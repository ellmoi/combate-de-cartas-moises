// ======================================================
// PRUEBAS DEL FLUJO COMPLETO
// ======================================================
//
// Simulan clics reales sobre controles visibles: preparar partida,
// comenzar batalla, atacar, defender, cambiar y llegar al resultado.
// Esto comprueba la conexión entre eventos, estado y renderizado.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createEngine, arenas } from "./combate.test.js";

const appSource = fs.readFileSync(path.resolve(__dirname, "..", "la_convergencia_prototype", "app.js"), "utf8");
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function node(dataset, selectors = []) {
  const target = {
    dataset,
    closest(selector) {
      return selectors.includes(selector) ? target : null;
    }
  };
  return target;
}

function click(engine, elementId, target = null) {
  engine.elements.get(elementId).dispatchEvent({ type: "click", target: target ?? engine.elements.get(elementId) });
}

function selectConfigurationThroughEvents(engine, team = [5, 4, 1, 2, 3], initial = 5) {
  click(engine, "game-modes", node({ modeId: "selection-combat" }, ["[data-mode-id]"]));
  click(engine, "arena-grid", node({ arenaId: arenas[0].id }, ["[data-arena-id]"]));
  for (const characterId of team) {
    click(engine, "character-grid", node({ characterId: String(characterId) }, ["[data-character-id]"]));
  }
  click(engine, "team-slots", node({ action: "set-initial", characterId: String(initial) }, ['[data-action="set-initial"]']));
  click(engine, "confirm-team-button");
}

function battleAction(engine, action, extra = {}) {
  click(engine, "battle-preview", node({ action, ...extra }, ["[data-action]"]));
}

test("todos los controles críticos visibles tienen delegación estable", () => {
  for (const id of ["characterGrid", "teamSlots", "confirmTeamButton", "gameModesContainer", "arenaGrid", "startConvergenceButton", "versusSection", "battlePreview", "resultsSection"])
    assert.match(appSource, new RegExp(`${id}\\.addEventListener\\(\\"click\\"`));
  for (const action of ["start-battle", "basic-attack", "defend", "analyze", "open-switch", "switch-character", "use-ability", "replay-match", "return-team", "return-lobby"])
    assert.match(appSource, new RegExp(action));
});

test("configuración y VS funcionan mediante eventos visibles", () => {
  const engine = createEngine({ random: () => 0 });
  selectConfigurationThroughEvents(engine);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [5, 4, 1, 2, 3]);
  assert.equal(engine.gameState.initialCharacterId, 5);
  assert.equal(engine.gameState.teamConfirmed, true);
  assert.equal(engine.gameState.gameReady, true);
  click(engine, "start-convergence-button");
  assert.equal(engine.gameState.currentScreen, "versus");
  assert.equal(engine.battleState.player.reserveIds.length, 4);
  assert.equal(engine.battleState.cpu.reserveIds.length, 4);
  assert.match(engine.elements.get("versus-section").innerHTML, /COMENZAR BATALLA/);
  click(engine, "versus-section", node({ action: "start-battle" }, ['[data-action="start-battle"]']));
  assert.equal(engine.battleState.status, "battle");
  assert.equal(engine.gameState.currentScreen, "battle");
  assert.match(engine.elements.get("battle-preview").innerHTML, /TU TURNO/);
});

test("ataque, defensa, análisis y cambio voluntario conectan evento, estado y render", () => {
  const engine = createEngine({ random: () => 0 });
  selectConfigurationThroughEvents(engine);
  click(engine, "start-convergence-button");
  click(engine, "versus-section", node({ action: "start-battle" }, ['[data-action="start-battle"]']));
  const cpuBefore = engine.getFighter("cpu").currentHealth;
  battleAction(engine, "basic-attack");
  assert.ok(engine.getFighter("cpu").currentHealth < cpuBefore);
  const defensesBefore = engine.battleState.stats.player.defenses;
  battleAction(engine, "defend");
  assert.equal(engine.battleState.stats.player.defenses, defensesBefore + 1);
  const analyzesBefore = engine.battleState.stats.player.analyzes;
  battleAction(engine, "analyze");
  assert.equal(engine.battleState.stats.player.analyzes, analyzesBefore + 1);
  assert.ok(engine.battleState.log.some((entry) => entry.includes("ANÁLISIS:")));
  const previous = engine.battleState.player.activeCharacterId;
  battleAction(engine, "open-switch");
  assert.equal(engine.battleState.switchSelectionOpen, true);
  const replacement = engine.getLivingReserveIds("player")[0];
  battleAction(engine, "switch-character", { characterId: String(replacement) });
  assert.notEqual(engine.battleState.player.activeCharacterId, previous);
  assert.match(engine.elements.get("battle-preview").innerHTML, /SALUD/);
  assert.match(engine.elements.get("battle-preview").innerHTML, /ENERGÍA/);
});

test("la pausa CPU bloquea acciones y muestra feedback antes de responder", () => {
  const timers = [];
  const engine = createEngine({ random: () => 0, setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; } });
  selectConfigurationThroughEvents(engine);
  click(engine, "start-convergence-button");
  click(engine, "versus-section", node({ action: "start-battle" }, ['[data-action="start-battle"]']));
  battleAction(engine, "basic-attack");
  assert.equal(engine.battleState.turn, "cpu");
  assert.equal(engine.battleState.cpuThinking, true);
  assert.match(engine.elements.get("battle-preview").innerHTML, /TURNO CPU.*PROCESANDO/);
  assert.match(engine.elements.get("battle-preview").innerHTML, /basic-attack" disabled/);
  assert.ok(timers.some((timer) => timer.delay === 650));
  const cpuTimer = timers.find((timer) => timer.delay === 650);
  cpuTimer.callback();
  assert.equal(engine.battleState.cpuThinking, false);
  assert.equal(engine.battleState.turn, "player");
  assert.ok(engine.battleState.log.some((entry) => entry.startsWith("CPU:")));
});

test("Luna y Axel usan sus habilidades implementadas desde data-action", () => {
  let engine = createEngine({ random: () => 0 });
  selectConfigurationThroughEvents(engine, [1, 2, 3, 4, 5], 1);
  click(engine, "start-convergence-button");
  click(engine, "versus-section", node({ action: "start-battle" }, ['[data-action="start-battle"]']));
  const energyBefore = engine.getFighter("player").currentEnergy;
  const cpuHealthBefore = engine.getFighter("cpu").currentHealth;
  battleAction(engine, "use-ability", { abilityIndex: "2" });
  assert.equal(engine.getFighter("player", 1).currentEnergy, energyBefore - 40 + 5);
  assert.ok(engine.battleState.log.some((entry) => entry.includes("gastó 40 de energía")));
  assert.equal(engine.getFighter("cpu").currentHealth, cpuHealthBefore - 15);

  engine = createEngine({ random: () => 0 });
  selectConfigurationThroughEvents(engine, [2, 1, 3, 4, 5], 2);
  click(engine, "start-convergence-button");
  click(engine, "versus-section", node({ action: "start-battle" }, ['[data-action="start-battle"]']));
  const axelHealthBefore = engine.getFighter("player").currentHealth;
  battleAction(engine, "use-ability", { abilityIndex: "2" });
  assert.equal(engine.getFighter("player", 2).currentHealth, axelHealthBefore - 5);
  assert.ok(engine.battleState.log.some((entry) => entry.includes("utilizó Desvío")));
});

test("una partida completa llega a victoria o derrota solo con eventos UI", () => {
  const engine = createEngine({ random: () => 0 });
  selectConfigurationThroughEvents(engine);
  click(engine, "start-convergence-button");
  click(engine, "versus-section", node({ action: "start-battle" }, ['[data-action="start-battle"]']));

  let safety = 0;
  while (engine.battleState.status !== "finished" && safety < 300) {
    if (engine.battleState.status === "player-must-switch") {
      const replacement = engine.getLivingReserveIds("player")[0];
      assert.ok(replacement, "debe existir reemplazo visible");
      battleAction(engine, "switch-character", { characterId: String(replacement) });
    } else battleAction(engine, "basic-attack");
    safety += 1;
  }

  assert.ok(safety < 300, "la partida debe terminar");
  assert.ok(["player", "cpu"].includes(engine.battleState.winner));
  assert.equal(engine.gameState.currentScreen, "results");
  assert.match(engine.elements.get("results-section").innerHTML, /VICTORIA|DERROTA/);
  assert.doesNotMatch(engine.elements.get("results-section").innerHTML, /NaN|undefined/);
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log(`\nFLUJO JUGABLE: ${tests.length - failed}/${tests.length} pruebas superadas`);
if (failed) process.exitCode = 1;

