import { logger } from '../../../simbuls-athenaeum/scripts/logger.js';
import { MODULE } from '../module.js';
import { HELPER } from '../../../simbuls-athenaeum/scripts/helper.js';
import { ActionDialog } from '../../../simbuls-athenaeum/scripts/apps/action-dialog.js'
import { queueUpdate } from '../../../simbuls-athenaeum/scripts/update-queue.js';

const NAME = "LairActionManagement";

/** @todo need to support an array of actors, not just a single one */
class LairActionDialog extends ActionDialog {
    /** @override */
    constructor(combatants) {
        /* Localize title */
        const title = HELPER.format("DND5E.LairActionLabel");

        /* construct an action dialog using only legendary actions */
        super(combatants, {lair: true, title, id: 'lairact-action-dialog'});
    }
}


/**
 * LegendaryActionManagement
 *  This Module strictly manages Legendary action economy per the dnd5e rules.
 */
export class LairActionManagement {

    static register(){
        this.settings();
        this.hooks();
    }

    static settings(){
        const config = false;
        const settingsData = {
            lairActionHelper : {
                scope : "world", config, group: "lair", default: 0, type: Boolean,
            }
        };

        MODULE.applySettings(settingsData);
    }

    static hooks() {
        Hooks.on('createCombatant', LairActionManagement._createCombatant);

        Hooks.on('updateCombat', LairActionManagement._updateCombat);
    }

    /**
     * Check Combatant for Lair Actions, store information on the combat.
     *  actorid, [itemid], 
     * 
     * @param {Combatant} combatant 
     */
    static _createCombatant(combatant) {

        /* do not run if not the first GM or the feature is not enabled */
        if (!HELPER.isFirstGM() || !HELPER.setting(MODULE.data.name, 'lairActionHelper')) return;

        const usesLair = getProperty(combatant, "actor.system.resources.lair.value");
        const hasLairAction = !!combatant.actor?.items.find((i) => i.system?.activation?.type === "lair");

        /* flag this combatant as a lair actor for quick filtering */
        if (usesLair && hasLairAction) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | flagging as combatant that has lair: ${combatant.name}`, combatant);
            queueUpdate( async () => await combatant.setFlag(MODULE.data.name, 'hasLair', true) );
        }

    }

    /**
     * 
     * @param {*} combat 
     * @param {*} changed 
     */
    static _updateCombat(combat, changed) {

        /* do not run if not the first GM or the feature is not enabled */
        if (!HELPER.isFirstGM() || !HELPER.setting(MODULE.data.name, 'lairActionHelper')) return;

        /* only trigger lair actions on a legit turn change */
        if (!HELPER.isTurnChange(combat, changed)) return;

        const allLairCombatants = combat.combatants.filter( combatant => combatant.getFlag(MODULE.data.name, 'hasLair') );

        
        const previousId = combat.previous?.combatantId;
        const currentId = combat.current?.combatantId;
        
        let previousInit = combat.combatants.get(previousId).initiative;
        const currentInit = combat.combatants.get(currentId).initiative;

        /* check if we have wrapped around and simulate its previous initiative */

        /* lair init should be inside this range or outside? */
        const inside = previousInit - currentInit >= 0; 

        const containsLair = (combatant) => {
            const init = combatant.actor.system.resources.lair.initiative

            return previousInit >= init && init > currentInit;
        }

        const excludesLair = (combatant) => {
            const init = combatant.actor.system.resources.lair.initiative

            return init > currentInit || init <= previousInit;
        }

        const hasHp = (combatant) => {
            return getProperty(combatant.actor, 'system.attributes.hp.value') ?? 0 > 0;
        }

        const filterCondition = inside ? containsLair : excludesLair;

        //const triggeredLairInits = allLairCombatants.filter( combatant => correctDirection(combatant) && lairCloser(combatant) && hasHp(combatant) );
        const triggeredLairInits = allLairCombatants.filter( combatant => filterCondition(combatant) && hasHp(combatant) );

        /* send list of combantants to the action dialog subclass */
        if (triggeredLairInits.length > 0) {
            LairActionManagement.showLairActions(triggeredLairInits);
        }

    }

    /** @private */
    /*
    * Generates the action dialog for legendary actions 
    * @param {Array of Object} combatants
    */
    static showLairActions(combatants) {
        new LairActionDialog(combatants).render(true);
    }
}
