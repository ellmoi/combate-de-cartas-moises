/*
 * Configuración temporal de habilidades para la primera entrega.
 * Estos valores permiten probar el motor y NO forman parte del lore ni de los
 * datos oficiales de characters.js. Requieren balance y aprobación posteriores.
 */
export const PROTOTYPE_ABILITY_COSTS = {
  standard: 15,
  advanced: 25,
  special: 40
};

export const PROTOTYPE_ENERGY_REGEN = 5;

export const PROTOTYPE_ABILITY_DEFINITIONS = {
  "character-1-ability-3": {
    type: "attack",
    target: "enemy",
    effect: "damage",
    tier: "special",
    value: 15
  },
  "character-2-ability-3": {
    type: "defense",
    target: "self",
    effect: "damage-reduction",
    tier: "special",
    value: 0.5,
    duration: 1
  }
};