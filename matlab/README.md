# Enlace genérico con MATLAB / Simulink

La app necesita estar en **Bola levitadora → Enlace → Automático**. La física automática se ejecuta en el proceso local de la aplicación; MATLAB envía mandos y recibe estados. No hay PID dentro de la app.

Requisitos: MATLAB con `tcpclient`; para el bloque, también Simulink con MATLAB System en ejecución interpretada. **No se requiere Instrument Control Toolbox**, ni compilador ni Simulink Coder. No se promete compatibilidad con todas las versiones antiguas; comprobar `exist('tcpclient','file')` y la disponibilidad de MATLAB System. Esta primera integración es un prototipo a validar en las versiones del curso.

1. Copiar esta carpeta a una ubicación editable y añadirla al path de MATLAB.
2. Abrir la bola en la app instalada, ajustar sus parámetros y activar Automático. El cambio de modo reinicia el ensayo.
3. Ejecutar `probar_enlace` para verificar la comunicación desde MATLAB base.
4. Ejecutar `crear_modelo` para generar un ejemplo de Simulink en memoria. Activar Automático antes de pulsar Run.
5. Reemplazar el mando constante por el controlador del estudiante. Limitar la salida entre 0 y 1. El bloque devuelve altura en metros y velocidad en m/s.

El bloque entrega y[k] antes de aplicar u[k]. Su método de actualización avanza la planta un período de muestreo, evitando un lazo algebraico artificial. El período por defecto es 0.01 s y el solver debe ser de paso fijo; el backend integra en subpasos de hasta 0.005 s. No duplicar la planta en Simulink.

La simulación avanza por pasos, no por FPS. Si Simulink corre más rápido que el reloj real, usar Simulation Pacing para observar la animación. Los gráficos de la app son una vista muestreada de los estados; registrar las salidas en Simulink para conservar cada muestra del controlador.

Solo se acepta un cliente. Al cerrar la conexión o pasar 5 segundos sin datos se detiene el avance y el mando pasa a cero. Para depuración con pausas largas, reiniciar la conexión. Volver a Manual cierra el servidor y reinicia la planta. Salir del escenario desconecta MATLAB.

## Protocolo 1

TCP `127.0.0.1:5050`, binario `double` IEEE754 little-endian. Petición de 4 valores `[operación, secuencia, mando, Ts]`: operación 0 reinicia (secuencia 0), operación 1 avanza (secuencia incremental). Mando entre 0 y 1; Ts entre 0.001 y 0.1 s. Cada petición devuelve 8 valores `[secuencia, tiempo, altura, velocidad, aire, fuerza, mando, estado]`, estado válido 1. Tramas inválidas cierran la conexión. El cliente espera una respuesta antes de enviar la siguiente petición.

Documentación: https://www.mathworks.com/help/matlab/ref/tcpclient.html
