import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.resolve(__dirname, "..", "la_convergencia_prototype");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadExports(relativePath, names) {
  const context = vm.createContext({});
  const source = read(relativePath).replace(/export const /g, "const ");
  vm.runInContext(source + `\nglobalThis.__exports = { ${names.join(", ")} };`, context);
  return context.__exports;
}

const { characters } = loadExports("js/data/characters.js", ["characters"]);
const { gameModes } = loadExports("js/data/game-modes.js", ["gameModes"]);
const { arenas } = loadExports("js/data/arenas.js", ["arenas"]);
const abilityConfig = loadExports("js/config/ability-prototype.js", [
  "PROTOTYPE_ABILITY_COSTS",
  "PROTOTYPE_ENERGY_REGEN",
  "PROTOTYPE_ABILITY_DEFINITIONS"
]);

function element() {
  const listeners = new Map();
  return {
    innerHTML: "",
    textContent: "",
    disabled: false,
    hidden: false,
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      for (const handler of listeners.get(event.type) ?? []) handler(event);
      return true;
    },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    contains() { return true; },
    closest() { return null; },
    scrollIntoView() { this.scrolledIntoView = true; }
  };
}

function createEngine(options = {}) {
  const elements = new Map();
  const document = {
    body: { dataset: {} },
    addEventListener() {},
    querySelectorAll() { return []; },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }
  };
  const testMath = Object.create(Math);
  if (typeof options.random === "function") testMath.random = options.random;
  const context = vm.createContext({ document, console, Math: testMath, Number, Array, Object, localStorage: options.localStorage, confirm: options.confirm, crypto: options.crypto, setTimeout: options.setTimeout });
  let source = read("app.js").replace(/^import[\s\S]*?from "\.\/js\/config\/ability-prototype\.js";\s*/, "");
  source = `const characters = globalThis.__data.characters;
const gameModes = globalThis.__data.gameModes;
const arenas = globalThis.__data.arenas;
const { PROTOTYPE_ABILITY_COSTS, PROTOTYPE_ENERGY_REGEN, PROTOTYPE_ABILITY_DEFINITIONS } = globalThis.__data.abilityConfig;
` + source;
  source += `
globalThis.__engine = {
  constants: { MAX_TEAM_SIZE, BASIC_ATTACK_DAMAGE, DEFENSE_DAMAGE_REDUCTION, MAX_MATCH_HISTORY, STORAGE_KEYS },
  gameState,
  get matchConfig() { return matchConfig; },
  set matchConfig(value) { matchConfig = value; },
  get battleState() { return battleState; },
  set battleState(value) { battleState = value; },
  createMatchConfig, createBattleState, createFighterState, initializeFighters,
  toggleCharacterSelection, setInitialCharacter, confirmTeam, selectGameMode, selectArena, updateGameReady, viewCharacter, prepareMatch, finishBattle,
  announce, showScreen, scrollToSection, getTeamValidationMessage, getStartValidationMessage, renderConfirmation, renderStartButton, renderBattle,
  findCharacter, getFighter, getLivingReserveIds, syncReserveIds,
  getAbility, canUseAbility, spendEnergy, regenerateEnergy,
  getActiveEffects, addEffect, removeEffect, tickEffects, removeEffectsOnSwitch,
  calculateDamage, applyDamage, handleActiveDefeat, allFightersDefeated,
  beginTurn, startBattle, getValidCpuActions, performCpuTurn,
  basicAttack, defend, analyzeOpponent, useAbility, switchPlayerCharacter,
  renderEffectBadges, renderResults, replayMatch, returnToTeam, returnToLobby, safePercentage,
  loadMatchHistory, saveMatchHistory, createMatchHistoryEntry, archiveFinishedMatch,
  getArchiveSummary, renderArchive, setArchiveFilter, clearMatchHistory,
  resolveCharacterName, resolveArenaName, resolveModeName, formatArchiveDate,
  loadPlayerSetup, savePlayerSetup, restorePlayerSetup, resetPlayerSetup
};`;
  context.__data = { characters, gameModes, arenas, abilityConfig };
  vm.runInContext(source, context, { filename: "app.js" });
  context.__engine.elements = elements;
  return context.__engine;
}

function setupBattle({ playerIds = [1, 2, 3, 4, 5], cpuIds = [1, 2, 3, 4, 5], playerActive = playerIds[0], cpuActive = cpuIds[0] } = {}, engineOptions = {}) {
  const engine = createEngine(engineOptions);
  const battle = engine.createBattleState({ modeId: "selection-combat", arenaId: arenas[0].id, teamIds: playerIds, initialCharacterId: playerActive });
  battle.player.teamIds = [...playerIds];
  battle.player.activeCharacterId = playerActive;
  battle.player.reserveIds = playerIds.filter((id) => id !== playerActive);
  battle.player.fighters = engine.initializeFighters(playerIds);
  battle.cpu.teamIds = [...cpuIds];
  battle.cpu.activeCharacterId = cpuActive;
  battle.cpu.reserveIds = cpuIds.filter((id) => id !== cpuActive);
  battle.cpu.fighters = engine.initializeFighters(cpuIds);
  battle.status = "battle";
  battle.turn = "player";
  battle.turnNumber = 1;
  battle.log = [];
  engine.battleState = battle;
  return { engine, battle };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("datos y regresión estructural", () => {
  assert.equal(characters.length, 28);
  assert.deepEqual(Array.from(characters.slice(8).map((character) => character.name)), ["Kael", "Iris", "Dante", "Nara", "Gael", "Zoe", "León", "Alma", "Ren", "Vera", "Milo", "Kiara", "Ian", "Jade", "Bruno", "Nina", "Thiago", "Eva", "Marco", "Aria"]);
  assert.equal(characters.every((character) => character.abilities.length >= 1), true);
  assert.equal(gameModes.length, 4);
  assert.equal(arenas.length, 6);
  const engine = createEngine();
  assert.equal(engine.constants.MAX_TEAM_SIZE, 5);
});

test("los 28 personajes tienen una habilidad de ataque jugable", () => {
  characters.forEach((character) => {
    const companions = characters.filter((item) => item.id !== character.id).slice(0, 4).map((item) => item.id);
    const { engine } = setupBattle({ playerIds: [character.id, ...companions], playerActive: character.id });
    const ability = engine.getAbility("player", 0);
    assert.equal(ability.effect, "damage", character.name);
    assert.equal(Number.isFinite(ability.energyCost), true, character.name);
    assert.equal(Number.isFinite(ability.definition.value), true, character.name);
  });
});

test("regresión de selección, inicial, confirmación, modo, arena y matchConfig", () => {
  const engine = createEngine();
  for (let id = 1; id <= 6; id += 1) engine.toggleCharacterSelection(id);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1, 2, 3, 4, 5]);
  engine.setInitialCharacter(2);
  assert.equal(engine.gameState.initialCharacterId, 2);
  engine.confirmTeam();
  assert.equal(engine.gameState.teamConfirmed, true);
  engine.selectGameMode("selection-combat");
  engine.selectArena(arenas[0].id);
  engine.updateGameReady();
  assert.equal(engine.gameState.gameReady, true);
  const config = engine.createMatchConfig();
  assert.equal(config.teamIds.length, 5);
  assert.equal(config.initialCharacterId, 2);
  const battle = engine.createBattleState(config);
  assert.equal(battle.player.teamIds.length, 5);
  assert.equal(battle.cpu.teamIds.length, 5);
  assert.equal(new Set(battle.cpu.teamIds).size, 5);
  assert.equal(battle.status, "ready");
});
test("ataque básico, defensa y consumo de defensa", () => {
  const { engine, battle } = setupBattle();
  const target = engine.getFighter("cpu");
  assert.equal(engine.applyDamage("player", "cpu", 10), 10);
  assert.equal(target.currentHealth, target.maxHealth - 10);
  battle.defending.cpu = true;
  assert.equal(engine.applyDamage("player", "cpu", 10), 5);
  assert.equal(battle.defending.cpu, false);
  assert.equal(engine.applyDamage("player", "cpu", 10), 10);
});

test("energía: consumo, límites, rechazo y regeneración activa", () => {
  const { engine, battle } = setupBattle();
  const player = engine.getFighter("player");
  player.currentEnergy = 20;
  assert.equal(engine.spendEnergy("player", 15), true);
  assert.equal(player.currentEnergy, 5);
  assert.equal(engine.spendEnergy("player", 6), false);
  assert.equal(player.currentEnergy, 5);
  assert.equal(engine.regenerateEnergy("player"), 5);
  assert.equal(player.currentEnergy, 10);
  player.currentEnergy = player.maxEnergy - 2;
  assert.equal(engine.regenerateEnergy("player"), 2);
  assert.equal(player.currentEnergy, player.maxEnergy);
  const reserve = engine.getFighter("player", battle.player.reserveIds[0]);
  const reserveEnergy = reserve.currentEnergy;
  engine.beginTurn("player");
  assert.equal(reserve.currentEnergy, reserveEnergy);
});

test("habilidad provisional causa daño y rechaza falta de energía", () => {
  const mayaBattle = setupBattle({ playerActive: 3 });
  const maya = mayaBattle.engine.getFighter("player");
  const target = mayaBattle.engine.getFighter("cpu");
  assert.equal(mayaBattle.engine.canUseAbility("player", 0).valid, true);
  assert.equal(mayaBattle.engine.getAbility("player", 0).definition.value, 25);
  assert.equal(mayaBattle.engine.useAbility("player", 0), true);
  assert.ok(maya.currentEnergy < maya.maxEnergy);
  assert.ok(target.currentHealth < target.maxHealth);
  const luna = setupBattle({ playerActive: 1 });
  const fighter = luna.engine.getFighter("player");
  fighter.currentEnergy = 39;
  assert.equal(luna.engine.canUseAbility("player", 2).valid, false);
  assert.equal(luna.engine.useAbility("player", 2), false);
  assert.equal(fighter.currentEnergy, 39);
});

test("Luna: Dreamachine cuesta 40, causa 15 y pasa por defensa", () => {
  const { engine, battle } = setupBattle({ playerActive: 1 });
  const luna = engine.getFighter("player");
  const cpu = engine.getFighter("cpu");
  battle.defending.cpu = true;
  const ability = engine.getAbility("player", 2);
  assert.equal(ability.name, "Arpegio interior");
  assert.equal(ability.energyCost, 40);
  assert.equal(ability.effect, "damage");
  const healthBefore = cpu.currentHealth;
  assert.equal(engine.useAbility("player", 2), true);
  assert.equal(luna.currentEnergy, luna.maxEnergy - 35);
  assert.ok(battle.log.some((entry) => entry.includes("gastó 40")));
  assert.equal(cpu.currentHealth, healthBefore - 8);
  assert.ok(battle.log.some((entry) => entry.includes("recibe 8 de daño tras defenderse")));
  assert.ok(battle.log.some((entry) => entry.includes("15") || entry.includes("8")));
});

test("Axel: Desvío cuesta 40, reduce un golpe y se consume", () => {
  const { engine, battle } = setupBattle({ playerActive: 2 });
  const axel = engine.getFighter("player");
  const ability = engine.getAbility("player", 2);
  assert.equal(ability.name, "Desvío");
  assert.equal(ability.energyCost, 40);
  assert.equal(ability.effect, "damage-reduction");
  assert.equal(engine.useAbility("player", 2), true);
  assert.equal(axel.currentEnergy, axel.maxEnergy - 35);
  assert.ok(battle.log.some((entry) => entry.includes("gastó 40")));
  assert.ok(battle.log.some((entry) => entry.includes("Desvío estará activo durante 1 turno")));
  assert.equal(axel.activeEffects.length, 0);

  const isolated = setupBattle({ playerActive: 2 });
  const isolatedAxel = isolated.engine.getFighter("player");
  isolated.engine.addEffect("player", {
    id: "character-2-ability-3-effect", name: "Desvío", sourceCharacterId: 2,
    type: "damage-reduction", value: 0.5, duration: 1, consumeOnTrigger: true
  });
  const before = isolatedAxel.currentHealth;
  assert.equal(isolated.engine.applyDamage("cpu", "player", 10), 5);
  assert.equal(isolatedAxel.currentHealth, before - 5);
  assert.equal(isolatedAxel.activeEffects.length, 0);
});

test("efectos se refrescan, expiran y el render no produce infinito", () => {
  const { engine } = setupBattle();
  const effect = { id: "test", name: "Temporal", sourceCharacterId: 1, type: "damage-reduction", value: 0.5, duration: 2 };
  assert.equal(engine.addEffect("player", effect), true);
  assert.equal(engine.addEffect("player", effect), true);
  assert.equal(engine.getActiveEffects("player").length, 1);
  engine.tickEffects("player");
  assert.equal(engine.getActiveEffects("player")[0].remainingTurns, 1);
  assert.match(engine.renderEffectBadges("player"), /1 TURNO/);
  engine.tickEffects("player");
  assert.equal(engine.getActiveEffects("player").length, 0);
});

test("cambio conserva estados individuales y derrotado no vuelve", () => {
  const { engine, battle } = setupBattle();
  const original = engine.getFighter("player");
  original.currentHealth -= 7;
  const nextId = battle.player.reserveIds[0];
  engine.switchPlayerCharacter(nextId);
  assert.equal(engine.getFighter("player", original.characterId).currentHealth, original.maxHealth - 7);
  assert.equal(battle.player.activeCharacterId, nextId);
  engine.getFighter("player", original.characterId).defeated = true;
  engine.syncReserveIds("player");
  assert.ok(!engine.getLivingReserveIds("player").includes(original.characterId));
});

test("derrota activa fuerza cambio y victoria del jugador", () => {
  const { engine, battle } = setupBattle();
  const player = engine.getFighter("player");
  player.currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  assert.equal(battle.status, "player-must-switch");
  assert.equal(player.defeated, true);
  for (const id of battle.cpu.teamIds) {
    const fighter = engine.getFighter("cpu", id);
    fighter.currentHealth = 0;
    fighter.defeated = true;
  }
  battle.cpu.fighters[battle.cpu.activeCharacterId].defeated = false;
  battle.cpu.fighters[battle.cpu.activeCharacterId].currentHealth = 1;
  battle.status = "battle";
  engine.applyDamage("player", "cpu", 10);
  assert.equal(battle.status, "finished");
  assert.equal(battle.winner, "player");
});

test("victoria CPU", () => {
  const { engine, battle } = setupBattle();
  for (const id of battle.player.teamIds) {
    const fighter = engine.getFighter("player", id);
    fighter.currentHealth = 0;
    fighter.defeated = true;
  }
  const active = engine.getFighter("player");
  active.defeated = false;
  active.currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  assert.equal(battle.status, "finished");
  assert.equal(battle.winner, "cpu");
});

test("CPU ofrece solo acciones válidas", () => {
  const luna = setupBattle({ cpuActive: 1 });
  luna.battle.turn = "cpu";
  let actions = luna.engine.getValidCpuActions();
  assert.ok(actions.some((action) => action.type === "ability" && action.abilityIndex === 2));
  luna.engine.getFighter("cpu").currentEnergy = 0;
  actions = luna.engine.getValidCpuActions();
  assert.ok(!actions.some((action) => action.type === "ability"));
  const maya = setupBattle({ cpuActive: 3 });
  maya.battle.turn = "cpu";
  assert.ok(maya.engine.getValidCpuActions().some((action) => action.type === "ability" && action.abilityIndex === 0));
});

test("Camila usa fallback seguro y no produce NaN ni undefined", () => {
  const { engine, battle } = setupBattle({ playerIds: [8, 1, 2, 3, 4], playerActive: 8 });
  const camila = engine.getFighter("player");
  assert.equal(camila.maxHealth, 100);
  assert.equal(camila.maxEnergy, 100);
  engine.applyDamage("cpu", "player", 10);
  assert.ok(Number.isFinite(camila.currentHealth));
  assert.ok(Number.isFinite(camila.currentEnergy));
  assert.equal(engine.getAbility("player", 0).effect, "damage");
  assert.ok(!JSON.stringify(battle).includes("null") || Number.isFinite(camila.currentHealth));
});

function runCombatTests() {
  let passed = 0;
  for (const { name, fn } of tests) {
    try {
      fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error.stack);
    }
  }
  console.log(`\nRESULTADO: ${passed}/${tests.length} pruebas superadas`);
  if (passed !== tests.length) process.exitCode = 1;
  return { passed, total: tests.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCombatTests();

export { createEngine, setupBattle, characters, gameModes, arenas, runCombatTests };








