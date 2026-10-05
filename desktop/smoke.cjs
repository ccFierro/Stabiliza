// Integration check against Chromium, including the packaged application.
const fs = require('node:fs/promises');
const path = require('node:path');
const { app } = require('electron');
exports.run = async (window, origin) => {
  const results = [];
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level === 3) errors.push(message); });
  await window.loadURL(`${origin}/update.html`);
  const updateDeadline=Date.now()+10000;
  let splashReady=false;
  do {
    splashReady=await window.webContents.executeJavaScript(`document.getElementById('version').textContent.includes(${JSON.stringify(app.getVersion())})`);
    if(splashReady)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  } while(Date.now()<updateDeadline);
  if(!splashReady)throw new Error('La pantalla de actualización no recibió el estado por IPC');
  window.webContents.send('updates:state',{stage:'downloading',progress:55,startup:true,version:app.getVersion(),target:'siguiente versión'});
  await new Promise(resolve=>setTimeout(resolve,300));
  const displayedProgress=await window.webContents.executeJavaScript("document.getElementById('track').getAttribute('aria-valuenow')");
  if(displayedProgress!=='55')throw new Error('No se actualiza la barra de progreso');
  await fs.writeFile(path.join(process.cwd(),'dist','preview-update.png'),(await window.webContents.capturePage()).toPNG());
  for (const [route, system] of [['/', 'ball'], ['/pivot.html', 'pivot'], ...['pendulum','boiler','maglev','tanks','beam','twin'].map(id=>[`/lab.html?system=${id}`,id])]) {
    await window.loadURL(origin+route);
    const deadline = Date.now()+10000;
    let state;
    do {
      state = await window.webContents.executeJavaScript('window.estabiliza?.readMeasurement()');
      if (state) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    } while(Date.now()<deadline);
    if (state?.system !== system) throw new Error(`No se inicializó ${system}`);
    const isolated = await window.webContents.executeJavaScript('typeof require === "undefined" && typeof process === "undefined"');
    if (!isolated) throw new Error('Node expuesto en la interfaz');
    const updatesProtected=await window.webContents.executeJavaScript("window.desktopUpdates.state().then(()=>false,()=>true)");
    if(!updatesProtected)throw new Error('La planta puede invocar el actualizador');
    const layout = await window.webContents.executeJavaScript('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})');
    const title = window.getTitle();
    if (!title.includes(`v${app.getVersion()}`)) throw new Error(`Versión ausente del título en ${system}`);
    results.push({system,isolated,layout,title});
    if (system==='ball' || system==='twin') {
      await new Promise(resolve=>setTimeout(resolve,300));
      await fs.writeFile(path.join(process.cwd(),'dist',`preview-${system}.png`),(await window.webContents.capturePage()).toPNG());
    }
  }
  await fs.writeFile(path.join(process.cwd(),'dist','smoke-results.json'),JSON.stringify({results,errors},null,2));
  if(errors.length) throw new Error(errors.join('\n'));
};
