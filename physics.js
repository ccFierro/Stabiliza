export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const parameters = Object.freeze({ mass: 0.003, gravity: 9.81, height: 1, fanSpeed: 12, drag: 0.001, decay: 0.55, fanTau: 0.18 });
// Each experiment can provide its own schema; UI units convert to SI through scale.
export const parameterFields = [
  { key: 'height', label: 'Altura útil del tubo', unit: 'm', min: .3, max: 2, step: .1, scale: 1 },
  { key: 'mass', label: 'Masa de la bola', unit: 'g', min: 1, max: 10, step: .1, scale: .001 },
  { key: 'fanSpeed', label: 'Velocidad máxima del aire', unit: 'm/s', min: 6, max: 20, step: .5, scale: 1 },
  { key: 'fanTau', label: 'Tiempo de respuesta del ventilador τ', unit: 's', min: .05, max: 1, step: .01, scale: 1 },
  { key: 'drag', label: 'Coeficiente aerodinámico k', unit: 'kg/m', min: .0005, max: .003, step: .0001, scale: 1 },
  { key: 'decay', label: 'Atenuación del aire λ', unit: '1/m', min: 0, max: 1, step: .05, scale: 1 }
];

// SI units. Positive velocity and force point upwards. Height is ball-center travel.
export class Plant {
  constructor(config = {}) { this.configure(config); }
  configure(config) {
    const next = { ...parameters, ...config };
    for (const field of parameterFields) {
      const value = next[field.key] / field.scale;
      if (!Number.isFinite(value) || value < field.min - 1e-10 || value > field.max + 1e-10) throw new RangeError(`Valor fuera de rango: ${field.label}`);
    }
    next.gravity = parameters.gravity;
    this.parameters = Object.freeze(next);
    this.reset();
  }
  reset() { this.y = 0; this.v = 0; this.air = 0; this.time = 0; this.lossUntil = 0; this.lastForce = 0; }
  equilibrium(y) {
    const p = this.parameters;
    return Math.sqrt(p.mass * p.gravity / p.drag) / (p.fanSpeed * Math.exp(-p.decay * y));
  }
  step(command, dt) {
    if (!Number.isFinite(command) || !Number.isFinite(dt) || dt <= 0 || dt > 0.02) throw new RangeError('Entrada o paso de integración inválido');
    const p = this.parameters;
    const loss = this.time < this.lossUntil ? 0.55 : 1;
    const targetAir = p.fanSpeed * clamp(command, 0, 1) * loss;
    this.air += (targetAir - this.air) * (1 - Math.exp(-dt / p.fanTau));
    const relative = this.air * Math.exp(-p.decay * this.y) - this.v;
    this.lastForce = p.drag * relative * Math.abs(relative);
    this.v += (this.lastForce / p.mass - p.gravity) * dt;
    this.y += this.v * dt;
    if (this.y <= 0) { this.y = 0; this.v = Math.max(0, this.v); }
    if (this.y >= p.height) { this.y = p.height; this.v = Math.min(0, this.v); }
    this.time += dt;
  }
  impulse(direction) { this.v += direction * 0.75; }
  loseAir() { this.lossUntil = this.time + 1; }
}

export const pivotParameters = Object.freeze({ armMass: .08, motorMass: .05, length: .3, maxThrust: 2, damping: .012, motorTau: .12, angleLimit: 70*Math.PI/180, gravity:9.81 });
export const pivotFields = [
  {key:'length',label:'Longitud del brazo',unit:'m',min:.15,max:.6,step:.01,scale:1},
  {key:'armMass',label:'Masa del brazo',unit:'g',min:30,max:250,step:1,scale:.001},
  {key:'motorMass',label:'Masa del motor',unit:'g',min:20,max:150,step:1,scale:.001},
  {key:'maxThrust',label:'Empuje máximo',unit:'N',min:.5,max:5,step:.1,scale:1},
  {key:'damping',label:'Fricción viscosa del pivote',unit:'N·m·s/rad',min:.002,max:.05,step:.001,scale:1},
  {key:'motorTau',label:'Respuesta del motor τ',unit:'s',min:.05,max:.5,step:.01,scale:1},
  {key:'angleLimit',label:'Límite angular ±',unit:'°',min:30,max:80,step:1,scale:Math.PI/180}
];

// y is angle [rad], v angular velocity [rad/s], air is thrust [N].
// Uniform rod pivoted at its left end, point motor at its right end.
export class PivotPlant {
  constructor(config={}) { this.configure(config); }
  configure(config) {
    const next={...pivotParameters,...config};
    for(const field of pivotFields){
      const value=next[field.key]/field.scale;
      if(!Number.isFinite(value)||value<field.min-1e-10||value>field.max+1e-10)throw new RangeError(`Valor fuera de rango: ${field.label}`);
    }
    next.gravity=pivotParameters.gravity;this.parameters=Object.freeze(next);this.reset();
  }
  get inertia(){const p=this.parameters;return (p.armMass/3+p.motorMass)*p.length**2;}
  reset(){this.y=-this.parameters.angleLimit;this.v=0;this.air=0;this.time=0;this.lossUntil=0;}
  equilibrium(angle){const p=this.parameters;return Math.sqrt(p.gravity*(p.armMass/2+p.motorMass)*Math.cos(angle)/p.maxThrust);}
  step(command,dt){
    if(!Number.isFinite(command)||!Number.isFinite(dt)||dt<=0||dt>.02)throw new RangeError('Entrada o paso de integración inválido');
    const p=this.parameters;
    const target=p.maxThrust*clamp(command,0,1)**2*(this.time<this.lossUntil?.55:1);
    this.air+=(target-this.air)*(1-Math.exp(-dt/p.motorTau));
    const torque=this.air*p.length-p.gravity*(p.armMass/2+p.motorMass)*p.length*Math.cos(this.y)-p.damping*this.v;
    this.v+=torque/this.inertia*dt;this.y+=this.v*dt;
    if(this.y<=-p.angleLimit){this.y=-p.angleLimit;this.v=Math.max(0,this.v);}
    if(this.y>=p.angleLimit){this.y=p.angleLimit;this.v=Math.min(0,this.v);}
    this.time+=dt;
  }
  impulse(direction){this.v+=direction*.8;}
  loseAir(){this.lossUntil=this.time+1;}
}

