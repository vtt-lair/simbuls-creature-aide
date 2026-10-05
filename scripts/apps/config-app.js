import { MODULE } from "../module.js";
import { HELPER } from "../../../simbuls-athenaeum/scripts/helper.js";
import { logger } from "../../../simbuls-athenaeum/scripts/logger.js";

export class HelpersSettingsConfig extends foundry.applications.settings.SettingsConfig {
    
    constructor(options = {}){
        const { subModule = null, subMenuId = null, groupLabels = HelpersSettingsConfig.defaultGroupLabels, parentMenu = null, ...appOpts } = options;
        super(appOpts);
        this.options = this.options || {};
        this.options.subModule = subModule;
        this.options.groupLabels = groupLabels;
        this.options.subMenuId = subMenuId;
        this.options.parentMenu = parentMenu;
    }

    static _menus = new Collection();
    static get menus() { return HelpersSettingsConfig._menus; }
    get menus() { return HelpersSettingsConfig.menus; }

    static DEFAULT_OPTIONS = {
        id : "creature-aide-client-settings",
        window: { title: "Helpers" },
        position: { width : 600, height : "auto" },
    };

    static PARTS = {
        main: {
            template: `/modules/simbuls-athenaeum/templates/ModularSettings.html`
        }
    };

    static get defaultGroupLabels() {
        return {
            'regen': { faIcon: 'fas fa-tint', tabLabel: 'SCA.groupLabel.regen'},
            'recharge': { faIcon: 'fas fa-refresh', tabLabel: 'SCA.groupLabel.recharge'},
            'lair': { faIcon: 'fas fa-home', tabLabel: 'SCA.groupLabel.lair'},
            'legendary': { faIcon: 'fas fa-paw', tabLabel: 'SCA.groupLabel.legendary'},
            'undead': { faIcon: 'fas fa-heartbeat', tabLabel: 'SCA.groupLabel.undead'},
        }
    }

    _onClickReturn(event) {
        event.preventDefault();
        const menu = game.settings.menus.get('simbuls-creature-aide.helperOptions');
        if ( !menu ) return ui.notifications.error("No parent menu found");
        const app = new menu.type();
        return app.render({ force: true });
    }

    async _onSubmitForm(config, event) {
        const formData = await super._onSubmitForm(config, event);
        if( this.options.subMenuId ){
            await this._onClickReturn(event);
        }
        return formData;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const returnBtn = this.element.querySelector('button[name="return"]');
        if (returnBtn) returnBtn.addEventListener('click', this._onClickReturn.bind(this));
    }

    async _prepareContext(options) {
        const canConfigure = game.user.can("SETTING_MODIFY") || game.user.can("SETTINGS_MODIFY");
        const settings = Array.from(game.settings.settings);

        let data = {
            title: HELPER.format('SCA.ConfigApp.title'),
            tabs: foundry.utils.duplicate(this.options.groupLabels),
            hasParent: !!this.options.subMenuId,
            parentMenu: this.options.parentMenu
        };

        const registerTabSetting = (tabName) => {
            if (!data.tabs[tabName].settings) data.tabs[tabName].settings = [];
        }

        const registerTabMenu = (tabName) => {
            if (!data.tabs[tabName].menus) data.tabs[tabName].menus = [];
        }

        for (let [_, setting] of settings.filter(([_, setting]) => setting.namespace == MODULE.data.name)) {
            if (!setting.config) {
                if (!canConfigure && setting.scope !== "client") continue;
                setting.group = data.tabs[setting.group] ? setting.group : 'misc'

                registerTabSetting(setting.group);
                let groupTab = data.tabs[setting.group] ?? false;
                
                if(groupTab) groupTab.settings.push({
                    ...setting,
                    type : setting.type instanceof Function ? setting.type.name : "String",
                    isCheckbox : setting.type === Boolean,
                    isSelect : setting.choices !== undefined,
                    isRange : setting.type === Number && setting.range,
                    value : HELPER.setting(MODULE.data.name, setting.key),
                    path: `${setting.namespace}.${setting.key}`
                });
            } 
        }

        const childMenus = this.menus.filter( menu => menu.parentMenu == this.options.subMenuId )
        childMenus.forEach( menu => {
            registerTabMenu(menu.tab);
            let groupTab = data.tabs[menu.tab] ?? false;
            if(groupTab) groupTab.menus.push(menu);
        });

        data.tabs = Object.entries(data.tabs).reduce( (acc, [name, val]) => {
            if(!!val.settings || !!val.menus) acc[name] = val;
            return acc;
        }, {})

        logger.debug(game.settings.get(MODULE.data.name, "debug"), `${MODULE.data.name} | GET DATA | DATA | `, data);

        return {
            user : game.user, canConfigure, systemTitle : game.system.title, data
        }
    }
}