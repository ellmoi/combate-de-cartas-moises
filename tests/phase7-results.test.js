import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createEngine, setupBattle, characters, arenas } from "./phase6-engine.test.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function finish(engine, battle, winner) {
  battle.status = "finished";
  battle.turn = null;
  battle.winner = winner;
  engine.renderResults();
  return engine.elements.get("results-section");
}

test("battleState crea estadísticas limpias", () => {
  const { battle } = setupBattle();
  assert.equal(battle.stats.totalTurns, 0);
  for (const side of ["player", "cpu"]) {
    assert.deepEqual(Object.keys(battle.stats[side]), [
      "basicAttacks", "abilitiesUsed", "defenses", "analyzes", "switches",
      "damageDealt", "damageReceived", "charactersDefeated"
    ]);
    assert.ok(Object.values(battle.stats[side]).every((value) => value === 0));
  }
});

test("daño real y defensa actualizan causado y recibido", () => {
  const { engine, battle } = setupBattle();
  battle.defending.cpu = true;
  assert.equal(engine.applyDamage("player", "cpu", 10), 5);
  assert.equal(battle.stats.player.damageDealt, 5);
  assert.equal(battle.stats.cpu.damageReceived, 5);
  assert.equal(battle.stats.cpu.damageDealt, 0);
  assert.equal(battle.stats.player.damageReceived, 0);
});

test("ataques y turnos se contabilizan desde acciones válidas", () => {
  const { engine, battle } = setupBattle();
  engine.basicAttack();
  assert.equal(battle.stats.player.basicAttacks, 1);
  assert.equal(battle.stats.totalTurns, 2);
  assert.equal(battle.turnNumber, 2);
});

test("habilidades, defensas y análisis se contabilizan", () => {
  const luna = setupBattle({ playerActive: 1 });
  assert.equal(luna.engine.useAbility("player", 2), true);
  assert.equal(luna.battle.stats.player.abilitiesUsed, 1);
  assert.equal(luna.battle.stats.totalTurns, 2);

  const defense = setupBattle();
  defense.engine.defend();
  assert.equal(defense.battle.stats.player.defenses, 1);
  assert.equal(defense.battle.stats.totalTurns, 2);

  const analysis = setupBattle();
  analysis.engine.analyzeOpponent();
  assert.equal(analysis.battle.stats.player.analyzes, 1);
  assert.equal(analysis.battle.stats.totalTurns, 2);
});

test("cambios voluntarios y obligatorios cuentan correctamente", () => {
  const voluntary = setupBattle();
  voluntary.engine.switchPlayerCharacter(voluntary.battle.player.reserveIds[0]);
  assert.equal(voluntary.battle.stats.player.switches, 1);
  assert.equal(voluntary.battle.stats.totalTurns, 2);

  const mandatory = setupBattle();
  const active = mandatory.engine.getFighter("player");
  active.currentHealth = 1;
  mandatory.engine.applyDamage("cpu", "player", 10);
  assert.equal(mandatory.battle.status, "player-must-switch");
  const turnsBefore = mandatory.battle.stats.totalTurns;
  mandatory.engine.switchPlayerCharacter(mandatory.battle.player.reserveIds[0]);
  assert.equal(mandatory.battle.stats.player.switches, 1);
  assert.equal(mandatory.battle.stats.totalTurns, turnsBefore);
});

test("una derrota se atribuye una sola vez", () => {
  const { engine, battle } = setupBattle();
  const target = engine.getFighter("cpu");
  target.currentHealth = 1;
  engine.applyDamage("player", "cpu", 10);
  assert.equal(battle.stats.player.charactersDefeated, 1);
  engine.handleActiveDefeat("cpu", "player");
  assert.equal(battle.stats.player.charactersDefeated, 1);
});

test("victoria y derrota usan battleState.winner", () => {
  const victory = setupBattle();
  let section = finish(victory.engine, victory.battle, "player");
  assert.equal(section.hidden, false);
  assert.match(section.innerHTML, /<h2>VICTORIA<\/h2>/);
  assert.match(section.innerHTML, /GANADOR<\/small><b>JUGADOR<\/b>/);

  const defeat = setupBattle();
  section = finish(defeat.engine, defeat.battle, "cpu");
  assert.match(section.innerHTML, /<h2>DERROTA<\/h2>/);
  assert.match(section.innerHTML, /GANADOR<\/small><b>CPU<\/b>/);
  assert.doesNotMatch(section.innerHTML, /MUERTO|FALLECIDO|ELIMINADO PARA SIEMPRE/);
});

test("resultado contiene información, estadísticas y diez estados finales", () => {
  const { engine, battle } = setupBattle({ playerIds: [8, 1, 2, 3, 4], playerActive: 8 });
  battle.stats.totalTurns = 7;
  battle.stats.player.damageDealt = 25;
  battle.stats.player.analyzes = 2;
  const section = finish(engine, battle, "player");
  const html = section.innerHTML;
  assert.match(html, /TURNOS<\/small><b>7<\/b>/);
  assert.match(html, /DAÑO CAUSADO<\/small><b>25<\/b>/);
  assert.match(html, /ANÁLISIS<\/small><b>2<\/b>/);
  assert.match(html, /INICIAL JUGADOR/);
  assert.match(html, /INICIAL CPU/);
  assert.match(html, /EQUIPO JUGADOR/);
  assert.match(html, /EQUIPO CPU/);
  assert.equal((html.match(/SALUD ·/g) || []).length, 10);
  assert.equal((html.match(/ENERGÍA ·/g) || []).length, 10);
  assert.match(html, /CAMILA/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test("repetir crea batalla nueva y conserva solo configuración", () => {
  const { engine, battle } = setupBattle({ playerIds: [1, 2, 3, 4, 5], playerActive: 2 });
  const config = { modeId: "selection-combat", arenaId: arenas[2].id, teamIds: [1, 2, 3, 4, 5], initialCharacterId: 2 };
  engine.matchConfig = config;
  battle.status = "finished";
  battle.winner = "player";
  const oldBattle = battle;
  const oldCpuTeam = battle.cpu.teamIds;
  const oldPlayer = engine.getFighter("player");
  oldPlayer.currentHealth = 1;
  oldPlayer.currentEnergy = 0;
  oldPlayer.activeEffects.push({ id: "old-effect", remainingTurns: 99 });
  battle.stats.totalTurns = 50;
  battle.log.push("registro anterior");

  assert.equal(engine.replayMatch(), true);
  const replay = engine.battleState;
  assert.notEqual(replay, oldBattle);
  assert.notEqual(replay.cpu.teamIds, oldCpuTeam);
  assert.deepEqual(Array.from(replay.player.teamIds), config.teamIds);
  assert.equal(replay.player.initialCharacterId, 2);
  assert.equal(replay.player.activeCharacterId, 2);
  assert.equal(replay.modeId, config.modeId);
  assert.equal(replay.arenaId, config.arenaId);
  assert.equal(replay.cpu.teamIds.length, 5);
  assert.equal(replay.stats.totalTurns, 0);
  for (const side of ["player", "cpu"]) {
    for (const fighter of Object.values(replay[side].fighters)) {
      assert.equal(fighter.currentHealth, fighter.maxHealth);
      assert.equal(fighter.currentEnergy, fighter.maxEnergy);
      assert.equal(fighter.defeated, false);
      assert.deepEqual(Array.from(fighter.activeEffects), []);
    }
  }
  assert.ok(!replay.log.includes("registro anterior"));
  assert.equal(replay.status, "battle");
});

test("cambiar equipo descarta partida sin borrar selección", () => {
  const { engine, battle } = setupBattle();
  engine.gameState.selectedTeamIds.push(1, 2, 3, 4, 5);
  engine.gameState.initialCharacterId = 1;
  engine.gameState.teamConfirmed = true;
  engine.matchConfig = { modeId: "selection-combat", arenaId: arenas[0].id, teamIds: [1, 2, 3, 4, 5], initialCharacterId: 1 };
  battle.status = "finished";
  assert.equal(engine.returnToTeam(), true);
  assert.equal(engine.battleState, null);
  assert.equal(engine.matchConfig, null);
  assert.equal(engine.gameState.teamConfirmed, false);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1, 2, 3, 4, 5]);
  assert.equal(engine.gameState.currentScreen, "team");
  assert.equal(engine.elements.get("equipo").hidden, false);
});

test("volver al lobby cambia pantalla y no borra estado", () => {
  const { engine, battle } = setupBattle();
  engine.matchConfig = { modeId: "selection-combat", arenaId: arenas[0].id, teamIds: [1, 2, 3, 4, 5], initialCharacterId: 1 };
  battle.status = "finished";
  battle.winner = "player";
  assert.equal(engine.returnToLobby(), true);
  assert.equal(engine.battleState, battle);
  assert.ok(engine.matchConfig);
  assert.equal(engine.gameState.currentScreen, "lobby");
  assert.equal(engine.elements.get("lobby").hidden, false);
});

test("no se usa location.reload", () => {
  const app = fs.readFileSync(path.resolve(__dirname, "..", "la_convergencia_prototype", "app.js"), "utf8");
  assert.doesNotMatch(app, /location\.reload\s*\(/);
});

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
console.log(`\nRESULTADO FASE 7: ${passed}/${tests.length} pruebas superadas`);
if (passed !== tests.length) process.exitCode = 1;
