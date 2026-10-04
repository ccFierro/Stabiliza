import {clamp} from './physics.js';
const G=9.81,rad=Math.PI/180;
const field=(key,label,unit,min,max,step,scale=1)=>({key,label,unit,min,max,step,scale});
const input=(key,label,min=0)=>({key,label,min,max:1});
const signal=(key,name,unit,group=key,scale=1,offset=0)=>({key,name,unit,group,value:s=>s[key]*scale+offset});
const rk4=(s,h,f)=>{
  const a=f(s),b=f(s.map((v,i)=>v+h*a[i]/2)),c=f(s.map((v,i)=>v+h*b[i]/2)),d=f(s.map((v,i)=>v+h*c[i]));
  return s.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
};
const lag=(value,target,h,tau)=>value+(target-value)*(-Math.expm1(-h/tau));
function stop(s,pos,vel,low,high){if(s[pos]<=low){s[pos]=low;s[vel]=Math.max(0,s[vel]);}if(s[pos]>=high){s[pos]=high;s[vel]=Math.min(0,s[vel]);}}
class BasePlant{
  constructor(id,config={}){this.spec=plantSpecs[id];this.configure(config);}
  configure(config={}){
    for(const key of Object.keys(config))if(!Object.hasOwn(this.spec.defaults,key))throw new RangeError(`Parámetro desconocido: ${key}`);
    const next={...this.spec.defaults,...config};
    for(const f of this.spec.fields){const v=next[f.key]/f.scale;if(!Number.isFinite(v)||v<f.min-1e-9||v>f.max+1e-9)throw new RangeError(`Valor fuera de rango: ${f.label}`);}
    this.parameters=Object.freeze(next);this.reset();
  }
  reset(){this.time=0;this.eventUntil=0;this.halted=false;this.reason='';this.commands=this.spec.inputs.map(()=>0);this.initialize();}
  step(commands,dt){
    if(!Array.isArray(commands)||commands.length!==this.spec.inputs.length||commands.some(v=>!Number.isFinite(v))||!Number.isFinite(dt)||dt<=0||dt>.02)throw new RangeError('Mando o paso inválido');
    if(this.halted)return;
    this.commands=commands.map((v,i)=>clamp(v,this.spec.inputs[i].min,1));
    const steps=Math.ceil(dt/.001),h=dt/steps;
    for(let i=0;i<steps&&!this.halted;i++){this.advance(this.commands,h);this.time+=h;}
  }
  get status(){return this.halted?this.reason:'Ensayo en curso';}
}

export class CartPendulum extends BasePlant{
  constructor(config){super('pendulum',config);}
  initialize(){this.s=[0,0,this.parameters.initialAngle,0];this.force=0;}
  advance([u],h){
    const p=this.parameters,l=p.length/2,J=p.mass*p.length**2/3;
    this.force=lag(this.force,p.maxForce*u,h,p.tau);
    const F=this.force+(this.time<this.eventUntil?2:0);
    this.s=rk4(this.s,h,([x,v,t,w])=>{
      const a=p.cartMass+p.mass,b=p.mass*l*Math.cos(t),det=a*J-b*b;
      const q=F-p.friction*v+p.mass*l*Math.sin(t)*w*w,r=p.mass*G*l*Math.sin(t)-p.damping*w;
      return [v,(J*q-b*r)/det,w,(a*r-b*q)/det];
    });
    const v=this.s[1];stop(this.s,0,1,-p.rail/2,p.rail/2);
    // A rail-stop impulse changes angular velocity through the mass matrix.
    if(v!==this.s[1])this.s[3]-=p.mass*l*Math.cos(this.s[2])*(this.s[1]-v)/J;
    this.s[2]=Math.atan2(Math.sin(this.s[2]),Math.cos(this.s[2]));
  }
  perturb(kind){if(kind==='event')this.eventUntil=this.time+1;else this.s[3]+=(kind==='plus'?1:-1)*.35;}
  measure(){return {x:this.s[0],v:this.s[1],theta:this.s[2],omega:this.s[3],force:this.force};}
  get status(){return Math.abs(this.s[0])>=this.parameters.rail/2-1e-6?'Tope del riel':Math.abs(this.s[2])<.2?'Cerca de la vertical':'Fuera de la vertical';}
}

export class MagneticLevitation extends BasePlant{
  constructor(config){super('maglev',config);}
  initialize(){const p=this.parameters;this.s=[p.initialGap,0];this.current=p.initialCurrent;this.force=p.k*this.current**2/p.initialGap**2;}
  advance([u],h){
    const p=this.parameters,voltage=p.voltage*u*(this.time<this.eventUntil?.6:1);
    this.current=lag(this.current,voltage/p.resistance,h,p.inductance/p.resistance);
    this.s=rk4(this.s,h,([gap,v])=>[v,G-p.k*this.current**2/(Math.max(.005,gap)**2*p.mass)-p.damping*v/p.mass]);
    stop(this.s,0,1,.005,p.travel);
    this.force=p.k*this.current**2/this.s[0]**2;
  }
  perturb(kind){if(kind==='event')this.eventUntil=this.time+1;else this.s[1]+=(kind==='plus'?1:-1)*.1;}
  measure(){return {gap:this.s[0],v:this.s[1],current:this.current,force:this.force,weight:this.parameters.mass*G,voltage:this.parameters.voltage*this.commands[0]*(this.time<this.eventUntil?.6:1)};}
  get status(){return this.s[0]<=.005?'Contacto con el electroimán':this.s[0]>=this.parameters.travel?'Tope inferior':'Esfera en movimiento';}
}

export class BallBeam extends BasePlant{
  constructor(config){super('beam',config);}
  initialize(){this.s=[this.parameters.initialPosition,0,0,0];this.torque=0;}
  advance([u],h){
    const p=this.parameters,J=p.beamMass*p.length**2/12;
    this.torque=lag(this.torque,p.maxTorque*u*(this.time<this.eventUntil?.5:1),h,p.tau);
    this.s=rk4(this.s,h,([x,v,t,w])=>[v,(x*w*w-G*Math.sin(t)-p.rolling*v/p.mass)/1.4,w,(this.torque-p.damping*w-2*p.mass*x*v*w-p.mass*G*x*Math.cos(t))/(J+p.mass*x*x)]);
    stop(this.s,0,1,-p.length*.45,p.length*.45);stop(this.s,2,3,-p.limit,p.limit);
  }
  perturb(kind){if(kind==='event')this.eventUntil=this.time+1;else this.s[1]+=(kind==='plus'?1:-1)*.2;}
  measure(){return {x:this.s[0],v:this.s[1],theta:this.s[2],omega:this.s[3],torque:this.torque};}
  get status(){return Math.abs(this.s[0])>=this.parameters.length*.45-1e-6?'Bola en el tope':Math.abs(this.s[2])>=this.parameters.limit-1e-6?'Límite de inclinación':'Rodadura sobre la viga';}
}

export class TwinRotor extends BasePlant{
  constructor(config){super('twin',config);}
  initialize(){this.s=[this.parameters.initialAngle,0];this.left=0;this.right=0;}
  advance([a,b],h){
    const p=this.parameters,r=p.length/2,m=p.beamMass+2*p.motorMass,J=p.beamMass*p.length**2/12+2*p.motorMass*r*r+m*p.offset**2;
    this.left=lag(this.left,p.maxThrust*a*a*(this.time<this.eventUntil?.5:1),h,p.tau);
    this.right=lag(this.right,p.maxThrust*b*b,h,p.tau);
    this.s=rk4(this.s,h,([t,w])=>[w,(r*(this.right-this.left)+m*G*p.offset*Math.sin(t)-p.damping*w)/J]);
    stop(this.s,0,1,-p.limit,p.limit);
  }
  perturb(kind){if(kind==='event')this.eventUntil=this.time+1;else this.s[1]+=(kind==='plus'?1:-1)*.35;}
  measure(){return {theta:this.s[0],omega:this.s[1],left:this.left,right:this.right,torque:(this.right-this.left)*this.parameters.length/2};}
  get status(){return Math.abs(this.s[0])>=this.parameters.limit-1e-6?'Tope angular':'Pivote central libre';}
}

export class CoupledTanks extends BasePlant{
  constructor(config){super('tanks',config);}
  initialize(){const p=this.parameters;this.h1=p.height*p.initial1;this.h2=p.height*p.initial2;this.pump=0;this.q12=0;this.outlet=0;this.overflow=0;this.rate1=0;this.rate2=0;}
  advance([u],h){
    const p=this.parameters;this.pump=lag(this.pump,u*p.maxFlow,h,p.tau);
    const old1=this.h1,old2=this.h2;
    let v1=p.area1*this.h1+this.pump*h,v2=p.area2*this.h2;
    let q=p.coupling*Math.sign(this.h1-this.h2)*Math.sqrt(2*G*Math.abs(this.h1-this.h2));
    q=clamp(q,-v2/h,v1/h);v1-=q*h;v2+=q*h;
    const out=Math.min(v2/h,p.drain*Math.sqrt(2*G*this.h2)*(this.time<this.eventUntil?2:1));v2-=out*h;
    this.overflow=(Math.max(0,v1-p.area1*p.height)+Math.max(0,v2-p.area2*p.height))/h;
    this.h1=clamp(v1/p.area1,0,p.height);this.h2=clamp(v2/p.area2,0,p.height);
    this.q12=q;this.outlet=out;this.rate1=(this.h1-old1)/h;this.rate2=(this.h2-old2)/h;
  }
  perturb(kind){if(kind==='event')this.eventUntil=this.time+5;else this.h2=clamp(this.h2+(kind==='plus'?.05:-.05),0,this.parameters.height);}
  measure(){return {h1:this.h1,h2:this.h2,pump:this.pump,transfer:this.q12,outlet:this.outlet,overflow:this.overflow,volume:this.h1*this.parameters.area1+this.h2*this.parameters.area2};}
  get status(){return this.overflow>1e-9?'Rebose por capacidad máxima':this.h2<.001?'Estanque 2 vacío':'Flujo entre estanques';}
}

// Lumped saturated water/steam model, initially hot, 100–180 °C.
// Antoine pressure (mmHg -> Pa), constant liquid density and approximate energies.
export const saturationPressure=T=>133.322368*10**(8.14019-1810.94/(244.485+T));
export function boilerState(T,m,V){
  const pressure=saturationPressure(T),rhoV=pressure/(461.5*(T+273.15));
  const liquid=(m-rhoV*V)/(1-rhoV/1000),vapor=m-liquid;
  return {pressure,liquid,vapor,energy:liquid*4180*T+vapor*(2506000+1500*(T-100))};
}
export class Boiler extends BasePlant{
  constructor(config){super('boiler',config);}
  initialize(){
    const p=this.parameters,T=p.initialTemperature,liquid=1000*p.volume*p.initialLevel;
    const rho=saturationPressure(T)/(461.5*(T+273.15));
    this.mass=liquid+rho*p.volume*(1-p.initialLevel);this.temperature=T;
    this.energy=boilerState(T,this.mass,p.volume).energy;this.heat=0;this.feed=0;this.steam=0;this.heatLoss=0;this.refresh();
  }
  refresh(){const s=boilerState(this.temperature,this.mass,this.parameters.volume);this.pressure=s.pressure;this.level=s.liquid/(1000*this.parameters.volume);}
  advance([heat,feed],h){
    const p=this.parameters;
    this.heat=lag(this.heat,heat*p.maxHeat,h,p.tau);this.feed=lag(this.feed,feed*p.maxFeed,h,p.tau);
    const demand=p.demand*(this.time<this.eventUntil?1.8:1);
    this.steam=demand*Math.sqrt(Math.max(0,(this.pressure-101325)/1e5));
    const hv=2506000+1500*(this.temperature-100)+461.5*(this.temperature+273.15);
    this.heatLoss=p.loss*(this.temperature-20);
    this.mass+=(this.feed-this.steam)*h;
    this.energy+=(this.heat-this.heatLoss+this.feed*4180*p.feedTemperature-this.steam*hv)*h;
    const low=boilerState(100,this.mass,p.volume).energy,high=boilerState(180,this.mass,p.volume).energy;
    if(this.energy<low||this.energy>high){this.temperature=this.energy<low?100:180;this.halted=true;this.reason='Fuera del modelo saturado (100–180 °C). Reinicia y ajusta el mando.';}
    else{let lo=100,hi=180;for(let i=0;i<35;i++){const mid=(lo+hi)/2;if(boilerState(mid,this.mass,p.volume).energy<this.energy)lo=mid;else hi=mid;}this.temperature=(lo+hi)/2;}
    this.refresh();
    if(this.level<.05||this.level>.95){this.halted=true;this.reason='Nivel fuera del dominio (5–95 %). Reinicia la planta.';}
  }
  perturb(kind){if(kind==='event')this.eventUntil=this.time+10;else{this.energy+=(kind==='plus'?1:-1)*5000;}}
  measure(){return {pressure:this.pressure,temperature:this.temperature+273.15,level:this.level,heat:this.heat,feed:this.feed,steam:this.steam,mass:this.mass,energy:this.energy,heatLoss:this.heatLoss};}
}

const angular=signal('theta','Ángulo','°','angle',1/rad),angularSpeed=signal('omega','Velocidad angular','rad/s','angularSpeed');
export const plantSpecs={
  pendulum:{title:'Péndulo invertido',subtitle:'Carro lineal · equilibrio inestable',number:'03',Class:CartPendulum,
    defaults:{cartMass:.5,mass:.15,length:.55,maxForce:10,friction:.1,damping:.003,tau:.07,rail:2,initialAngle:5*rad},
    fields:[field('cartMass','Masa del carro','kg',.2,2,.1),field('mass','Masa de la barra','kg',.05,.5,.01),field('length','Longitud de la barra','m',.25,1,.05),field('maxForce','Fuerza máxima','N',2,20,.5),field('friction','Fricción del carro','N·s/m',0,1,.01),field('damping','Fricción del pivote','N·m·s/rad',0,.05,.001),field('tau','Respuesta del motor','s',.03,.5,.01),field('rail','Recorrido total','m',1,4,.1),field('initialAngle','Inclinación inicial','°',-15,15,.5,rad)],
    inputs:[input('cart','Motor del carro',-1)],primary:'theta',unit:'°',factor:1/rad,reference:0,bounds:p=>[-20,20],
    signals:[angular,angularSpeed,signal('x','Posición del carro','m','position'),signal('v','Velocidad del carro','m/s','velocity'),signal('force','Fuerza del motor','N','force')],
    perturbations:['↶ Impulso','↷ Impulso','Fuerza lateral · 1 s'],
    equations:['(M + m)ẍ + mℓ cos(θ)θ̈ = F − bẋ + mℓ sin(θ)θ̇²','(I + mℓ²)θ̈ + mℓ cos(θ)ẍ = mgℓ sin(θ) − cθ̇','ℓ = L/2; I = mL²/12; τḞ = Fmax·u − F'],
    assumptions:'Barra uniforme, ángulo desde la vertical superior, positivo hacia la derecha. Carro limitado por topes con impacto inelástico; la barra puede dar una vuelta completa. Sin colisiones de la barra con el riel. No hay PID ni levantamiento automático.',
    guide:['Inicia desde 5° y observa la caída sin mando.','Estabiliza el ángulo desde Simulink y comprueba también la deriva del carro.','Compara longitudes de barra y aplica un impulso angular.'],source:'https://ctms.engin.umich.edu/CTMS/index.php?example=InvertedPendulum&section=SystemModeling'},
  boiler:{title:'Caldera de vapor',subtitle:'Balance de masa y energía · dos entradas',number:'04',Class:Boiler,
    defaults:{volume:.01,initialLevel:.55,initialTemperature:110,maxHeat:8000,maxFeed:.008,feedTemperature:25,demand:.002,loss:8,tau:1},
    fields:[field('volume','Volumen del depósito','L',5,40,1,.001),field('initialLevel','Nivel inicial','%',20,80,1,.01),field('initialTemperature','Temperatura inicial','°C',105,140,1),field('maxHeat','Potencia máxima','kW',2,15,.5,1000),field('maxFeed','Caudal máximo de agua','g/s',2,20,.5,.001),field('feedTemperature','Temperatura de entrada','°C',10,80,1),field('demand','Coeficiente de consumo','g/(s·√bar)',1,5,.1,.001),field('loss','Pérdidas térmicas','W/K',3,25,1),field('tau','Respuesta de actuadores','s',.2,3,.1)],
    inputs:[input('heat','Potencia del calentador'),input('feed','Bomba de alimentación')],primary:'pressure',unit:'bar abs.',factor:1e-5,reference:2,bounds:()=>[1.1,8],
    signals:[signal('pressure','Presión absoluta','bar','pressure',1e-5),signal('temperature','Temperatura','°C','temperature',1,-273.15),signal('level','Nivel de agua','%','level',100),signal('heat','Potencia térmica','kW','heat',.001),signal('feed','Agua de entrada','g/s','flow',1000),signal('steam','Consumo de vapor','g/s','flow',1000),signal('mass','Masa total','kg'),signal('energy','Energía interna','kJ','energy',.001),signal('heatLoss','Pérdidas','kW','heat',.001)],
    perturbations:['+5 kJ','−5 kJ','Consumo +80 % · 10 s'],
    equations:['ṁ = qagua − qvapor','Ė = Q − UA(T − Tamb) + qagua·hagua − qvapor·hvapor','p = psat(T); ρv = p/[Rv(T + 273,15)]','m = ml + mv; V = ml/ρl + mv/ρv','E = ml·ul(T) + mv·uv(T)'],
    assumptions:'Modelo didáctico concentrado y saturado, inicialmente caliente. Antoine aproxima psat; vapor ideal, ρl=1000 kg/m³ y energías específicas aproximadas. No representa arranque en frío, combustión ni encogimiento/hinchamiento del nivel. Fuera de 100–180 °C o 5–95 % de nivel se detiene explícitamente; no se simula una regulación de protección.',
    guide:['Usa calentamiento y alimentación simultáneamente para sostener presión y nivel.','Aumenta el consumo de vapor y observa ambas variables.','Compara pérdidas térmicas y temperatura de alimentación. El tiempo avanza en segundos reales.'],source:'https://www.mathworks.com/help/control/ug/regulating-pressure-in-a-drum-boiler.html'},
  maglev:{title:'Levitación magnética',subtitle:'Electroimán · dinámica eléctrica y mecánica',number:'05',Class:MagneticLevitation,
    defaults:{mass:.02,initialGap:.025,initialCurrent:2.5,travel:.065,voltage:12,resistance:4,inductance:.2,k:.00002,damping:.01},
    fields:[field('mass','Masa de la esfera','g',10,50,1,.001),field('initialGap','Separación inicial','mm',10,40,1,.001),field('initialCurrent','Corriente inicial','A',0,6,.1),field('travel','Separación máxima','mm',45,100,1,.001),field('voltage','Tensión máxima','V',6,24,.5),field('resistance','Resistencia de bobina','Ω',2,8,.1),field('inductance','Inductancia','H',.05,1,.01),field('k','Coeficiente magnético','N·m²/A²',.000005,.00005,.000001),field('damping','Amortiguamiento','N·s/m',0,.05,.001)],
    inputs:[input('coil','Tensión de la bobina')],primary:'gap',unit:'mm',factor:1000,reference:25,bounds:p=>[5,p.travel*1000],
    signals:[signal('gap','Separación','mm','gap',1000),signal('v','Velocidad hacia abajo','m/s','velocity'),signal('current','Corriente','A'),signal('voltage','Tensión aplicada','V'),signal('force','Atracción magnética','N','force'),signal('weight','Peso','N','force')],
    perturbations:['↓ Impulso','↑ Impulso','Caída de tensión · 1 s'],
    equations:['L·di/dt = Vmax·u − Ri','m·d²z/dt² = mg − k·i²/z² − b·dz/dt','z positivo hacia abajo; 5 mm ≤ z ≤ zmax'],
    assumptions:'Bobina RL con inductancia constante y fuerza empírica k·i²/z². Sin saturación del núcleo, remanencia ni calentamiento. Topes inelásticos. La corriente inicial configurable representa energía almacenada en la bobina; no se mantiene automáticamente. Modelo no calibrado y de equilibrio abierto inestable.',
    guide:['Prepara el mando antes de iniciar. Con parámetros originales, el equilibrio a 25 mm requiere aproximadamente 82,5 % y 2,48 A. La corriente inicial se configura por separado.','Observa que una separación menor aumenta la atracción para la misma corriente.','Aplica un golpe o una caída de tensión y compara la recuperación. Si llega al tope inferior, puede necesitar reiniciar: el actuador tiene capacidad limitada.'],source:'https://www.quanser.com/products/magnetic-levitation/'},
  tanks:{title:'Estanques acoplados',subtitle:'Dos depósitos · regulación de nivel',number:'06',Class:CoupledTanks,
    defaults:{height:.8,area1:.012,area2:.012,initial1:.3,initial2:.2,maxFlow:.0003,coupling:.00008,drain:.00005,tau:.5},
    fields:[field('height','Altura de estanques','m',.4,1.5,.1),field('area1','Sección del estanque 1','cm²',60,400,10,.0001),field('area2','Sección del estanque 2','cm²',60,400,10,.0001),field('initial1','Nivel inicial 1','%',0,90,1,.01),field('initial2','Nivel inicial 2','%',0,90,1,.01),field('maxFlow','Caudal máximo de bomba','L/s',.05,.6,.01,.001),field('coupling','Área efectiva de conexión','mm²',10,200,5,.000001),field('drain','Área efectiva de salida','mm²',10,150,5,.000001),field('tau','Respuesta de la bomba','s',.1,2,.1)],
    inputs:[input('pump','Bomba de entrada')],primary:'h2',unit:'cm',factor:100,reference:40,bounds:p=>[0,p.height*100],
    signals:[signal('h1','Nivel 1','cm','level',100),signal('h2','Nivel 2','cm','level',100),signal('pump','Caudal de bomba','L/s','flow',1000),signal('transfer','Caudal 1 → 2','L/s','flow',1000),signal('outlet','Caudal de salida','L/s','flow',1000),signal('overflow','Rebose total','L/s','flow',1000),signal('volume','Volumen almacenado','L','volume',1000)],
    perturbations:['+5 cm · nivel 2','−5 cm · nivel 2','Abrir descarga · 5 s'],
    equations:['A1·dh1/dt = qbomba − q12 − qrebose1','A2·dh2/dt = q12 − qsalida − qrebose2','q12 = a12·sign(h1 − h2)·√(2g|h1 − h2|)','qsalida = a2·√(2gh2); τ·dqbomba/dt = qmax·u − qbomba'],
    assumptions:'Depósitos abiertos de sección constante, conectados por el fondo. Las áreas efectivas incluyen el coeficiente de descarga. Flujo reversible entre depósitos, disponibilidad de agua y rebose explícitos. Sin dinámica de presión en tuberías.',
    guide:['Regula el nivel del segundo estanque con la bomba del primero.','Abre temporalmente la descarga y observa el retardo entre niveles.','Cambia la sección o el área de conexión para modificar la respuesta.'],source:'https://www.quanser.com/products/coupled-tanks/'},
  beam:{title:'Balancín con bola',subtitle:'Viga motorizada · posición y ángulo acoplados',number:'07',Class:BallBeam,
    defaults:{length:.8,mass:.05,beamMass:.3,maxTorque:.6,damping:.08,rolling:.01,tau:.08,limit:25*rad,initialPosition:.1},
    fields:[field('length','Longitud de la viga','m',.5,1.2,.05),field('mass','Masa de la bola','g',10,200,5,.001),field('beamMass','Masa de la viga','kg',.1,1,.05),field('maxTorque','Torque máximo','N·m',.3,2,.1),field('damping','Fricción del eje','N·m·s/rad',.02,.5,.01),field('rolling','Resistencia a rodadura','N·s/m',0,.05,.001),field('tau','Respuesta del motor','s',.03,.5,.01),field('limit','Inclinación máxima ±','°',10,35,1,rad),field('initialPosition','Posición inicial','m',-.2,.2,.01)],
    inputs:[input('motor','Torque del motor',-1)],primary:'x',unit:'cm',factor:100,reference:0,bounds:p=>[-p.length*45,p.length*45],
    signals:[signal('x','Posición de la bola','cm','position',100),signal('v','Velocidad de la bola','m/s','velocity'),angular,angularSpeed,signal('torque','Torque del motor','N·m')],
    perturbations:['→ Impulso','← Impulso','Pérdida de torque · 1 s'],
    equations:['(7/5)·r̈ = r·α̇² − g·sin(α) − (c/m)·ṙ','(Jviga + mr²)·α̈ = τmotor − bα̇ − 2mrṙα̇ − mgr·cos(α)','Jviga = Mviga·L²/12; τa·dτmotor/dt = τmax·u − τmotor'],
    assumptions:'Esfera maciza en rodadura ideal, sin deslizamiento, radio despreciable en la geometría de la viga. Se conserva la inercia de rodadura 7/5. Viga uniforme con pivote central, topes de posición e inclinación. La entrada es torque, no una consigna de ángulo con PID oculto.',
    guide:['Observa cómo el peso de la bola inclina la viga con mando cero.','Regula primero el ángulo y después la posición mediante un controlador en cascada externo.','Compara masa de la bola y respuesta del motor.'],source:'https://ctms.engin.umich.edu/CTMS/index.php?example=BallBeam&section=SystemModeling'},
  twin:{title:'Balancín de doble hélice',subtitle:'Dos motores · mando diferencial',number:'08',Class:TwinRotor,
    defaults:{length:.8,beamMass:.2,motorMass:.08,maxThrust:3,tau:.15,damping:.04,offset:0,limit:50*rad,initialAngle:5*rad},
    fields:[field('length','Longitud total','m',.4,1.2,.05),field('beamMass','Masa de la barra','kg',.1,.6,.05),field('motorMass','Masa de cada motor','g',30,200,5,.001),field('maxThrust','Empuje máximo por hélice','N',1,6,.1),field('tau','Respuesta de motores','s',.05,.6,.01),field('damping','Fricción del pivote','N·m·s/rad',.005,.2,.005),field('offset','Centro de masa sobre el eje','cm',-10,10,.5,.01),field('limit','Ángulo máximo ±','°',20,70,1,rad),field('initialAngle','Inclinación inicial','°',-15,15,1,rad)],
    inputs:[input('left','Motor izquierdo'),input('right','Motor derecho')],primary:'theta',unit:'°',factor:1/rad,reference:0,bounds:p=>[-p.limit/rad,p.limit/rad],
    signals:[angular,angularSpeed,signal('left','Empuje izquierdo','N','force'),signal('right','Empuje derecho','N','force'),signal('torque','Torque diferencial','N·m')],
    perturbations:['↶ Impulso','↷ Impulso','Motor izq. al 50 % · 1 s'],
    equations:['J·θ̈ = (L/2)(Fd − Fi) + Mg·d·sin(θ) − bθ̇','J = Mbarra·L²/12 + 2·mmotor·(L/2)² + M·d²','τ·dFi/dt = Fmax·ui² − Fi; τ·dFd/dt = Fmax·ud² − Fd'],
    assumptions:'Empujes perpendiculares a la barra, pivote fijo y motores simétricos. d positivo sitúa el centro de masa sobre el pivote (inestable); negativo, debajo (restaurador); con d=0 no hay restauración angular gravitatoria. Sin aerodinámica cruzada entre hélices.',
    guide:['Aplica mandos iguales y observa que no generan torque diferencial.','Controla el ángulo variando el empuje entre los dos motores.','Cambia el centro de masa y compara equilibrio estable, neutro e inestable.'],source:'https://www.quanser.com/products/Aero-2/'}
};

export const createPlant=(id,config)=>{if(!Object.hasOwn(plantSpecs,id))throw new RangeError('Planta desconocida');return new plantSpecs[id].Class(config);};
