// ======================================================
// PRUEBAS DE PANTALLAS Y ESTRUCTURA
// ======================================================
//
// Comprueban navegación, ids únicos, rutas de imágenes, UTF-8 y
// estilos esenciales. También verifican que solo una pantalla quede
// activa y que cambiar de vista no destruya la batalla.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createEngine, setupBattle, characters, arenas } from "./combate.test.js";

const workspace = path.resolve(__dirname, "..");
const root = path.join(workspace, "la_convergencia_prototype");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const css = read("index.css");
const app = read("app.js");
const screenIds = ["lobby", "modos", "cartas", "ficha", "equipo", "arenas", "versus-section", "battle-preview", "results-section", "archivo"];
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function configuredEngine() {
  const engine = createEngine();
  [1, 2, 3, 4, 5].forEach((id) => engine.toggleCharacterSelection(id));
  engine.setInitialCharacter(1);
  engine.confirmTeam();
  engine.selectGameMode("selection-combat");
  engine.selectArena(arenas[0].id);
  return engine;
}

test("la aplicación inicia únicamente en lobby", () => {
  const engine = createEngine();
  assert.equal(engine.gameState.currentScreen, "lobby");
  assert.equal(engine.elements.get("lobby").hidden, false);
  screenIds.slice(1).forEach((id) => assert.equal(engine.elements.get(id).hidden, true));
});

test("showScreen rechaza pantallas inexistentes", () => {
  const engine = createEngine();
  assert.equal(engine.showScreen("missing"), false);
  assert.equal(engine.gameState.currentScreen, "lobby");
});

test("showScreen mantiene exactamente una pantalla visible", () => {
  const engine = createEngine();
  ["modes", "characters", "team", "arenas", "archive"].forEach((name) => {
    assert.equal(engine.showScreen(name, { focus: false }), true);
    assert.equal(screenIds.filter((id) => engine.elements.get(id).hidden === false).length, 1);
  });
});

test("el menú superior contiene los seis destinos requeridos", () => {
  for (const target of ["lobby", "characters", "team", "modes", "arenas", "archive"])
    assert.match(html, new RegExp(`data-screen-target="${target}"`));
});

test("ver ficha abre el personaje correcto sin cambiar selección", () => {
  const engine = createEngine();
  engine.toggleCharacterSelection(1);
  const before = [...engine.gameState.selectedTeamIds];
  engine.viewCharacter(4);
  assert.equal(engine.gameState.viewedCharacterId, 4);
  assert.equal(engine.gameState.currentScreen, "character-detail");
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), before);
  assert.match(engine.elements.get("character-detail").innerHTML, /VALERIA/);
});

test("volver a cartas conserva selección", () => {
  const engine = createEngine();
  engine.toggleCharacterSelection(2);
  engine.viewCharacter(2);
  engine.showScreen("characters");
  assert.deepEqual(Array.from(engine.gameState.selectedTeamIds), [2]);
  assert.equal(engine.gameState.currentScreen, "characters");
});

test("preparar partida abre versus", () => {
  const engine = configuredEngine();
  engine.prepareMatch();
  assert.equal(engine.battleState.status, "ready");
  assert.equal(engine.gameState.currentScreen, "versus");
});

test("comenzar batalla abre combate", () => {
  const engine = configuredEngine();
  engine.prepareMatch();
  engine.startBattle();
  assert.equal(engine.battleState.status, "battle");
  assert.equal(engine.gameState.currentScreen, "battle");
});

test("finalizar batalla abre resultados", () => {
  const { engine } = setupBattle();
  engine.finishBattle("player");
  assert.equal(engine.battleState.status, "finished");
  assert.equal(engine.gameState.currentScreen, "results");
});

test("repetir conserva su batalla nueva y abre combate", () => {
  const { engine, battle } = setupBattle();
  engine.matchConfig = { modeId: "selection-combat", arenaId: arenas[0].id, teamIds: [1, 2, 3, 4, 5], initialCharacterId: 1 };
  battle.status = "finished";
  battle.winner = "player";
  assert.equal(engine.replayMatch(), true);
  assert.equal(engine.battleState.status, "battle");
  assert.equal(engine.gameState.currentScreen, "battle");
});

test("navegar fuera y volver no destruye battleState", () => {
  const { engine, battle } = setupBattle();
  engine.showScreen("archive");
  engine.showScreen("battle");
  assert.equal(engine.battleState, battle);
});

test("cambiar equipo y volver al lobby usan pantallas", () => {
  let setup = setupBattle();
  setup.engine.returnToTeam();
  assert.equal(setup.engine.gameState.currentScreen, "team");
  setup = setupBattle();
  setup.engine.returnToLobby();
  assert.equal(setup.engine.gameState.currentScreen, "lobby");
});

test("las diez vistas principales comparten la clase screen", () => {
  screenIds.forEach((id) => assert.match(html, new RegExp(`<section class="[^"]*screen[^"]*" id="${id}"`)));
});

test("no hay IDs HTML duplicados", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("CSS oculta pantallas inactivas y respeta movimiento reducido", () => {
  assert.match(css, /\.screen\[hidden\],\.screen\.is-hidden\{display:none!important\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("app ya no utiliza scrollIntoView ni location hash", () => {
  assert.doesNotMatch(app, /scrollIntoView|location\.hash/);
});

test("todos los retratos oficiales referidos existen", () => {
  characters.filter((character) => character.image).forEach((character) => {
    assert.equal(fs.existsSync(path.join(root, character.image)), true, character.image);
  });
});

test("los 28 personajes usan retratos separados desde la fuente única", () => {
  assert.equal(characters.every((character) => character.image?.startsWith("assets/characters/")), true);
  assert.equal(new Set(characters.map((character) => character.image)).size, 28);
  assert.doesNotMatch(app, /IMAGEN PENDIENTE|DATOS PROVISIONALES/);
});

test("los dos fondos auditados existen y hero es el fondo activo", () => {
  assert.equal(fs.existsSync(path.join(root, "assets/bg_convergencia.png")), true);
  assert.equal(fs.existsSync(path.join(root, "assets/hero-convergence.png")), true);
  assert.match(css, /url\(['"]assets\/hero-convergence\.png['"]\)/);
});

test("cada contexto visual define object-fit sin deformación", () => {
  assert.match(css, /\.card \.art img\{[^}]*object-fit:cover/);
  assert.match(css, /\.sheet-portrait img\{[^}]*object-fit:contain/);
  assert.match(css, /\.versus article>img\{[^}]*object-fit:contain/);
  assert.match(css, /\.battle \.fighters>img\{[^}]*object-fit:contain/);
});

test("archivos activos son UTF-8 válido", () => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  ["index.html", "index.css", "app.js", "js/data/characters.js", "js/data/game-modes.js", "js/data/arenas.js"].forEach((name) => decoder.decode(fs.readFileSync(path.join(root, name))));
});

test("la entrega no conserva respaldos ni informes residuales", () => {
  assert.equal(fs.existsSync(path.join(root, "backup")), false);
  assert.equal(fs.existsSync(path.join(root, "docs", "reports")), false);
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log(`\nSISTEMA DE PANTALLAS: ${tests.length - failed}/${tests.length} pruebas superadas`);
if (failed) process.exitCode = 1;

