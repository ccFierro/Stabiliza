import { initWorkspace } from './workspace-ui.js';
import { Plant, PivotPlant, clamp, parameters as ballParameters, parameterFields as ballFields, pivotParameters, pivotFields } from './physics.js';
import { InputSource } from './input-source.js';
import { createScopes } from './scopes.js';
const $ = id => document.getElementById(id);
const isPivot=document.body.dataset.system==='pivot';
const parameters=isPivot?pivotParameters:ballParameters, parameterFields=isPivot?pivotFields:ballFields;
const plant = isPivot?new PivotPlant():new Plant(), inputSource = new InputSource();
const dt = 0.005;
let paused = false, reference = isPivot?0:.5, command = 0;
const displayFactor=isPivot?180/Math.PI:100, positionUnit=isPivot?'°':'cm', velocityUnit=isPivot?'rad/s':'m/s';
const bounds=()=>isPivot?[-plant.parameters.angleLimit,plant.parameters.angleLimit]:[0,plant.parameters.height];
let accumulator = 0, last = performance.now(), samples = [], nextSample = 0, fanAngle = 0, toastTimer;
let acceleration=0;
const svgNS = 'http://www.w3.org/2000/svg';
function svg(tag, attributes, parent) { const node = document.createElementNS(svgNS, tag); for (const [k,v] of Object.entries(attributes)) node.setAttribute(k,v); parent.append(node); return node; }
const toY = y => 399 - y / plant.parameters.height * 318;
function updateScale() {
  if(isPivot){
    const limit=plant.parameters.angleLimit,deg=limit*180/Math.PI;
    reference=clamp(reference,-limit*.9,limit*.9);
    $('reference').min=-deg*.9;$('reference').max=deg*.9;$('reference').step=.1;$('reference').value=reference*180/Math.PI;
    $('referenceMin').textContent=`${(-deg*.9).toFixed(0)}°`;$('referenceMax').textContent=`${(deg*.9).toFixed(0)}°`;
    $('plantSummary').textContent=`Modelo didáctico · brazo de ${plant.parameters.length} m · motor de ${Math.round(plant.parameters.motorMass*1000)} g`;
    $('chart').setAttribute('aria-label',`Gráfico de ángulo entre ${-deg} y ${deg} grados`);
    $('pivotRuler').replaceChildren();
    for(let angle=-60;angle<=60;angle+=15){
      const a=angle*Math.PI/180;
      svg('line',{x1:230+174*Math.cos(a),y1:245-174*Math.sin(a),x2:230+183*Math.cos(a),y2:245-183*Math.sin(a),stroke:'#afc3b9'},$('pivotRuler'));
      if(angle%30===0)svg('text',{x:230+204*Math.cos(a),y:249-204*Math.sin(a),'text-anchor':'middle',fill:'#8ba195','font-size':10},$('pivotRuler')).textContent=`${angle}°`;
    }
    for(const a of [-limit,limit])svg('line',{x1:230+163*Math.cos(a),y1:245-163*Math.sin(a),x2:230+194*Math.cos(a),y2:245-194*Math.sin(a),stroke:'#be956f','stroke-width':3,'stroke-linecap':'round'},$('pivotRuler'));
    return;
  }
  const h = plant.parameters.height;
  $('ruler').replaceChildren();
  for(let i = 0; i <= 10; i++) {
    const y = toY(h*i/10);
    svg('line', { x1: i % 2 === 0 ? 228 : 235, x2: 244, y1:y, y2:y, stroke:'#b8ccca' }, $('ruler'));
    if (i % 2 === 0) svg('text',{x:215,y:y+4,'text-anchor':'end',fill:'#88a6a3','font-size':10,'font-family':'monospace'},$('ruler')).textContent = +(h*i*10).toFixed(1);
  }
  svg('text',{x:228,y:58,fill:'#92a28f','font-size':9,'text-anchor':'end'},$('ruler')).textContent='cm';
  $('reference').min = h*5;
  $('reference').max = h*95;
  $('reference').step = .1;
  reference = clamp(reference,h*.05,h*.95);
  $('reference').value = reference*100;
  $('referenceMin').textContent = `${+(h*5).toFixed(1)} cm`;
  $('referenceMax').textContent = `${+(h*95).toFixed(1)} cm`;
  $('plantSummary').textContent = `Modelo didáctico · esfera de ${+(plant.parameters.mass*1000).toFixed(1)} g · recorrido de ${h} m`;
  $('chart').setAttribute('aria-label',`Gráfico temporal de altura y referencia entre 0 y ${h*100} centímetros`);
}
updateScale();
const particles = Array.from({length:28}, (_, i) => ({
  distance: (i * 47) % (isPivot?110:350),
  node: svg('line',{x1:isPivot?470+(i%5)*9:289+(i%5)*20,x2:isPivot?470+(i%5)*9:289+(i%5)*20,stroke:'#3b9ba3','stroke-width':1.2,'stroke-linecap':'round'},$(isPivot?'rotorFlow':'flow'))
}));
const blades = isPivot?[]:Array.from({length:4}, () => svg('path',{'stroke-width':.7,'stroke-linejoin':'round'},$('fanBlades')));
function advanceAirAnimation(step) {
  if(isPivot){
    const speed=Math.sqrt(plant.air/plant.parameters.maxThrust);
    for(const particle of particles)particle.distance=(particle.distance+speed*200*step)%110;
    fanAngle=(fanAngle+speed*1250*step)%360;return;
  }
  // Integrate displacement: changing fan speed must not jump particle positions.
  // Display speed is scaled down for legibility, with the plant's height attenuation.
  for (const particle of particles) {
    const height = clamp(particle.distance / 350, 0, 1) * plant.parameters.height;
    const localAir = plant.air * Math.exp(-plant.parameters.decay * height);
    particle.distance = (particle.distance + localAir * 28 / plant.parameters.height * step) % 350;
  }
  fanAngle = (fanAngle + plant.air * 90 * step) % 360;
}
function toast(message) { $('eventToast').textContent = message; $('eventToast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('eventToast').classList.remove('visible'),2200); }
function openDialog(id) {
  $(id).showModal();
}
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const bounds=dialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
});
$('navGuide').onclick=()=>openDialog('guideDialog');
$('navModel').onclick=()=>openDialog('modelDialog');
let zoom=1;
const apparatus=$('apparatus');
const viewWidth=()=>!isPivot&&apparatus.clientWidth<480?440:660;
function updateView(){
  const width=viewWidth();
  apparatus.setAttribute('viewBox',`${330-width/2/zoom} ${255-255/zoom} ${width/zoom} ${510/zoom}`);
  $('zoomValue').textContent=`${Math.round(zoom*100)} %`;
  $('zoomOut').disabled=zoom<=.75;$('zoomIn').disabled=zoom>=3;
}
$('zoomIn').onclick=()=>{zoom=clamp(zoom+.25,.75,3);updateView();};
$('zoomOut').onclick=()=>{zoom=clamp(zoom-.25,.75,3);updateView();};
$('zoomReset').onclick=()=>{zoom=1;updateView();};
updateView();
window.addEventListener('resize',updateView);
initWorkspace({document,window,onLayout:updateView});
function syncInputUI() {
  const connected=inputSource.connected;
  $('localInputs').disabled=connected;
  $('configurationInputs').disabled=connected;
  $('pause').disabled=$('reset').disabled=connected;
  $('controlBadge').textContent=connected?'EXTERNO':'MANUAL';
  $('connectionStatus').classList.toggle('external',connected);
  $('connectionLabel').textContent=connected?'Entrada externa activa':'Control local';
  $('sourceTitle').textContent=connected?'Mando externo activo':'Sin comunicación externa';
  $('sourceDescription').textContent=connected?'Los controles locales y la configuración están bloqueados mientras se reciben mandos.':'El puente de Simulink está pendiente. Al recibir mandos externos, el control local se bloqueará.';
  $('modeHelp').textContent=connected?'La planta está recibiendo el mando de una fuente externa.':isPivot?'Aplica mando al motor. El ángulo resulta del empuje, el peso y la inercia.':'Aplica potencia al ventilador. La altura es el resultado de la física.';
  $('power').value=(connected?inputSource.external:inputSource.manual)*100;
}
// Adapter contract for a future transport. No connection is inferred from a button.
window.estabiliza = Object.freeze({
  receiveExternalCommand(value) {
    if(document.hidden)return false;
    const key=isPivot?'motor':'fan';
    if(Array.isArray(value))value=value.length===1?value[0]:NaN;
    else if(value&&typeof value==='object')value=Object.keys(value).length===1&&Object.hasOwn(value,key)?value[key]:NaN;
    const wasConnected=inputSource.connected;
    if(!inputSource.receive(value,performance.now()))return false;
    if(!wasConnected){paused=false;accumulator=0;updatePause();}
    syncInputUI();return true;
  },
  disconnect() { inputSource.disconnect();command=0;syncInputUI(); },
  readMeasurement() {return {system:isPivot?'pivot':'ball',time:plant.time,...(isPivot?{angle:plant.y,angularVelocity:plant.v,thrust:plant.air}:{height:plant.y,velocity:plant.v,air:plant.air}),command,commands:[command],reference,paused,halted:false,connected:inputSource.connected,parameters:{...plant.parameters},units:isPivot?{angle:'rad',angularVelocity:'rad/s',thrust:'N'}:{height:'m',velocity:'m/s',air:'m/s'}};},
  readSchema(){return {version:2,system:isPivot?'pivot':'ball',inputs:[{key:isPivot?'motor':'fan',label:isPivot?'Motor':'Ventilador',min:0,max:1,unit:'normalized'}],measurements:isPivot?{angle:'rad',angularVelocity:'rad/s',thrust:'N'}:{height:'m',velocity:'m/s',air:'m/s'},reference:{key:isPivot?'angle':'height',unit:isPivot?'rad':'m'},timeoutMs:500};}
});
$('reference').oninput=e=>{if(!inputSource.connected){reference=Number(e.target.value)/displayFactor;render();}};
$('power').oninput=e=>{inputSource.setManual(Number(e.target.value)/100);};
for(const button of document.querySelectorAll('[data-power]'))button.onclick=()=>{
  if(inputSource.setManual(Number(button.dataset.power)/100))$('power').value=button.dataset.power;
};
$('pause').onclick=()=>{if(inputSource.connected)return;paused=!paused; accumulator=0;updatePause();};
function updatePause() { $('pause').innerHTML=paused?'▶ <span>Continuar</span>':'Ⅱ <span>Pausar</span>'; $('runLabel').textContent=paused?'Simulación en pausa':'Simulación activa';$('runningDot').style.background=paused?'#a57c33':'#00979d';for(const id of ['pushUp','pushDown','airLoss']) $(id).disabled=paused; }
function resetExperiment() {plant.reset();inputSource.disconnect();syncInputUI();samples=[];nextSample=0;accumulator=0;command=0;acceleration=0;fanAngle=0;particles.forEach((p,i)=>{p.distance=(i*47)%(isPivot?110:350);});render();}
$('reset').onclick=()=>{if(inputSource.connected)return;resetExperiment();toast('Planta reiniciada · mando en 0 %');};
for(const field of parameterFields) {
  const label=document.createElement('label');
  label.textContent=`${field.label} (${field.unit})`;
  const input=document.createElement('input');
  Object.assign(input,{id:`config-${field.key}`,name:field.key,type:'number',min:field.min,max:field.max,step:field.step,required:true,value:parameters[field.key]/field.scale});
  label.append(input);$('parameterFields').append(label);
}
$('parameterForm').onsubmit=e=>{
  e.preventDefault();
  if(inputSource.connected){$('configStatus').textContent='Desconecta el mando externo antes de modificar la planta.';return;}
  const next={};for(const field of parameterFields)next[field.key]=Number($(`config-${field.key}`).value)*field.scale;
  try {plant.configure(next);updateScale();resetExperiment();$('configStatus').textContent='Configuración aplicada. Se reiniciaron la planta y el registro de datos.';}
  catch(error){$('configStatus').textContent=error.message;}
};
$('defaultParameters').onclick=()=>{
  if(inputSource.connected)return;
  for(const field of parameterFields)$(`config-${field.key}`).value=parameters[field.key]/field.scale;
  $('configStatus').textContent='Valores originales cargados. Pulsa Aplicar para iniciar el ensayo con ellos.';
};
$('pushUp').onclick=()=>{plant.impulse(1);toast(isPivot?'Impulso antihorario · +0,8 rad/s':'Impulso hacia arriba · +0,75 m/s');};
$('pushDown').onclick=()=>{plant.impulse(-1);toast(isPivot?'Impulso horario · −0,8 rad/s':'Impulso hacia abajo · −0,75 m/s');};
$('airLoss').onclick=()=>{plant.loseAir();toast(isPivot?'Empuje objetivo reducido un 45 % durante 1 s':'Flujo reducido un 45 % durante 1 s');};
$('export').onclick=()=>{
  if(!samples.length) {toast('Inicia la simulación para registrar datos');return;}
  const p=plant.parameters;
  const header=isPivot?'tiempo_s,angulo_rad,marcador_rad,velocidad_rad_s,mando_normalizado,masa_brazo_kg,masa_motor_kg,longitud_m,empuje_max_N,friccion_Nm_s_rad,tau_s,limite_rad,fuente':'tiempo_s,altura_m,marcador_m,velocidad_m_s,mando_normalizado,masa_kg,recorrido_m,aire_max_m_s,tau_s,k_kg_m,lambda_inversa_m,fuente';
  const config=isPivot?[p.armMass,p.motorMass,p.length,p.maxThrust,p.damping,p.motorTau,p.angleLimit]:[p.mass,p.height,p.fanSpeed,p.fanTau,p.drag,p.decay];
  const extraHeader=isPivot?'aceleracion_rad_s2,empuje_N,momento_motor_Nm,momento_peso_Nm,momento_friccion_Nm,momento_resultante_Nm':'aceleracion_m_s2,aire_base_m_s,fuerza_aire_N,peso_N,friccion_adicional_N,fuerza_resultante_N';
  const content=header+','+extraHeader+'\n'+samples.map(s=>[...[s.t,s.y,s.r,s.v,s.u,...config].map(n=>n.toFixed(5)),s.source,...[s.a,s.air,s.f,s.g,s.b,s.n].map(n=>n.toFixed(6))].join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=isPivot?'motor-pivote.csv':'bola-levitadora.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function render() {
  if(isPivot)renderPivot();else{
  $('ball').setAttribute('transform',`translate(330 ${toY(plant.y)})`);
  $('referenceLine').setAttribute('transform',`translate(0 ${toY(reference)})`);
  $('heightMarker').setAttribute('transform',`translate(0 ${toY(plant.y)})`);
  // Offset the measurement when it would overlap the reference label.
  $('heightText').setAttribute('y',Math.abs(plant.y-reference)/plant.parameters.height<.085?27:5);
  $('referenceText').textContent=`H ${+(reference*100).toFixed(1)} cm`;
  $('heightText').textContent=`${(plant.y*100).toFixed(1)} cm`;
  renderBallIndicators();
  }
  $('referenceValue').innerHTML=`${+(reference*displayFactor).toFixed(1)} <small>${positionUnit}</small>`;
  const equilibrium=plant.equilibrium(reference);
  $('equilibriumValue').textContent=`${(equilibrium*100).toFixed(1)} %`;
  $('reachability').textContent=equilibrium>1?'Este marcador requiere más del 100 % de mando. Revisa la masa o la capacidad del actuador.':'El equilibrio está dentro del rango del actuador. El cálculo es informativo y no garantiza estabilidad.';
  $('reachability').classList.toggle('unreachable',equilibrium>1);
  for(const button of document.querySelectorAll('[data-power]'))button.setAttribute('aria-pressed',String(Math.abs(Number(button.dataset.power)-command*100)<.05));
  $('powerValue').innerHTML=`${(command*100).toFixed(0)} <small>%</small>`;
  $('time').textContent=`t = ${plant.time.toFixed(2)} s`;
  $('airValue').textContent=`${plant.air.toFixed(2)} ${isPivot?'N':'m/s'}`;
  $('metricHeight').innerHTML=`${(plant.y*displayFactor).toFixed(1)} <small>${positionUnit}</small>`;
  $('metricError').innerHTML=`${((reference-plant.y)*displayFactor).toFixed(1)} <small>${positionUnit}</small>`;
  $('metricVelocity').innerHTML=`${plant.v.toFixed(2)} <small>${velocityUnit}</small>`;
  $('metricPower').innerHTML=`${(command*100).toFixed(1)} <small>%</small>`;
  // Orthographic side view: blades turn around the vertical shaft, not in the screen plane.
  const projected = blades.map((node,i)=>({node,angle:fanAngle*Math.PI/180+i*Math.PI/2}));
  projected.sort((a,b)=>Math.sin(a.angle)-Math.sin(b.angle));
  for(const {node,angle} of projected) {
    const projection=Math.cos(angle), depth=Math.sin(angle);
    const root=330+projection*5, tip=330+projection*43;
    const pitch=depth*2;
    node.setAttribute('d',`M ${root} 442 L ${tip} ${440+pitch} Q ${tip+projection*3} ${443+pitch} ${tip} ${445+pitch} L ${root} 446 Z`);
    node.setAttribute('fill',depth<0?'#90c4c3':'#3b9398');
    node.setAttribute('stroke',depth<0?'#78b0b1':'#2b6e76');
    $('fanBlades').append(node);
  }
  if(!isPivot)particles.forEach(({node,distance})=>{
    const y=414-distance;
    const speed=plant.air*Math.exp(-plant.parameters.decay*distance/350*plant.parameters.height);
    node.setAttribute('y1',y);node.setAttribute('y2',y-(3+speed*.9));
    const edgeFade=Math.min(1,distance/18,(350-distance)/18);
    node.style.opacity=clamp(plant.air/12,0,.6)*edgeFade;
  });
  scopes.draw(samples,plant.time);
}
function renderBallIndicators(){
  const weight=plant.parameters.mass*plant.parameters.gravity,force=plant.lastForce;
  $('sceneHeight').innerHTML=`${(plant.y*100).toFixed(1)} <small>cm</small>`;
  $('sceneVelocity').innerHTML=`${plant.v.toFixed(2)} <small>m/s</small>`;
  $('sceneAcceleration').innerHTML=`${acceleration.toFixed(2)} <small>m/s²</small>`;
  $('sceneLift').innerHTML=`${(force*1000).toFixed(2)} <small>mN</small>`;
  $('sceneWeight').innerHTML=`${(weight*1000).toFixed(2)} <small>mN</small>`;
  const resting=Math.abs(plant.v)<.015;
  const motion=resting?'Casi en reposo':plant.v>0?'Ascendiendo':'Descendiendo';
  const lower=plant.y<.0001,upper=plant.y>plant.parameters.height-.0001;
  $('motionState').textContent=motion;
  $('sceneState').textContent=lower?'Tope inferior':upper?'Tope superior':motion;
  $('sceneBalance').textContent=lower?'Contacto con la base':upper?'Contacto con el techo':`F neta: ${((force-weight)*1000).toFixed(1)} mN`;
  $('sceneCommand').textContent=`${(command*100).toFixed(1)} %`;
  $('sceneError').textContent=`${((reference-plant.y)*100).toFixed(1)} cm`;
  $('motorLed').setAttribute('fill',plant.air>.1?'#88b8b4':'#c4cecd');
  const y=toY(plant.y),tip=clamp(y-Math.sign(force)*clamp(Math.abs(force)/weight*38,0,70),65,413);
  $('liftVector').setAttribute('d',`M 302 ${y} V ${tip}`);
  $('liftVector').style.opacity=Math.abs(force)>.00001?1:0;
  $('gravityVector').setAttribute('d',`M 357 ${y} V ${Math.min(413,y+38)}`);
  $('liftLabel').setAttribute('x',288);$('liftLabel').setAttribute('y',Math.max(64,tip-7));$('liftLabel').textContent=Math.abs(force)>.00001?(force>=0?'F↑':'F↓'):'';
  $('weightLabel').setAttribute('x',354);$('weightLabel').setAttribute('y',Math.min(415,y+52));$('weightLabel').textContent='mg';
}
function renderPivot(){
  const angle=plant.y*180/Math.PI;
  $('pivotArm').setAttribute('transform',`rotate(${-angle} 230 245)`);
  $('pivotReference').setAttribute('transform',`rotate(${-reference*180/Math.PI} 230 245)`);
  $('angleReadout').textContent=`${angle.toFixed(1)}°`;
  const radians=fanAngle*Math.PI/180;
  $('rotorBlade').setAttribute('transform',`translate(490 224) scale(${Math.cos(radians)} 1)`);
  $('rotorBladeBack').setAttribute('transform',`translate(490 224) scale(${Math.sin(radians)} 1)`);
  $('thrustArrow').style.opacity=.2+.8*plant.air/plant.parameters.maxThrust;
  particles.forEach(({node,distance})=>{node.setAttribute('y1',253+distance);node.setAttribute('y2',259+distance);node.style.opacity=Math.sqrt(plant.air/plant.parameters.maxThrust)*.4*Math.min(1,distance/12,(110-distance)/20);});
}
const scopes=createScopes({pivot:isPivot,getBounds:bounds});
function sampleState(){
  const p=plant.parameters;
  const f=isPivot?plant.air*p.length:plant.lastForce;
  const g=isPivot?-p.gravity*p.length*(p.armMass/2+p.motorMass)*Math.cos(plant.y):-p.mass*p.gravity;
  const b=isPivot?-p.damping*plant.v:0;
  return {t:plant.time,y:plant.y,r:reference,v:plant.v,u:command,a:acceleration,air:plant.air,f,g,b,n:f+g+b,source:inputSource.connected?'externa':'manual'};
}
function frame(now) {
  const elapsed=Math.min((now-last)/1000,.1);last=now;
  const wasConnected=inputSource.connected;
  const requested=inputSource.tick(now);
  if(wasConnected!==inputSource.connected){syncInputUI();toast('Comunicación interrumpida · mando en 0 %');}
  if(!paused&&!document.hidden) {
    accumulator+=elapsed;
    while(accumulator>=dt) {
      command=requested;
      const previousVelocity=plant.v;
      plant.step(command,dt);acceleration=(plant.v-previousVelocity)/dt;advanceAirAnimation(dt);accumulator-=dt;
      if(plant.time>=nextSample){samples.push(sampleState());nextSample+=.05;if(samples.length>12000)samples.shift();}
    }
  }
  render();requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;if(document.hidden&&inputSource.connected){inputSource.disconnect();command=0;syncInputUI();}});
syncInputUI();render();requestAnimationFrame(frame);
