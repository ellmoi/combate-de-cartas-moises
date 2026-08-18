// ==========================================
// MODOS DE JUEGO
// Opciones que aparecen en la selección de modo.
// ==========================================
export const gameModes = [
  {
    id: "selection-combat",
    number: "01",
    name: "Combate de Selección",
    label: "MODO UNIVERSITARIO · PRINCIPAL",
    description: "Jugador vs Máquina · Equipo de cinco · Una carta activa · Cuatro reservas · Cambios permitidos.",
    status: "DISPONIBLE",
    available: true
  },
  {
    id: "training",
    number: "02",
    name: "Entrenamiento",
    label: "MODO ALTERNATIVO",
    description: "REGLAS: [POR DEFINIR]",
    status: "EN DESARROLLO",
    available: false
  },
  {
    id: "survival",
    number: "03",
    name: "Supervivencia",
    label: "MODO ALTERNATIVO",
    description: "REGLAS: [POR DEFINIR]",
    status: "EN DESARROLLO",
    available: false
  },
  {
    id: "challenges",
    number: "04",
    name: "Desafíos",
    label: "MODO ALTERNATIVO",
    description: "REGLAS: [POR DEFINIR]",
    status: "EN DESARROLLO",
    available: false
  }
];
