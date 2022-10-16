![Latest Release Download Count](https://img.shields.io/badge/dynamic/json?color=blue&label=Downloads%40latest&query=assets%5B1%5D.download_count&url=https%3A%2F%2Fapi.github.com%2Frepos%2Fvtt-lair%2Fsimbuls-creature-aide%2Freleases%2Flatest) [![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fsimbuls-creature-aide&colorB=4aa94a)](https://forge-vtt.com/bazaar#package=simbuls-creature-aide) 

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/N4N36ZSPQ)

# Simbul's Creature Aide
A Foundry VTT module that gives the GM the ability to:
## Legendary Actions
  - Prompts GM with available legendary actions in-between combatant turns. 
  - Tracks current available uses of legendary actions.
  - And reset the used legendary actions to their max on the end of their turn in combat.
    - Note: RAW indicates this should be at the beginning of their turn, but due to timing issues with the legendary action helper, this has been moved to the end of the turn and has no mechanical effect on gameplay.
    
## Lair Actions
  - Prompts GM with available Lair actions at the creature's designated lair initiative.
- A creature's legendary and lair actions will be indexed when first added to the tracker. Only items with an activation cost of "Legendary Action" or "Lair Action" will be indexed.

## Recharge Abilities for GM's
  - At either start or end of the turn.
  - For abilities with a "d6 recharge" on every turn.
  - Configurable to hide the roll.
- Automatic Regeneration
  - Automatically checks actors with the Regeneration or Self-Repair features
  - Searches the these features for the phrase "X hit points", where X can be a static value or a dice formula
    - The search phrase is localized for your supported language.
  - At the start of their turn, if the actor isn't full health it prompts the GM for a roll for the regen and auto applies the healing
  ![image](https://user-images.githubusercontent.com/33215552/196030513-eb83309b-4c22-4960-9318-d1988b7f4c62.png)

  - Regeneration Blocking
    - Feature to prevent the auto regen popup
    - Matches and active effect of the specified name (case specific)
  ![image](https://user-images.githubusercontent.com/33215552/196030495-5758a842-f651-43f9-9816-3d9a23d40864.png)


Originally part of [DnD 5e Helpers](https://github.com/trioderegion/dnd5e-helpers)

### Settings
![image](https://user-images.githubusercontent.com/33215552/195983860-dc75d9f6-19bb-4bcd-975a-38e39aa2a25a.png)

### Details
- To enable, select the 'Enabled' option for 'Wild Magic Auto-Detect' on the module's config page.
- Make sure to setup a Wild Magic Surge Table and supply the name of the table so that it draws from said table.
- Change the Tides of Chaos feature name, if you changed on the character.

- To enable it for a character, choose which type of Wild Surge the character should use under 'Special Traits' on the character sheet.

  ![image](https://user-images.githubusercontent.com/33215552/195983919-5bf3b4b1-5f8e-40c9-b60c-d095125a4a85.png)
  
  ![image](https://user-images.githubusercontent.com/33215552/195983897-b23ee102-c53c-46eb-86ff-b06e38bdd6e3.png)
- Triggers on _any_ reduction in current spell slots from a character with the 'Wild Magic Surge' special trait
- Optional homebrews
  - More Surges - a surge triggers on a roll <= spell level. Also recharges Tides of Chaos.
  - Volatile Surges - Similar to More, but adds 1d4 to the spell level if Tides of Chaos has been expended.
  - Accumulating Surges - Each time a spell is cast a count is accumulated. Once a surge happens, this count is reset to 0 and it starts over again.
  - The homebrew variants look for the designated Tides of Chaos feature and expects it to have "X uses per long rest". Will also recharge an actor resource of the same name, if present.
- Blind draw surge table results, which hides the results of the surge from the players.

![image](https://user-images.githubusercontent.com/33215552/195983945-4141caf4-9d39-4921-9663-24afd65e217a.png)

![image](https://user-images.githubusercontent.com/33215552/195983952-665ff37b-20e8-466e-90c6-296d43942830.png)

