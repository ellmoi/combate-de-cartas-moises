// ==========================================
// REGLAS DE HABILIDADES
// Costes y efectos que utiliza el motor de combate.
// ==========================================
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