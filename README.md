# Estabiliza · Laboratorio de sistemas

Aplicación local con ocho plantas físicas y animación 2D. La app calcula la física; el estudiante implementa el controlador en Simulink. No contiene PID ni otro controlador interno. Sin dependencias externas; requiere Node.js 18 o superior.

## Abrir

Ejecutar `Iniciar.bat`, o `node server.js`, y abrir http://127.0.0.1:3000. También se puede usar `npm start` (`npm.cmd start` si PowerShell bloquea scripts). Después de actualizar, reiniciar el servidor para habilitar las nuevas rutas.

| Planta | Página | Entradas normalizadas |
| --- | --- | --- |
| Bola levitadora neumática | `/` | `fan`: 0…1 |
| Motor con pivote | `/pivot.html` | `motor`: 0…1 |
| Péndulo invertido lineal | `/lab.html?system=pendulum` | `cart`: −1…1 |
| Caldera de vapor | `/lab.html?system=boiler` | `heat`, `feed`: 0…1 |
| Levitación magnética | `/lab.html?system=maglev` | `coil`: 0…1 |
| Estanques acoplados | `/lab.html?system=tanks` | `pump`: 0…1 |
| Balancín con bola | `/lab.html?system=beam` | `motor`: −1…1 |
| Balancín de doble hélice | `/lab.html?system=twin` | `left`, `right`: 0…1 |

El selector superior incluye las ocho escenas. Cambiar de página inicia otro ensayo con los parámetros originales; exportar primero los datos que se quieran conservar. Las seis plantas nuevas arrancan en pausa para preparar los mandos antes de iniciar.

## Herramientas

- Animación protagonista, vista fija sin arrastre y zoom entre 75 % y 300 %. Visualización agrupa mediciones, acciones y flujos.
- Pausa, reinicio y perturbaciones específicas junto al modelo. Los impulsos están desactivados durante la pausa.
- Un único panel activo: Mandos, Datos, Gráficos, Enlace o Ajustes. Las pestañas admiten flechas, Inicio y Fin.
- Solo planta amplía la escena. El botón o Escape recuperan la pestaña seleccionada.
- En pantallas de hasta 700 px las herramientas quedan debajo del simulador. Las transiciones respetan la preferencia de reducir movimiento.
- Aplicar parámetros reinicia el estado físico, pone los mandos a cero y borra el registro. Las condiciones iniciales editables están en Ajustes. No hay persistencia entre páginas.
- Los marcadores son referencias visuales y no modifican los actuadores. Modelo matemático y guía se abren desde Ajustes.
- Caldera y estanques permiten velocidad 1×, 5× y 10× en modo manual. Las entradas externas fuerzan 1×.

## Modelos físicos

Todos son modelos didácticos sin calibración experimental. Cada escena contiene sus ecuaciones, supuestos, parámetros y una guía. La escala de los dibujos es esquemática; la física usa las dimensiones configuradas.

### Bola neumática y motor con pivote

`physics.js` conserva los modelos originales. La bola incluye gravedad, arrastre cuadrático, atenuación exponencial con altura, retardo del ventilador y topes sin rebote. Puede tener equilibrio abierto estable por atenuación espacial y amortiguamiento; con atenuación cero desaparece la restauración de posición. El mando de equilibrio de la guía no se aplica automáticamente.

El pivote usa una barra uniforme y un motor en el extremo. Incluye inercia, gravedad, fricción, retardo y topes angulares. El empuje objetivo depende del cuadrado del mando; este no equivale a potencia eléctrica medida. Las aspas se ven de perfil y la animación depende del actuador.

### Péndulo invertido lineal

Modelo no lineal acoplado de carro y barra uniforme. La entrada firmada actúa sobre un motor con retardo. Ángulo desde la vertical superior, positivo hacia la derecha. El carro tiene topes inelásticos que transmiten impulso a la barra; esta puede girar completamente sin colisiones con el riel. No hay estabilización ni swing-up automáticos.

Se configuran masas, longitud, fuerza, fricciones, respuesta del motor, recorrido e inclinación inicial. Perturbaciones: impulsos angulares y fuerza lateral de 2 N durante un segundo.

Referencia: [CTMS, péndulo invertido](https://ctms.engin.umich.edu/CTMS/index.php?example=InvertedPendulum&section=SystemModeling).

### Caldera de vapor

Balances de masa y energía con agua líquida y vapor saturado. Calentamiento y alimentación independientes, consumo de vapor dependiente de presión, pérdidas al ambiente y retardos de actuadores. El nivel resulta del balance de masa y los volúmenes de ambas fases.

Comienza caliente y funciona en el dominio de 100–180 °C y nivel 5–95 %. Salir del dominio detiene explícitamente el ensayo y requiere reinicio; no se fija artificialmente una presión estable. La presión es absoluta: Pa en el adaptador, bar en pantalla. La temperatura se entrega en K y se muestra en °C.

Aproximaciones: presión de saturación mediante Antoine, vapor ideal, densidad líquida constante y energías específicas aproximadas. No representa arranque en frío, combustión, protecciones industriales ni encogimiento/hinchamiento dinámico del nivel. Perturbaciones: ±5 kJ o consumo +80 % durante 10 segundos simulados.

Referencia de la estructura de regulación: [Drum Boiler de MathWorks](https://www.mathworks.com/help/control/ug/regulating-pressure-in-a-drum-boiler.html). Las ecuaciones implementadas son una simplificación propia, no una copia calibrada del equipo.

### Levitación magnética

Separación positiva hacia abajo, gravedad, amortiguamiento y atracción `F = k·i²/z²`. La corriente sigue un circuito RL y un mando de tensión. El equilibrio abierto es inestable. Separación mínima de 5 mm y tope inferior configurable, sin rebote.

Inductancia constante y fuerza empírica; se omiten saturación, remanencia, calentamiento y variación de inductancia con posición. Se configuran masa, separación, recorrido, tensión, resistencia, inductancia y coeficiente magnético. Perturbaciones: ±0,1 m/s y tensión al 60 % durante un segundo.

La corriente inicial también se configura: por defecto 2,5 A, para preparar un ensayo cercano al equilibrio antes de iniciar. Es energía inicial de la bobina, no un mando automático. Con tensión cero decae según el circuito RL. Con los parámetros originales, el equilibrio a 25 mm requiere aproximadamente 82,5 % de mando y 2,48 A. Desde el tope inferior puede no haber fuerza suficiente para levantar la esfera; reiniciar recupera las condiciones iniciales.

### Estanques acoplados

Depósitos abiertos de sección constante conectados por el fondo, con bomba en el primero y descarga en el segundo. Flujo reversible proporcional a la raíz de la diferencia de nivel. Las áreas efectivas incorporan el coeficiente de descarga. Se limita el caudal al agua disponible y se contabiliza explícitamente el rebose.

Se configuran altura, secciones, niveles iniciales, caudal, áreas efectivas y respuesta de bomba. Perturbaciones: ±5 cm en el segundo estanque o descarga duplicada durante 5 segundos.

Referencia: [Quanser Coupled Tanks](https://www.quanser.com/products/coupled-tanks/).

### Balancín con bola

Viga y esfera maciza en rodadura ideal, con inercia equivalente 7/5, torque del peso de la bola, inercia dependiente de su posición, fricción y actuador de primer orden. La entrada es torque firmado, no una consigna de ángulo con PID oculto. Incluye topes de posición e inclinación. Radio despreciable en la geometría; no modela deslizamiento.

Se configuran masas, longitud, posición inicial, torque, fricción y respuesta. Perturbaciones: impulsos lineales y torque al 50 % durante un segundo.

Referencia introductoria: [CTMS Ball & Beam](https://ctms.engin.umich.edu/CTMS/index.php?example=BallBeam&section=SystemModeling). Esta implementación añade dinámica de la viga.

### Balancín de doble hélice

Motores independientes, empujes perpendiculares a la barra, retardos de primer orden y dependencia cuadrática de los mandos. Torque diferencial, fricción, topes y centro de masa desplazable respecto del pivote, con corrección de inercia por ejes paralelos.

Centro de masa sobre el pivote: acción gravitatoria desestabilizante; debajo: restauradora; en el eje: sin restauración gravitatoria. Sin inestabilidad artificial ni interacción aerodinámica entre hélices. Perturbaciones: impulsos angulares o empuje objetivo izquierdo al 50 % durante un segundo.

Referencia de configuración: [Quanser Aero 2](https://www.quanser.com/products/Aero-2/).

## Gráficos y CSV

Inicialmente se muestran variable principal, marcador y primer mando. Todas las señales y ambos mandos están disponibles en la leyenda. Ocultar señales no interrumpe su registro ni las elimina del CSV.

- Juntos: cada magnitud usa un rango normalizado 0–100 %. Las señales de igual magnitud comparten escala. No son unidades físicas comunes; el rango se consulta sobre la leyenda.
- Separados: un gráfico por magnitud, en unidades físicas.
- Curvas con lectura de valores al pasar el puntero; ventanas de 10, 20 y 60 segundos.
- Hasta 12 000 muestras: aproximadamente 10 minutos simulados a 20 Hz. CSV exporta mediciones, referencia, mandos, fuente y parámetros.

Las mediciones del CSV y del adaptador usan las unidades declaradas. Las referencias usan la unidad física de la variable principal. Los campos `param_` guardan unidades internas SI salvo temperaturas de configuración de la caldera, en °C. La interfaz convierte a cm, mm, grados, bar, litros, kW o g/s.

En las plantas originales la aceleración se estima por pasos de 5 ms. Fuerzas y momentos resultantes excluyen las reacciones de los topes; durante contacto no equivalen directamente a masa/inercia por aceleración.

## Aplicación de escritorio y actualizaciones

La preparación para Windows está en [DESKTOP.md](DESKTOP.md): ejecución con Electron, instalador por usuario y publicaciones en GitHub Releases. El flujo crea borradores para revisar antes de ofrecer una actualización a los estudiantes. El origen de actualizaciones configurado es `ccFierro/Stabiliza`; necesita una Release pública estable para distribuir actualizaciones.

## Adaptador externo

La bola levitadora incluye un enlace TCP local en la app de escritorio y un bloque MATLAB System sin Instrument Control Toolbox. Ver [guía MATLAB](matlab/README.md). En Automático, el proceso local integra la física por cada paso solicitado; la interfaz muestra sus estados. Solo la bola está habilitada en esta versión.

El adaptador JavaScript anterior se conserva para desarrollo de las plantas restantes:

```js
window.estabiliza.readSchema();
window.estabiliza.readMeasurement();
window.estabiliza.receiveExternalCommand({ left: 0.4, right: 0.45 });
window.estabiliza.disconnect();
```

El ejemplo corresponde a la doble hélice. Usar las claves de la tabla inicial para las demás. También se acepta un vector en el orden de `readSchema().inputs`, y un número para plantas de una entrada. Cada trama debe contener todos los actuadores, con valores finitos dentro de rango. Una trama inválida se rechaza completa y no renueva la recepción.

- `readSchema()`: versión 2, sistema, entradas con rangos, unidades de medición, referencia y timeout.
- `readMeasurement()`: tiempo simulado, estados, mandos, referencia, pausa, recepción y parámetros. Las nuevas plantas incluyen estado y motivo de detención. Las originales conservan `command` y añaden `commands`.
- Una trama válida inicia/reanuda la planta, activa la fuente externa y bloquea mandos locales, configuración, pausa y reinicio. Las perturbaciones siguen disponibles.
- Sin una trama válida durante 500 ms de reloj real, todos los mandos pasan a cero; nunca se restaura un mando manual antiguo. El actuador conserva su dinámica residual.
- Las pestañas ocultas no reciben mandos y suspenden el avance. La caldera rechaza mandos si ya salió del dominio.
- Control externo siempre a velocidad 1×. El navegador no garantiza tiempo real estricto; el futuro transporte debe resolver sincronización, muestreo y fallos.

## Archivos y verificación

- `physics.js`, `app.js`: las dos plantas originales.
- `plants.js`: seis modelos, parámetros, señales, ecuaciones y guías.
- `plant-scenes.js`: ilustraciones vectoriales ligadas a los estados.
- `lab.html`, `lab.js`: interfaz de las seis plantas nuevas.
- `input-source.js`: arbitraje, entradas firmadas y múltiples.
- `scopes.js`, `workspace-ui.js`, `styles.css`: instrumentación y presentación compartidas.

Las plantas nuevas usan pasos de 5 ms y subpasos de hasta 1 ms. Los sistemas mecánicos usan Runge–Kutta de orden 4; estanques conservan volumen y la caldera resuelve la temperatura desde el balance energético.

Ejecutar `node --test` o `npm.cmd test`. Las pruebas verifican equilibrio, inestabilidad, conservación, balances, topes, extremos de parámetros, perturbaciones y entradas externas. La integración de las ocho páginas comprueba mandos, navegación, gráficos y CSV con un DOM simulado (`ui-test-dom.js`). No sustituye una revisión visual en navegador.
## Ejercicios de modelamiento (0.1.6)

Desde la portada, **Ejercicios de modelamiento** abre seis prácticas independientes de la conexión TCP: RL, RC con dos resistencias, LC con dos inductancias ideales sin acoplamiento, masa-resorte, masa-resorte-amortiguador y masa con dos resortes. Se distinguen primer y segundo orden. Todos parten del reposo con un escalón aplicado en t = 0 y unidades SI.

Incluye esquemas estáticos, ecuaciones, ayudas progresivas para bloques Simulink, gráficos por señal y leyendas interactivas. Los casos aleatorios eligen parámetros positivos dentro de rangos didácticos y una ventana según la constante de tiempo, período natural y amortiguamiento. Los casos se guardan y recuperan como JSON con versión de formato; los cambios manuales se aplican al pulsar Calcular respuesta. Los gráficos y exportaciones siempre corresponden al último ensayo calculado.

Se puede exportar la referencia o importar resultados CSV (cabecera `t` seguida de las señales indicadas, coma como separador y punto decimal). El archivo debe cubrir todo el intervalo; la comparación interpola linealmente y muestra errores RMS y máximo en unidades físicas, sin certificar toda la implementación del estudiante. Importar datos no necesita MATLAB instalado. La integración RK4 se limita a un máximo de pasos y se verifica contra soluciones analíticas y balances físicos.
