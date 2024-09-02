import { logger } from '../../../simbuls-athenaeum/scripts/logger.js';
import { MODULE } from '../module.js';
import { HELPER } from '../../../simbuls-athenaeum/scripts/helper.js';
import { queueUpdate } from '../../../simbuls-athenaeum/scripts/update-queue.js';

const NAME = "Regeneration";

export class Regeneration {

    static register() {
        logger.info(MODULE.data.name, "Registering Automatic Regeneration");
        Regeneration.settings();
        Regeneration.hooks();
    }

    static settings() {
        const config = false;
        const settingsData = {
            autoRegen : {
                scope : "world", config, group: "regen", default: 0, type: Boolean,
            },
            regenBlock : {
                scope : "world", config, group: "regen", default: HELPER.localize('SCA.regenBlock_default'), type: String,
            }
        };

        MODULE.applySettings(settingsData);

    }

    static hooks() {
        Hooks.on("updateCombat", Regeneration._updateCombat);
    }

    static _updateCombat(combat, changed) {

        const setting = HELPER.setting(MODULE.data.name, 'autoRegen');

        /** bail out if disabled */
        if( setting == 0 ) return;

        /** only want the GM to operate and only on a legitimate turn change */
        if (!HELPER.isTurnChange(combat, changed) || !HELPER.isFirstGM()) return;

        /** get the actor whose turn it just changed to */
        const next = combat.combatants.get(combat.current.combatantId);
        const token = next.token?.object;

        if(!token) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Could not find a valid token in the upcoming turn.`);
            return;
        }

        /** does the current actor have a regeneration feature? */
        const feature = Regeneration._getRegenFeature(token.actor);

        /** if we have a valid feature, and the token's HP is less than max run the regen process */
        var currentHP = token.document.actor.system.attributes.hp.value;
        var maxHP = token.document.actor.system.attributes.hp.max;
        if (feature && currentHP < maxHP) {
            Regeneration._executeRegen(token, feature);
        }

    }

    static _getRegenFeature(actor) {
        if(!actor) {
        logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Cannot regenerate a null actor`);
        return null;
        }

        /** before we check anything else, is regen blocked on this actor? */
        const regenBlockName = HELPER.setting(MODULE.data.name, "regenBlock");
        const blockEffect = actor.effects?.find(e => e.name ?? e.label === regenBlockName );
        const enabledBlockEffect = !(foundry.utils.getProperty(blockEffect ?? {}, 'disabled') ?? true);

        if (enabledBlockEffect) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | ${actor.name}'s regeneration blocked by ${blockEffect.name ?? blockEffect.label}`);
            return null;
        }

        /** Get the supported names of the regeneration feature */
        const regenName = game.i18n.format("SCA.AutoRegen_Regneration")
        const selfRepairName = game.i18n.format("SCA.AutoRegen_SelfRepair")

        /** search for this item in the actor */
        const regen = actor.items.find(i => i.name === regenName || i.name === selfRepairName);

        return regen;
    }

    static _getActorHP(actor) {
        const actorHP = foundry.utils.getProperty(actor, 'system.attributes.hp');
        return actorHP;
    }

    /* @private */
    static _parseRegenFeature(item) {

        /* @todo localize 'hit points'! */
        const hitPointsString = HELPER.localize("SCA.AutoRegen_HP");
        const regenRegExp = new RegExp(`([0-9]+|[0-9]*d0*[1-9][0-9]*) ${hitPointsString}`);
        let match = item.system.description.value.match(regenRegExp);

        if (!match) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Could not parse ${item.name}'s description for a regeneration value containing ${hitPointsString}`);
            return null;
        }

        return match[1];
    }

    static _executeRegen(token, feature) {

        const regen = Regeneration._parseRegenFeature(feature);

        if (!regen) return;

        const hp = Regeneration._getActorHP(token.actor);

        const rollRegenCallback = () => queueUpdate( async () => {

            /** roll the regen expression */
            const rollObject = await new Roll(regen).evaluate();
            let regenRoll = rollObject.total;

            /** apply the damage to the token */
            await token.actor.applyDamage(- regenRoll);

            /** echo results to chat */
            await ChatMessage.create({
                content: game.i18n.format("SCA.AutoRegenDialog_healingmessage",
                {tokenName: token.name, regenRoll: regenRoll}),
                whisper: ChatMessage.getWhisperRecipients('gm').map(o => o.id)
            });

        });


        //dialog choice to heal or not
        if (regen !== null) {
            new Dialog({
                title: game.i18n.format("SCA.AutoRegenDialog_name", {tokenName: token.name}),
                content: game.i18n.format("SCA.AutoRegenDialog_content", {tokenName: token.name, tokenHP: hp.value, actorMax: hp.max}),
                buttons: {
                    one: {
                        // @todo need to correct the type in 'regenAmout'
                        label: game.i18n.format("SCA.AutoRegenDialog_healingprompt", {regenAmout: regen}),
                        callback: rollRegenCallback
                    },
                    two: {
                        label: game.i18n.format("SCA.AutoRegenDialog_stopprompt"),
                    }
                }
            }).render(true);

            return;
        }

    }
}
