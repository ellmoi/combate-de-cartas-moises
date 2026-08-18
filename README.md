# La Convergencia

La Convergencia es un juego de cartas y combate por turnos. El jugador prepara un equipo de cinco personajes, elige quién comienza y combate contra un equipo controlado por la CPU.

## Tecnologías

- HTML
- CSS
- JavaScript Vanilla

## Cómo ejecutar

La forma recomendada es abrir la carpeta `la_convergencia_prototype` con Live Server y entrar a `index.html`.

También se puede abrir `index.html` directamente, aunque un servidor local evita problemas con los módulos de JavaScript.

## Cómo jugar

1. Selecciona el modo **Selección y Combate**.
2. Elige cinco personajes para formar el equipo.
3. Escoge el personaje inicial y confirma el equipo.
4. Selecciona una arena.
5. Inicia el enfrentamiento contra la CPU.
6. Derrota a todos los personajes del equipo rival.

## Controles

- **Ataque básico:** causa daño sin gastar energía.
- **Habilidad:** causa daño o aplica el efecto disponible y consume energía.
- **Defender:** reduce el siguiente daño recibido.
- **Analizar:** muestra información actual del rival.
- **Cambiar:** permite elegir un personaje de reserva.

La salud y la energía aparecen en el HUD superior. El registro inferior muestra las acciones más recientes del combate.

## Pruebas

Desde la carpeta principal ejecuta:

```bash
npm test
```

Las pruebas revisan configuración, jugador, pantallas, interfaz, combate, reemplazos, resultados, archivo y el flujo completo del juego.

## Imágenes y sonidos

Las imágenes nuevas se colocan en `la_convergencia_prototype/assets/characters`. Mientras falte una imagen, el juego muestra las iniciales del personaje.

Los sonidos opcionales se colocan en `la_convergencia_prototype/assets/sounds` con estos nombres:

- `attack.mp3`
- `hit.mp3`
- `defense.mp3`
- `ability.mp3`
- `victory.mp3`
- `defeat.mp3`
- `click.mp3`

## Proyecto

Proyecto académico desarrollado con metodología Scrum.

**Sprint 1 - Primera entrega funcional.**