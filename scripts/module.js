import { logger } from './logger.js';
import { HelpersSettingsConfig } from './apps/config-app.js';

const NAME = "simbuls-creature-aide";
const PATH = `/modules/${NAME}`;
const TITLE = "Simbul's Creature Aide";


/**
 * @class
 * @property {Function} patch
 */
export class MODULE{
    static async register(){
        logger.info("Initializing Module");
        MODULE.globals();
        MODULE.settings();
    }

    static async build(){
        MODULE.data = {
            name : NAME, path : PATH, title : TITLE
        };
    }

    static globals() {
        game.dnd5e.npcactions = {};
    }

    static settings() {
        game.settings.registerMenu(MODULE.data.name, "helperOptions", {
            name : MODULE.format("setting.ConfigOption.name"),
            label : MODULE.format("setting.ConfigOption.label"),
            icon : "fas fa-user-cog",
            type : HelpersSettingsConfig,
            restricted : false,
        });
    }

    /**
     * @returns any
     */
    static setting(key){
        return game.settings.get(MODULE.data.name, key);
    }

    static localize(...args){
        return game.i18n.localize(...args);
    }

    static format(...args){
        return game.i18n.format(...args);
    }

    static applySettings(settingsData){
        Object.entries(settingsData).forEach(([key, data])=> {
            game.settings.register(
                MODULE.data.name, key, {
                    name : MODULE.localize(`setting.${key}.name`),
                    hint : MODULE.localize(`setting.${key}.hint`),
                    ...data
                }
            );
        });
    }

    static isTurnChange(combat, changed){
        /* we need a turn change or a round change to consider this a live combat */
        const liveCombat = !!combat.started && (("turn" in changed) || ('round' in changed));
        const anyCombatants = (combat.combatants.size ?? 0) !== 0;
        const notFirstTurn = !(((changed.turn ?? undefined) === 0) && (changed.round ?? 0) === 1)
    
        return liveCombat && anyCombatants && notFirstTurn;
    }

    static isFirstTurn(combat, changed){
        return combat.started && changed.round === 1;
    }
    
    static firstGM(){
        return game.users.find(u => u.isGM && u.active);
    }
    
    static isFirstGM(){
        return game.user.id === MODULE.firstGM()?.id;
    }

    /*
    * Helper function for quickly creating a simple dialog with labeled buttons and associated data. 
    * Useful for allowing a choice of actors to spawn prior to `warpgate.spawn`.
    *
    * @param `data` {Array of Objects}: Contains two keys `label` and `value`. Label corresponds to the 
    *     button's text. Value corresponds to the return value if this button is pressed. Ex. 
    *     `const data = buttons: [{label: 'First Choice, value: {token {name: 'First'}}, {label: 'Second Choice',
    *         value: {token: {name: 'Second}}}]`
    * @param `direction` {String} (optional): `'column'` or `'row'` accepted. Controls layout direction of dialog.
    */
    static async buttonDialog(data, direction = 'row') {
        return await new Promise(async (resolve) => {
            let buttons = {}, dialog;

            data.buttons.forEach((button) => {
                buttons[button.label] = {
                    label: button.label,
                    callback: () => resolve(button.value)
                }
            });

            dialog = new Dialog({
                title: data.title,
                content: data.content,
                buttons,
                close: () => resolve("Exit, No Button Click")
            }, {
                /*width: '100%',*/ height: '100%' 
            });

            await dialog._render(true);
            dialog.element.find('.dialog-buttons').css({'flex-direction': direction});
        });
  }
}
