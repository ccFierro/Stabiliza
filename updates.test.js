import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {Updates}=createRequire(import.meta.url)('./desktop/updates.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(overrides={}){
  const updater=new EventEmitter(),calls=[],timers=new Map();let serial=0;
  updater.checkForUpdates=async()=>{};
  updater.downloadUpdate=async()=>{calls.push('download');};
  updater.quitAndInstall=(...args)=>calls.push(['install',...args]);
  const flow=new Updates({updater,configured:()=>true,version:'0.1.2',notify:()=>{},openLab:async()=>calls.push('lab'),idle:async()=>true,confirm:async()=>true,schedule:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id),...overrides});
  const runTimer=async ms=>{for(const [id,t] of timers)if(t.ms===ms){timers.delete(id);await t.fn();}};
  return {updater,flow,calls,runTimer};
}
test('al iniciar descarga e instala silenciosamente sin cargar la planta',async()=>{
  const {updater,flow,calls,runTimer}=fixture();await flow.check();
  updater.emit('update-available',{version:'0.1.3'});await tick();
  updater.emit('download-progress',{percent:45});assert.equal(flow.state.progress,45);
  updater.emit('update-downloaded');await tick();await runTimer(800);
  assert.deepEqual(calls,['download',['install',true,true]]);
});
test('sin novedades o sin conexión abre el laboratorio',async()=>{
  for(const event of ['update-not-available','error']){
    const {updater,flow,calls}=fixture();await flow.check();updater.emit(event);await tick();
    assert.deepEqual(calls,['lab']);assert.equal(flow.state.startup,false);
  }
});
test('un chequeo lento no bloquea el inicio ni instala tarde sobre el ensayo',async()=>{
  const {updater,flow,calls,runTimer}=fixture();await flow.check();await runTimer(10000);
  updater.emit('update-available',{version:'0.1.3'});updater.emit('update-downloaded');await tick();await runTimer(800);
  assert.deepEqual(calls,['lab','download']);assert.equal(flow.state.stage,'ready');
});
test('abrir sin esperar durante descarga impide el reinicio automático',async()=>{
  const {updater,flow,calls,runTimer}=fixture();updater.emit('update-available',{version:'0.1.3'});
  await flow.enterLab();updater.emit('update-downloaded');await tick();await runTimer(800);
  assert.deepEqual(calls,['download','lab']);
});
test('un ensayo activo y la cancelación impiden instalar',async()=>{
  for(const overrides of [{idle:async()=>false},{confirm:async()=>false}]){
    const {updater,flow,calls,runTimer}=fixture(overrides);await flow.enterLab();
    updater.emit('update-downloaded');await flow.install();await runTimer(800);
    assert.deepEqual(calls,['lab']);
  }
});
test('se vuelve a comprobar la pausa inmediatamente antes de instalar',async()=>{
  let paused=true;const {updater,flow,calls,runTimer}=fixture({idle:async()=>paused});
  await flow.enterLab();updater.emit('update-downloaded');await flow.install();paused=false;await runTimer(800);
  assert.deepEqual(calls,['lab']);assert.equal(flow.state.stage,'busy');
});
test('dos solicitudes simultáneas solo instalan una vez',async()=>{
  const {updater,flow,calls,runTimer}=fixture();await flow.enterLab();updater.emit('update-downloaded');
  await Promise.all([flow.install(),flow.install()]);await runTimer(800);
  assert.deepEqual(calls,['lab',['install',true,true]]);
});
test('un fallo de descarga permite continuar y volver a comprobar',async()=>{
  const {updater,flow,calls}=fixture();updater.downloadUpdate=async()=>{throw Error('offline');};
  updater.emit('update-available',{version:'0.1.3'});await tick();
  assert.deepEqual(calls,['lab']);assert.equal(flow.downloading,false);await flow.check();assert.equal(flow.state.stage,'checking');
});
