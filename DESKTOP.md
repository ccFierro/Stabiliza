# Estabiliza para Windows

La edición de escritorio incluye el navegador y el servidor local. El estudiante no necesita instalar Node.js. La conexión real con Simulink todavía está pendiente; empaquetar la app no la implementa.

## Probar y generar un instalador

Requisitos de desarrollo: Windows x64 y Node.js 24 con npm.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run desktop
npm.cmd run dist:win
```

El instalador queda en `dist/Estabiliza-0.1.0-x64.exe` (el nombre cambia con la versión). Se instala por usuario y permite elegir carpeta. `npm.cmd start` sigue abriendo el servidor web de desarrollo como antes.

## Primera publicación en GitHub

1. Repositorio configurado: https://github.com/ccFierro/Stabiliza. Confirmar que sea público y subir el proyecto, incluyendo `package-lock.json` y `.github/workflows/release.yml`; excluir `node_modules` y `dist`.
2. Ejecutar el workflow **Instalador Windows** desde Actions para obtener un instalador de prueba en sus artefactos. Este flujo incorpora automáticamente la dirección del repositorio como origen de actualizaciones.
3. Para preparar la primera versión distribuible, crear y subir la etiqueta `v0.1.0`, coincidente con `package.json`.
4. El workflow ejecuta las pruebas, genera el instalador y adjunta los archivos a una **Release en borrador**. Revisar y probar el instalador, escribir las novedades y publicar el borrador como versión estable.
5. Distribuir ese instalador a los estudiantes una sola vez. Las publicaciones siguientes se detectan desde la aplicación.

Los borradores y las prepublicaciones no se ofrecen como actualizaciones estables. Conservar juntos el `.exe`, `.exe.blockmap` y `latest.yml` generados. No editar el manifiesto a mano.

Las compilaciones locales ya usan `ccFierro/Stabiliza` como origen de actualizaciones. Para generar el instalador:

```powershell
npm.cmd run dist:win
```

GitHub Actions utiliza `GITHUB_REPOSITORY` para incorporar el repositorio del workflow. Localmente, esa variable permite reemplazar el destino predeterminado si se necesita. El primer instalador generado antes de configurar GitHub no tenía origen de actualizaciones: reemplazarlo una vez por esta compilación. La comprobación funcionará cuando exista una Release pública estable con `latest.yml` y sus archivos asociados.

No incluir tokens de GitHub dentro de la app. El workflow usa `GITHUB_TOKEN` únicamente para publicar. Esta configuración asume descargas públicas; un repositorio privado necesita un servicio de distribución accesible para los estudiantes, no un token compartido incrustado.

## Publicar una mejora

Con Git instalado y el repositorio conectado:

```powershell
npm.cmd version patch --no-git-tag-version
npm.cmd test
git add .
git commit -m "Preparar nueva versión"
git tag v0.1.1
git push
git push origin v0.1.1
```

Usar siempre la etiqueta correspondiente a la nueva versión de `package.json`. Revisar el borrador generado antes de publicarlo. El botón manual de Actions genera artefactos de prueba sin publicar una Release.

## Comportamiento de actualización

- Comprobación al iniciar y cada seis horas; también desde **Actualizaciones → Buscar actualizaciones**.
- Descarga con consentimiento, en segundo plano; muestra progreso en el menú.
- Instalación solo mediante **Reiniciar e instalar**, después de pausar y desconectar el mando externo. Se vuelve a comprobar el estado tras confirmar.
- No instala automáticamente al cerrar. Sin internet, la simulación local sigue disponible.
- Los datos del ensayo están en memoria: exportar CSV antes de cerrar o reiniciar. Aún no hay recuperación de sesión ni persistencia de parámetros.
- El instalador conserva la carpeta de datos del usuario; no se fuerza degradación a versiones anteriores.

## Alcance de esta primera preparación

El ejecutable inicial usa el icono predeterminado y no está firmado digitalmente. Windows puede mostrar avisos de aplicación desconocida. Antes de distribuir a toda la clase, configurar firma de código mediante secretos del proceso de compilación y validar una actualización real entre dos versiones en un equipo de prueba. No guardar certificados ni claves en el repositorio.

La física permanece en la interfaz por ahora; el servidor usa un puerto local disponible y no interfiere con el servidor web del puerto 3000. El traslado de la física al proceso local y el protocolo TCP sincronizado con Simulink son trabajos siguientes.
