// ======================================================
// PRUEBAS DEL ARCHIVO DE PARTIDAS
// ======================================================
//
// Comprueban cómo se guarda, recupera, filtra y borra el historial.
// Las pruebas preparan un localStorage simulado para no modificar
// los datos reales del navegador mientras se ejecutan.
//
// Flujo habitual: preparar historial -> ejecutar función -> comprobar.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createEngine, setupBattle, arenas } from "./combate.test.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
  }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

class FailingStorage {
  getItem() { throw new Error("storage unavailable"); }
  setItem() { throw new Error("storage unavailable"); }
  removeItem() { throw new Error("storage unavailable"); }
}

const STORAGE_KEY = "laConvergencia.matchHistory";
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function finishedBattle(storage, winner = "player", options = {}) {
  const setup = setupBattle(options, { localStorage: storage, confirm: () => true });
  setup.battle.status = "finished";
  setup.battle.turn = null;
  setup.battle.winner = winner;
  return setup;
}

test("nombre obligatorio se limpia, valida y persiste", () => {
  const storage = new MemoryStorage();
  const engine = createEngine({ localStorage: storage });
  assert.equal(engine.savePlayerName(" "), false);
  assert.equal(engine.savePlayerName(" M "), false);
  assert.equal(engine.savePlayerName("  Moises  "), true);
  assert.equal(storage.getItem("convergenciaUsuario"), "Moises");
  assert.equal(engine.currentPlayerName, "Moises");
});

test("historial se filtra por jugador y exporta JSON ordenado", () => {
  const entries = [
    { id: "1", playerName: "Moises", winner: "player", completedAt: "2026-08-17T10:00:00Z" },
    { id: "2", playerName: "Laura", winner: "cpu", completedAt: "2026-08-18T10:00:00Z" },
    { id: "3", playerName: "Moises", winner: "abandoned", completedAt: "2026-08-19T10:00:00Z" }
  ];
  const storage = new MemoryStorage({ convergenciaUsuario: "Moises", [STORAGE_KEY]: JSON.stringify(entries) });
  const engine = createEngine({ localStorage: storage });
  assert.deepEqual(Array.from(engine.getCurrentPlayerHistory(), entry => entry.id), ["1", "3"]);
  const exported = engine.createHistoryExport();
  assert.equal(exported.juego, "La Convergencia");
  assert.equal(exported.jugador, "Moises");
  assert.equal(exported.batallas.length, 2);
  assert.doesNotThrow(() => JSON.stringify(exported, null, 2));
});

test("abandonar combate se registra una sola vez", () => {
  const storage = new MemoryStorage({ convergenciaUsuario: "Moises" });
  const { engine } = setupBattle({}, { localStorage: storage });
  assert.equal(engine.archiveAbandonedMatch(), true);
  assert.equal(engine.archiveAbandonedMatch(), false);
  const history = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(history.length, 1);
  assert.equal(history[0].winner, "abandoned");
  assert.equal(history[0].playerName, "Moises");
});

test("historial inexistente y JSON corrupto devuelven array vacío", () => {
  const empty = new MemoryStorage();
  assert.deepEqual(Array.from(createEngine({ localStorage: empty }).loadMatchHistory()), []);
  const corrupt = new MemoryStorage({ [STORAGE_KEY]: "{datos rotos" });
  assert.deepEqual(Array.from(createEngine({ localStorage: corrupt }).loadMatchHistory()), []);
  corrupt.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
  assert.deepEqual(Array.from(createEngine({ localStorage: corrupt }).loadMatchHistory()), []);
});

test("partida no terminada no se guarda", () => {
  const storage = new MemoryStorage();
  const { engine } = setupBattle({}, { localStorage: storage });
  assert.equal(engine.archiveFinishedMatch(), false);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("victoria terminada crea snapshot ISO correcto", () => {
  const storage = new MemoryStorage();
  const { engine, battle } = finishedBattle(storage, "player");
  battle.stats.totalTurns = 9;
  battle.stats.player.damageDealt = 42;
  assert.equal(engine.archiveFinishedMatch(), true);
  const history = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(history.length, 1);
  const entry = history[0];
  assert.equal(entry.winner, "player");
  assert.equal(entry.stats.totalTurns, 9);
  assert.equal(entry.stats.player.damageDealt, 42);
  assert.match(entry.completedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(typeof entry.id, "string");
  assert.ok(entry.id.length > 0);
  assert.equal(entry.modeId, battle.modeId);
  assert.equal(entry.arenaId, battle.arenaId);
});

test("derrota se guarda correctamente", () => {
  const storage = new MemoryStorage();
  const { engine } = finishedBattle(storage, "cpu");
  assert.equal(engine.archiveFinishedMatch(), true);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY))[0].winner, "cpu");
});

test("victoria real archiva automáticamente la última acción", () => {
  const storage = new MemoryStorage();
  const { engine, battle } = setupBattle({}, { localStorage: storage });
  for (const id of battle.cpu.teamIds) {
    const fighter = engine.getFighter("cpu", id);
    fighter.currentHealth = 0;
    fighter.defeated = true;
  }
  const active = engine.getFighter("cpu");
  active.currentHealth = 1;
  active.defeated = false;
  engine.basicAttack();
  const history = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(history.length, 1);
  assert.equal(history[0].winner, "player");
  assert.equal(history[0].stats.player.basicAttacks, 1);
  assert.equal(history[0].stats.totalTurns, 1);
  assert.equal(battle.archived, true);
});

test("habilidad decisiva queda contabilizada antes del snapshot", () => {
  const storage = new MemoryStorage();
  const { engine, battle } = setupBattle({ playerActive: 1 }, { localStorage: storage });
  for (const id of battle.cpu.teamIds) {
    const fighter = engine.getFighter("cpu", id);
    fighter.currentHealth = 0;
    fighter.defeated = true;
  }
  const active = engine.getFighter("cpu");
  active.currentHealth = 1;
  active.defeated = false;
  assert.equal(engine.useAbility("player", 2), true);
  const entry = JSON.parse(storage.getItem(STORAGE_KEY))[0];
  assert.equal(entry.stats.player.abilitiesUsed, 1);
  assert.equal(entry.stats.totalTurns, 1);
  assert.equal(entry.stats.player.damageDealt, 15);
});
test("partida se archiva una vez y render no duplica", () => {
  const storage = new MemoryStorage();
  const { engine, battle } = finishedBattle(storage);
  assert.equal(engine.archiveFinishedMatch(), true);
  assert.equal(battle.archived, true);
  assert.equal(engine.archiveFinishedMatch(), false);
  engine.renderArchive();
  engine.renderArchive();
  engine.renderResults();
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 1);
});

test("snapshot copia arrays y estadísticas", () => {
  const storage = new MemoryStorage();
  const { engine, battle } = finishedBattle(storage);
  battle.stats.player.basicAttacks = 3;
  assert.equal(engine.archiveFinishedMatch(), true);
  const before = JSON.parse(storage.getItem(STORAGE_KEY))[0];
  battle.player.teamIds[0] = 999;
  battle.cpu.teamIds[0] = 999;
  battle.stats.player.basicAttacks = 999;
  const after = JSON.parse(storage.getItem(STORAGE_KEY))[0];
  assert.deepEqual(after, before);
  assert.notEqual(after.player.teamIds[0], 999);
  assert.notEqual(after.cpu.teamIds[0], 999);
  assert.equal(after.stats.player.basicAttacks, 3);
});

test("replay es partida independiente y se archiva con ID nuevo", () => {
  const storage = new MemoryStorage();
  const { engine, battle } = finishedBattle(storage);
  engine.matchConfig = { modeId: battle.modeId, arenaId: battle.arenaId, teamIds: [...battle.player.teamIds], initialCharacterId: battle.player.initialCharacterId };
  assert.equal(engine.archiveFinishedMatch(), true);
  const firstId = JSON.parse(storage.getItem(STORAGE_KEY))[0].id;
  assert.equal(engine.replayMatch(), true);
  const replay = engine.battleState;
  assert.equal(replay.archived, false);
  assert.equal(replay.archiveAttempted, false);
  replay.status = "finished";
  replay.turn = null;
  replay.winner = "cpu";
  assert.equal(engine.archiveFinishedMatch(), true);
  const history = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(history.length, 2);
  assert.notEqual(history[1].id, firstId);
});

test("resumen deriva partidas, victorias, derrotas y porcentaje", () => {
  const engine = createEngine({ localStorage: new MemoryStorage() });
  let summary = engine.getArchiveSummary([]);
  assert.deepEqual({ ...summary }, { matches: 0, victories: 0, defeats: 0, abandoned: 0, winPercentage: 0 });
  summary = engine.getArchiveSummary([{ winner: "player" }, { winner: "player" }, { winner: "cpu" }]);
  assert.deepEqual({ ...summary }, { matches: 3, victories: 2, defeats: 1, abandoned: 0, winPercentage: 67 });
});

test("el historial global conserva todos los registros", () => {
  const seeded = Array.from({ length: 50 }, (_, index) => ({ id: `old-${index}`, winner: "player" }));
  const storage = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(seeded) });
  const { engine } = finishedBattle(storage, "cpu");
  assert.equal(engine.archiveFinishedMatch(), true);
  const history = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(history.length, 51);
  assert.equal(history.some((entry) => entry.id === "old-0"), true);
  assert.equal(history[0].id, "old-0");
  assert.equal(history[50].winner, "cpu");
});

test("datos incompletos renderizan fallback sin undefined ni NaN", () => {
  const incomplete = [{ id: "legacy", playerName: "Pruebas", completedAt: "invalid", winner: "player", modeId: "missing", arenaId: "missing", player: { teamIds: [999], initialCharacterId: 999 }, cpu: {} }];
  const storage = new MemoryStorage({ convergenciaUsuario: "Pruebas", [STORAGE_KEY]: JSON.stringify(incomplete) });
  const engine = createEngine({ localStorage: storage });
  engine.renderArchive();
  const html = engine.elements.get("archive-content").innerHTML;
  assert.match(html, /—/);
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.match(html, /1<\/b>/);
});

test("filtros muestran todas, victorias o derrotas", () => {
  const history = [
    { id: "win", playerName: "Pruebas", completedAt: new Date().toISOString(), winner: "player" },
    { id: "loss", playerName: "Pruebas", completedAt: new Date().toISOString(), winner: "cpu" }
  ];
  const engine = createEngine({ localStorage: new MemoryStorage({ convergenciaUsuario: "Pruebas", [STORAGE_KEY]: JSON.stringify(history) }) });
  assert.equal(engine.setArchiveFilter("player"), true);
  let html = engine.elements.get("archive-content").innerHTML;
  assert.match(html, /data-match-id="win"/);
  assert.doesNotMatch(html, /data-match-id="loss"/);
  assert.equal(engine.setArchiveFilter("cpu"), true);
  html = engine.elements.get("archive-content").innerHTML;
  assert.match(html, /data-match-id="loss"/);
  assert.doesNotMatch(html, /data-match-id="win"/);
});

test("borrar confirmado elimina solo clave del historial", () => {
  const storage = new MemoryStorage({ [STORAGE_KEY]: "[]", "otra.clave": "conservar" });
  const engine = createEngine({ localStorage: storage, confirm: () => true });
  assert.equal(engine.clearMatchHistory(), true);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem("otra.clave"), "conservar");
});

test("cancelar borrado conserva historial", () => {
  const raw = JSON.stringify([{ id: "keep" }]);
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });
  const engine = createEngine({ localStorage: storage, confirm: () => false });
  assert.equal(engine.clearMatchHistory(), false);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test("fallo de localStorage no rompe juego ni archivo", () => {
  const storage = new FailingStorage();
  const { engine, battle } = setupBattle({}, { localStorage: storage });
  assert.deepEqual(Array.from(engine.loadMatchHistory()), []);
  engine.basicAttack();
  assert.equal(battle.stats.player.basicAttacks, 1);
  battle.status = "finished";
  battle.winner = "player";
  assert.equal(engine.archiveFinishedMatch(), false);
  assert.doesNotThrow(() => engine.renderArchive());
});

test("solo historial usa la clave estable", () => {
  const app = fs.readFileSync(path.resolve(__dirname, "..", "la_convergencia_prototype", "app.js"), "utf8");
  assert.match(app, /matchHistory:\s*"laConvergencia\.matchHistory"/);
  assert.equal((app.match(/localStorage/g) || []).length >= 3, true);
  assert.doesNotMatch(app, /JSON\.stringify\(battleState\)/);
});

test("usuarios persistentes rechazan duplicados y cambiar activo conserva el juego", () => {
  const storage = new MemoryStorage();
  const engine = createEngine({ localStorage: storage });
  const moi = engine.createUser("Moi");
  const pedro = engine.createUser("Pedro");
  assert.ok(moi?.id);
  assert.ok(pedro?.id);
  assert.equal(engine.createUser(" moi "), null);
  engine.gameState.selectedTeamIds.push(1, 2, 3);
  engine.gameState.currentScreen = "lobby";
  assert.equal(engine.selectUser(moi.id), true);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1, 2, 3]);
  assert.equal(engine.gameState.currentScreen, "lobby");
  assert.equal(JSON.parse(storage.getItem("laConvergencia.users")).length, 2);
  assert.equal(storage.getItem("laConvergencia.activeUserId"), moi.id);
});

test("ranking usa historiales reales y ordena por victorias, porcentaje y partidas", () => {
  const users = [
    { id: "moi", username: "Moi", createdAt: "2026-01-01" },
    { id: "pedro", username: "Pedro", createdAt: "2026-01-02" },
    { id: "laura", username: "Laura", createdAt: "2026-01-03" }
  ];
  const history = [
    { id: "1", userId: "moi", winner: "player" }, { id: "2", userId: "moi", winner: "player" }, { id: "3", userId: "moi", winner: "cpu" },
    { id: "4", userId: "pedro", winner: "player" }, { id: "5", userId: "pedro", winner: "player" }, { id: "6", userId: "pedro", winner: "cpu" }, { id: "7", userId: "pedro", winner: "cpu" },
    { id: "8", userId: "laura", winner: "player" }, { id: "9", userId: "laura", winner: "abandoned" }
  ];
  const storage = new MemoryStorage({ "laConvergencia.users": JSON.stringify(users), "laConvergencia.activeUserId": "moi", [STORAGE_KEY]: JSON.stringify(history) });
  const engine = createEngine({ localStorage: storage });
  const ranking = engine.getGlobalRanking();
  assert.deepEqual(Array.from(ranking, (user) => user.id), ["moi", "pedro", "laura"]);
  assert.deepEqual({ ...engine.getUserStats("moi") }, { battles: 3, wins: 2, losses: 1, winRate: 66.67 });
  assert.deepEqual({ ...engine.getUserStats("laura") }, { battles: 1, wins: 1, losses: 0, winRate: 100 });
});

test("una batalla conserva el usuario inicial aunque cambie el usuario activo", () => {
  const users = [{ id: "moi", username: "Moi" }, { id: "pedro", username: "Pedro" }];
  const storage = new MemoryStorage({ "laConvergencia.users": JSON.stringify(users), "laConvergencia.activeUserId": "moi" });
  const { engine, battle } = setupBattle({}, { localStorage: storage });
  assert.equal(battle.userId, "moi");
  engine.selectUser("pedro");
  battle.status = "finished";
  battle.winner = "player";
  assert.equal(engine.archiveFinishedMatch(), true);
  const entry = JSON.parse(storage.getItem(STORAGE_KEY))[0];
  assert.equal(entry.userId, "moi");
  assert.equal(entry.playerName, "Moi");
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
console.log(`\nARCHIVO: ${passed}/${tests.length} pruebas superadas`);
if (passed !== tests.length) process.exitCode = 1;
