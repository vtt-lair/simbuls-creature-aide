import { logger } from '../../../simbuls-athenaeum/scripts/logger.js';
import { MODULE } from '../module.js';
import { HELPER } from '../../../simbuls-athenaeum/scripts/helper.js';
import { ActionDialog } from '../../../simbuls-athenaeum/scripts/apps/action-dialog.js'
import { queueUpdate } from '../../../simbuls-athenaeum/scripts/update-queue.js';

const NAME = "LegendaryActionManagement";

class LegendaryActionDialog extends ActionDialog {
  constructor(combatants) {
    const title = HELPER.format("DND5E.LegAct");
    super(combatants, {legendary: true, window: { title: title }, id:'legact-action-dialog'});
  }
}

export class LegendaryActionManagement {
    static register(){
        this.settings();
        this.hooks();
    }

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

    static hooks() {
        Hooks.on('createCombatant', LegendaryActionManagement._createCombatant);
        Hooks.on('updateCombat', LegendaryActionManagement._updateCombat);
    }

    static _createCombatant(combatant) {
        if (!HELPER.isFirstGM()) return;

        const hasLegendary = !!combatant.actor?.items.find((i) => i.system?.activation?.type === "legendary")

        if (hasLegendary) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | flagging as legendary combatant: ${combatant.name}`, combatant);
            queueUpdate( async () => await combatant.setFlag(MODULE.data.name, 'hasLegendary', true) )
        }
    }

    static _updateCombat(combat, changed) {
        if (!HELPER.isFirstGM()) return;
        if (!HELPER.isTurnChange(combat, changed)) return;

        const previousId = combat.previous?.combatantId;

        if (HELPER.setting(MODULE.data.name, 'legendaryActionHelper')) {
            let legendaryCombatants = combat.combatants.filter( combatant => combatant.getFlag(MODULE.data.name, 'hasLegendary') && combatant.id != previousId );

            legendaryCombatants = legendaryCombatants.filter( combatant => foundry.utils.getProperty(combatant.actor, 'system.resources.legact.value') ?? 0 > 0 );
            legendaryCombatants = legendaryCombatants.filter( combatant => foundry.utils.getProperty(combatant.actor, 'system.attributes.hp.value') ?? 0 > 0 );

            if (legendaryCombatants.length > 0) {
                LegendaryActionManagement.showLegendaryActions(legendaryCombatants);
            }
        }

        if (HELPER.setting(MODULE.data.name, 'legendaryActionRecharge')) {
            if (previousId) {
                const previousCombatant = combat.combatants.get(previousId);
                if (!!previousCombatant?.getFlag(MODULE.data.name, 'hasLegendary')) {
                    LegendaryActionManagement.rechargeLegendaryActions(previousCombatant);
                }
            }
        }
    }

    static showLegendaryActions(combatants) {
        new LegendaryActionDialog(combatants).render({ force: true });
    }

    static rechargeLegendaryActions(combatant) {
        if (!combatant.actor || !combatant.token) {
            return;
        }

        let legact = foundry.utils.getProperty(combatant.actor, 'system.resources.legact');

        if (!!legact && legact.value !== null) {
            if (legact.value < legact.max) {
                ui.notifications.info(game.i18n.format("SCA.CombatLegendary_notification", {max: legact.max, tokenName: combatant.token.name}))

                queueUpdate( async () => {
                    const newActor = await combatant.actor.update({'system.resources.legact.value': legact.max});
                    newActor.sheet.render(false);
                });
            }
        }
        return;
    }
}