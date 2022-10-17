import { logger } from '../../../simbuls-athenaeum/scripts/logger.js';
import { MODULE } from '../module.js';
import { HELPER } from '../../../simbuls-athenaeum/scripts/helper.js';
import { queueUpdate } from '../../../simbuls-athenaeum/scripts/update-queue.js';

const NAME = "AbilityRecharge";

export class AbilityRecharge {
    static register(){
        logger.info(MODULE.data.name, "Registering In-Combat Ability Recharge");
        AbilityRecharge.settings();
        AbilityRecharge.hooks();
    }

    static settings() {
        const config = false;
        const settingsData = {
        abilityRecharge : {
            scope : "world", config, group: "recharge", default: 0, type: Number,
            choices : {
                0 : HELPER.localize("option.arOption.Off"),
                1 : HELPER.localize("option.arOption.Start"),
                2 : HELPER.localize("option.arOption.End"),
            }
        },
        hideAbilityRecharge : {
            scope : "world", config, group: "recharge", default: false, type: Boolean,
        }
        };

        MODULE.applySettings(settingsData);
    }

    static hooks() {
        Hooks.on("updateCombat", AbilityRecharge._updateCombat);
    }

    static _updateCombat(combat, changed) {

        const setting = HELPER.setting(MODULE.data.name, 'abilityRecharge');

        /** bail out if disabled */
        if( setting == 0 ) return;

        /** only want the GM to operate and only on a legitimate turn change */
        if (!HELPER.isTurnChange(combat, changed) || !HELPER.isFirstGM()) return;

        /** get the turn of interest */
        const next = combat.combatants.get(combat.current.combatantId);
        const previous = combat.combatants.get(combat.previous.combatantId);

        const turn = setting === 1 ? next : setting === 2 ? previous : null;

        const token = turn?.token?.object;

        if (token) AbilityRecharge._recharge(token);
    }

    static _recharge(token) {
        const rechargeItems = AbilityRecharge._collectRechargeItems(token);

        /** can do this inside a for each because of update-queue! yay! */
        rechargeItems.forEach(AbilityRecharge._rollRecharge);
    }

    static _needsRecharge(recharge = { value: 0, charged: false }) {
        return (recharge.value !== null &&
            (recharge.value > 0) &&
            recharge.charged !== null &&
            recharge.charged == false);
    }

    static _collectRechargeItems(token) {
        const rechargeItems = token.actor?.items.filter(e => AbilityRecharge._needsRecharge(e.system.recharge)) ?? [];

        return rechargeItems;
    }

    static _rollRecharge(item) {
        const data = item.system;
        if (!data.recharge.value) return;

        queueUpdate(async () => {
            // Roll the check
            const roll = await(new Roll("1d6").evaluate({async: true}));
            const success = roll.total >= parseInt(data.recharge.value);
            const rollMode = HELPER.setting(MODULE.data.name, "hideAbilityRecharge") == true ? "blindroll" : "";

            // Display a Chat Message
            // @todo rollMode is not being respected...
            await roll.toMessage(
                {
                    flavor: `${game.i18n.format("DND5E.ItemRechargeCheck", {name: item.name})} - ${game.i18n.localize(success ? "DND5E.ItemRechargeSuccess" : "DND5E.ItemRechargeFailure")}`,
                    speaker: ChatMessage.getSpeaker({actor: item.actor, token: item.actor.token}),
                },
                {
                    rollMode
                }
            );

            // Update the Item data
            if (success) await item.update({"system.recharge.charged": true});

            return;
        });
    }
}
