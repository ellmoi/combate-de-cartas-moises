const emptyStats = () => ({ health: null, energy: null, resistance: null, agility: null, technique: null, control: null, efficiency: null, power: null, perception: null });

// Crea los datos mínimos de los personajes provisionales.
// imageFile indica dónde colocar la imagen cuando esté disponible.
function createProvisionalCharacter(id, name, ability, fileName) {
  return {
    id,
    number: String(id).padStart(2, "0"),
    name,
    ability,
    className: "Provisional",
    image: null,
    imageFile: `assets/characters/${fileName}.webp`,
    imagePosition: "center top",
    status: "IMAGEN · PENDIENTE",
    summary: "DATOS PROVISIONALES",
    age: null,
    origin: "[PENDIENTE]",
    profession: "[PENDIENTE]",
    abilityDescription: "Ataque provisional de combate.",
    stats: { health: 100, energy: 100, resistance: 60, agility: 60, technique: 60, control: 60, efficiency: 60, power: 60, perception: 60 },
    abilities: [{ name: ability, description: "Causa daño provisional al oponente.", energyCost: 20, damage: 25 }],
    mask: { obtained: false, name: null, image: null },
    conviction: "[PENDIENTE]",
    history: "[PENDIENTE]",
    desire: "[DESCONOCIDO]",
    connections: "[ARCHIVO INCOMPLETO]"
  };
}

export const characters = [
  { id:1, number:"01", name:"Luna", ability:"Dreamachine", className:"Manipulador", image:"assets/reference/luna.jpg", status:"MARCA · ESTABLE", summary:"ECOS MENTALES · GUATEMALA", age:21, origin:"Guatemala", profession:"Estudiante / Beatmaker", abilityDescription:"Puede proyectar, distorsionar o amplificar estímulos auditivos y emocionales que afectan la percepción y el rendimiento del oponente.", stats:{health:72,energy:85,resistance:60,agility:78,technique:82,control:90,efficiency:75,power:70,perception:88}, abilities:[{name:"Ondas de susurro",description:"Emite ondas sonoras que confunden la concentración del enemigo.",energyCost:null},{name:"Ritmo alterado",description:"Desincroniza el ritmo del oponente.",energyCost:null},{name:"Arpegio interior",description:"Explosión sonora que causa daño mental y físico moderado.",energyCost:null},{name:"Pasiva · Afinación",description:"Aumenta progresivamente su control mientras la batalla avanza.",energyCost:null}], mask:{obtained:true,name:null,image:null}, conviction:"Estable", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" },
  { id:2, number:"02", name:"Axel", ability:"Vector", className:"Manipulación", image:"assets/reference/axel.jpg", status:"MÁSCARA · NO OBTENIDA", summary:"MENSAJERO · EL SALVADOR", age:24, origin:"El Salvador", profession:"Mensajero / Repartidor", abilityDescription:"Altera la dirección de fuerzas existentes, pero no las crea.", stats:{health:68,energy:72,resistance:58,agility:78,technique:64,control:62,efficiency:66,power:52,perception:76}, abilities:[{name:"Redirección",description:"Cambia la trayectoria de proyectiles o impactos.",energyCost:null},{name:"Impulso",description:"Modifica su propio impulso para moverse de forma inesperada.",energyCost:null},{name:"Desvío",description:"Desvía parte de la fuerza de un ataque para reducir su efecto.",energyCost:null},{name:"Aprovechamiento",description:"Usa fuerzas del entorno para sorprender o desestabilizar.",energyCost:null},{name:"Pasiva · Fluidez",description:"Reduce el desgaste al cambiar la dirección de fuerzas pequeñas.",energyCost:null}], mask:{obtained:false,name:null,image:null}, conviction:"Estable", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" },
  { id:3, number:"03", name:"Maya", ability:"Ancla", className:"Fijación", image:"assets/reference/maya.jpg", status:"MARCA · PALMA IZQUIERDA", summary:"ESTUDIANTE · GUATEMALA", age:22, origin:"Guatemala", profession:"Estudiante de arquitectura / Dibujante técnica", abilityDescription:"Establece un punto de referencia espacial para fijar posiciones relativas en el entorno.", stats:{health:60,energy:65,resistance:66,agility:68,technique:58,control:72,efficiency:64,power:46,perception:76}, abilities:[{name:"Anclaje",description:"Establece un punto de referencia en un objeto o superficie.",energyCost:null},{name:"Fijación",description:"Mantiene su cuerpo u objetos en relación a un ancla.",energyCost:null},{name:"Pivote",description:"Usa un ancla para cambiar su eje de giro.",energyCost:null},{name:"Amarre",description:"Crea rutas de movimiento controladas utilizando múltiples anclas.",energyCost:null},{name:"Pasiva · Lectura espacial",description:"Percibe patrones espaciales y puntos de apoyo naturales.",energyCost:null}], mask:{obtained:false,name:null,image:null}, conviction:"En desarrollo", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" },
  { id:4, number:"04", name:"Valeria", ability:"Fricción", className:"Alteración", image:"assets/reference/valeria.jpg", status:"MARCA · MUÑECA DERECHA", summary:"MECÁNICA · PANAMÁ", age:26, origin:"Panamá", profession:"Mecánica de motocicletas", abilityDescription:"Modifica temporalmente el grado de fricción entre dos superficies que están en contacto.", stats:{health:70,energy:61,resistance:74,agility:78,technique:63,control:49,efficiency:58,power:57,perception:60}, abilities:[{name:"Deslizamiento",description:"Reduce la fricción para deslizarse rápidamente.",energyCost:null},{name:"Agarre",description:"Aumenta la fricción para obtener mayor sujeción.",energyCost:null},{name:"Tracción",description:"Aumenta la fricción de oponentes u objetos para frenar su movimiento.",energyCost:null},{name:"Inercia",description:"Reduce la fricción de objetos para conservar su movimiento.",energyCost:null},{name:"Pasiva · Calor y desgaste",description:"Modificar la fricción genera calor y desgaste en los materiales.",energyCost:null}], mask:{obtained:false,name:null,image:null}, conviction:"En desarrollo", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" },
  { id:5, number:"05", name:"Noah", ability:"Depósito", className:"Acumulación", image:"assets/reference/noah.jpg", status:"MARCA · CENTRO DEL PECHO", summary:"COCINERO · HONDURAS", age:31, origin:"Honduras", profession:"Cocinero / Encargado de cocina", abilityDescription:"Absorbe y almacena calor mediante contacto para luego transferirlo a otra superficie.", stats:{health:76,energy:79,resistance:81,agility:45,technique:59,control:67,efficiency:64,power:55,perception:70}, abilities:[{name:"Absorber",description:"Extrae temporalmente el calor de una superficie.",energyCost:null},{name:"Almacenar",description:"Guarda el calor dentro de su cuerpo.",energyCost:null},{name:"Transferir",description:"Libera el calor almacenado al tocar otra superficie u objeto.",energyCost:null},{name:"Distribuir",description:"Difunde el calor por un área pequeña.",energyCost:null},{name:"Pasiva · Equilibrio térmico",description:"Su cuerpo se adapta a los cambios de temperatura.",energyCost:null}], mask:{obtained:false,name:null,image:null}, conviction:"En desarrollo", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" },
  { id:6, number:"06", name:"Sara", ability:"Costura", className:"Enlace", image:"assets/reference/sara.jpg", status:"MARCA · MANO IZQUIERDA", summary:"COSTURERA · EL SALVADOR", age:24, origin:"El Salvador", profession:"Técnica en reparación de ropa / Costurera y estudiante de diseño", abilityDescription:"Crea un punto de unión temporal entre dos materiales que esté tocando simultáneamente.", stats:{health:58,energy:73,resistance:54,agility:67,technique:76,control:71,efficiency:69,power:39,perception:77}, abilities:[{name:"Unir",description:"Crea una unión temporal entre dos puntos.",energyCost:null},{name:"Fijar",description:"Une un objeto o parte de su cuerpo a una superficie.",energyCost:null},{name:"Puente",description:"Conecta dos objetos o superficies para transferir tensión.",energyCost:null},{name:"Redirigir",description:"Usa uniones para cambiar la dirección de fuerzas.",energyCost:null},{name:"Pasiva · Concentración dividida",description:"Cada unión activa consume concentración.",energyCost:null}], mask:{obtained:false,name:null,image:null}, conviction:"En desarrollo", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" },
  { id:7, number:"07", name:"Elías", ability:"Umbral", className:"Condición", image:"assets/reference/elias.jpg", status:"MARCA · ÍNDICE DERECHO", summary:"CERRAJERO · NICARAGUA", age:35, origin:"Nicaragua", profession:"Cerrajero", abilityDescription:"Impone a un objeto que toca una condición mínima para que ocurra un movimiento mecánico concreto.", stats:{health:63,energy:68,resistance:66,agility:52,technique:81,control:74,efficiency:76,power:42,perception:84}, abilities:[{name:"Umbral alto",description:"Aumenta el umbral mínimo para que el mecanismo se active.",energyCost:null},{name:"Umbral bajo",description:"Disminuye el umbral mínimo para activar el mecanismo.",energyCost:null},{name:"Precisión mecánica",description:"Permite modificar umbrales complejos.",energyCost:null},{name:"Análisis rápido",description:"Observa y entiende mecanismos comunes en menos tiempo.",energyCost:null},{name:"Pasiva · Límites simultáneos",description:"Solo puede mantener dos umbrales activos al mismo tiempo.",energyCost:null}], mask:{obtained:false,name:null,image:null}, conviction:"En desarrollo", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" },
  { id:8, number:"08", name:"Camila", ability:"Préstamo", className:"[PENDIENTE]", image:null, imageFile:"assets/characters/camila.webp", imagePosition:"center top", status:"IMAGEN · PENDIENTE", summary:"ARCHIVO INCOMPLETO", age:null, origin:"[PENDIENTE]", profession:"[PENDIENTE]", abilityDescription:"[PENDIENTE]", stats:emptyStats(), abilities:[{name:"Préstamo",description:"Causa daño provisional al oponente.",energyCost:20,damage:25}], mask:{obtained:false,name:null,image:null}, conviction:"[PENDIENTE]", history:"[PENDIENTE]", desire:"[DESCONOCIDO]", connections:"[ARCHIVO INCOMPLETO]" }];

// Estos nombres y poderes son temporales y reutilizan el motor existente.
characters.push(
  createProvisionalCharacter(9, "Kael", "Pulso", "kael"),
  createProvisionalCharacter(10, "Iris", "Prisma", "iris"),
  createProvisionalCharacter(11, "Dante", "Impacto", "dante"),
  createProvisionalCharacter(12, "Nara", "Eco", "nara"),
  createProvisionalCharacter(13, "Gael", "Ruptura", "gael"),
  createProvisionalCharacter(14, "Zoe", "Fase", "zoe"),
  createProvisionalCharacter(15, "León", "Carga", "leon"),
  createProvisionalCharacter(16, "Alma", "Resonancia", "alma"),
  createProvisionalCharacter(17, "Ren", "Corte", "ren"),
  createProvisionalCharacter(18, "Vera", "Impulso", "vera"),
  createProvisionalCharacter(19, "Milo", "Rebote", "milo"),
  createProvisionalCharacter(20, "Kiara", "Rastro", "kiara"),
  createProvisionalCharacter(21, "Ian", "Presión", "ian"),
  createProvisionalCharacter(22, "Jade", "Desvío", "jade"),
  createProvisionalCharacter(23, "Bruno", "Peso", "bruno"),
  createProvisionalCharacter(24, "Nina", "Réplica", "nina"),
  createProvisionalCharacter(25, "Thiago", "Compresión", "thiago"),
  createProvisionalCharacter(26, "Eva", "Destello", "eva"),
  createProvisionalCharacter(27, "Marco", "Inercia", "marco"),
  createProvisionalCharacter(28, "Aria", "Onda", "aria")
);