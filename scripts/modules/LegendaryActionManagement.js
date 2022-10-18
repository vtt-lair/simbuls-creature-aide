import { logger } from '../../../simbuls-athenaeum/scripts/logger.js';
import { MODULE } from '../module.js';
import { HELPER } from '../../../simbuls-athenaeum/scripts/helper.js';
import { ActionDialog } from '../../../simbuls-athenaeum/scripts/apps/action-dialog.js'
import { queueUpdate } from '../../../simbuls-athenaeum/scripts/update-queue.js';

const NAME = "LegendaryActionManagement";

/** @todo need to support an array of actors, not just a single one */
class LegendaryActionDialog extends ActionDialog {

  /** @override */
  constructor(combatants) {
    
    /* Localize title */
    const title = HELPER.format("DND5E.LegAct");

    /* construct an action dialog using only legendary actions */
    super(combatants, {legendary: true, title, id:'legact-action-dialog'});
  }

}


/**
 * LegendaryActionManagement
 *  This Module strictly manages Legendary action economy per the dnd5e rules.
 */
export class LegendaryActionManagement {
    /** @public */
    static register(){
        this.settings();
        this.hooks();
    }

    /** @public */
    static settings(){
        const config = false;
        const settingsData = {
            legendaryActionRecharge : {
                scope : "world", config, group: "legendary", default: false, type: Boolean,
            },
            legendaryActionHelper : {
                scope : "world", config, group: "legendary", default: false, type: Boolean,
            }
        };

        MODULE.applySettings(settingsData);
    }

    /** @public */
    static hooks() {
        Hooks.on('createCombatant', LegendaryActionManagement._createCombatant);
        Hooks.on('updateCombat', LegendaryActionManagement._updateCombat);
    }

    /**
     * Check Combatant for Legendary Actions, store information on the combat.
     *  actorid, [itemid], 
     * 
     * @param {Combatant} combatant 
     */
    static _createCombatant(combatant) {
        /* do not run if not the first GM, but always flag regardless of enable state */
        if (!HELPER.isFirstGM()) return;

        const hasLegendary = !!combatant.actor?.items.find((i) => i.system?.activation?.type === "legendary")

        /* flag this combatant as a legendary actor for quick filtering */
        if (hasLegendary) {
            logger.debug(MODULE.data.name, `${NAME} | flagging as legendary combatant: ${combatant.name}`, combatant);
            queueUpdate( async () => await combatant.setFlag(MODULE.data.name, 'hasLegendary', true) )
        }
    }

    /** @private */
    /* 
    * @param {*} combat 
    * @param {*} changed 
    * @returns 
    */
    static _updateCombat(combat, changed) {
        /* do not run if not the first GM or the feature is not enabled */
        if (!HELPER.isFirstGM()) return;

        /* only trigger legendary actions on a legit turn change */
        if (!HELPER.isTurnChange(combat, changed)) return;

        const previousId = combat.previous?.combatantId;

        /* run the leg action helper dialog if enabled */
        if (HELPER.setting(MODULE.data.name, 'legendaryActionHelper')) {
            /* Collect legendary combatants (but not the combatant whose turn just ended) */
            let legendaryCombatants = combat.combatants.filter( combatant => combatant.getFlag(MODULE.data.name, 'hasLegendary') && combatant.id != previousId );

            /* only prompt for actions from alive creatures with leg acts remaining */
            legendaryCombatants = legendaryCombatants.filter( combatant => getProperty(combatant.actor, 'system.resources.legact.value') ?? 0 > 0 );
            legendaryCombatants = legendaryCombatants.filter( combatant => getProperty(combatant.actor, 'system.attributes.hp.value') ?? 0 > 0 );

            /* send list of combantants to the action dialog subclass */
            if (legendaryCombatants.length > 0) {
                LegendaryActionManagement.showLegendaryActions(legendaryCombatants);
            }
        }

        /* recharge the legendary actions, if enabled */
        if (HELPER.setting(MODULE.data.name, 'legendaryActionRecharge')) {

            /* once the dialog for the "in-between" turn has been rendered, recharge legendary actions
            * for the creature whose turn just ended. This is not entirely RAW, but due to order
            * of operations it must be done 'late'. Since a creature cannot use a legendary
            * action at the end of its own turn, nor on its own turn, recharging at end of turn
            * rather than beginning of turn is functionally equivalent. */
            if (previousId) {

                /* does the previous combatant have legendary actions? */
                const previousCombatant = combat.combatants.get(previousId);
                if (!!previousCombatant?.getFlag(MODULE.data.name, 'hasLegendary')) {
                    LegendaryActionManagement.rechargeLegendaryActions(previousCombatant);
                }
            }
        }
    }

    /** @private */
    /*
    * Generates the action dialog for legendary actions 
    * @param {Array of Object} combatants
    */
    static showLegendaryActions(combatants) {
        new LegendaryActionDialog(combatants).render(true);
    }

    /** @private */
    /*
    * @param {Combatant} combatant
    *
    * @return {Actor5e} modified actor document
    */
    static rechargeLegendaryActions(combatant) {
        if (!combatant.actor || !combatant.token) {
            return;
        }

        let legact = getProperty(combatant.actor, 'system.resources.legact');

        /* does this creature have the legendary action counter? */
        if (!!legact && legact.value !== null) {
            /* only reset if needed */
            if (legact.value < legact.max) {
                ui.notifications.info(game.i18n.format("SCA.CombatLegendary_notification", {max: legact.max, tokenName: combatant.token.name}))

                /* send the reset update and sheet refresh */
                queueUpdate( async () => {
                    const newActor = await combatant.actor.update({'data.resources.legact.value': legact.max});
                    newActor.sheet.render(false);
                });
            }
        }

        return;
    }

}
