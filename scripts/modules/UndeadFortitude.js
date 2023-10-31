import { logger } from '../../../simbuls-athenaeum/scripts/logger.js';
import { MODULE } from '../module.js';
import { HELPER } from '../../../simbuls-athenaeum/scripts/helper.js';
import { queueUpdate } from '../../../simbuls-athenaeum/scripts/update-queue.js';

const NAME = "UndeadFortitude";

export class UndeadFortitude {

    static register() {
        logger.info(MODULE.data.name, "Registering Undead Fortitude");
        UndeadFortitude.settings();
        UndeadFortitude.defaults();
        UndeadFortitude.hooks();
    }

    static settings() {
        const config = false;
        const settingsData = {
            undeadFortEnable: {
                scope: "world", config, group: "undead", default: 0, type: Number,
                choices: {
                    0: game.i18n.format("option.undeadFort.none"),
                    1: game.i18n.format("option.undeadFort.quick"),
                    2: game.i18n.format("option.undeadFort.advanced"),
                },
            },
            undeadFortDamageTypes: {
                scope: "world", config, group: "undead", default: "Radiant", type: String,
            },
            undeadFortName: {
                scope: "world", config, group: "undead", default: "Undead Fortitude", type: String,
            },
            undeadFortDC: {
                scope: "world", config, group: "undead", default: 5, type: Number,
            },
        };

        MODULE.applySettings(settingsData);

        CONFIG.DND5E.characterFlags.helpersUndeadFortitude = {
            hint: HELPER.localize("SCA.flagsUndeadFortitudeHint"),
            name: HELPER.localize("SCA.flagsUndeadFortitude"),
            section: "Feats",
            default:false,
            type: Boolean
        };    
    }
  

    static defaults() {
        MODULE[NAME] = {
            hpThreshold: 0,
        }
    }

    static hooks() {
        Hooks.on('preUpdateActor', UndeadFortitude._preUpdateActor);
    }

    /* for a pre hook, the initiating user can handle updates
    * as they have initiated this update already.
    */
    static _preUpdateActor(actor, update, options) {
        /* bail if not enabled */
        if (!(HELPER.setting(MODULE.data.name, 'undeadFortEnable') > 0)) return;

        /* bail if HP isnt being modified */
        if ( getProperty(update, "system.attributes.hp.value") == undefined ) return;

        /* Bail if the actor does not have undead fortitude and the flag is not set to true (shakes fist at double negatives)*/
        if (!actor.items.getName(HELPER.setting(MODULE.data.name, "undeadFortName")) && !actor.getFlag("dnd5e","helpersUndeadFortitude")) return;

        /* collect the needed information and pass it along to the handler */ 
        const originalHp = actor.system.attributes.hp.value;
        const finalHp = getProperty(update, "system.attributes.hp.value") ?? originalHp;
        
        // default the damage to this calculation
        let hpDelta = originalHp - finalHp;
        // if you have midi-QOL then you'll have the applied damage
        if (options.damageItem) {
            hpDelta = options.damageItem.appliedDamage
        }
        

        const data = {
            actor,
            finalHp,
            hpDelta,
            ignoredDamageTypes: HELPER.setting(MODULE.data.name, 'undeadFortDamageTypes'),
            baseDc: HELPER.setting(MODULE.data.name, 'undeadFortDC'),
            skipCheck: options.skipUndeadCheck,
        };

        logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} data`, data);

        UndeadFortitude.runSave(data, options);
    }

    /* Decides which save type to run, should it proc, and handles rolling.
    *
    * param {Object} data = {actor, finalHp, hpDelta}
    */
    static async runSave(data, options = {}) {

        /* we have been requested to run the save, check threshold DC */
        if (data.finalHp > MODULE[NAME].hpThreshold) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Actor has feat, but hasnt hit the threshold`);
            return;
        }

        if (options.skipUndeadCheck){
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Skipped undead fortitude check via options`);
            return;
        }

        /* get the DC */
        const mode = HELPER.setting(MODULE.data.name, 'undeadFortEnable')

        queueUpdate( async () => {
            const saveInfo = await UndeadFortitude._getUndeadFortitudeSave(data, options, mode === 2 ? true : false ); 
            const speaker = ChatMessage.getSpeaker({actor: data.actor, token: data.actor.token});
            const whisper = game.users.filter(u => u.isGM).map(u => u.id)
            let content = '';

            /* assume the actor fails its save automatically (i.e. rollSave == false) */
            let hasSaved = false;
            let messageName = data.actor.token?.name ?? data.actor.name // Take the token name or if that fails like for linked tokens fall back to the actor name

            if (saveInfo.rollSave) {
                /* but roll the save if we need to and check */
                const result = (await data.actor.rollAbilitySave('con', {flavor: `${HELPER.setting(MODULE.data.name, 'undeadFortName')} - DC ${saveInfo.saveDc}`, rollMode: 'gmroll'})).total;

                /* check for unexpected roll outputs (like BetterRolls) and simply output information
                * note: result == null _should_ account for result === undefined as well.
                */       
                if (result == null) {
                    logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Could not parse result of constitution save. Echoing needed DC instead.`);
          
                    content = HELPER.format('SCA.UndeadFort_failsafe', {tokenName: messageName, dc: saveInfo.saveDc});
                } else {

                    /* Otherwise, the roll result we got was valid and usable, so do the calculations ourselves */
                    hasSaved = result >= saveInfo.saveDc;

                    if (hasSaved) {
                        /* they saved, report and restore to 1 HP */
                        content = HELPER.format("SCA.UndeadFort_surivalmessage", { tokenName: messageName, total: result });
                        await data.actor.update({'data.attributes.hp.value': 1});
                    } else {
                        /* rolled and failed, but not instantly via damage type */
                        content = HELPER.format("SCA.UndeadFort_deathmessage", { tokenName: messageName, total: result });
                    }
                }
            } else {
                /* this is an auto-fail due to damage type, do not update remain at 0 */
                content = HELPER.format("SCA.UndeadFort_insantdeathmessage", { tokenName: messageName});
            } 

            await ChatMessage.create({content, speaker, whisper });
        });
    }

    static async _getUndeadFortitudeSave(data, options, fullCheck = false) {

        let saveInfo = {};
        if (fullCheck) {
            /* full check where we ask for the total damage */
            saveInfo = await UndeadFortitude.fullCheck(data, options);
        } else {
            /* quick check (no spillover) */
            saveInfo = await UndeadFortitude.quickCheck(data, options);
        }

        logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} undead fort. info:`, saveInfo);
        return saveInfo;
    }

    static checkRadiantCritical(options, ignoredDamageTypes) {
        if (!options.damageItem) return false;        
        if (options.damageItem.critical) return true;

        for (let di of options.damageItem.damageDetail) {
            for (let did of (di ?? [])) {
                if (ignoredDamageTypes.toLowerCase().indexOf(did.type) > -1) return true;
            }
        }
        return false;
    }

    static quickCheck(data, options) {
        if (game.modules.get("midi-qol")?.active) {
            if (UndeadFortitude.checkRadiantCritical(options, data.ignoredDamageTypes)) {
                return { rollSave: false, saveDC: 0 };
            } else {
                return { rollSave: true, saveDc: data.baseDc + data.hpDelta };
            }
        } else {
            return HELPER.buttonDialog({
                title: HELPER.localize("SCA.UndeadFort_dialogname"),
                content: HELPER.localize("SCA.UndeadFort_quickdialogcontent"),
                buttons: [{
                    label: HELPER.format("SCA.UndeadFort_quickdialogprompt1", { types: data.ignoredDamageTypes }),
                    value: { rollSave: false, saveDc: 0 }
                }, {
                    label: HELPER.localize("SCA.UndeadFort_quickdialogprompt2"),
                    value: { rollSave: true, saveDc: data.baseDc + data.hpDelta },
                }],
            });
        }        
    }

    static fullCheck(data, options) {
        const ignoredDamageTypes = data.ignoredDamageTypes;
        if (data.skipUndeadCheck) return;

        let damageQuery = HELPER.format("SCA.UndeadFort_slowdialogcontentquery")
        let content = `
            <form>
                <div class="form-group">
                    <label for="num">${damageQuery}</label>
                    <input id="num" name="num" type="number" min="0" value="${data.hpDelta}"></input>
                </div>
            </form>
        `;
    
        return new Promise( async (resolve) => {
            let dialog = new Dialog({
                title: HELPER.format("SCA.UndeadFort_dialogname"),
                content: content,
                buttons: {
                    one: {
                        label: HELPER.format("SCA.UndeadFort_quickdialogprompt1", { types: ignoredDamageTypes }),
                        callback: () => resolve({rollSave: false, saveDc: 0})
                    },
                    two: {
                        label: HELPER.format("SCA.UndeadFort_quickdialogprompt2"),
                        callback: (html) => {
                            const totalDamage = Number(html.find("#num")[0].value); 
                            return resolve({ rollSave: true, saveDc: data.baseDc + totalDamage})
                        },
                    },
                },
            });

            dialog.render(true);
        });
    }
}

  
