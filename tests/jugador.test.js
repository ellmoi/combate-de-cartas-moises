// ======================================================
// PRUEBAS DE CONFIGURACIÓN DEL JUGADOR
// ======================================================
//
// Comprueban la carga, limpieza y guardado de las selecciones.
// También prueban datos inválidos para confirmar que el juego los
// descarta sin romper la sesión actual.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createEngine, arenas } from "./combate.test.js";

const PLAYER_SETUP_KEY = "laConvergencia.playerSetup";
const MATCH_HISTORY_KEY = "laConvergencia.matchHistory";

class MemoryStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
    this.setCount = 0;
  }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.setCount += 1; this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

class FailingStorage {
  getItem() { throw new Error("unavailable"); }
  setItem() { throw new Error("unavailable"); }
  removeItem() { throw new Error("unavailable"); }
}

function setup(overrides = {}) {
  return JSON.stringify({
    version: 1,
    selectedTeamIds: [],
    initialCharacterId: null,
    selectedModeId: null,
    selectedArenaId: null,
    ...overrides
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("sin configuración, JSON corrupto y objeto inválido devuelven null", () => {
  assert.equal(createEngine({ localStorage: new MemoryStorage() }).loadPlayerSetup(), null);
  assert.equal(createEngine({ localStorage: new MemoryStorage({ [PLAYER_SETUP_KEY]: "{" }) }).loadPlayerSetup(), null);
  assert.equal(createEngine({ localStorage: new MemoryStorage({ [PLAYER_SETUP_KEY]: "{}" }) }).loadPlayerSetup(), null);
});

test("versión desconocida se ignora", () => {
  const storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({ version: 2, selectedTeamIds: [1] }) });
  const engine = createEngine({ localStorage: storage });
  assert.equal(engine.loadPlayerSetup(), null);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), []);
});

test("configuración válida se restaura al arrancar", () => {
  const arenaId = arenas[1].id;
  const storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({
    selectedTeamIds: [1, 2, 3, 4, 5],
    initialCharacterId: 2,
    selectedModeId: "selection-combat",
    selectedArenaId: arenaId
  }) });
  const engine = createEngine({ localStorage: storage });
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1, 2, 3, 4, 5]);
  assert.equal(engine.gameState.initialCharacterId, 2);
  assert.equal(engine.gameState.selectedModeId, "selection-combat");
  assert.equal(engine.gameState.selectedArenaId, arenaId);
  assert.equal(engine.gameState.teamConfirmed, false);
  assert.equal(engine.gameState.gameReady, false);
  assert.equal(engine.matchConfig, null);
  assert.equal(engine.battleState, null);
  assert.match(engine.elements.get("lobby-team-counter").textContent, /5 \/ 5/);
  assert.match(engine.elements.get("lobby-team-status").textContent, /SIN CONFIRMAR/);
});

test("IDs inexistentes y duplicados se eliminan y se limita a cinco", () => {
  const storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({ selectedTeamIds: [1, 1, 999, 2, 3, 4, 5, 6, "7"] }) });
  const engine = createEngine({ localStorage: storage });
  const loaded = engine.loadPlayerSetup();
  assert.deepEqual(Array.from(loaded.selectedTeamIds), [1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1, 2, 3, 4, 5]);
});

test("inicial válido se conserva e inicial fuera del equipo se elimina", () => {
  let storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({ selectedTeamIds: [1, 2], initialCharacterId: 2 }) });
  assert.equal(createEngine({ localStorage: storage }).gameState.initialCharacterId, 2);
  storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({ selectedTeamIds: [1, 2], initialCharacterId: 3 }) });
  assert.equal(createEngine({ localStorage: storage }).gameState.initialCharacterId, null);
  storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({ selectedTeamIds: [1, 2], initialCharacterId: 999 }) });
  assert.equal(createEngine({ localStorage: storage }).gameState.initialCharacterId, null);
});

test("modo y arena válidos se conservan; inválidos se eliminan", () => {
  const valid = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({ selectedModeId: "selection-combat", selectedArenaId: arenas[0].id }) });
  let engine = createEngine({ localStorage: valid });
  assert.equal(engine.gameState.selectedModeId, "selection-combat");
  assert.equal(engine.gameState.selectedArenaId, arenas[0].id);
  const invalid = new MemoryStorage({ [PLAYER_SETUP_KEY]: setup({ selectedModeId: "missing", selectedArenaId: "missing" }) });
  engine = createEngine({ localStorage: invalid });
  assert.equal(engine.gameState.selectedModeId, null);
  assert.equal(engine.gameState.selectedArenaId, null);
});

test("teamConfirmed y campos de sesión nunca se restauran", () => {
  const raw = JSON.stringify({
    version: 1,
    selectedTeamIds: [1, 2, 3, 4, 5],
    initialCharacterId: 1,
    selectedModeId: "selection-combat",
    selectedArenaId: arenas[0].id,
    teamConfirmed: true,
    gameReady: true,
    matchConfig: { unsafe: true },
    battleState: { unsafe: true },
    viewedCharacterId: 1
  });
  const engine = createEngine({ localStorage: new MemoryStorage({ [PLAYER_SETUP_KEY]: raw }) });
  assert.equal(engine.gameState.teamConfirmed, false);
  assert.equal(engine.gameState.gameReady, false);
  assert.equal(engine.gameState.viewedCharacterId, null);
  assert.equal(engine.matchConfig, null);
  assert.equal(engine.battleState, null);
});

test("cambiar equipo guarda snapshot permitido", () => {
  const storage = new MemoryStorage();
  const engine = createEngine({ localStorage: storage });
  engine.toggleCharacterSelection(1);
  const saved = JSON.parse(storage.getItem(PLAYER_SETUP_KEY));
  assert.deepEqual(saved, {
    version: 1,
    selectedTeamIds: [1],
    initialCharacterId: null,
    selectedModeId: null,
    selectedArenaId: null
  });
  assert.deepEqual(Object.keys(saved), ["version", "selectedTeamIds", "initialCharacterId", "selectedModeId", "selectedArenaId"]);
});

test("cambiar inicial, modo y arena guarda cada cambio real", () => {
  const storage = new MemoryStorage();
  const engine = createEngine({ localStorage: storage });
  engine.toggleCharacterSelection(1);
  engine.setInitialCharacter(1);
  assert.equal(JSON.parse(storage.getItem(PLAYER_SETUP_KEY)).initialCharacterId, 1);
  engine.selectGameMode("selection-combat");
  assert.equal(JSON.parse(storage.getItem(PLAYER_SETUP_KEY)).selectedModeId, "selection-combat");
  engine.selectArena(arenas[2].id);
  assert.equal(JSON.parse(storage.getItem(PLAYER_SETUP_KEY)).selectedArenaId, arenas[2].id);
  const writes = storage.setCount;
  engine.setInitialCharacter(1);
  engine.selectGameMode("selection-combat");
  engine.selectArena(arenas[2].id);
  assert.equal(storage.setCount, writes);
});

test("sexto personaje rechazado no genera escritura", () => {
  const storage = new MemoryStorage();
  const engine = createEngine({ localStorage: storage });
  [1, 2, 3, 4, 5].forEach((id) => engine.toggleCharacterSelection(id));
  const writes = storage.setCount;
  engine.toggleCharacterSelection(6);
  assert.equal(storage.setCount, writes);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1, 2, 3, 4, 5]);
});

test("restablecer elimina solo playerSetup y limpia sesión", () => {
  const history = JSON.stringify([{ id: "keep" }]);
  const storage = new MemoryStorage({
    [PLAYER_SETUP_KEY]: setup({ selectedTeamIds: [1, 2], initialCharacterId: 1, selectedModeId: "selection-combat", selectedArenaId: arenas[0].id }),
    [MATCH_HISTORY_KEY]: history
  });
  const engine = createEngine({ localStorage: storage, confirm: () => true });
  engine.matchConfig = { temporary: true };
  engine.battleState = { temporary: true };
  assert.equal(engine.resetPlayerSetup(), true);
  assert.equal(storage.getItem(PLAYER_SETUP_KEY), null);
  assert.equal(storage.getItem(MATCH_HISTORY_KEY), history);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), []);
  assert.equal(engine.gameState.initialCharacterId, null);
  assert.equal(engine.gameState.selectedModeId, null);
  assert.equal(engine.gameState.selectedArenaId, null);
  assert.equal(engine.gameState.teamConfirmed, false);
  assert.equal(engine.gameState.gameReady, false);
  assert.equal(engine.matchConfig, null);
  assert.equal(engine.battleState, null);
});

test("cancelar restablecimiento conserva configuración", () => {
  const raw = setup({ selectedTeamIds: [1] });
  const storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: raw });
  const engine = createEngine({ localStorage: storage, confirm: () => false });
  assert.equal(engine.resetPlayerSetup(), false);
  assert.equal(storage.getItem(PLAYER_SETUP_KEY), raw);
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1]);
});

test("borrar historial no elimina playerSetup", () => {
  const rawSetup = setup({ selectedTeamIds: [1] });
  const storage = new MemoryStorage({ [PLAYER_SETUP_KEY]: rawSetup, [MATCH_HISTORY_KEY]: "[]" });
  const engine = createEngine({ localStorage: storage, confirm: () => true });
  assert.equal(engine.clearMatchHistory(), true);
  assert.equal(storage.getItem(MATCH_HISTORY_KEY), null);
  assert.equal(storage.getItem(PLAYER_SETUP_KEY), rawSetup);
});

test("localStorage fallido no rompe carga, juego, guardado ni reset", () => {
  const engine = createEngine({ localStorage: new FailingStorage(), confirm: () => true });
  assert.equal(engine.loadPlayerSetup(), null);
  assert.doesNotThrow(() => engine.toggleCharacterSelection(1));
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [1]);
  assert.equal(engine.savePlayerSetup(), false);
  assert.doesNotThrow(() => engine.resetPlayerSetup());
});

test("no usa localStorage.clear ni persiste campos prohibidos", () => {
  const app = fs.readFileSync(path.resolve(__dirname, "..", "la_convergencia_prototype", "app.js"), "utf8");
  assert.doesNotMatch(app, /localStorage\.clear\s*\(/);
  assert.equal((app.match(/laConvergencia\.playerSetup/g) || []).length, 1);
  const storage = new MemoryStorage();
  const engine = createEngine({ localStorage: storage });
  engine.toggleCharacterSelection(1);
  const raw = storage.getItem(PLAYER_SETUP_KEY);
  assert.doesNotMatch(raw, /battleState|matchConfig|currentHealth|currentEnergy|turn|effects|winner|cpu|matchHistory|archiveFilter|viewedCharacterId|teamConfirmed|gameReady/);
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
console.log(`\nJUGADOR: ${passed}/${tests.length} pruebas superadas`);
if (passed !== tests.length) process.exitCode = 1;
