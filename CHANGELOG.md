# Novedades

## 0.1.2

- Busca actualizaciones automáticamente al abrir la app, antes de cargar la planta.
- Pantalla de inicio con identidad visual, barra de descarga y estados de actualización.
- Descarga automática e instalación silenciosa al iniciar; vuelve a abrir la aplicación al terminar.
- Sin conexión, o si la comprobación tarda más de diez segundos, abre el laboratorio.
- **Abrir laboratorio sin esperar** deja la descarga en segundo plano y evita reinicios automáticos durante la sesión.
- Las actualizaciones recibidas durante una sesión requieren pausa, desconexión del control externo y confirmación antes de instalar.

El salto desde 0.1.1 todavía utiliza el instalador visible de esa versión. El nuevo comportamiento rige después de instalar 0.1.2. Windows puede solicitar permisos si la instalación necesita elevación.

## 0.1.1

- La barra de título muestra la versión instalada en todas las plantas.
- Nuevo menú **Ayuda → Novedades de esta versión** para reconocer la actualización.
- El flujo de GitHub prepara un único borrador antes de subir los archivos del instalador.

Versión destinada a comprobar el salto desde 0.1.0 mediante el actualizador. La física de las plantas no cambia. La comunicación TCP con Simulink sigue pendiente.

## 0.1.0

- Primera versión para Windows x64 con ocho plantas, parámetros, perturbaciones, gráficos y exportación CSV.
- Actualizaciones mediante GitHub Releases; instalación con ensayo pausado y control externo desconectado.
- Instalador sin firma digital. Exportar los datos antes de reiniciar: no se recuperan los ensayos en memoria.
