// ======================================================
// PRUEBAS DE REEMPLAZOS EN COMBATE
// ======================================================
//
// Preparan derrotas controladas para comprobar cambios obligatorios,
// reservas vivas y el final de la partida cuando no quedan reemplazos.
// Incluyen tanto decisiones del jugador como cambios automáticos CPU.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createEngine, arenas } from "./combate.test.js";

const app = fs.readFileSync(path.resolve(__dirname, "..", "la_convergencia_prototype", "app.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "..", "la_convergencia_prototype", "index.css"), "utf8");

function setup({ playerIds = [1,2,3,4,5], cpuIds = [1,2,3,4,5], playerActive = playerIds[0], cpuActive = cpuIds[0], timers = [] } = {}) {
  const engine = createEngine({ random: () => 0, setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; } });
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
  return { engine, battle, timers };
}

function clickSwitch(engine, characterId) {
  const target = { dataset: { action: "switch-character", characterId: String(characterId) }, closest(selector) { return selector === "[data-action]" ? this : null; } };
  engine.elements.get("battle-preview").dispatchEvent({ type: "click", target });
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("el daño se limita a cero y marca una sola derrota", () => {
  const { engine, battle } = setup();
  const fighter = engine.getFighter("player");
  fighter.currentHealth = 1;
  engine.applyDamage("cpu", "player", 999);
  assert.equal(fighter.currentHealth, 0);
  assert.equal(fighter.defeated, true);
  const defeats = battle.stats.cpu.charactersDefeated;
  engine.handleActiveDefeat("player", "cpu");
  assert.equal(battle.stats.cpu.charactersDefeated, defeats);
});

test("derrota con reservas abre cambio obligatorio y limpia pausa CPU", () => {
  const { engine, battle } = setup();
  battle.turn = "cpu";
  battle.cpuThinking = true;
  engine.getFighter("player").currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  assert.equal(battle.status, "player-must-switch");
  assert.equal(battle.switchSelectionOpen, true);
  assert.equal(battle.cpuThinking, false);
  assert.equal(battle.turn, "player");
});

test("acciones de combate quedan bloqueadas durante el reemplazo", () => {
  const { engine, battle } = setup();
  engine.getFighter("player").currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  const cpuHealth = engine.getFighter("cpu").currentHealth;
  const stats = JSON.stringify(battle.stats.player);
  engine.basicAttack();
  engine.defend();
  engine.analyzeOpponent();
  engine.useAbility("player", 0);
  assert.equal(engine.getFighter("cpu").currentHealth, cpuHealth);
  assert.equal(JSON.stringify(battle.stats.player), stats);
  assert.equal(battle.status, "player-must-switch");
});

test("selector muestra únicamente reservas vivas con salud y energía", () => {
  const { engine, battle } = setup();
  const defeatedReserve = battle.player.reserveIds[0];
  engine.getFighter("player", defeatedReserve).defeated = true;
  engine.getFighter("player", defeatedReserve).currentHealth = 0;
  engine.getFighter("player").currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  engine.renderBattle();
  const markup = engine.elements.get("battle-preview").innerHTML;
  assert.match(markup, /TU PERSONAJE FUE DERROTADO\. ELIGE UN REEMPLAZO/);
  assert.match(markup, /DISPONIBLE/);
  assert.match(markup, /SALUD/);
  assert.match(markup, /ENERGÍA/);
  assert.ok(!engine.getLivingReserveIds("player").includes(defeatedReserve));
});

test("clic en reserva actualiza activo y continúa en turno jugador", () => {
  const { engine, battle, timers } = setup();
  const defeatedId = battle.player.activeCharacterId;
  engine.getFighter("player").currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  const replacement = engine.getLivingReserveIds("player")[0];
  clickSwitch(engine, replacement);
  assert.equal(battle.player.activeCharacterId, replacement);
  assert.equal(battle.status, "battle");
  assert.equal(battle.turn, "player");
  assert.equal(battle.switchSelectionOpen, false);
  assert.ok(battle.player.reserveIds.includes(defeatedId));
  assert.ok(!battle.player.reserveIds.includes(replacement));
  assert.equal(engine.getFighter("player", defeatedId).defeated, true);
  assert.equal(timers.filter((timer) => timer.delay === 650).length, 0);
});

test("un derrotado no puede volver al combate", () => {
  const { engine, battle } = setup();
  const oldActive = battle.player.activeCharacterId;
  engine.getFighter("player").currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  const replacement = engine.getLivingReserveIds("player")[0];
  engine.switchPlayerCharacter(replacement);
  assert.equal(engine.switchPlayerCharacter(oldActive), false);
  assert.equal(battle.player.activeCharacterId, replacement);
});

test("sin reservas vivas la derrota del jugador abre resultados", () => {
  const { engine, battle } = setup();
  battle.player.reserveIds.forEach((id) => { const fighter = engine.getFighter("player", id); fighter.currentHealth = 0; fighter.defeated = true; });
  engine.getFighter("player").currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  assert.equal(battle.status, "finished");
  assert.equal(battle.winner, "cpu");
  assert.equal(battle.switchSelectionOpen, false);
  assert.equal(engine.gameState.currentScreen, "results");
});

test("CPU reemplaza automáticamente con una reserva viva", () => {
  const { engine, battle } = setup();
  const defeatedId = battle.cpu.activeCharacterId;
  engine.getFighter("cpu").currentHealth = 1;
  engine.applyDamage("player", "cpu", 10);
  assert.equal(engine.getFighter("cpu", defeatedId).defeated, true);
  assert.notEqual(battle.cpu.activeCharacterId, defeatedId);
  assert.equal(engine.getFighter("cpu").defeated, false);
  assert.ok(!battle.cpu.reserveIds.includes(battle.cpu.activeCharacterId));
  assert.equal(battle.status, "battle");
});

test("sin reservas CPU la última derrota abre victoria", () => {
  const { engine, battle } = setup();
  battle.cpu.reserveIds.forEach((id) => { const fighter = engine.getFighter("cpu", id); fighter.currentHealth = 0; fighter.defeated = true; });
  engine.getFighter("cpu").currentHealth = 1;
  engine.applyDamage("player", "cpu", 10);
  assert.equal(battle.status, "finished");
  assert.equal(battle.winner, "player");
  assert.equal(engine.gameState.currentScreen, "results");
});

test("Camila usa su retrato separado en el selector", () => {
  const { engine } = setup({ playerIds: [1,8], cpuIds: [2,3], playerActive: 1, cpuActive: 2 });
  engine.getFighter("player").currentHealth = 1;
  engine.applyDamage("cpu", "player", 10);
  engine.renderBattle();
  const markup = engine.elements.get("battle-preview").innerHTML;
  assert.match(markup, /assets\/characters\/camila\.png/);
  assert.match(markup, /CAMILA/);
  assert.doesNotMatch(markup, /switch-placeholder|NaN|undefined/);
});

test("VS usa lados equivalentes, centro estable y botón contenido", () => {
  assert.match(app, /versus-side versus-side-/);
  assert.match(app, /versus-center/);
  assert.match(app, /versus-portrait/);
  assert.match(app, /versus-reserve-strip/);
  assert.match(app, /versus-center[\s\S]*startControl/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(230px,300px\) minmax\(0,1fr\)/);
  assert.match(css, /\.versus-center \.start-battle-button\{[^}]*width:100%/);
});

test("retratos completos no se deforman y nombres largos pueden partir", () => {
  assert.match(css, /\.versus-portrait img[\s\S]*?object-fit:contain/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /font:700 clamp\(/);
  assert.match(css, /\.versus-placeholder/);
});

test("VS móvil evita tres columnas y scroll horizontal", () => {
  assert.match(css, /\.versus\{overflow-x:clip/);
  assert.match(css, /@media\(max-width:700px\)\{\.versus-layout,\.versus>div\.versus-layout\{grid-template-columns:1fr\}/);
  assert.match(css, /\.versus-center\{order:-1/);
});

let failed = 0;
for (const item of tests) {
  try { item.fn(); console.log("PASS " + item.name); }
  catch (error) { failed += 1; console.error("FAIL " + item.name + "\n" + error.stack); }
}
console.log("\nREEMPLAZOS: " + (tests.length - failed) + "/" + tests.length + " pruebas superadas");
if (failed) process.exitCode = 1;
