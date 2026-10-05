const { app, BrowserWindow, Menu, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { canInstall } = require('./update-policy.cjs');

let window, server, origin;
let checking = false, downloading = false, ready = false, available = false, interactiveCheck = false;
let updateStatus = 'Sin comprobar';
const configured = () => app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
const show = (message, detail = '') => dialog.showMessageBox(window, { type: 'info', title: 'Estabiliza', message, detail });
function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Aplicación', submenu: [{ label: 'Salir', role: 'quit' }] },
    { label: 'Vista', submenu: [{ role: 'togglefullscreen', label: 'Pantalla completa' }] },
    { label: 'Actualizaciones', submenu: [
      { label: `Versión ${app.getVersion()} · ${updateStatus}`, enabled: false },
      { label: 'Buscar actualizaciones', enabled: !checking && !downloading && !ready, click: () => check(true) },
      { label: 'Descargar actualización', enabled: available && !downloading && !ready, click: download },
      { label: 'Reiniciar e instalar…', enabled: ready, click: install }
    ] },
    { label: 'Ayuda', submenu: [
      { label: 'Novedades de esta versión', click: () => show(`Novedades · Estabiliza ${app.getVersion()}`, 'Versión 0.1.1\n\nLa barra de título muestra la versión instalada y este menú permite reconocer la nueva versión tras actualizar.\n\nSe conserva el funcionamiento de las ocho plantas. La comunicación TCP con Simulink todavía está pendiente.') },
      { label: 'Acerca de Estabiliza', click: () => show(`Estabiliza ${app.getVersion()}`, 'Laboratorio de sistemas de control. La física se ejecuta localmente. La comunicación TCP con Simulink está pendiente de implementación.') }
    ] }
  ]));
}
async function check(interactive = false) {
  if (checking || downloading || ready) return;
  if (!configured()) {
    if (interactive) await show('Actualizaciones aún no configuradas', 'Esta compilación local no tiene un repositorio de publicaciones. Las versiones generadas por el flujo de GitHub incorporan su dirección automáticamente.');
    return;
  }
  checking = true; interactiveCheck = interactive; updateStatus = 'Buscando…'; menu();
  try { await autoUpdater.checkForUpdates(); }
  catch { /* The error event reports failures without interrupting the simulation. */ }
  finally { checking = false; menu(); }
}
async function download() {
  if (downloading || ready || !available) return;
  downloading = true; updateStatus = 'Descargando…'; menu();
  try { await autoUpdater.downloadUpdate(); }
  catch { /* Handled by the updater error event. */ }
  finally { downloading = false; menu(); }
}
async function idle() {
  try { return canInstall(await window.webContents.executeJavaScript('window.estabiliza?.readMeasurement()')); }
  catch { return false; }
}
async function install() {
  if (!ready) return;
  if (!await idle()) return show('Detén el ensayo antes de actualizar', 'Pausa la simulación y desconecta el mando externo. Luego vuelve a «Reiniciar e instalar».');
  const { response } = await dialog.showMessageBox(window, { type: 'question', title: 'Instalar actualización', message: '¿Reiniciar Estabiliza para actualizar?', detail: 'Exporta los datos que quieras conservar. El ensayo actual no se restaura después del reinicio.', buttons: ['Ahora no', 'Reiniciar e instalar'], defaultId: 0, cancelId: 0 });
  if (response === 1 && await idle()) autoUpdater.quitAndInstall(false, true);
}
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;
autoUpdater.on('update-available', async info => {
  available = true; updateStatus = `Disponible ${info.version}`; menu();
  const { response } = await dialog.showMessageBox(window, { type: 'info', title: 'Actualización disponible', message: `Estabiliza ${info.version} está disponible`, detail: 'Puedes descargarla en segundo plano y elegir cuándo instalarla.', buttons: ['Más tarde', 'Descargar'], defaultId: 0, cancelId: 0 });
  if (response === 1) await download();
});
autoUpdater.on('update-not-available', () => {
  available = false; updateStatus = 'Al día'; menu();
  if (interactiveCheck) void show('Ya tienes la versión más reciente');
});
autoUpdater.on('download-progress', progress => { updateStatus = `Descargando ${Math.floor(progress.percent)} %`; menu(); });
autoUpdater.on('update-downloaded', () => { ready = true; updateStatus = 'Lista para instalar'; menu(); });
autoUpdater.on('error', () => {
  updateStatus = 'No se pudo completar; puedes reintentar'; menu();
  if (interactiveCheck || downloading) void show('No se pudo completar la actualización', 'Comprueba tu conexión y vuelve a intentarlo desde el menú Actualizaciones. Puedes seguir usando la versión instalada.');
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const { createLocalServer } = await import(pathToFileURL(path.join(__dirname, '..', 'server.js')).href);
    server = createLocalServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${server.address().port}`;
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    const desktopTitle = `Estabiliza · v${app.getVersion()}`;
    window = new BrowserWindow({ width: 1440, height: 960, minWidth: 760, minHeight: 600, backgroundColor: '#edf4f4', title: desktopTitle, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    window.on('page-title-updated', event => { event.preventDefault(); window.setTitle(desktopTitle); });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const restrictNavigation = (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); };
    window.webContents.on('will-navigate', restrictNavigation);
    window.webContents.on('will-redirect', restrictNavigation);
    const smoke = process.argv.includes('--smoke-test');
    if (!smoke) window.once('ready-to-show', () => window.show());
    menu();
    await window.loadURL(origin);
    if (smoke) {
      try { await require('./smoke.cjs').run(window, origin); app.exit(0); }
      catch (error) { fs.writeFileSync(path.join(process.cwd(), 'dist', 'smoke-error.txt'), error.stack); app.exit(1); }
      return;
    }
    setTimeout(() => void check(), 12000).unref();
    setInterval(() => void check(), 6 * 60 * 60 * 1000).unref();
  }).catch(error => { dialog.showErrorBox('No se pudo iniciar Estabiliza', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => server?.close());
}
