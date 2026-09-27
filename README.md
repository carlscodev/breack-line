# BREACH / Tactical Operations

Prototipo de shooter tactico 3D para navegador. Una residencia contemporanea,
cinco amenazas y una extraccion. Toda la escena es geometria 3D: no hay una
imagen de fondo que sustituya al escenario jugable.

## Ejecutar

- `npm install` instala las versiones exactas declaradas en `package.json`.
- `npm run dev` inicia Vite.
- `npm run build` genera la version de produccion.
- `npm run preview` sirve esa version.
- `node scripts/verify.mjs` comprueba TypeScript estricto, compila el HUD Vue,
  renderiza sus estados con SSR y comprueba la oclusion del sistema de vision.

Se necesita un navegador moderno con WebGL 2 y aceleracion grafica. La escena,
las texturas y el audio no requieren descargas de recursos externos. Las fuentes
de Google tienen alternativas locales si no hay conexion.

## Controles

| Control | Accion |
| --- | --- |
| Enter | Iniciar operacion |
| WASD / flechas | Movimiento relativo a la camara |
| Raton | Apuntado independiente del movimiento |
| Clic izquierdo | Disparar; mantener para fuego automatico con MK18 |
| Clic derecho | Apuntar con precision y desplazarse mas despacio |
| Shift izquierdo | Movimiento rapido |
| R | Recargar |
| F | Encender o apagar la linterna |
| Espacio / Escape | Pausa tactica |
| M | Silenciar o activar audio |
| Rueda del raton | Zoom |

Los controles tactiles aparecen en dispositivos con puntero grueso. Toca el
escenario para apuntar y disparar; el joystick controla el desplazamiento.

Elimina las cinco amenazas y alcanza el cuadrado de extraccion en el pasillo
sur. La mision se pausa al perder el foco o al abrir un panel. Los resultados
se guardan localmente; no hay servidor, cuentas ni datos enviados a terceros.

## Estructura

| Archivo | Responsabilidad |
| --- | --- |
| `src/App.tsx` | Punto de entrada React y ciclo de vida del motor y de Vue |
| `src/engine/World.ts` | Render PBR, luces, sombras, niebla, camara y limpieza de recursos |
| `src/engine/Environment.ts` | Arquitectura, mobiliario, puertas, colisiones y geometria agrupada |
| `src/engine/Materials.ts` | Texturas procedurales y materiales PBR |
| `src/engine/Player.ts` | Movimiento visual, apuntado, GLTFLoader y AnimationMixer |
| `src/engine/OperatorModel.ts` | Operador anatomico articulado, equipamiento y clips de animacion |
| `src/engine/VisionSystem.ts` | Linterna, haz visible y oclusion por raycasting |
| `src/engine/Game.ts` | Bucle de simulacion, entrada, IA, balistica y estados de mision |
| `src/engine/Effects.ts` | Trazadoras, luz de fogonazo y particulas de impacto |
| `src/engine/AudioSystem.ts` | Efectos sintetizados con Web Audio, activados por gesto del usuario |
| `src/engine/types.ts` | Contratos, armamento, estado inicial y plano de muros |
| `src/ui/GameHUD.vue` | HUD y paneles con Vue 3 Composition API y script setup |
| `src/ui/mountHUD.ts` | Montaje del componente Vue dentro del host React |
| `src/index.css` | Sistema visual, estados, transiciones y adaptacion a pantallas pequenas |

## Renderizado

- Camara ortografica con seguimiento interpolado, zoom y retroceso leve.
- `PCFSoftShadowMap`, mapas de sombras de 2048 px, bias y normalBias calibrados.
- Materiales de hormigon, nogal, acero, tela y cuero con rugosidad definida.
- `SpotLight` neutra-calida con penumbra y sombras dinamicas.
- Haz tridimensional aproximado mediante capas transparentes, recortadas por
  raycasting, mas niebla `FogExp2` y particulas ambientales. No es un integrador
  fisico de dispersion volumetrica por ray marching.
- Los muros recortados para la camara conservan su altura de oclusion y
  colision. Las balas no atraviesan estos recortes visuales.
- La geometria estatica se agrupa por material para reducir draw calls. Los
  originales de colision se mantienen fuera de la escena renderizada.
- Dos niveles de calidad ajustan densidad de pixeles y particulas ambientales.

## Operadores GLB

En **Equipamiento**, antes de iniciar la mision, importa un archivo `.glb`
autonomo de hasta 30 MB. No se sube a ningun servidor. Tambien se puede usar
`Player.loadModel(url)` desde codigo.

El cargador normaliza la altura a 1.82 m y centra el modelo sobre el suelo.
La orientacion esperada es Y arriba y Z positivo al frente. Los clips se
asocian por nombres: Idle/Standing/Breath, Walk/Run/Strafe, Shooting/Fire/Recoil
y Reload. Idle y Walk tienen transiciones crossfade; disparo y recarga son
acciones de una sola reproduccion.

Si no se importa un recurso, el operador procedural incluye torso, chaleco,
pouches, casco, visor, auriculares, manos, piernas, rodilleras, botas y arma.
Los clips animan una jerarquia de huesos. Los modelos importados usan sus
propios esqueletos y animaciones. No se realiza retargeting automatico entre
esqueletos distintos; los GLB sin clips se muestran sin animacion esqueletica.
Los recursos comprimidos con Draco o KTX2 necesitan sus decodificadores antes
de importarse; no estan incluidos en este prototipo.

## Integracion Vue

La configuracion del proyecto anfitrion requiere conservar `src/App.tsx` y el
plugin React de Vite. Por eso el motor no depende de React ni de Vue, mientras
el HUD real es el componente `GameHUD.vue`.

`mountHUD.ts` compila exclusivamente ese SFC local y confiable con
`@vue/compiler-sfc`, y monta Vue en un nodo dedicado. No compila archivos
aportados por usuarios. Esta adaptacion permite conservar la configuracion
de Vite, pero utiliza `new Function`; una politica CSP que prohiba
`unsafe-eval` requiere trasladar la compilacion del SFC al build mediante el
plugin Vue en un proyecto de produccion independiente.

## Alcance y comprobaciones

Es un prototipo de un nivel con IA sencilla, puertas ya abiertas y animacion
procedural de caida; no incluye ragdolls, multijugador, editor de niveles ni
retargeting de Mixamo. El operador original es procedural, no un activo GLB
comercial. La comprobacion de compilacion de produccion se realiza con Vite.

El script de verificacion no requiere GPU, pero no sustituye una prueba visual
y jugable en navegador. Conviene comprobar la mision completa, las sombras,
un GLB propio, el audio y los controles tactiles en el hardware de destino.
Ejecuta tambien `npm audit` antes de publicar una version de produccion.