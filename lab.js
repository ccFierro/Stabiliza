import {createPlant,plantSpecs} from './plants.js';
import {createScene} from './plant-scenes.js';
import {MultiInputSource} from './input-source.js';
import {createScopes} from './scopes.js';
import {initWorkspace} from './workspace-ui.js';
import {clamp} from './physics.js';

const $=id=>document.getElementById(id);
const requested=new URLSearchParams(location.search).get('system');
const id=Object.hasOwn(plantSpecs,requested)?requested:'pendulum';
const spec=plantSpecs[id],plant=createPlant(id),source=new MultiInputSource(spec.inputs),dt=.005;
const units={pendulum:{x:'m',v:'m/s',theta:'rad',omega:'rad/s',force:'N'},boiler:{pressure:'Pa',temperature:'K',level:'1',heat:'W',feed:'kg/s',steam:'kg/s',mass:'kg',energy:'J',heatLoss:'W'},maglev:{gap:'m',v:'m/s',current:'A',force:'N',weight:'N',voltage:'V'},tanks:{h1:'m',h2:'m',pump:'m³/s',transfer:'m³/s',outlet:'m³/s',overflow:'m³/s',volume:'m³'},beam:{x:'m',v:'m/s',theta:'rad',omega:'rad/s',torque:'N·m'},twin:{theta:'rad',omega:'rad/s',left:'N',right:'N',torque:'N·m'}}[id];
let paused=true,reference=spec.reference/spec.factor,command=spec.inputs.map(()=>0),samples=[],nextSample=.05,accumulator=0,last=performance.now(),speed=1,zoom=1,toastTimer;
const inputs=[],outputs=[],readings=[];
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const fmt=value=>Math.abs(value)>=100?value.toFixed(1):Math.abs(value)>=1?value.toFixed(2):value.toFixed(3);
document.body.dataset.system=id;document.title=`Estabiliza — ${spec.title}`;
$('plantTitle').textContent=spec.title;
document.querySelector('.stage-heading .eyebrow').textContent=`PLANTA ${spec.number} / ${spec.subtitle.toUpperCase()}`;
document.querySelector('.stage-heading p').textContent='Ajusta los mandos e inicia el ensayo. La física determina la respuesta.';
$('scenePickerToggle').innerHTML=`<span class="scene-symbol" aria-hidden="true">◉</span><span><small>Sistema</small>${spec.title}</span><span class="picker-chevron" aria-hidden="true">⌄</span>`;
for(const link of document.querySelectorAll('.systems a'))if(link.getAttribute('href')===`/lab.html?system=${id}`)link.setAttribute('aria-current','page');
$('apparatus').setAttribute('aria-label',`${spec.title}: modelo físico 2D`);
$('plantSummary').textContent='Modelo didáctico sin calibración experimental. Consulta ecuaciones y supuestos en Ajustes.';
['pushUp','pushDown','airLoss'].forEach((key,i)=>{$(key).textContent=spec.perturbations[i];$(key).title=spec.perturbations[i];});
$('timeScaleControl').hidden=!['tanks','boiler'].includes(id);

for(const [i,actuator] of spec.inputs.entries()){
  const group=el('div',undefined,'control-section'),label=el('label',actuator.label),output=el('output','0 %');
  label.htmlFor=`actuator-${i}`;label.append(output);
  const range=el('input');Object.assign(range,{type:'range',id:`actuator-${i}`,min:actuator.min*100,max:100,step:.1,value:0});range.setAttribute('aria-label',actuator.label);
  const limits=el('div',undefined,'range-labels');limits.append(el('span',`${actuator.min*100} %`),el('span','100 %'));
  const presets=el('div',undefined,'power-presets');presets.setAttribute('aria-label',`Valores rápidos: ${actuator.label}`);
  for(const value of actuator.min<0?[-100,-50,0,50,100]:[0,25,50,75,100]){
    const button=el('button',`${value} %`);button.type='button';button.onclick=()=>{if(source.setManual(i,value/100)){range.value=value;render();}};presets.append(button);
  }
  range.oninput=e=>{if(source.setManual(i,Number(e.target.value)/100))render();};
  group.append(label,range,limits,presets);$('actuatorControls').append(group);inputs.push(range);outputs.push(output);
  const row=el('div',undefined,'reading-row');row.append(el('span',actuator.label),el('code',`${actuator.key}: ${actuator.min}…1`));$('inputSchema').append(row);
}
for(const signal of spec.signals){const box=el('div'),value=el('strong');box.append(el('span',signal.name),value);$('liveReadings').append(box);readings.push([signal,value]);}
for(const field of spec.fields){
  const label=el('label',`${field.label} (${field.unit})`),input=el('input');
  Object.assign(input,{id:`config-${field.key}`,name:field.key,type:'number',min:field.min,max:field.max,step:field.step,required:true,value:plant.parameters[field.key]/field.scale});
  label.append(input);$('parameterFields').append(label);
}
const equations=el('div',undefined,'equations');for(const equation of spec.equations)equations.append(el('div',equation));
const sourceLink=el('a','Referencia didáctica ↗');sourceLink.href=spec.source;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';
$('modelDetails').append(el('h2',spec.title),equations,el('h3','Supuestos y límites'),el('p',spec.assumptions),el('p','Las ecuaciones son la implementación didáctica de esta app; no una reproducción calibrada del equipo de referencia.'),sourceLink);
for(const step of spec.guide)$('experimentSteps').append(el('li',step));
$('apiExample').textContent=`window.estabiliza.receiveExternalCommand(\n  ${JSON.stringify(Object.fromEntries(spec.inputs.map(i=>[i.key,0])))}\n);\nwindow.estabiliza.readMeasurement();\nwindow.estabiliza.readSchema();\nwindow.estabiliza.disconnect();`;
function updateReference(){
  const [min,max]=spec.bounds(plant.parameters);reference=clamp(reference*spec.factor,min,max)/spec.factor;
  Object.assign($('reference'),{min,max,step:(max-min)/1000,value:reference*spec.factor});
  $('referenceMin').textContent=`${fmt(min)} ${spec.unit}`;$('referenceMax').textContent=`${fmt(max)} ${spec.unit}`;
}
updateReference();
const scene=createScene($('apparatus'),id);
function updateView(){const width=['maglev','boiler'].includes(id)&&$('apparatus').clientWidth<480?520:660;$('apparatus').setAttribute('viewBox',`${330-width/2/zoom} ${255-255/zoom} ${width/zoom} ${510/zoom}`);$('zoomValue').textContent=`${Math.round(zoom*100)} %`;$('zoomIn').disabled=zoom>=3;$('zoomOut').disabled=zoom<=.75;}
$('zoomIn').onclick=()=>{zoom=clamp(zoom+.25,.75,3);updateView();};$('zoomOut').onclick=()=>{zoom=clamp(zoom-.25,.75,3);updateView();};$('zoomReset').onclick=()=>{zoom=1;updateView();};window.addEventListener('resize',updateView);updateView();
initWorkspace({document,window,onLayout:updateView,layers:{showAnnotations:'annotations',showForces:'forces',showFlow:'flow'}});
const primary=spec.signals.find(s=>s.key===spec.primary);
const signals=[...spec.signals,{key:'reference',name:'Marcador',unit:spec.unit,group:primary.group,dash:[5,5],value:s=>s.reference*spec.factor},...spec.inputs.map((a,i)=>({key:`command_${a.key}`,name:a.label,unit:'%',group:'command',value:s=>s.commands[i]*100}))];
const groups={};for(const s of signals)groups[s.group]=s.group==='command'?'Mandos de actuadores':signals.filter(a=>a.group===s.group).map(a=>a.name).join(' · ');
const scopes=createScopes({definitions:signals,groups,initial:[spec.primary,'reference',`command_${spec.inputs[0].key}`],baseRanges:group=>group==='command'?[Math.min(...spec.inputs.map(i=>i.min))*100,100]:group===primary.group?spec.bounds(plant.parameters):undefined,note:' Datos de un modelo didáctico. Los topes son inelásticos; la caldera se detiene al salir del dominio declarado.'});

function toast(message){$('eventToast').textContent=message;$('eventToast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('eventToast').classList.remove('visible'),3000);}
function updatePause(){
  $('pause').textContent=paused?'▶ Iniciar':'Ⅱ Pausar';$('pause').disabled=source.connected||plant.halted;
  $('runLabel').textContent=plant.halted?'Límite del modelo':paused?'Ensayo en pausa':'Simulación activa';$('runningDot').style.background=paused?'#a57c33':'#00979d';
  for(const id of ['pushUp','pushDown','airLoss'])$(id).disabled=paused||plant.halted;
}
function syncSource(){
  const connected=source.connected;$('localInputs').disabled=connected;$('configurationInputs').disabled=connected;$('reset').disabled=connected;
  $('controlBadge').textContent=connected?'EXTERNO':'MANUAL';$('connectionStatus').classList.toggle('external',connected);
  $('connectionLabel').textContent=connected?'Entrada externa activa':'Control local';$('sourceTitle').textContent=connected?'Mandos externos recibidos':'Sin comunicación externa';
  $('sourceDescription').textContent=connected?'El adaptador está recibiendo mandos. Los controles locales están bloqueados.':'El transporte con Simulink está pendiente. El adaptador acepta tramas completas y caduca tras 500 ms sin recibirlas.';
  $('modeHelp').textContent=connected?'La planta recibe mandos externos a velocidad 1×.':`${spec.inputs.length===1?'Un actuador':'Dos actuadores independientes'}. ${spec.inputs.some(i=>i.min<0)?'El signo del mando determina el sentido.':'El mando va de 0 a 100 %.'} No hay controlador interno.`;
  if(plant.halted)$('modeHelp').textContent=plant.reason;
  inputs.forEach((range,i)=>{range.value=(connected?source.external[i]:source.manual[i])*100;});updatePause();
}
const schema=Object.freeze({version:2,system:id,inputs:spec.inputs.map(i=>({...i,unit:'normalized'})),measurements:{...units},reference:{key:spec.primary,unit:units[spec.primary]},timeoutMs:500});
window.estabiliza=Object.freeze({
  receiveExternalCommand(value){if(document.hidden||plant.halted)return false;if(!source.receive(value,performance.now()))return false;paused=false;speed=1;$('timeScale').value='1';syncSource();return true;},
  disconnect(){source.disconnect();command=spec.inputs.map(()=>0);syncSource();render();},
  readMeasurement(){return {system:id,time:plant.time,...plant.measure(),reference,commands:[...command],connected:source.connected,paused,halted:plant.halted,status:plant.status,parameters:{...plant.parameters},units:{...units}};},
  readSchema(){return structuredClone(schema);}
});
function record(){samples.push({t:plant.time,...plant.measure(),reference,commands:[...command],source:source.connected?'externa':'manual'});if(samples.length>12000)samples.shift();}
function render(){
  const state=plant.measure(),shown=source.connected?source.external:source.manual;
  readings.forEach(([signal,node])=>{node.replaceChildren(document.createTextNode(fmt(signal.value(state))+' '),el('small',signal.unit));});
  outputs.forEach((node,i)=>{node.textContent=`${(shown[i]*100).toFixed(1)} %`;});
  $('referenceValue').textContent=`${fmt(reference*spec.factor)} ${spec.unit}`;$('plantState').textContent=(paused&&!plant.halted?'En pausa · ':'')+plant.status;$('plantState').classList.toggle('limit-reached',plant.halted);
  $('time').textContent=`t = ${plant.time.toFixed(2)} s${speed!==1?' · '+speed+'×':''}`;
  scene(plant,reference);scopes.draw(samples,plant.time);
}
function reset(){plant.reset();source.disconnect();command=spec.inputs.map(()=>0);samples=[];nextSample=.05;accumulator=0;paused=true;updateReference();syncSource();record();render();}
$('pause').onclick=()=>{if(source.connected||plant.halted)return;paused=!paused;accumulator=0;last=performance.now();updatePause();};
$('reset').onclick=()=>{if(!source.connected){reset();toast('Ensayo reiniciado. Mandos en cero.');}};
$('reference').oninput=e=>{if(!source.connected){reference=Number(e.target.value)/spec.factor;render();}};
$('timeScale').onchange=e=>{if(source.connected)return;speed=[1,5,10].includes(Number(e.target.value))?Number(e.target.value):1;accumulator=0;render();};
['plus','minus','event'].forEach((kind,i)=>{$(['pushUp','pushDown','airLoss'][i]).onclick=()=>{if(paused||plant.halted)return;plant.perturb(kind);toast(spec.perturbations[i]);render();};});
$('parameterForm').onsubmit=e=>{
  e.preventDefault();if(source.connected)return;
  const next=Object.fromEntries(spec.fields.map(f=>[f.key,Number($(`config-${f.key}`).value)*f.scale]));
  try{plant.configure(next);reset();$('configStatus').textContent='Parámetros aplicados. Ensayo preparado y registro reiniciado.';}catch(error){$('configStatus').textContent=error.message;}
};
$('defaultParameters').onclick=()=>{if(source.connected)return;for(const f of spec.fields)$(`config-${f.key}`).value=spec.defaults[f.key]/f.scale;$('configStatus').textContent='Valores originales cargados. Pulsa Aplicar y reiniciar.';};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();});
$('navModel').onclick=()=>$('modelDialog').showModal();$('navGuide').onclick=()=>$('guideDialog').showModal();
$('export').onclick=()=>{
  const keys=Object.keys(units),params=Object.keys(plant.parameters);
  const header=['time_s',...keys.map(k=>`${k}_[${units[k]}]`),`reference_${spec.primary}`,...spec.inputs.map(i=>`command_${i.key}`),'source',...params.map(k=>`param_${k}`)];
  const lines=samples.map(s=>[s.t,...keys.map(k=>s[k]),s.reference,...s.commands,s.source,...params.map(k=>plant.parameters[k])].map(v=>typeof v==='number'?v.toPrecision(10):v).join(','));
  const url=URL.createObjectURL(new Blob([header.join(',')+'\n'+lines.join('\n')],{type:'text/csv;charset=utf-8'}));
  const link=el('a');link.href=url;link.download=`${id}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function frame(now){
  const elapsed=Math.max(0,Math.min((now-last)/1000,.1));last=now;
  const connected=source.connected,requested=source.tick(now);if(connected!==source.connected){command=spec.inputs.map(()=>0);syncSource();toast('Entrada externa caducada. Mandos en cero.');}
  if(!paused&&!document.hidden&&!plant.halted){
    accumulator+=elapsed*speed;
    while(accumulator>=dt){command=[...requested];plant.step(command,dt);accumulator-=dt;
      if(plant.time>=nextSample-1e-9){record();nextSample+=.05;}
      if(plant.halted){paused=true;source.disconnect();command=spec.inputs.map(()=>0);accumulator=0;record();syncSource();toast(plant.reason);break;}
    }
  }
  render();requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;if(document.hidden&&source.connected){source.disconnect();command=spec.inputs.map(()=>0);syncSource();}});
syncSource();record();render();requestAnimationFrame(frame);
