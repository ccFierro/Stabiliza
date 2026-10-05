const {app,BrowserWindow,Menu,dialog,session,ipcMain}=require('electron');
const {autoUpdater}=require('electron-updater');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {canInstall}=require('./update-policy.cjs');
const {Updates}=require('./updates.cjs');
const smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',path.join(app.getPath('temp'),`estabiliza-smoke-${process.pid}`));
let window,progressWindow,server,origin,updates;
const labels={checking:'Buscando…',downloading:'Descargando',ready:'Lista para instalar',installing:'Instalando…',current:'Al día',error:'No se pudo actualizar',slow:'Conexión lenta',busy:'Pausa el ensayo para instalar',unconfigured:'Versión de desarrollo'};
const show=(message,detail='')=>dialog.showMessageBox(window,{type:'info',title:'Estabiliza',message,detail});
function menu(){
  const state=updates.state;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Aplicación',submenu:[{label:'Salir',role:'quit'}]},
    {label:'Vista',submenu:[{role:'togglefullscreen',label:'Pantalla completa'}]},
    {label:'Actualizaciones',submenu:[
      {label:`Versión ${app.getVersion()} · ${labels[state.stage]||state.stage}${state.stage==='downloading'?` ${Math.floor(state.progress)} %`:''}`,enabled:false},
      {label:'Ver progreso de actualización',click:()=>void showProgress()},
      {label:'Buscar actualizaciones',enabled:!updates.checking&&!updates.downloading&&!updates.installing,click:()=>{void showProgress();void updates.check();}},
      {label:'Reiniciar e instalar',enabled:updates.ready&&!updates.installing,click:()=>{void showProgress();void updates.install();}}
    ]},
    {label:'Ayuda',submenu:[
      {label:'Novedades de esta versión',click:()=>show(`Novedades · Estabiliza ${app.getVersion()}`,'Nueva galería de inicio con los ocho escenarios, ilustraciones y sus mandos y mediciones. Puedes volver a la galería desde el logotipo del laboratorio. Se mantienen las actualizaciones automáticas al iniciar.')},
      {label:'Acerca de Estabiliza',click:()=>show(`Estabiliza ${app.getVersion()}`,'Laboratorio local de sistemas de control. La comunicación TCP con Simulink está pendiente de implementación.')}
    ]}
  ]));
}
function restrict(contents){
  contents.setWindowOpenHandler(()=>({action:'deny'}));
  const guard=(event,url)=>{try{if(new URL(url).origin!==origin)event.preventDefault();}catch{event.preventDefault();}};
  contents.on('will-navigate',guard);contents.on('will-redirect',guard);
}
function preferences(){return {nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.cjs')};}
async function showProgress(){
  if(updates.state.startup){window.focus();return;}
  if(progressWindow&&!progressWindow.isDestroyed()){progressWindow.focus();return;}
  progressWindow=new BrowserWindow({parent:window,width:580,height:720,minWidth:480,minHeight:620,resizable:false,show:false,backgroundColor:'#edf5f5',webPreferences:preferences()});
  progressWindow.setMenu(null);restrict(progressWindow.webContents);
  progressWindow.on('closed',()=>{progressWindow=null;});
  progressWindow.once('ready-to-show',()=>progressWindow?.show());
  await progressWindow.loadURL(`${origin}/update.html`);
}
function authorized(event){
  const contents=event.sender;
  if(contents!==window?.webContents&&contents!==progressWindow?.webContents)return false;
  return event.senderFrame===contents.mainFrame&&event.senderFrame.url===`${origin}/update.html`;
}
ipcMain.handle('updates:state',event=>{if(!authorized(event))throw new Error('Vista no autorizada');return {...updates.state};});
ipcMain.handle('updates:action',async(event,action)=>{
  if(!authorized(event))throw new Error('Vista no autorizada');
  if(action==='continue'){if(updates.installing)return;if(updates.state.startup)await updates.enterLab();else progressWindow?.close();}
  else if(action==='check')await updates.check();
  else if(action==='install')await updates.install();
  else throw new Error('Acción no válida');
});

if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  app.whenReady().then(async()=>{
    const {createLocalServer}=await import(pathToFileURL(path.join(__dirname,'..','server.js')).href);
    server=createLocalServer();
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    origin=`http://127.0.0.1:${server.address().port}`;
    session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    const desktopTitle=`Estabiliza · v${app.getVersion()}`;
    window=new BrowserWindow({width:1440,height:960,minWidth:760,minHeight:600,backgroundColor:'#edf5f5',title:desktopTitle,show:false,webPreferences:preferences()});
    window.on('page-title-updated',event=>{event.preventDefault();window.setTitle(desktopTitle);});
    restrict(window.webContents);
    updates=new Updates({updater:autoUpdater,version:app.getVersion(),
      configured:()=>app.isPackaged&&fs.existsSync(path.join(process.resourcesPath,'app-update.yml')),
      notify:state=>{
        if(!window||window.isDestroyed())return;
        window.setEnabled(!updates.installing);
        for(const target of [window,progressWindow])if(target&&!target.isDestroyed()&&target.webContents.getURL()===`${origin}/update.html`)target.webContents.send('updates:state',state);
        menu();
      },
      openLab:()=>window.loadURL(`${origin}/gallery.html`),
      idle:async()=>{if(window.webContents.getURL()===`${origin}/gallery.html`)return true;try{return canInstall(await window.webContents.executeJavaScript('window.estabiliza?.readMeasurement()'));}catch{return false;}},
      confirm:async()=>{
        const {response}=await dialog.showMessageBox(window,{type:'question',title:'Instalar actualización',message:'¿Reiniciar para actualizar?',detail:'Exporta los datos que quieras conservar. El ensayo actual no se restaura después del reinicio.',buttons:['Ahora no','Reiniciar e instalar'],defaultId:0,cancelId:0});
        return response===1;
      }
    });
    if(!smoke)window.once('ready-to-show',()=>window.show());
    menu();
    if(smoke){
      try{await require('./smoke.cjs').run(window,origin);app.exit(0);}
      catch(error){fs.writeFileSync(path.join(process.cwd(),'dist','smoke-error.txt'),error.stack);app.exit(1);}
      return;
    }
    await window.loadURL(`${origin}/update.html`);
    void updates.check();
    setInterval(()=>void updates.check(),6*60*60*1000).unref();
  }).catch(error=>{dialog.showErrorBox('No se pudo iniciar Estabiliza',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>server?.close());
}
