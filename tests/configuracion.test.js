// ======================================================
// PRUEBAS DE CONFIGURACIÓN GUIADA
// ======================================================
//
// Comprueban que el jugador complete modo, equipo, inicial,
// confirmación y arena en el orden correcto.
// Algunas pruebas leen el código como texto para verificar que
// los pasos y controles necesarios continúen presentes.
import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("la_convergencia_prototype/app.js", "utf8");
const html = fs.readFileSync("la_convergencia_prototype/index.html", "utf8");
const css = fs.readFileSync("la_convergencia_prototype/index.css", "utf8");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("el paso pendiente sigue el orden requerido", () => {
  const body = app.match(/function getNextSetupStep\(\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  ["selectedModeId", "selectedTeamIds.length", "initialCharacterId", "teamConfirmed", "selectedArenaId", 'return "ready"'].reduce((last, token) => {
    const position = body.indexOf(token);
    assert.ok(position > last, token + " debe respetar el orden");
    return position;
  }, -1);
});

test("el botón principal reanuda el primer paso pendiente", () => {
  assert.match(app, /function continueSetup\(\)/);
  assert.match(app, /showScreen\(getSetupScreen\(step\)\)/);
  assert.match(app, /function prepareMatch\(\) \{\s*return continueSetup\(\)/);
});

test("seleccionar el modo principal abre personajes", () => {
  assert.match(app, /modeId === "selection-combat"[\s\S]*?showScreen\("characters"\)/);
});

test("cinco personajes habilitan una continuación explícita", () => {
  assert.match(html, /id="continue-characters-button"[^>]*disabled/);
  assert.match(app, /count === MAX_TEAM_SIZE \? "EQUIPO COMPLETO/);
  assert.match(app, /function continueFromCharacters[\s\S]*?showScreen\("team"\)/);
});

test("inicial, confirmación y arena avanzan automáticamente", () => {
  assert.match(app, /function setInitialCharacter[\s\S]*?Inicial seleccionado/);
  assert.match(app, /function confirmTeam[\s\S]*?showScreen\("arenas"\)/);
  assert.match(app, /function selectArena[\s\S]*?showScreen\("lobby"\)/);
});

test("el lobby distingue preparación e inicio de combate", () => {
  assert.match(app, /INICIAR COMBATE/);
  assert.match(app, /CONTINUAR PREPARACIÓN/);
  assert.match(html, /data-action="resume-setup"/);
});

test("el tutorial es un diálogo accesible y explica preparación y combate", () => {
  assert.match(html, /<dialog id="game-tutorial"[^>]*aria-labelledby="tutorial-title"/);
  assert.match(html, /id="tutorial-title">CÓMO JUGAR/);
  ["PREPARA LA PARTIDA", "ATAQUE BÁSICO", "HABILIDADES", "DEFENDER", "ANALIZAR", "CAMBIAR", "OBJETIVO"].forEach((text) => assert.ok(html.includes(text)));
  assert.match(html, /aria-label="Cerrar tutorial"/);
});

test("el progreso y tutorial se adaptan a móvil y teclado", () => {
  assert.match(css, /\.setup-progress/);
  assert.match(css, /\.game-tutorial::backdrop/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /min-height:44px/);
});

let failed = 0;
for (const item of tests) {
  try { item.fn(); console.log("PASS " + item.name); }
  catch (error) { failed += 1; console.error("FAIL " + item.name + "\n" + error.stack); }
}
console.log("\nCONFIGURACIÓN: " + (tests.length - failed) + "/" + tests.length + " pruebas superadas");
if (failed) process.exitCode = 1;
