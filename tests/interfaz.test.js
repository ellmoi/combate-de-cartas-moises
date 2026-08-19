// ======================================================
// PRUEBAS DE INTERFAZ Y ACCESIBILIDAD
// ======================================================
//
// Verifican atributos ARIA, foco de teclado, mensajes de validación
// y reglas responsive. No juzgan el aspecto artístico; comprueban
// que los elementos necesarios existan y comuniquen su estado.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createEngine, arenas } from "./combate.test.js";

const root = path.resolve(__dirname, "..", "la_convergencia_prototype");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("index.css");
const app = read("app.js");
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("existe una región viva no intrusiva para avisos", () => {
  assert.match(html, /id="app-announcer"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(css, /\.sr-only\{/);
});

test("la navegación principal tiene nombre accesible", () => {
  assert.match(html, /<nav[^>]+aria-label="Navegación principal">/);
});

test("el foco de teclado es claramente visible", () => {
  assert.match(css, /:focus-visible\{outline:3px solid/);
});

test("las selecciones comunican estado con aria-pressed", () => {
  assert.match(app, /role="button" tabindex="0" aria-pressed="\$\{isSelected\}"/);
  assert.match(app, /data-archive-filter="all" aria-pressed=/);
});

test("los controles bloqueados exponen disabled y aria-disabled", () => {
  assert.match(app, /disabled aria-disabled="true"/);
  const engine = createEngine();
  engine.renderConfirmation();
  assert.equal(engine.elements.get("confirm-team-button").disabled, true);
  assert.equal(engine.elements.get("confirm-team-button")["aria-disabled"], "true");
});

test("la validación guía al usuario en orden progresivo", () => {
  const engine = createEngine();
  assert.match(engine.getStartValidationMessage(), /ELIGE 5 PERSONAJES/);
  [1, 2, 3, 4, 5].forEach((id) => engine.toggleCharacterSelection(id));
  assert.match(engine.getStartValidationMessage(), /ELIGE UN PERSONAJE INICIAL/);
  engine.setInitialCharacter(1);
  assert.match(engine.getStartValidationMessage(), /CONFIRMA TU EQUIPO/);
  engine.confirmTeam();
  assert.match(engine.getStartValidationMessage(), /SELECCIONA UN MODO/);
  engine.selectGameMode("selection-combat");
  assert.match(engine.getStartValidationMessage(), /SELECCIONA UNA ARENA/);
  engine.selectArena(arenas[0].id);
  assert.match(engine.getStartValidationMessage(), /CONFIGURACIÓN COMPLETA/);
});

test("solo el modo principal puede habilitar el inicio", () => {
  const engine = createEngine();
  [1, 2, 3, 4, 5].forEach((id) => engine.toggleCharacterSelection(id));
  engine.setInitialCharacter(1);
  engine.confirmTeam();
  engine.selectArena(arenas[0].id);
  engine.selectGameMode("draft-combat");
  assert.equal(engine.gameState.gameReady, false);
  engine.selectGameMode("selection-combat");
  assert.equal(engine.gameState.gameReady, true);
});

test("las acciones importantes producen anuncios", () => {
  const engine = createEngine();
  engine.toggleCharacterSelection(1);
  assert.match(engine.elements.get("app-announcer").textContent, /añadido al equipo/);
  [2, 3, 4, 5].forEach((id) => engine.toggleCharacterSelection(id));
  engine.setInitialCharacter(1);
  engine.confirmTeam();
  assert.equal(engine.elements.get("app-announcer").textContent, "Equipo confirmado.");
});

test("los estados vacíos y de reemplazo usan mensajes inequívocos", () => {
  assert.match(app, /NO HAY PARTIDA PREPARADA/);
  assert.match(app, /TU PERSONAJE FUE DERROTADO\. ELIGE UN REEMPLAZO\./);
  assert.doesNotMatch(app, /MUERTO/);
});

test("hay adaptaciones específicas para tableta y móvil", () => {
  assert.match(css, /@media\(max-width:800px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /min-height:44px/);
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (error) { failed += 1; console.error(`✗ ${name}\n  ${error.message}`); }
}
console.log(`\nINTERFAZ: ${tests.length - failed}/${tests.length} pruebas superadas.`);
if (failed) process.exitCode = 1;

