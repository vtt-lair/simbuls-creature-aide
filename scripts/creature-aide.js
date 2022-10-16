/**
 * Main Module Organizational Tools
 */
import { MODULE } from './module.js';
import { logger } from './logger.js';

/**
 * Sub Modules
 */
import { AbilityRecharge } from './modules/AbilityRecharge.js';
import { LegendaryActionManagement } from './modules/LegendaryActionManagement.js';
import { LairActionManagement } from './modules/LairActionManagement.js';
import { Regeneration } from './modules/Regeneration.js';

const SUB_MODULES = {
    MODULE,
    logger,
    AbilityRecharge,
    LegendaryActionManagement,
    LairActionManagement,
    Regeneration
};

/*
  Initialize Module
*/
MODULE.build();

/*
  Initialize all Sub Modules
*/
Hooks.on(`setup`, () => {
    Object.values(SUB_MODULES).forEach(cl => cl.register());
    Hooks.callAll('npcactionsReady', {MODULE, logger});
});
