import { characters } from "./js/data/characters.js";
import { gameModes } from "./js/data/game-modes.js";
import { arenas } from "./js/data/arenas.js";
import {
  PROTOTYPE_ABILITY_COSTS,
  PROTOTYPE_ENERGY_REGEN,
  PROTOTYPE_ABILITY_DEFINITIONS
} from "./js/config/ability-prototype.js";

// ================================
// CONFIGURACI?N GENERAL
// Valores de reglas y tiempos de la interfaz.
// ================================
const MAX_TEAM_SIZE = 5;
const MAX_MATCH_HISTORY = 50;
const MAX_BATTLE_LOG_ENTRIES = 40;
const STORAGE_KEYS = {
  matchHistory: "laConvergencia.matchHistory",
  playerSetup: "laConvergencia.playerSetup"
};
const BASIC_ATTACK_DAMAGE = 10;
const DEFENSE_DAMAGE_REDUCTION = 0.5;
const CPU_TURN_DELAY_MS = 650;
const HIT_FEEDBACK_MS = 320;
const ACTION_FEEDBACK_MS = 450;
const FALLBACK_BATTLE_STATS = { health: 100, energy: 100 };
const STAT_LABELS = {
  health: "Salud", energy: "Energía", resistance: "Resistencia",
  agility: "Agilidad", technique: "Técnica", control: "Control",
  efficiency: "Eficiencia", power: "Potencia", perception: "Percepción"
};

// ================================
// SONIDOS
// Los archivos son opcionales: si falta uno, el juego contin?a.
// ================================
const SOUND_PATHS = {
  attack: "assets/sounds/attack.mp3", hit: "assets/sounds/hit.mp3",
  defense: "assets/sounds/defense.mp3", ability: "assets/sounds/ability.mp3",
  victory: "assets/sounds/victory.mp3", defeat: "assets/sounds/defeat.mp3",
  click: "assets/sounds/click.mp3"
};
const sounds = Object.fromEntries(Object.entries(SOUND_PATHS).map(([name, filePath]) => {
  const audio = typeof Audio === "function" ? new Audio(filePath) : null;
  if (audio) audio.preload = "auto";
  return [name, audio];
}));
let soundUnlocked = false;

// Reproduce un sonido desde el principio sin detener el juego si falla.
function playSound(soundName) {
  const audio = sounds[soundName];
  if (!soundUnlocked || !audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// ================================
// ESTADO DEL JUEGO
// Guarda temporalmente las decisiones del jugador.
// ================================
const gameState = {
  selectedTeamIds: [],
  viewedCharacterId: null,
  initialCharacterId: null,
  teamConfirmed: false,
  selectedModeId: null,
  selectedArenaId: null,
  gameReady: false,
  currentScreen: "lobby"
};

let matchConfig = null;
let battleState = null;
let archiveFilter = "all";

const characterGrid = document.getElementById("character-grid");
const teamCounter = document.getElementById("team-counter");
const teamSlots = document.getElementById("team-slots");
const confirmTeamButton = document.getElementById("confirm-team-button");
const resetPlayerSetupButton = document.getElementById("reset-player-setup-button");
const confirmationStatus = document.getElementById("confirmation-status");
const characterDetail = document.getElementById("character-detail");
const detailFileNumber = document.getElementById("detail-file-number");
const detailConviction = document.getElementById("detail-conviction");
const lobbyFeaturedCharacter = document.getElementById("lobby-featured-character");
const lobbyCharacterImage = document.getElementById("lobby-character-image");
const lobbyCharacterName = document.getElementById("lobby-character-name");
const lobbyTeamCounter = document.getElementById("lobby-team-counter");
const lobbyTeamSlots = document.getElementById("lobby-team-slots");
const lobbyTeamStatus = document.getElementById("lobby-team-status");
const gameModesContainer = document.getElementById("game-modes");
const arenaGrid = document.getElementById("arena-grid");
const startConvergenceButton = document.getElementById("start-convergence-button");
const lobbyModeStatus = document.getElementById("lobby-mode-status");
const lobbyModeName = document.getElementById("lobby-mode-name");
const lobbyModeDescription = document.getElementById("lobby-mode-description");
const lobbyArenaStatus = document.getElementById("lobby-arena-status");
const lobbyArenaName = document.getElementById("lobby-arena-name");
const lobbyArenaDescription = document.getElementById("lobby-arena-description");
const versusSection = document.getElementById("versus-section");
const battlePreview = document.getElementById("battle-preview");
const resultsSection = document.getElementById("results-section");
const teamSection = document.getElementById("equipo");
const lobbySection = document.getElementById("lobby");
const archiveContent = document.getElementById("archive-content");
const appAnnouncer = document.getElementById("app-announcer");
const primaryNavigation = document.getElementById("primary-navigation");
const SCREEN_IDS = Object.freeze({
  lobby: "lobby",
  modes: "modos",
  characters: "cartas",
  "character-detail": "ficha",
  team: "equipo",
  arenas: "arenas",
  versus: "versus-section",
  battle: "battle-preview",
  results: "results-section",
  archive: "archivo"
});

// ================================
// NAVEGACIÓN ENTRE PANTALLAS
// ================================
function showScreen(screenId, options = {}) {
  const targetId = SCREEN_IDS[screenId];
  if (!targetId) return false;
  const target = document.getElementById(targetId);
  if (!target) return false;
  Object.entries(SCREEN_IDS).forEach(([name, elementId]) => {
    const screen = document.getElementById(elementId);
    if (!screen) return;
    const active = name === screenId;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
    screen.classList.toggle("is-hidden", !active);
    screen.setAttribute("aria-hidden", String(!active));
  });
  gameState.currentScreen = screenId;
  if (document.body?.dataset) document.body.dataset.currentScreen = screenId;
  const links = primaryNavigation?.querySelectorAll?.("[data-screen-target]") ?? [];
  links.forEach((link) => {
    const active = link.dataset.screenTarget === screenId;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (options.focus !== false) {
    const focusTarget = target.querySelector?.("h1, h2, [tabindex]");
    if (focusTarget) {
      focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus?.({ preventScroll: true });
    }
  }
  globalThis.scrollTo?.({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  announce("Pantalla " + screenId.replace("-", " ") + ".");
  return true;
}

function findCharacter(characterId) {
  return characters.find((character) => character.id === characterId) ?? null;
}

function displayValue(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function announce(message) {
  if (!appAnnouncer || !message) return;
  appAnnouncer.textContent = "";
  appAnnouncer.textContent = message;
}

function scrollToSection(sectionId) {
  const screenEntry = Object.entries(SCREEN_IDS).find(([, elementId]) => elementId === sectionId);
  return screenEntry ? showScreen(screenEntry[0]) : false;
}

function getTeamValidationMessage() {
  if (gameState.selectedTeamIds.length < MAX_TEAM_SIZE) return `SELECCIONA 5 PERSONAJES · ${gameState.selectedTeamIds.length}/${MAX_TEAM_SIZE}`;
  if (gameState.initialCharacterId === null) return "ELIGE UN PERSONAJE INICIAL";
  return gameState.teamConfirmed ? "EQUIPO CONFIRMADO" : "EQUIPO LISTO PARA CONFIRMAR";
}

function getStartValidationMessage() {
  if (gameState.selectedTeamIds.length < MAX_TEAM_SIZE) return "ELIGE 5 PERSONAJES";
  if (gameState.initialCharacterId === null) return "ELIGE UN PERSONAJE INICIAL";
  if (!gameState.teamConfirmed) return "EQUIPO SIN CONFIRMAR · CONFIRMA TU EQUIPO";
  if (gameState.selectedModeId === null) return "SELECCIONA UN MODO";
  if (gameState.selectedModeId !== "selection-combat") return "MODO EN DESARROLLO";
  if (gameState.selectedArenaId === null) return "SELECCIONA UNA ARENA";
  return matchConfig ? "PARTIDA PREPARADA" : "CONFIGURACIÓN COMPLETA";
}

function disabledAttributes(disabled) {
  return disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"';
}
function invalidatePreparedMatch() {
  matchConfig = null;
  battleState = null;
}

function loadPlayerSetup() {
  try {
    const rawSetup = globalThis.localStorage?.getItem(STORAGE_KEYS.playerSetup);
    if (!rawSetup) return null;
    const parsedSetup = JSON.parse(rawSetup);
    if (!parsedSetup || typeof parsedSetup !== "object" || Array.isArray(parsedSetup) || parsedSetup.version !== 1 || !Array.isArray(parsedSetup.selectedTeamIds)) return null;
    const selectedTeamIds = [...new Set(parsedSetup.selectedTeamIds)]
      .filter((characterId) => Number.isInteger(characterId) && Boolean(findCharacter(characterId)))
      .slice(0, MAX_TEAM_SIZE);
    const initialCharacterId = selectedTeamIds.includes(parsedSetup.initialCharacterId) ? parsedSetup.initialCharacterId : null;
    const selectedModeId = gameModes.some((mode) => mode.id === parsedSetup.selectedModeId) ? parsedSetup.selectedModeId : null;
    const selectedArenaId = arenas.some((arena) => arena.id === parsedSetup.selectedArenaId) ? parsedSetup.selectedArenaId : null;
    return { version: 1, selectedTeamIds, initialCharacterId, selectedModeId, selectedArenaId };
  } catch {
    return null;
  }
}

function savePlayerSetup() {
  const setupSnapshot = {
    version: 1,
    selectedTeamIds: [...gameState.selectedTeamIds],
    initialCharacterId: gameState.initialCharacterId,
    selectedModeId: gameState.selectedModeId,
    selectedArenaId: gameState.selectedArenaId
  };
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(STORAGE_KEYS.playerSetup, JSON.stringify(setupSnapshot));
    return true;
  } catch {
    return false;
  }
}

function commitPlayerSetupChange() {
  savePlayerSetup();
}

function restorePlayerSetup() {
  const storedSetup = loadPlayerSetup();
  if (!storedSetup) return false;
  gameState.selectedTeamIds = [...storedSetup.selectedTeamIds];
  gameState.initialCharacterId = storedSetup.initialCharacterId;
  gameState.selectedModeId = storedSetup.selectedModeId;
  gameState.selectedArenaId = storedSetup.selectedArenaId;
  gameState.teamConfirmed = false;
  gameState.gameReady = false;
  matchConfig = null;
  battleState = null;
  return true;
}

function resetPlayerSetup() {
  const confirmed = typeof globalThis.confirm === "function"
    ? globalThis.confirm("¿Restablecer la configuración local del jugador?")
    : false;
  if (!confirmed) return false;
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEYS.playerSetup);
  } catch {
    // El estado de sesión puede restablecerse aunque falle el almacenamiento.
  }
  gameState.selectedTeamIds = [];
  gameState.initialCharacterId = null;
  gameState.selectedModeId = null;
  gameState.selectedArenaId = null;
  gameState.teamConfirmed = false;
  gameState.gameReady = false;
  matchConfig = null;
  battleState = null;
  renderApp();
  return true;
}
// ================================
// PERSONAJES Y SELECCIÓN DEL EQUIPO
// ================================
function renderCharacters() {
  characterGrid.innerHTML = characters.map((character) => {
    const isSelected = gameState.selectedTeamIds.includes(character.id);
    const portrait = character.image
      ? `<img src="${character.image}" alt="${character.name}" style="object-position:${character.imagePosition || "center top"}">`
      : `<b>${character.name.slice(0, 2).toUpperCase()}</b>`;

    return `
      <article class="card${isSelected ? " picked" : ""}" data-character-id="${character.id}" role="button" tabindex="0" aria-pressed="${isSelected}">
        <div class="art${character.image ? "" : " p4"}">${portrait}<em>${character.status}</em></div>
        <small>${character.number} · ${character.className.toUpperCase()}</small>
        <h3>${character.name.toUpperCase()}</h3>
        <p>${character.ability}</p>
        <footer>${character.summary}</footer>
        <button class="view-character-button" type="button" data-action="view-character" data-character-id="${character.id}">VER FICHA</button>
      </article>`;
  }).join("");
}

function toggleCharacterSelection(characterId) {
  if (!findCharacter(characterId)) return;
  const isSelected = gameState.selectedTeamIds.includes(characterId);
  let changed = false;

  if (isSelected) {
    gameState.selectedTeamIds = gameState.selectedTeamIds.filter((id) => id !== characterId);
    if (gameState.initialCharacterId === characterId) gameState.initialCharacterId = null;
    gameState.teamConfirmed = false;
    changed = true;
  } else if (gameState.selectedTeamIds.length < MAX_TEAM_SIZE) {
    gameState.selectedTeamIds.push(characterId);
    gameState.teamConfirmed = false;
    changed = true;
  }
  if (!changed) return;
  invalidatePreparedMatch();
  commitPlayerSetupChange();
  announce(findCharacter(characterId).name + (isSelected ? " fue retirado del equipo." : " fue añadido al equipo."));
  renderApp();
}

function viewCharacter(characterId) {
  if (!findCharacter(characterId)) return;
  gameState.viewedCharacterId = characterId;
  renderCharacterDetail();
  showScreen("character-detail");
}

function renderTeamCounter() {
  teamCounter.textContent = `${gameState.selectedTeamIds.length} / ${MAX_TEAM_SIZE}`;
}

function renderTeamSlots() {
  const selectedCharacters = gameState.selectedTeamIds.map(findCharacter);
  teamSlots.innerHTML = Array.from({ length: MAX_TEAM_SIZE }, (_, index) => {
    const character = selectedCharacters[index];
    if (!character) return `<article><div>—</div><small>${String(index + 1).padStart(2, "0")}</small><b>VACÍO</b><span>DISPONIBLE</span></article>`;

    const isInitial = gameState.initialCharacterId === character.id;
    const portrait = character.image ? `<img src="${character.image}" alt="${character.name}">` : `<div>${character.name.slice(0, 2).toUpperCase()}</div>`;
    return `<article class="${isInitial ? "initial" : ""}" data-character-id="${character.id}">${portrait}<small>${character.number}</small><b>${character.name.toUpperCase()}</b><span>${isInitial ? "INICIAL" : "SELECCIONADO"}</span><button class="set-initial-button" type="button" data-action="set-initial" data-character-id="${character.id}" ${disabledAttributes(isInitial)}>${isInitial ? "INICIAL" : "ELEGIR INICIAL"}</button></article>`;
  }).join("");
}

function renderConfirmation() {
  const canConfirm = gameState.selectedTeamIds.length === MAX_TEAM_SIZE && gameState.initialCharacterId !== null;
  confirmTeamButton.disabled = !canConfirm;
  confirmTeamButton.setAttribute("aria-disabled", String(!canConfirm));
  confirmTeamButton.classList.toggle("is-disabled", !canConfirm);
  confirmationStatus.textContent = getTeamValidationMessage();
}

function renderCharacterDetail() {
  const character = findCharacter(gameState.viewedCharacterId);
  if (!character) {
    detailFileNumber.textContent = "EXPEDIENTE —";
    detailConviction.textContent = "CONVICCIÓN · [PENDIENTE]";
    characterDetail.innerHTML = `<div class="detail-placeholder">SELECCIONA “VER FICHA”</div>`;
    return;
  }

  detailFileNumber.textContent = `EXPEDIENTE ${character.number}`;
  detailConviction.textContent = `CONVICCIÓN · ${displayValue(character.conviction, "[PENDIENTE]").toUpperCase()}`;
  const portrait = character.image ? `<img src="${character.image}" alt="${character.name}">` : `<div class="detail-placeholder">${character.name.slice(0, 2).toUpperCase()}</div>`;
  const stats = Object.entries(STAT_LABELS).map(([key, label]) => {
    const value = character.stats[key];
    const percentage = value === null ? 0 : value;
    return `<p>${label} <i style="--v:${percentage}%"></i> ${displayValue(value)}</p>`;
  }).join("");
  const abilities = character.abilities.length
    ? character.abilities.map((ability, index) => `${String(index + 1).padStart(2, "0")} · ${ability.name}<br><small>${ability.description}</small>`).join("<br>")
    : "[PENDIENTE]";
  const maskStatus = character.mask.obtained ? "OBTENIDA" : "NO OBTENIDA";

  characterDetail.innerHTML = `
    <div class="sheet-portrait">${portrait}<span>${character.name.toUpperCase()}</span></div>
    <article><small>IDENTIDAD</small><h3>${character.name.toUpperCase()}</h3><p>${displayValue(character.age)} años<br>${displayValue(character.origin, "[PENDIENTE]")}<br>${displayValue(character.profession, "[PENDIENTE]")}</p><small>COMBATE</small><p>Clase: ${displayValue(character.className, "[PENDIENTE]")}<br>Capacidad: ${character.ability}<br><small>${displayValue(character.abilityDescription, "[PENDIENTE]")}</small></p></article>
    <article class="stats"><small>ESTADÍSTICAS</small>${stats}</article>
    <article><small>HABILIDADES</small><p>${abilities}</p><span class="detail-mask">MÁSCARA · ${maskStatus}</span><small>ARCHIVO</small><p>Historia: ${displayValue(character.history, "[PENDIENTE]")}<br>Deseo: ${displayValue(character.desire, "[DESCONOCIDO]")}<br>Conexiones: ${displayValue(character.connections, "[ARCHIVO INCOMPLETO]")}</p></article>`;
}

function renderLobby() {
  const selectedMode = gameModes.find((mode) => mode.id === gameState.selectedModeId) ?? null;
  const selectedArena = arenas.find((arena) => arena.id === gameState.selectedArenaId) ?? null;
  const initialCharacter = findCharacter(gameState.initialCharacterId);
  const reserveCharacters = gameState.selectedTeamIds.filter((id) => id !== gameState.initialCharacterId).map(findCharacter);

  lobbyModeName.textContent = selectedMode ? selectedMode.name.toUpperCase() : "SELECCIONA UN MODO";
  lobbyModeStatus.textContent = selectedMode ? selectedMode.status : "SIN SELECCIONAR";
  lobbyModeDescription.textContent = selectedMode ? selectedMode.description : "Selecciona un modo de juego.";
  lobbyArenaName.textContent = selectedArena ? selectedArena.location.toUpperCase() : "SELECCIONA UNA ARENA";
  lobbyArenaStatus.textContent = selectedArena ? selectedArena.number + " / " + String(arenas.length).padStart(2, "0") : "SIN SELECCIONAR";
  lobbyArenaDescription.textContent = selectedArena ? selectedArena.description : "Selecciona una arena.";
  lobbyTeamCounter.textContent = `${gameState.selectedTeamIds.length} / ${MAX_TEAM_SIZE}`;
  lobbyTeamStatus.textContent = `EQUIPO ${gameState.selectedTeamIds.length}/${MAX_TEAM_SIZE} · ${gameState.teamConfirmed ? "EQUIPO LISTO" : "SIN CONFIRMAR"}`;

  if (initialCharacter) {
    lobbyFeaturedCharacter.classList.remove("is-empty");
    lobbyCharacterName.textContent = `INICIAL · ${initialCharacter.name.toUpperCase()}`;
    if (initialCharacter.image) {
      lobbyCharacterImage.src = initialCharacter.image;
      lobbyCharacterImage.alt = initialCharacter.name;
      lobbyCharacterImage.hidden = false;
    } else {
      lobbyCharacterImage.removeAttribute("src");
      lobbyCharacterImage.alt = "";
      lobbyCharacterImage.hidden = true;
    }
  } else {
    lobbyFeaturedCharacter.classList.add("is-empty");
    lobbyCharacterImage.removeAttribute("src");
    lobbyCharacterImage.alt = "";
    lobbyCharacterImage.hidden = true;
    lobbyCharacterName.textContent = "ELIGE UN PERSONAJE INICIAL";
  }

  lobbyTeamSlots.innerHTML = Array.from({ length: MAX_TEAM_SIZE }, (_, index) => {
    const character = index === 0 ? initialCharacter : reserveCharacters[index - 1];
    if (!character) return `<article><span>—</span><b>${String(index + 1).padStart(2, "0")}</b><small>VACÍO</small></article>`;
    const portrait = character.image ? `<img src="${character.image}" alt="${character.name}">` : `<span>${character.name.slice(0, 2).toUpperCase()}</span>`;
    return `<article class="${index === 0 ? "active" : ""}">${portrait}<b>${character.number}</b><small>${index === 0 ? "INICIAL" : "RESERVA"}</small></article>`;
  }).join("");
}

function renderGameModes() {
  gameModesContainer.innerHTML = gameModes.map((mode) => {
    const isSelected = gameState.selectedModeId === mode.id;
    return `<article class="${isSelected ? "chosen" : ""}" data-mode-id="${mode.id}" role="button" tabindex="0" aria-pressed="${isSelected}"><b>${mode.number}</b><div><small>${mode.label}</small><h3>${mode.name.toUpperCase()}</h3><p>${mode.description}</p></div><span>${isSelected ? "SELECCIONADO" : mode.status}</span></article>`;
  }).join("");
}

function renderArenas() {
  arenaGrid.innerHTML = arenas.map((arena) => {
    const isSelected = gameState.selectedArenaId === arena.id;
    return `<article class="${arena.className}${isSelected ? " is-selected" : ""}" data-arena-id="${arena.id}" role="button" tabindex="0" aria-pressed="${isSelected}"><small>${arena.number}${isSelected ? " · SELECCIONADA" : ""}</small><h3>${arena.name.toUpperCase()}</h3><b>${arena.location}</b><p>${arena.description}</p></article>`;
  }).join("");
}

function updateGameReady() {
  gameState.gameReady = gameState.selectedModeId === "selection-combat"
    && gameState.selectedArenaId !== null
    && gameState.selectedTeamIds.length === MAX_TEAM_SIZE
    && gameState.initialCharacterId !== null
    && gameState.teamConfirmed;
}

function createMatchConfig() {
  return {
    modeId: gameState.selectedModeId,
    arenaId: gameState.selectedArenaId,
    teamIds: [...gameState.selectedTeamIds],
    initialCharacterId: gameState.initialCharacterId
  };
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

// Crea un equipo CPU variado y evita repetir al personaje inicial del jugador.
function generateCpuTeam(excludedCharacterId = null) {
  const characterIds = characters
    .map((character) => character.id)
    .filter((characterId) => characterId !== excludedCharacterId);
  return shuffleArray(characterIds).slice(0, MAX_TEAM_SIZE);
}

function chooseCpuInitialCharacter(cpuTeamIds) {
  const randomIndex = Math.floor(Math.random() * cpuTeamIds.length);
  return cpuTeamIds[randomIndex];
}

// ================================
// MOTOR DE COMBATE
// Estas funciones modifican salud, energía, turnos y efectos.
// ================================
function createBattleStats() {
  const createSideStats = () => ({
    basicAttacks: 0,
    abilitiesUsed: 0,
    defenses: 0,
    analyzes: 0,
    switches: 0,
    damageDealt: 0,
    damageReceived: 0,
    charactersDefeated: 0
  });
  return { totalTurns: 0, player: createSideStats(), cpu: createSideStats() };
}

function recordBattleAction(side, statName) {
  if (!battleState?.stats?.[side] || !Object.hasOwn(battleState.stats[side], statName)) return;
  battleState.stats[side][statName] += 1;
  battleState.stats.totalTurns += 1;
}

function recordSwitch(side, countsAsTurn) {
  if (!battleState?.stats?.[side]) return;
  battleState.stats[side].switches += 1;
  if (countsAsTurn) battleState.stats.totalTurns += 1;
}

function createBattleState(config) {
  const playerTeamIds = [...config.teamIds];
  const cpuTeamIds = generateCpuTeam(config.initialCharacterId);
  const cpuInitialCharacterId = chooseCpuInitialCharacter(cpuTeamIds);

  return {
    status: "ready",
    modeId: config.modeId,
    arenaId: config.arenaId,
    turn: null,
    turnNumber: 0,
    player: {
      teamIds: [...playerTeamIds],
      initialCharacterId: config.initialCharacterId,
      activeCharacterId: config.initialCharacterId,
      reserveIds: playerTeamIds.filter((id) => id !== config.initialCharacterId),
      fighters: {}
    },
    cpu: {
      teamIds: [...cpuTeamIds],
      initialCharacterId: cpuInitialCharacterId,
      activeCharacterId: cpuInitialCharacterId,
      reserveIds: cpuTeamIds.filter((id) => id !== cpuInitialCharacterId),
      fighters: {}
    },
    defending: { player: false, cpu: false },
    winner: null,
    log: [],
    stats: createBattleStats(),
    archived: false,
    archiveAttempted: false,
    switchSelectionOpen: false,
    cpuThinking: false,
    lastHitSide: null,
    actionEffect: null
  };
}

function createFighterState(characterId) {
  const character = findCharacter(characterId);
  const health = Number.isFinite(character?.stats?.health) && character.stats.health > 0
    ? character.stats.health : FALLBACK_BATTLE_STATS.health;
  const energy = Number.isFinite(character?.stats?.energy) && character.stats.energy >= 0
    ? character.stats.energy : FALLBACK_BATTLE_STATS.energy;
  return {
    characterId,
    currentHealth: health,
    maxHealth: health,
    currentEnergy: energy,
    maxEnergy: energy,
    defeated: false,
    activeEffects: []
  };
}

function initializeFighters(teamIds) {
  return Object.fromEntries(teamIds.map((characterId) => [characterId, createFighterState(characterId)]));
}

function getFighter(side, characterId = battleState?.[side]?.activeCharacterId) {
  return battleState?.[side]?.fighters?.[characterId] ?? null;
}

function getLivingReserveIds(side) {
  if (!battleState) return [];
  return battleState[side].teamIds.filter((characterId) => {
    const fighter = getFighter(side, characterId);
    return characterId !== battleState[side].activeCharacterId && fighter && !fighter.defeated;
  });
}

function syncReserveIds(side) {
  battleState[side].reserveIds = battleState[side].teamIds.filter(
    (characterId) => characterId !== battleState[side].activeCharacterId
  );
}

function safePercentage(current, maximum) {
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(100, (current / maximum) * 100));
}

function addBattleLog(message) {
  if (battleState) {
    battleState.log.push(message);
    battleState.log = battleState.log.slice(-MAX_BATTLE_LOG_ENTRIES);
  }
  announce(message);
}

// Activa una clase CSS breve sin repetir reglas del motor.
function showBattleEffect(side, type, duration = ACTION_FEEDBACK_MS) {
  if (!battleState) return;
  battleState.actionEffect = { side, type };
  renderBattle();
  globalThis.setTimeout?.(() => {
    if (!battleState || battleState.actionEffect?.side !== side || battleState.actionEffect?.type !== type) return;
    battleState.actionEffect = null;
    renderBattle();
  }, duration);
}

function createAbilityId(characterId, abilityIndex) {
  return "character-" + characterId + "-ability-" + (abilityIndex + 1);
}

function getAbility(side, abilityIndex) {
  const character = findCharacter(battleState?.[side]?.activeCharacterId);
  const officialAbility = character?.abilities?.[abilityIndex];
  if (!officialAbility) return null;
  const id = createAbilityId(character.id, abilityIndex);
  const configuredDefinition = PROTOTYPE_ABILITY_DEFINITIONS[id] ?? null;
  const provisionalDefinition = abilityIndex === 0 ? {
    type: "attack", target: "enemy", effect: "damage", tier: "standard",
    value: Number.isFinite(officialAbility.damage) ? officialAbility.damage : 25,
    energyCost: 20
  } : null;
  const definition = configuredDefinition ?? provisionalDefinition;
  const tier = definition?.tier ?? ["standard", "advanced", "special"][abilityIndex] ?? "standard";
  const officialCost = Number.isFinite(officialAbility.energyCost) ? officialAbility.energyCost : null;
  return {
    id,
    name: officialAbility.name,
    description: officialAbility.description,
    energyCost: definition ? officialCost ?? definition.energyCost ?? PROTOTYPE_ABILITY_COSTS[tier] : null,
    type: definition?.type ?? null,
    target: definition?.target ?? null,
    effect: definition?.effect ?? "pending",
    definition,
    status: definition ? "implemented" : "pending"
  };
}

function canUseAbility(side, abilityIndex) {
  if (!battleState || battleState.status !== "battle") return { valid: false, reason: "BATALLA INACTIVA", ability: null };
  if (battleState.turn !== side) return { valid: false, reason: "TURNO NO DISPONIBLE", ability: null };
  const fighter = getFighter(side);
  const ability = getAbility(side, abilityIndex);
  if (!fighter || fighter.defeated) return { valid: false, reason: "COMBATIENTE INACTIVO", ability };
  if (!ability) return { valid: false, reason: "SIN DATOS", ability: null };
  if (ability.effect === "pending") return { valid: false, reason: "MECÁNICA PENDIENTE", ability };
  if (!Number.isFinite(ability.energyCost)) return { valid: false, reason: "COSTE PENDIENTE", ability };
  if (fighter.currentEnergy < ability.energyCost) return { valid: false, reason: "ENERGÍA INSUFICIENTE", ability };
  return { valid: true, reason: "", ability };
}

function spendEnergy(side, amount) {
  const fighter = getFighter(side);
  if (!fighter || fighter.defeated || !Number.isFinite(amount) || amount < 0 || fighter.currentEnergy < amount) return false;
  fighter.currentEnergy = Math.max(0, fighter.currentEnergy - amount);
  return true;
}

function regenerateEnergy(side) {
  const fighter = getFighter(side);
  if (!fighter || fighter.defeated) return 0;
  const previousEnergy = fighter.currentEnergy;
  fighter.currentEnergy = Math.min(fighter.maxEnergy, fighter.currentEnergy + PROTOTYPE_ENERGY_REGEN);
  const recovered = fighter.currentEnergy - previousEnergy;
  if (recovered > 0) addBattleLog(findCharacter(fighter.characterId).name + " recuperó " + recovered + " de energía.");
  return recovered;
}

function getActiveEffects(side) {
  const fighter = getFighter(side);
  return !fighter || fighter.defeated ? [] : fighter.activeEffects;
}

function addEffect(side, effect) {
  const fighter = getFighter(side);
  if (!fighter || fighter.defeated) return false;
  const normalizedEffect = {
    id: effect.id,
    name: effect.name,
    sourceCharacterId: effect.sourceCharacterId,
    type: effect.type,
    value: effect.value,
    duration: effect.duration,
    remainingTurns: effect.duration,
    expiresOnSwitch: Boolean(effect.expiresOnSwitch),
    consumeOnTrigger: Boolean(effect.consumeOnTrigger)
  };
  const existingIndex = fighter.activeEffects.findIndex((item) => item.id === normalizedEffect.id);
  if (existingIndex >= 0) fighter.activeEffects[existingIndex] = normalizedEffect;
  else fighter.activeEffects.push(normalizedEffect);
  addBattleLog(normalizedEffect.name + " estará activo durante " + normalizedEffect.duration + " turno" + (normalizedEffect.duration === 1 ? "" : "s") + ".");
  return true;
}

function removeEffect(side, effectId, announce = false) {
  const fighter = getFighter(side);
  if (!fighter) return;
  const effect = fighter.activeEffects.find((item) => item.id === effectId);
  fighter.activeEffects = fighter.activeEffects.filter((item) => item.id !== effectId);
  if (announce && effect) addBattleLog(effect.name + " terminó.");
}

function tickEffects(side) {
  const fighter = getFighter(side);
  if (!fighter || fighter.defeated) return;
  const expiredIds = [];
  fighter.activeEffects.forEach((effect) => {
    if (Number.isFinite(effect.remainingTurns)) {
      effect.remainingTurns -= 1;
      if (effect.remainingTurns <= 0) expiredIds.push(effect.id);
    }
  });
  expiredIds.forEach((effectId) => removeEffect(side, effectId, true));
}

function removeEffectsOnSwitch(side, characterId) {
  const fighter = getFighter(side, characterId);
  if (!fighter) return;
  const expired = fighter.activeEffects.filter((effect) => effect.expiresOnSwitch);
  fighter.activeEffects = fighter.activeEffects.filter((effect) => !effect.expiresOnSwitch);
  expired.forEach((effect) => addBattleLog(effect.name + " terminó al cambiar de combatiente."));
}

function calculateDamage(attackerSide, targetSide, baseDamage) {
  const attackerModifier = getActiveEffects(attackerSide)
    .filter((effect) => effect.type === "damage-increase")
    .reduce((total, effect) => total * effect.value, 1);
  const defenderEffects = getActiveEffects(targetSide).filter((effect) => effect.type === "damage-reduction");
  const defenderModifier = defenderEffects.reduce((total, effect) => total * (1 - effect.value), 1);
  const defended = battleState.defending[targetSide];
  const defenseModifier = defended ? DEFENSE_DAMAGE_REDUCTION : 1;
  return {
    damage: Math.max(0, Math.round(baseDamage * attackerModifier * defenderModifier * defenseModifier)),
    defended,
    consumedEffectIds: defenderEffects.filter((effect) => effect.consumeOnTrigger).map((effect) => effect.id)
  };
}

function finishBattle(winner) {
  battleState.status = "finished";
  battleState.turn = null;
  battleState.winner = winner;
  battleState.switchSelectionOpen = false;
  battleState.cpuThinking = false;
  addBattleLog(winner === "player" ? "VICTORIA: el equipo CPU ha sido derrotado." : "DERROTA: tu equipo ha sido derrotado.");
  playSound(winner === "player" ? "victory" : "defeat");
  showBattleEffect(winner, "winner", 900);
  archiveFinishedMatch();
  showScreen("results");
}

function allFightersDefeated(side) {
  return battleState[side].teamIds.every((characterId) => getFighter(side, characterId)?.defeated);
}

function chooseRandomLivingReserve(side) {
  const availableIds = getLivingReserveIds(side);
  return availableIds.length ? availableIds[Math.floor(Math.random() * availableIds.length)] : null;
}

function performMandatoryCpuSwitch() {
  const nextCharacterId = chooseRandomLivingReserve("cpu");
  if (!nextCharacterId) {
    finishBattle("player");
    return false;
  }
  battleState.cpu.activeCharacterId = nextCharacterId;
  syncReserveIds("cpu");
  recordSwitch("cpu", false);
  addBattleLog("CPU envía a " + findCharacter(nextCharacterId).name + " como combatiente activo.");
  return true;
}

function handleActiveDefeat(side, responsibleSide = side === "player" ? "cpu" : "player") {
  const fighter = getFighter(side);
  if (!fighter || fighter.currentHealth > 0 || fighter.defeated) return false;
  fighter.currentHealth = 0;
  fighter.defeated = true;
  battleState.defending[side] = false;
  if (battleState.stats?.[responsibleSide]) battleState.stats[responsibleSide].charactersDefeated += 1;
  addBattleLog(findCharacter(fighter.characterId).name + " ha sido derrotado.");
  if (allFightersDefeated(side)) {
    finishBattle(side === "player" ? "cpu" : "player");
    return true;
  }
  if (side === "cpu") performMandatoryCpuSwitch();
  else {
    battleState.status = "player-must-switch";
    battleState.turn = "player";
    battleState.cpuThinking = false;
    battleState.switchSelectionOpen = true;
    addBattleLog("TU PERSONAJE FUE DERROTADO. ELIGE UN REEMPLAZO.");
  }
  return true;
}

function applyDamage(attackerSide, targetSide, baseDamage) {
  const fighter = getFighter(targetSide);
  if (!fighter || fighter.defeated) return 0;
  const result = calculateDamage(attackerSide, targetSide, baseDamage);
  if (result.defended) battleState.defending[targetSide] = false;
  result.consumedEffectIds.forEach((effectId) => removeEffect(targetSide, effectId, true));
  fighter.currentHealth = Math.max(0, fighter.currentHealth - result.damage);
  playSound("hit");
  showBattleEffect(targetSide, "hit", HIT_FEEDBACK_MS);
  battleState.lastHitSide = targetSide;
  if (typeof globalThis.setTimeout === "function") {
    globalThis.setTimeout(() => {
      if (!battleState || battleState.lastHitSide !== targetSide) return;
      battleState.lastHitSide = null;
      renderBattle();
    }, HIT_FEEDBACK_MS);
  }
  if (battleState.stats?.[attackerSide] && battleState.stats?.[targetSide]) {
    battleState.stats[attackerSide].damageDealt += result.damage;
    battleState.stats[targetSide].damageReceived += result.damage;
  }
  addBattleLog(findCharacter(fighter.characterId).name + " recibe " + result.damage + " de daño" + (result.defended ? " tras defenderse" : "") + ".");
  handleActiveDefeat(targetSide, attackerSide);
  return result.damage;
}

function beginTurn(side) {
  if (!battleState || battleState.status !== "battle") return;
  battleState.turn = side;
  tickEffects(side);
  regenerateEnergy(side);
}

function startBattle() {
  if (!battleState || battleState.status !== "ready") return;
  battleState.player.fighters = initializeFighters(battleState.player.teamIds);
  battleState.cpu.fighters = initializeFighters(battleState.cpu.teamIds);
  battleState.status = "battle";
  battleState.turnNumber = 1;
  battleState.winner = null;
  battleState.log = [];
  battleState.switchSelectionOpen = false;
  addBattleLog("Comienza la batalla: " + findCharacter(battleState.player.activeCharacterId).name + " contra " + findCharacter(battleState.cpu.activeCharacterId).name + ".");
  beginTurn("player");
  renderApp();
  showScreen("battle");
}

function canPlayerAct() {
  return battleState?.status === "battle" && battleState.turn === "player";
}

function endCpuTurn() {
  if (!battleState || battleState.status === "finished") return;
  battleState.turnNumber += 1;
  if (battleState.status === "player-must-switch") return;
  beginTurn("player");
}

function getValidCpuActions() {
  if (!battleState || battleState.status !== "battle" || battleState.turn !== "cpu") return [];
  const actions = [{ type: "attack" }, { type: "defend" }];
  for (let abilityIndex = 0; abilityIndex < 3; abilityIndex += 1) {
    if (canUseAbility("cpu", abilityIndex).valid) actions.push({ type: "ability", abilityIndex });
  }
  return actions;
}

function performCpuTurn() {
  if (!battleState || battleState.status !== "battle" || battleState.turn !== "cpu") return;
  const cpu = findCharacter(battleState.cpu.activeCharacterId);
  const actions = getValidCpuActions();
  const action = actions[Math.floor(Math.random() * actions.length)];
  if (action.type === "attack") {
    playSound("attack");
    showBattleEffect("cpu", "attacking");
    addBattleLog("CPU: " + cpu.name + " usa ATAQUE BÁSICO.");
    recordBattleAction("cpu", "basicAttacks");
    applyDamage("cpu", "player", BASIC_ATTACK_DAMAGE);
    endCpuTurn();
  } else if (action.type === "defend") {
    playSound("defense");
    showBattleEffect("cpu", "defending");
    battleState.defending.cpu = true;
    recordBattleAction("cpu", "defenses");
    addBattleLog("CPU: " + cpu.name + " se prepara para defender.");
    endCpuTurn();
  } else useAbility("cpu", action.abilityIndex);
}

function completeCpuTurnPresentation() {
  if (!battleState || battleState.status !== "battle" || battleState.turn !== "cpu") return;
  battleState.cpuThinking = false;
  performCpuTurn();
  renderApp();
}

function endPlayerTurn() {
  if (!battleState || battleState.status !== "battle") return;
  beginTurn("cpu");
  battleState.cpuThinking = true;
  renderApp();
  if (typeof globalThis.setTimeout === "function") {
    globalThis.setTimeout(completeCpuTurnPresentation, CPU_TURN_DELAY_MS);
  } else completeCpuTurnPresentation();
}

function basicAttack() {
  if (!canPlayerAct()) return;
  const player = findCharacter(battleState.player.activeCharacterId);
  addBattleLog(player.name + " usa ATAQUE BÁSICO.");
  playSound("attack");
  showBattleEffect("player", "attacking");
  recordBattleAction("player", "basicAttacks");
  applyDamage("player", "cpu", BASIC_ATTACK_DAMAGE);
  if (battleState.status === "battle") endPlayerTurn();
  else renderApp();
}

function defend() {
  if (!canPlayerAct()) return;
  const player = findCharacter(battleState.player.activeCharacterId);
  playSound("defense");
  showBattleEffect("player", "defending");
  battleState.defending.player = true;
  recordBattleAction("player", "defenses");
  addBattleLog(player.name + " se prepara para defender.");
  endPlayerTurn();
}

function analyzeOpponent() {
  if (!canPlayerAct()) return;
  const cpu = findCharacter(battleState.cpu.activeCharacterId);
  const fighter = getFighter("cpu");
  recordBattleAction("player", "analyzes");
  addBattleLog("ANÁLISIS: " + cpu.name + ", " + cpu.className + ", " + fighter.currentHealth + "/" + fighter.maxHealth + " de salud, " + fighter.currentEnergy + "/" + fighter.maxEnergy + " de energía.");
  endPlayerTurn();
}

const abilityHandlers = {
  damage({ side, ability }) {
    const targetSide = side === "player" ? "cpu" : "player";
    return applyDamage(side, targetSide, ability.definition.value);
  },
  "damage-reduction"({ side, ability, character }) {
    return addEffect(side, {
      id: ability.id + "-effect",
      name: ability.name,
      sourceCharacterId: character.id,
      type: "damage-reduction",
      value: ability.definition.value,
      duration: ability.definition.duration,
      expiresOnSwitch: false,
      consumeOnTrigger: true
    });
  }
};

function resolveAbilityEffect(side, ability, character) {
  const handler = abilityHandlers[ability.effect];
  if (!handler) return false;
  handler({ side, ability, character });
  return true;
}

function useAbility(side, abilityIndex) {
  const validation = canUseAbility(side, abilityIndex);
  const character = findCharacter(battleState?.[side]?.activeCharacterId);
  if (!validation.valid) {
    if (battleState && character) {
      addBattleLog(character.name + " no puede usar " + (validation.ability?.name ?? "esa habilidad") + ": " + validation.reason + ".");
      renderBattle();
    }
    return false;
  }
  const ability = validation.ability;
  if (!abilityHandlers[ability.effect]) {
    addBattleLog("La mecánica de " + ability.name + " está pendiente; no se consumió energía.");
    renderBattle();
    return false;
  }
  if (!spendEnergy(side, ability.energyCost)) {
    addBattleLog(character.name + " no tiene suficiente energía para " + ability.name + ".");
    renderBattle();
    return false;
  }
  addBattleLog(character.name + " utilizó " + ability.name + ".");
  addBattleLog(character.name + " gastó " + ability.energyCost + " de energía.");
  playSound("ability");
  showBattleEffect(side, "using-skill");
  recordBattleAction(side, "abilitiesUsed");
  if (!resolveAbilityEffect(side, ability, character)) {
    const fighter = getFighter(side);
    fighter.currentEnergy = Math.min(fighter.maxEnergy, fighter.currentEnergy + ability.energyCost);
    addBattleLog("La mecánica de " + ability.name + " está pendiente; no se consumió energía.");
    renderBattle();
    return false;
  }
  if (battleState.status === "finished") renderApp();
  else if (side === "player" && battleState.status === "battle") endPlayerTurn();
  else if (side === "cpu") endCpuTurn();
  return true;
}

function openSwitchSelection() {
  if (!canPlayerAct() || !getLivingReserveIds("player").length) return;
  battleState.switchSelectionOpen = true;
  renderBattle();
}

function switchPlayerCharacter(characterId) {
  if (!battleState || battleState.turn !== "player") return false;
  const mandatory = battleState.status === "player-must-switch";
  if (!mandatory && battleState.status !== "battle") return false;
  if (!getLivingReserveIds("player").includes(characterId)) return false;
  const previousCharacterId = battleState.player.activeCharacterId;
  removeEffectsOnSwitch("player", previousCharacterId);
  battleState.player.activeCharacterId = characterId;
  syncReserveIds("player");
  battleState.switchSelectionOpen = false;
  battleState.cpuThinking = false;
  battleState.status = "battle";
  recordSwitch("player", !mandatory);
  addBattleLog((mandatory ? "Reemplazo obligatorio" : "Cambio voluntario") + ": entra " + findCharacter(characterId).name + ".");
  if (mandatory) {
    beginTurn("player");
    renderApp();
  } else endPlayerTurn();
  return true;
}
function renderReserveCards(reserveIds, side) {
  return reserveIds.map((characterId) => {
    const character = findCharacter(characterId);
    const fighter = getFighter(side, characterId);
    const portrait = character.image ? `<img src="${character.image}" alt="${character.name}">` : `<i>${character.name.slice(0, 2).toUpperCase()}</i>`;
    const state = fighter?.defeated ? "DERROTADO" : fighter ? `${fighter.currentHealth}/${fighter.maxHealth}` : "LISTO";
    return `<span class="${fighter?.defeated ? "is-defeated" : ""}" data-character-id="${character.id}" data-side="${side}">${portrait}${character.number} · ${character.name.toUpperCase()}<small>${state}</small></span>`;
  }).join("");
}

// ================================
// INTERFAZ DE ENFRENTAMIENTO Y BATALLA
// ================================
function renderVersusSide(side, character) {
  const sideLabel = side === "player" ? "JUGADOR" : "CPU";
  const portrait = character.image
    ? '<img src="' + character.image + '" alt="Tarjeta completa de ' + character.name + '">'
    : '<div class="versus-placeholder" role="img" aria-label="Retrato pendiente de ' + character.name + '">' + character.name.slice(0, 2).toUpperCase() + '</div>';
  return '<article class="versus-side versus-side-' + side + '" data-character-id="' + character.id + '" data-side="' + side + '">' +
    '<header class="versus-identity"><small>' + sideLabel + ' · ' + character.number + '</small><h2>' + character.name.toUpperCase() + '</h2><p>' + character.ability.toUpperCase() + '</p></header>' +
    '<div class="versus-portrait">' + portrait + '</div>' +
    '<div class="versus-reserve-strip"><small>RESERVAS</small><div class="versus-reserves">' + renderReserveCards(battleState[side].reserveIds, side) + '</div></div></article>';
}

function renderVersus() {
  if (!battleState) {
    versusSection.innerHTML = '<h2 class="section-context">ENFRENTAMIENTO</h2><small>CONFIGURACIÓN DE PARTIDA</small><div class="battle-empty">NO HAY PARTIDA PREPARADA</div>';
    return;
  }
  const player = findCharacter(battleState.player.activeCharacterId);
  const cpu = findCharacter(battleState.cpu.activeCharacterId);
  const arena = arenas.find((item) => item.id === battleState.arenaId);
  const startControl = battleState.status === "ready"
    ? '<button class="start-battle-button" type="button" data-action="start-battle">COMENZAR BATALLA</button>'
    : '<small>' + (battleState.status === "finished" ? "BATALLA FINALIZADA" : "TURNO " + battleState.turnNumber) + '</small>';
  versusSection.innerHTML = '<header class="versus-context"><small>' + arena.number + ' · ' + arena.name.toUpperCase() + ' · ' + arena.location.toUpperCase() + '</small></header>' +
    '<div class="versus-layout">' + renderVersusSide("player", player) +
    '<section class="versus-center" aria-label="Enfrentamiento"><div class="versus-score"><span>1</span><b>VS</b><span>1</span></div>' + startControl + '</section>' +
    renderVersusSide("cpu", cpu) + '</div>';
}

function renderHudFighter(side) {
  const fighter = getFighter(side);
  const character = findCharacter(battleState[side].activeCharacterId);
  const ready = battleState.status === "ready";
  const health = ready ? createFighterState(character.id) : fighter;
  const healthPercentage = safePercentage(health.currentHealth, health.maxHealth);
  const energyPercentage = safePercentage(health.currentEnergy, health.maxEnergy);
  const defendingText = battleState.defending[side] ? " · DEFENDIENDO" : "";

  return `<article><small>${side === "player" ? "JUGADOR" : "CPU"} · ACTIVA${defendingText}</small><h3>${character.name.toUpperCase()}</h3><p>♥ SALUD <i style="--v:${healthPercentage}%"></i> ${health.currentHealth} / ${health.maxHealth}</p><p>◈ ENERGÍA <i style="--v:${energyPercentage}%"></i> ${health.currentEnergy} / ${health.maxEnergy}</p><b>CONVICCIÓN · ${displayValue(character.conviction).toUpperCase()}</b>${renderEffectBadges(side)}</article>`;
}

function renderBattleReserves(side) {
  return battleState[side].reserveIds.map((characterId) => {
    const character = findCharacter(characterId);
    const fighter = getFighter(side, characterId);
    const defeated = fighter?.defeated;
    const status = fighter ? (defeated ? "DERROTADO" : `${fighter.currentHealth}/${fighter.maxHealth}`) : "LISTO";
    return `<span class="${defeated ? "is-defeated" : ""}">${character.number} ${character.name} <small>${status}</small></span>`;
  }).join("");
}

function renderSwitchSelection() {
  if (!battleState.switchSelectionOpen && battleState.status !== "player-must-switch") return "";
  const mandatory = battleState.status === "player-must-switch";
  const cards = getLivingReserveIds("player").map((characterId) => {
    const character = findCharacter(characterId);
    const fighter = getFighter("player", characterId);
    const portrait = character.image
      ? '<img src="' + character.image + '" alt="">'
      : '<span class="switch-placeholder">' + character.name.slice(0, 2).toUpperCase() + '</span>';
    return '<article class="switch-option">' + portrait + '<div><small>DISPONIBLE</small><b>' + character.name.toUpperCase() + '</b><p>SALUD · ' + fighter.currentHealth + ' / ' + fighter.maxHealth + '<br>ENERGÍA · ' + fighter.currentEnergy + ' / ' + fighter.maxEnergy + '</p></div><button type="button" data-action="switch-character" data-character-id="' + characterId + '">ELEGIR REEMPLAZO</button></article>';
  }).join("");
  return '<aside class="switch-selection' + (mandatory ? " is-mandatory" : "") + '" role="dialog" aria-modal="' + mandatory + '" aria-labelledby="switch-selection-title"><div class="switch-selection-panel"><header><small>' + (mandatory ? "CAMBIO OBLIGATORIO" : "CAMBIO VOLUNTARIO") + '</small><h2 id="switch-selection-title">' + (mandatory ? "TU PERSONAJE FUE DERROTADO. ELIGE UN REEMPLAZO." : "ELIGE UNA RESERVA") + '</h2></header><div class="switch-options">' + cards + '</div></div></aside>';
}

function renderBattleLog() {
  const entries = battleState.log.map((entry) => `<li>${entry}</li>`).join("");
  return `<aside class="battle-log"><b>REGISTRO DE BATALLA</b><ol data-battle-log>${entries || "<li>La batalla aún no ha comenzado.</li>"}</ol></aside>`;
}

function renderEffectBadges(side) {
  const fighter = getFighter(side);
  if (!fighter || battleState.status === "ready") return "";
  const badges = [];
  if (battleState.defending[side]) badges.push('<span>DEFENSA · 1 USO</span>');
  fighter.activeEffects.forEach((effect) => {
    badges.push('<span>' + effect.name.toUpperCase() + ' · ' + effect.remainingTurns + ' TURNO' + (effect.remainingTurns === 1 ? '' : 'S') + '</span>');
  });
  return badges.length ? '<div class="active-effects">' + badges.join('') + '</div>' : '';
}

function renderAbilityButton(abilityIndex, canAct) {
  const slotLabels = ["HABILIDAD 1", "HABILIDAD 2", "ESPECIAL"];
  const ability = getAbility("player", abilityIndex);
  if (!ability) {
    return '<button disabled title="SIN DATOS">' + slotLabels[abilityIndex] + '<small>PENDIENTE</small></button>';
  }
  const validation = canUseAbility("player", abilityIndex);
  const enabled = canAct && validation.valid;
  const statusText = ability.status === "pending" ? "MECÁNICA PENDIENTE" : (!enabled && validation.reason ? validation.reason : ability.energyCost + " EN");
  const reason = enabled ? ability.description : validation.reason || ability.description;
  return '<button type="button" data-action="use-ability" data-ability-index="' + abilityIndex + '" ' +
    (enabled ? '' : 'disabled aria-disabled="true"') + ' title="' + reason + '" aria-label="' + ability.name + '. ' + reason + '">' +
    slotLabels[abilityIndex] + '<small>' + ability.name.toUpperCase() + ' · ' + statusText + '</small></button>';
}
// Crea una carta de combate sencilla: solo retrato y nombre.
function renderBattleCharacter(character, side, effectClass) {
  const portrait = character.image
    ? `<img src="${character.image}" alt="${character.name}" style="object-position:${character.imagePosition || "center top"}">`
    : `<div class="detail-placeholder" role="img" aria-label="Imagen pendiente de ${character.name}">${character.name.slice(0, 2).toUpperCase()}</div>`;
  return `<article class="battle-character fighter-visual fighter-${side}${effectClass}"><div class="battle-character-image">${portrait}</div><b class="battle-character-name">${character.name.toUpperCase()}</b></article>`;
}

function renderBattle() {
  battlePreview.classList.toggle("is-cpu-thinking", Boolean(battleState?.cpuThinking));
  if (!battleState) {
    battlePreview.innerHTML = `<h2 class="section-context">COMBATE</h2><div class="battle-scene"></div><div class="battle-empty">NO HAY PARTIDA PREPARADA</div>`;
    return;
  }

  const player = findCharacter(battleState.player.activeCharacterId);
  const cpu = findCharacter(battleState.cpu.activeCharacterId);
  const arena = arenas.find((item) => item.id === battleState.arenaId);
  const canAct = canPlayerAct();
  const finishedMessage = battleState.status === "finished"
    ? `<div class="battle-result ${battleState.winner === "player" ? "is-victory" : "is-defeat"}">${battleState.winner === "player" ? "VICTORIA" : "DERROTA"}</div>`
    : "";
  const turnLabel = battleState.status === "ready"
    ? "ESPERANDO INICIO"
    : battleState.status === "player-must-switch"
      ? "CAMBIO OBLIGATORIO"
      : battleState.status === "finished"
        ? "BATALLA FINALIZADA"
        : battleState.turn === "player"
          ? `TURNO ${battleState.turnNumber} · TU TURNO`
          : `TURNO ${battleState.turnNumber} · TURNO CPU${battleState.cpuThinking ? " · PROCESANDO" : ""}`;

  const effect = battleState.actionEffect;
  const playerEffect = effect?.side === "player" ? ` is-${effect.type}` : "";
  const cpuEffect = effect?.side === "cpu" ? ` is-${effect.type}` : "";

  battlePreview.innerHTML = `<div class="battle-scene"></div>${finishedMessage}<header>${renderHudFighter("player")}<strong>1 <span>VS</span> 1<small>${arena.name.toUpperCase()} · ${arena.location.toUpperCase()}<br>${turnLabel}</small></strong>${renderHudFighter("cpu")}</header><div class="fighters${battleState.lastHitSide ? ` is-hit-${battleState.lastHitSide}` : ""}">${renderBattleCharacter(player, "player", playerEffect)}<div class="versus-mark"></div>${renderBattleCharacter(cpu, "cpu", cpuEffect)}</div>${renderSwitchSelection()}<footer><p>ACTIVA <b>${player.number}</b><span class="battle-reserves">${renderBattleReserves("player")}</span></p><div><button type="button" data-action="basic-attack" ${disabledAttributes(!canAct)}>ATAQUE BÁSICO</button>${renderAbilityButton(0, canAct)}${renderAbilityButton(1, canAct)}${renderAbilityButton(2, canAct)}<button type="button" data-action="defend" ${disabledAttributes(!canAct)}>DEFENDER</button><button type="button" data-action="analyze" ${disabledAttributes(!canAct)}>ANALIZAR</button><button type="button" data-action="open-switch" ${disabledAttributes(!(canAct && getLivingReserveIds("player").length))}>CAMBIAR</button></div><p><span class="battle-reserves">${renderBattleReserves("cpu")}</span><b>${cpu.number}</b> ACTIVA</p></footer>${renderBattleLog()}`;
  const log = battlePreview.querySelector?.("[data-battle-log]");
  if (log) log.scrollTop = log.scrollHeight;
}
// ================================
// ARCHIVO DE PARTIDAS
// Se guarda en localStorage para conservar el historial del navegador.
// ================================
function loadMatchHistory() {
  try {
    const rawHistory = globalThis.localStorage?.getItem(STORAGE_KEYS.matchHistory);
    if (!rawHistory) return [];
    const parsedHistory = JSON.parse(rawHistory);
    return Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch {
    return [];
  }
}

function saveMatchHistory(history) {
  try {
    if (!globalThis.localStorage || !Array.isArray(history)) return false;
    globalThis.localStorage.setItem(STORAGE_KEYS.matchHistory, JSON.stringify(history.slice(-MAX_MATCH_HISTORY)));
    return true;
  } catch {
    return false;
  }
}

function createLocalMatchId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    // El fallback mantiene disponible el archivo si crypto no está accesible.
  }
  return "match-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function copyHistorySideStats(stats = {}) {
  return {
    basicAttacks: Number.isFinite(stats.basicAttacks) ? stats.basicAttacks : 0,
    abilitiesUsed: Number.isFinite(stats.abilitiesUsed) ? stats.abilitiesUsed : 0,
    defenses: Number.isFinite(stats.defenses) ? stats.defenses : 0,
    analyzes: Number.isFinite(stats.analyzes) ? stats.analyzes : 0,
    switches: Number.isFinite(stats.switches) ? stats.switches : 0,
    damageDealt: Number.isFinite(stats.damageDealt) ? stats.damageDealt : 0,
    damageReceived: Number.isFinite(stats.damageReceived) ? stats.damageReceived : 0,
    charactersDefeated: Number.isFinite(stats.charactersDefeated) ? stats.charactersDefeated : 0
  };
}

function createMatchHistoryEntry() {
  if (!battleState || battleState.status !== "finished" || !["player", "cpu"].includes(battleState.winner)) return null;
  return {
    id: createLocalMatchId(),
    completedAt: new Date().toISOString(),
    modeId: battleState.modeId,
    arenaId: battleState.arenaId,
    winner: battleState.winner,
    player: {
      teamIds: [...battleState.player.teamIds],
      initialCharacterId: battleState.player.initialCharacterId
    },
    cpu: {
      teamIds: [...battleState.cpu.teamIds],
      initialCharacterId: battleState.cpu.initialCharacterId
    },
    stats: {
      totalTurns: Number.isFinite(battleState.stats?.totalTurns) ? battleState.stats.totalTurns : 0,
      player: copyHistorySideStats(battleState.stats?.player),
      cpu: copyHistorySideStats(battleState.stats?.cpu)
    }
  };
}

function archiveFinishedMatch() {
  if (!battleState || battleState.status !== "finished" || !["player", "cpu"].includes(battleState.winner)) return false;
  if (battleState.archived || battleState.archiveAttempted) return false;
  battleState.archiveAttempted = true;
  const entry = createMatchHistoryEntry();
  if (!entry) return false;
  const history = loadMatchHistory();
  history.push(entry);
  const saved = saveMatchHistory(history);
  battleState.archived = saved;
  renderArchive();
  return saved;
}

function getArchiveSummary(history) {
  const matches = Array.isArray(history) ? history : [];
  const victories = matches.filter((entry) => entry?.winner === "player").length;
  const defeats = matches.filter((entry) => entry?.winner === "cpu").length;
  return {
    matches: matches.length,
    victories,
    defeats,
    winPercentage: matches.length ? Math.round((victories / matches.length) * 100) : 0
  };
}

function resolveCharacterName(characterId) {
  return findCharacter(characterId)?.name ?? "—";
}

function resolveArenaName(arenaId) {
  return arenas.find((arena) => arena.id === arenaId)?.location ?? "—";
}

function resolveModeName(modeId) {
  return gameModes.find((mode) => mode.id === modeId)?.name ?? "—";
}

function formatArchiveDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function archiveNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function renderArchiveEntry(entry) {
  const winner = entry?.winner === "player" ? "VICTORIA" : entry?.winner === "cpu" ? "DERROTA" : "—";
  const playerStats = entry?.stats?.player ?? {};
  const cpuStats = entry?.stats?.cpu ?? {};
  const playerTeam = Array.isArray(entry?.player?.teamIds) ? entry.player.teamIds.map(resolveCharacterName).join(" · ") : "—";
  const cpuTeam = Array.isArray(entry?.cpu?.teamIds) ? entry.cpu.teamIds.map(resolveCharacterName).join(" · ") : "—";
  const matchId = typeof entry?.id === "string" ? entry.id.replace(/[^a-zA-Z0-9_-]/g, "") : "";
  return `<article class="archive-match ${winner === "VICTORIA" ? "is-victory" : winner === "DERROTA" ? "is-defeat" : ""}" data-match-id="${matchId}">
    <small>${formatArchiveDate(entry?.completedAt)} · ${winner}</small>
    <h3>${resolveModeName(entry?.modeId)}</h3>
    <p>ARENA · ${resolveArenaName(entry?.arenaId)}<br>INICIAL JUGADOR · ${resolveCharacterName(entry?.player?.initialCharacterId)}<br>INICIAL CPU · ${resolveCharacterName(entry?.cpu?.initialCharacterId)}</p>
    <div class="archive-match-stats"><span>TURNOS <b>${archiveNumber(entry?.stats?.totalTurns)}</b></span><span>DAÑO CAUSADO <b>${archiveNumber(playerStats.damageDealt)}</b></span><span>DAÑO RECIBIDO <b>${archiveNumber(playerStats.damageReceived)}</b></span></div>
    <details><summary>VER DETALLE</summary><p>EQUIPO JUGADOR · ${playerTeam}<br>EQUIPO CPU · ${cpuTeam}</p><div class="archive-detail-stats"><span>ATAQUES · ${archiveNumber(playerStats.basicAttacks)}</span><span>HABILIDADES · ${archiveNumber(playerStats.abilitiesUsed)}</span><span>DEFENSAS · ${archiveNumber(playerStats.defenses)}</span><span>ANÁLISIS · ${archiveNumber(playerStats.analyzes)}</span><span>CAMBIOS · ${archiveNumber(playerStats.switches)}</span><span>DERROTADOS · ${archiveNumber(playerStats.charactersDefeated)}</span><span>DAÑO CPU · ${archiveNumber(cpuStats.damageDealt)}</span></div></details>
  </article>`;
}

function renderArchive() {
  const history = loadMatchHistory();
  const summary = getArchiveSummary(history);
  const filteredHistory = history.filter((entry) => archiveFilter === "all" || entry?.winner === archiveFilter).slice().reverse();
  const entries = filteredHistory.length
    ? filteredHistory.map(renderArchiveEntry).join("")
    : `<div class="archive-empty">${history.length ? "NO HAY PARTIDAS PARA ESTE FILTRO" : "AÚN NO HAY PARTIDAS REGISTRADAS"}</div>`;
  archiveContent.innerHTML = `<div class="archive-summary">
      <p><small>PARTIDAS JUGADAS</small><b>${summary.matches}</b></p><p><small>VICTORIAS</small><b>${summary.victories}</b></p><p><small>DERROTAS</small><b>${summary.defeats}</b></p><p><small>PORCENTAJE DE VICTORIA</small><b>${summary.winPercentage}%</b></p>
    </div><div class="archive-toolbar"><div><button type="button" data-archive-filter="all" aria-pressed="${archiveFilter === "all"}" class="${archiveFilter === "all" ? "is-active" : ""}">TODAS</button><button type="button" data-archive-filter="player" aria-pressed="${archiveFilter === "player"}" class="${archiveFilter === "player" ? "is-active" : ""}">VICTORIAS</button><button type="button" data-archive-filter="cpu" aria-pressed="${archiveFilter === "cpu"}" class="${archiveFilter === "cpu" ? "is-active" : ""}">DERROTAS</button></div><button type="button" data-action="clear-history" ${disabledAttributes(!history.length)}>BORRAR HISTORIAL</button></div><div class="archive-history">${entries}</div>`;
}

function setArchiveFilter(filter) {
  if (!["all", "player", "cpu"].includes(filter)) return false;
  archiveFilter = filter;
  renderArchive();
  return true;
}

function clearMatchHistory() {
  const confirmed = typeof globalThis.confirm === "function"
    ? globalThis.confirm("¿Borrar todo el historial local de partidas?")
    : false;
  if (!confirmed) return false;
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEYS.matchHistory);
  } catch {
    // El fallo del historial no afecta al juego.
  }
  archiveFilter = "all";
  renderArchive();
  return true;
}
function renderFinalTeam(side) {
  const team = battleState[side];
  return team.teamIds.map((characterId) => {
    const character = findCharacter(characterId);
    const fighter = getFighter(side, characterId);
    const isActive = characterId === team.activeCharacterId;
    const status = fighter.defeated ? "DERROTADO" : isActive ? "ACTIVO" : "SUPERVIVIENTE";
    const portrait = character.image
      ? `<img src="${character.image}" alt="${character.name}">`
      : `<div class="result-placeholder">${character.name.slice(0, 2).toUpperCase()}</div>`;
    return `<article class="${fighter.defeated ? "is-defeated" : ""}">${portrait}<div><small>${character.number} · ${status}</small><h3>${character.name.toUpperCase()}</h3><p>SALUD · ${fighter.currentHealth} / ${fighter.maxHealth}<br>ENERGÍA · ${fighter.currentEnergy} / ${fighter.maxEnergy}</p></div></article>`;
  }).join("");
}

function renderResultStats(side) {
  const stats = battleState.stats[side];
  const labels = [
    ["DAÑO CAUSADO", stats.damageDealt],
    ["DAÑO RECIBIDO", stats.damageReceived],
    ["ATAQUES BÁSICOS", stats.basicAttacks],
    ["HABILIDADES", stats.abilitiesUsed],
    ["DEFENSAS", stats.defenses],
    ["CAMBIOS", stats.switches],
    ["DERROTADOS", stats.charactersDefeated]
  ];
  if (side === "player") labels.push(["ANÁLISIS", stats.analyzes]);
  return labels.map(([label, value]) => `<p><small>${label}</small><b>${value}</b></p>`).join("");
}

function renderResults() {
  const finished = battleState?.status === "finished" && (battleState.winner === "player" || battleState.winner === "cpu");
  resultsSection.hidden = !finished;
  if (!finished) return;

  const mode = gameModes.find((item) => item.id === battleState.modeId);
  const arena = arenas.find((item) => item.id === battleState.arenaId);
  const playerInitial = findCharacter(battleState.player.initialCharacterId);
  const cpuInitial = findCharacter(battleState.cpu.initialCharacterId);
  const victory = battleState.winner === "player";
  const winnerName = findCharacter(battleState[battleState.winner].activeCharacterId)?.name ?? (victory ? "JUGADOR" : "CPU");
  const logEntries = battleState.log.map((entry) => `<li>${entry}</li>`).join("");

  resultsSection.innerHTML = `<small>REGISTRO DE PARTIDA · RESULTADO FINAL</small>
    <h2>${victory ? "VICTORIA" : "DERROTA"}</h2>
    <div class="winner"><article><small>GANADOR · ${victory ? "JUGADOR" : "CPU"}</small><h3>${winnerName.toUpperCase()}</h3><p>ESTADO · <b>COMBATE FINALIZADO</b></p></article></div>
    <div class="result-data">
      <p><small>MODO</small><b>${displayValue(mode?.name)}</b></p>
      <p><small>ARENA</small><b>${displayValue(arena?.location)}</b></p>
      <p><small>TURNOS</small><b>${battleState.stats.totalTurns}</b></p>
      <p><small>INICIAL JUGADOR</small><b>${displayValue(playerInitial?.name)}</b></p>
      <p><small>INICIAL CPU</small><b>${displayValue(cpuInitial?.name)}</b></p>
      <p><small>GANADOR</small><b>${victory ? "JUGADOR" : "CPU"}</b></p>
    </div>
    <div class="result-teams">
      <section class="result-team"><h3>EQUIPO JUGADOR</h3>${renderFinalTeam("player")}</section>
      <section class="result-team"><h3>EQUIPO CPU</h3>${renderFinalTeam("cpu")}</section>
    </div>
    <div class="result-stats">
      <section><h3>ESTADÍSTICAS · JUGADOR</h3>${renderResultStats("player")}</section>
      <section><h3>ESTADÍSTICAS · CPU</h3>${renderResultStats("cpu")}</section>
    </div>
    <aside class="result-log"><h3>REGISTRO FINAL</h3><ol>${logEntries}</ol></aside>
    <footer><button type="button" data-action="replay-match">REPETIR</button><button type="button" data-action="return-team">CAMBIAR EQUIPO</button><button type="button" data-action="return-lobby">VOLVER AL LOBBY</button></footer>`;
}

function replayMatch() {
  if (!matchConfig || battleState?.status !== "finished") return false;
  const replayConfig = {
    modeId: matchConfig.modeId,
    arenaId: matchConfig.arenaId,
    teamIds: [...matchConfig.teamIds],
    initialCharacterId: matchConfig.initialCharacterId
  };
  matchConfig = replayConfig;
  battleState = createBattleState(replayConfig);
  startBattle();
  return true;
}

function returnToTeam() {
  battleState = null;
  matchConfig = null;
  gameState.teamConfirmed = false;
  renderApp();
  showScreen("team");
  return true;
}

function returnToLobby() {
  showScreen("lobby");
  return true;
}
function createAndShowMatch() {
  if (!gameState.gameReady) return;
  matchConfig = createMatchConfig();
  battleState = createBattleState(matchConfig);
  announce("Partida preparada.");
  renderApp();
  showScreen("versus");
}

function handleModeInteraction(event) {
  const modeCard = event.target.closest("[data-mode-id]");
  if (!modeCard || !gameModesContainer.contains(modeCard)) return;
  selectGameMode(modeCard.dataset.modeId);
}

function handleArenaInteraction(event) {
  const arenaCard = event.target.closest("[data-arena-id]");
  if (!arenaCard || !arenaGrid.contains(arenaCard)) return;
  selectArena(arenaCard.dataset.arenaId);
}

function handleSelectableKeyboard(event, selector, callback) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target.closest(selector);
  if (!item) return;
  event.preventDefault();
  callback(item.dataset.modeId ?? item.dataset.arenaId);
}
// ================================
// ACTUALIZACIÓN GENERAL DE LA INTERFAZ
// ================================
function renderCoreApp() {
  updateGameReady();
  renderCharacters();
  renderTeamCounter();
  renderTeamSlots();
  renderCharacterDetail();
  renderConfirmation();
  renderGameModes();
  renderArenas();
  renderLobby();
  renderStartButton();
  renderVersus();
  renderBattle();
  renderResults();
  renderArchive();
}

function handleScreenNavigation(event) {
  const trigger = event.target.closest?.("[data-screen-target]");
  if (!trigger) return;
  event.preventDefault?.();
  showScreen(trigger.dataset.screenTarget);
}

function handleCharacterInteraction(event) {
  const card = event.target.closest("[data-character-id]");
  if (!card || !characterGrid.contains(card)) return;
  const characterId = Number(card.dataset.characterId);
  if (event.target.closest('[data-action="view-character"]')) viewCharacter(characterId);
  else toggleCharacterSelection(characterId);
}

function handleCharacterKeyboard(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest("button")) return;
  const card = event.target.closest("[data-character-id]");
  if (!card) return;
  event.preventDefault();
  toggleCharacterSelection(Number(card.dataset.characterId));
}

function handleTeamInteraction(event) {
  const button = event.target.closest('[data-action="set-initial"]');
  if (!button) return;
  setInitialCharacter(Number(button.dataset.characterId));
}

document.addEventListener("click", (event) => {
  soundUnlocked = true;
  if (event.target.closest?.("button, a, [role='button']") && !event.target.closest?.(".battle")) playSound("click");
  handleScreenNavigation(event);
});
characterGrid.addEventListener("click", handleCharacterInteraction);
characterGrid.addEventListener("keydown", handleCharacterKeyboard);
teamSlots.addEventListener("click", handleTeamInteraction);
confirmTeamButton.addEventListener("click", confirmTeam);
resetPlayerSetupButton.addEventListener("click", resetPlayerSetup);
gameModesContainer.addEventListener("click", handleModeInteraction);
gameModesContainer.addEventListener("keydown", (event) => handleSelectableKeyboard(event, "[data-mode-id]", selectGameMode));
arenaGrid.addEventListener("click", handleArenaInteraction);
arenaGrid.addEventListener("keydown", (event) => handleSelectableKeyboard(event, "[data-arena-id]", selectArena));
startConvergenceButton.addEventListener("click", prepareMatch);
versusSection.addEventListener("click", (event) => {
  if (event.target.closest('[data-action="start-battle"]')) startBattle();
});
archiveContent.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-archive-filter]");
  if (filterButton) setArchiveFilter(filterButton.dataset.archiveFilter);
  if (event.target.closest('[data-action="clear-history"]')) clearMatchHistory();
});
resultsSection.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "replay-match") replayMatch();
  if (action === "return-team") returnToTeam();
  if (action === "return-lobby") returnToLobby();
});
battlePreview.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "basic-attack") basicAttack();
if (action.dataset.action === "defend") defend();
  if (action.dataset.action === "use-ability") useAbility("player", Number(action.dataset.abilityIndex));
  if (action.dataset.action === "analyze") analyzeOpponent();
  if (action.dataset.action === "open-switch") openSwitchSelection();
  if (action.dataset.action === "switch-character") switchPlayerCharacter(Number(action.dataset.characterId));
});

// ================================
// INICIALIZACIÓN
// Recupera la configuración guardada y abre el lobby.
// ================================
restorePlayerSetup();
renderApp();
showScreen("lobby", { focus: false, instant: true });




function getNextSetupStep() {
  if (gameState.selectedModeId !== "selection-combat") return "mode";
  if (gameState.selectedTeamIds.length !== MAX_TEAM_SIZE) return "characters";
  if (gameState.initialCharacterId === null) return "initial";
  if (!gameState.teamConfirmed) return "confirmation";
  if (gameState.selectedArenaId === null) return "arena";
  return "ready";
}

function getSetupScreen(step = getNextSetupStep()) {
  return { mode: "modes", characters: "characters", initial: "team", confirmation: "team", arena: "arenas" }[step] ?? null;
}

function continueSetup() {
  const step = getNextSetupStep();
  if (step === "ready") return createAndShowMatch();
  showScreen(getSetupScreen(step));
  announce({ mode: "Selecciona el modo de juego.", characters: "Selecciona cinco personajes para tu equipo.", initial: "Elige quién comienza.", confirmation: "Revisa y confirma tu equipo.", arena: "Selecciona una arena." }[step]);
  return true;
}

function prepareMatch() {
  return continueSetup();
}

function continueFromCharacters() {
  if (gameState.selectedTeamIds.length !== MAX_TEAM_SIZE) return false;
  announce("Equipo completo. Elige quién comienza.");
  showScreen("team");
  return true;
}

function selectGameMode(modeId) {
  const mode = gameModes.find((item) => item.id === modeId);
  if (!mode) return false;
  if (gameState.selectedModeId !== modeId) {
    gameState.selectedModeId = modeId;
    invalidatePreparedMatch();
    commitPlayerSetupChange();
  }
  renderApp();
  if (modeId === "selection-combat") {
    showScreen("characters");
    announce("Modo seleccionado: " + mode.name + ". Ahora selecciona cinco personajes.");
  } else announce("Este modo continúa en desarrollo. Selecciona el modo principal para jugar.");
  return true;
}

function setInitialCharacter(characterId) {
  if (!gameState.selectedTeamIds.includes(characterId)) return false;
  if (gameState.initialCharacterId === characterId) return true;
  gameState.initialCharacterId = characterId;
  gameState.teamConfirmed = false;
  invalidatePreparedMatch();
  commitPlayerSetupChange();
  renderApp();
  announce("Inicial seleccionado: " + findCharacter(characterId).name + ". Revisa y confirma tu equipo.");
  const panel = document.getElementById("team-confirmation-panel");
  panel?.setAttribute("tabindex", "-1");
  panel?.focus?.({ preventScroll: true });
  return true;
}

function confirmTeam() {
  if (gameState.selectedTeamIds.length !== MAX_TEAM_SIZE || gameState.initialCharacterId === null) return false;
  gameState.teamConfirmed = true;
  commitPlayerSetupChange();
  renderApp();
  showScreen("arenas");
  announce("Equipo confirmado.");
  return true;
}

function selectArena(arenaId) {
  const arena = arenas.find((item) => item.id === arenaId);
  if (!arena) return false;
  if (gameState.selectedArenaId !== arenaId) {
    gameState.selectedArenaId = arenaId;
    invalidatePreparedMatch();
    commitPlayerSetupChange();
  }
  renderApp();
  showScreen("lobby");
  announce("Arena seleccionada: " + arena.location + ". Configuración completa.");
  return true;
}

function renderStartButton() {
  const step = getNextSetupStep();
  startConvergenceButton.disabled = false;
  startConvergenceButton.setAttribute("aria-disabled", "false");
  startConvergenceButton.textContent = step === "ready" ? "INICIAR COMBATE →" : "CONTINUAR PREPARACIÓN →";
  lobbyTeamStatus.textContent = getStartValidationMessage();
  document.querySelectorAll('[data-action="resume-setup"]').forEach((button) => {
    button.textContent = step === "ready" ? "INICIAR COMBATE →" : "INICIAR CONVERGENCIA →";
    button.setAttribute("aria-label", step === "ready" ? "Iniciar combate" : "Continuar preparación: " + getStartValidationMessage());
  });
}

function renderSetupGuide() {
  const count = gameState.selectedTeamIds.length;
  const status = document.getElementById("character-selection-status");
  const nextButton = document.getElementById("continue-characters-button");
  if (status) status.textContent = count === MAX_TEAM_SIZE ? "EQUIPO COMPLETO · 5 / 5" : count + " / " + MAX_TEAM_SIZE;
  if (nextButton) {
    nextButton.disabled = count !== MAX_TEAM_SIZE;
    nextButton.setAttribute("aria-disabled", String(count !== MAX_TEAM_SIZE));
  }
  const step = getNextSetupStep();
  const steps = [["mode", "1", "MODO"], ["characters", "2", "EQUIPO"], ["initial", "3", "INICIAL"], ["confirmation", "4", "CONFIRMAR"], ["arena", "5", "ARENA"]];
  const current = step === "ready" ? steps.length : Math.max(0, steps.findIndex((item) => item[0] === step));
  const markup = steps.map((item, index) => {
    const state = index < current ? "is-complete" : index === current ? "is-current" : "";
    return '<button type="button" class="' + state + '" data-screen-target="' + getSetupScreen(item[0]) + '" ' + (index > current ? disabledAttributes(true) : "") + '><span>' + (index < current ? "✓" : item[1]) + "</span>" + item[2] + "</button>";
  }).join("");
  document.querySelectorAll("[data-setup-progress]").forEach((progress) => { progress.innerHTML = markup; });
}

function renderApp() {
  renderCoreApp();
  renderSetupGuide();
}

function openTutorial() {
  const tutorial = document.getElementById("game-tutorial");
  if (!tutorial) return false;
  if (typeof tutorial.showModal === "function") tutorial.showModal();
  else tutorial.setAttribute("open", "");
  announce("Tutorial de cómo jugar abierto.");
  return true;
}

function closeTutorial() {
  const tutorial = document.getElementById("game-tutorial");
  if (!tutorial) return false;
  if (typeof tutorial.close === "function" && tutorial.open) tutorial.close();
  else tutorial.removeAttribute("open");
  return true;
}

document.getElementById("continue-characters-button")?.addEventListener("click", continueFromCharacters);
document.addEventListener("click", (event) => {
  const action = event.target.closest?.("[data-action]")?.dataset.action;
  if (action === "resume-setup") continueSetup();
  if (action === "open-tutorial") openTutorial();
  if (action === "close-tutorial") closeTutorial();
});

