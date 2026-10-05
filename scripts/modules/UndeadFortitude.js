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
        MODULE[NAME] = { hpThreshold: 0 }
    }

    static hooks() {
        Hooks.on('preUpdateActor', UndeadFortitude._preUpdateActor);
    }

    static _preUpdateActor(actor, update, options) {
        if (!(HELPER.setting(MODULE.data.name, 'undeadFortEnable') > 0)) return;
        if (foundry.utils.getProperty(update, "system.attributes.hp.value") == undefined ) return;
        if (!actor.items.getName(HELPER.setting(MODULE.data.name, "undeadFortName")) && !actor.getFlag("dnd5e","helpersUndeadFortitude")) return;

        const originalHp = actor.system.attributes.hp.value;
        const finalHp = foundry.utils.getProperty(update, "system.attributes.hp.value") ?? originalHp;
        
        let hpDelta = originalHp - finalHp;
        if (originalHp === 0 && finalHp === 0) return;

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

    static async runSave(data, options = {}) {
        if (data.finalHp > MODULE[NAME].hpThreshold) {
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Actor has feat, but hasnt hit the threshold`);
            return;
        }

        if (options.skipUndeadCheck){
            logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Skipped undead fortitude check via options`);
            return;
        }

        const mode = HELPER.setting(MODULE.data.name, 'undeadFortEnable')

        queueUpdate( async () => {
            const saveInfo = await UndeadFortitude._getUndeadFortitudeSave(data, options, mode === 2 ? true : false ); 
            const speaker = ChatMessage.getSpeaker({actor: data.actor, token: data.actor.token});
            const whisper = game.users.filter(u => u.isGM).map(u => u.id)
            let content = '';

            let hasSaved = false;
            let messageName = data.actor.token?.name ?? data.actor.name;

            if (saveInfo.rollSave) {
                const result = (await data.actor.rollAbilitySave('con', {flavor: `${HELPER.setting(MODULE.data.name, 'undeadFortName')} - DC ${saveInfo.saveDc}`, rollMode: 'gmroll'})).total;
      
                if (result == null) {
                    logger.debug(game.settings.get(MODULE.data.name, "debug"), `${NAME} | Could not parse result of constitution save. Echoing needed DC instead.`);
                    content = HELPER.format('SCA.UndeadFort_failsafe', {tokenName: messageName, dc: saveInfo.saveDc});
                } else {
                    hasSaved = result >= saveInfo.saveDc;
                    if (hasSaved) {
                        content = HELPER.format("SCA.UndeadFort_surivalmessage", { tokenName: messageName, total: result });
                        await data.actor.update({'system.attributes.hp.value': 1});
                    } else {
                        content = HELPER.format("SCA.UndeadFort_deathmessage", { tokenName: messageName, total: result });
                    }
                }
            } else {
                content = HELPER.format("SCA.UndeadFort_insantdeathmessage", { tokenName: messageName});
            } 

            await ChatMessage.create({content, speaker, whisper });
        });
    }

    static async _getUndeadFortitudeSave(data, options, fullCheck = false) {
        let saveInfo = {};
        if (fullCheck) {
            saveInfo = await UndeadFortitude.fullCheck(data, options);
        } else {
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
    
        return foundry.applications.api.DialogV2.wait({
            window: { title: HELPER.format("SCA.UndeadFort_dialogname") },
            content: content,
            buttons: [
                {
                    action: "one",
                    label: HELPER.format("SCA.UndeadFort_quickdialogprompt1", { types: ignoredDamageTypes }),
                    callback: () => ({rollSave: false, saveDc: 0})
                },
                {
                    action: "two",
                    label: HELPER.format("SCA.UndeadFort_quickdialogprompt2"),
                    callback: (event, button, dialog) => {
                        const totalDamage = Number(dialog.querySelector("#num").value); 
                        return { rollSave: true, saveDc: data.baseDc + totalDamage };
                    },
                }
            ]
        });
    }
}