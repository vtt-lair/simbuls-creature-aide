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
        if( setting == 0 ) return;
        if (!HELPER.isTurnChange(combat, changed) || !HELPER.isFirstGM()) return;

        const next = combat.combatants.get(combat.current.combatantId);
        const token = next.token?.object;

        if(!token) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Could not find a valid token in the upcoming turn.`);
            return;
        }

        const feature = Regeneration._getRegenFeature(token.actor);

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

        const regenBlockName = HELPER.setting(MODULE.data.name, "regenBlock");
        const blockEffect = actor.effects?.find(e => e.name === regenBlockName );
        const enabledBlockEffect = !(foundry.utils.getProperty(blockEffect ?? {}, 'disabled') ?? true);

        if (enabledBlockEffect) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | ${actor.name}'s regeneration blocked by ${blockEffect.name}`);
            return null;
        }

        const regenName = game.i18n.format("SCA.AutoRegen_Regneration")
        const selfRepairName = game.i18n.format("SCA.AutoRegen_SelfRepair")

        const regen = actor.items.find(i => i.name === regenName || i.name === selfRepairName);
        return regen;
    }

    static _getActorHP(actor) {
        const actorHP = foundry.utils.getProperty(actor, 'system.attributes.hp');
        return actorHP;
    }

    static _parseRegenFeature(item) {
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
            const rollObject = await new Roll(regen).evaluate();
            let regenRoll = rollObject.total;

            await token.actor.applyDamage(- regenRoll);

            await ChatMessage.create({
                content: game.i18n.format("SCA.AutoRegenDialog_healingmessage",
                {tokenName: token.name, regenRoll: regenRoll}),
                whisper: ChatMessage.getWhisperRecipients('gm').map(o => o.id)
            });
        });

        if (regen !== null) {
            foundry.applications.api.DialogV2.wait({
                window: { title: game.i18n.format("SCA.AutoRegenDialog_name", {tokenName: token.name}) },
                content: game.i18n.format("SCA.AutoRegenDialog_content", {tokenName: token.name, tokenHP: hp.value, actorMax: hp.max}),
                buttons: [
                    {
                        action: "one",
                        label: game.i18n.format("SCA.AutoRegenDialog_healingprompt", {regenAmout: regen}),
                        callback: rollRegenCallback
                    },
                    {
                        action: "two",
                        label: game.i18n.format("SCA.AutoRegenDialog_stopprompt")
                    }
                ]
            });
            return;
        }
    }
}