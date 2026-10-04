import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlant,plantSpecs,boilerState,saturationPressure} from './plants.js';
import {MultiInputSource} from './input-source.js';
const run=(p,u,seconds)=>{for(let t=0;t<seconds-1e-9;t+=.005)p.step(u,.005);};
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('Péndulo: equilibrio vertical, inestabilidad y acoplamiento carro-barra',()=>{
  const p=createPlant('pendulum',{initialAngle:0});run(p,[0],1);near(p.measure().theta,0);
  p.step([1],.005);assert.ok(p.measure().x>0);assert.ok(p.measure().theta<0);
  const q=createPlant('pendulum');const initial=q.measure().theta;run(q,[0],.3);assert.ok(q.measure().theta>initial);
});
test('Péndulo: energía conservada sin mando ni fricción, antes de los topes',()=>{
  const p=createPlant('pendulum',{friction:0,damping:0}),a=p.parameters,l=a.length/2,J=a.mass*a.length**2/3;
  const energy=()=>{const {v,theta,omega}=p.measure();return .5*(a.cartMass+a.mass)*v*v+a.mass*l*Math.cos(theta)*v*omega+.5*J*omega*omega+a.mass*9.81*l*Math.cos(theta);};
  const initial=energy();run(p,[0],.5);near(energy(),initial,1e-8);
});
test('Levitación magnética: caída libre, equilibrio RL y pérdida de tensión',()=>{
  const p=createPlant('maglev');run(p,[0],1);near(p.measure().gap,p.parameters.travel);
  p.reset();const a=p.parameters,i=a.initialGap*Math.sqrt(a.mass*9.81/a.k),u=i*a.resistance/a.voltage;p.current=i;
  run(p,[u],.1);near(p.measure().gap,a.initialGap);near(p.measure().current,i);
  p.perturb('event');run(p,[u],.15);assert.ok(p.measure().gap>a.initialGap);
});
test('La corriente inicial de levitación es un estado físico, no un controlador',()=>{
  const p=createPlant('maglev',{initialCurrent:2.5}),initial=p.measure();
  near(initial.current,2.5);near(initial.force,p.parameters.k*2.5**2/p.parameters.initialGap**2);
  p.step([0],.005);assert.ok(p.measure().current<initial.current);
  p.reset();near(p.measure().current,2.5);near(p.time,0);
});
test('Balancín: reacción al peso y equilibrio de torque sin PID oculto',()=>{
  const p=createPlant('beam'),a=p.parameters;p.torque=a.mass*9.81*a.initialPosition;
  run(p,[p.torque/a.maxTorque],.5);near(p.measure().x,a.initialPosition);near(p.measure().theta,0);
  p.reset();run(p,[0],.3);assert.ok(p.measure().theta<0);assert.ok(p.measure().x>a.initialPosition);
});
test('Doble hélice: simetría, torque diferencial y centro de masa',()=>{
  const p=createPlant('twin',{initialAngle:0});run(p,[.6,.6],1);near(p.measure().theta,0);near(p.measure().left,p.measure().right);
  run(p,[0,.8],.2);assert.ok(p.measure().theta>0);
  const stable=createPlant('twin',{offset:-.05}),unstable=createPlant('twin',{offset:.05});run(stable,[0,0],.15);run(unstable,[0,0],.15);
  assert.ok(stable.measure().theta<stable.parameters.initialAngle);assert.ok(unstable.measure().theta>unstable.parameters.initialAngle);
});
test('Estanques: conservación de volumen, flujo reversible y rebose medido',()=>{
  const p=createPlant('tanks',{initial1:.2,initial2:.7});let previous=p.measure().volume;
  p.pump=p.parameters.maxFlow*.6;
  for(let i=0;i<1000;i++){p.step([.6],.001);const s=p.measure();near(s.volume-previous,(s.pump-s.outlet-s.overflow)*.001,1e-12);previous=s.volume;}
  assert.ok(p.measure().transfer<0);
  const q=createPlant('tanks',{initial1:.9,initial2:.9,maxFlow:.0006,drain:.00001});run(q,[1],8);assert.ok(q.measure().overflow>0);assert.ok(q.h1<=q.parameters.height);
});
test('Caldera: balance de masa/energía y relación presión-temperatura',()=>{
  const p=createPlant('boiler'),a=p.parameters;p.heat=a.maxHeat*.8;p.feed=a.maxFeed*.1;
  const old=p.measure(),hv=2506000+1500*(p.temperature-100)+461.5*(p.temperature+273.15);
  p.step([.8,.1],.001);const s=p.measure();near(s.mass-old.mass,(s.feed-s.steam)*.001,1e-10);
  near(s.energy-old.energy,(s.heat-s.heatLoss+s.feed*4180*a.feedTemperature-s.steam*hv)*.001,1e-6);
  near(boilerState(p.temperature,p.mass,a.volume).energy,p.energy,.001);assert.ok(s.pressure>old.pressure);
  assert.ok(saturationPressure(140)>saturationPressure(110));
});
test('Caldera: fin explícito del dominio en vez de estabilización artificial',()=>{
  const p=createPlant('boiler',{initialTemperature:105,maxHeat:15000,volume:.005,initialLevel:.2,demand:.001,loss:3});
  run(p,[1,0],60);assert.equal(p.halted,true);const t=p.time;p.step([0,0],.005);near(p.time,t);assert.ok(p.reason.length>0);
});
for(const id of Object.keys(plantSpecs)){
  test(`${id}: extremos configurables finitos, validación y reinicio`,()=>{
    const spec=plantSpecs[id];
    const configs=[{},Object.fromEntries(spec.fields.map(f=>[f.key,f.min*f.scale])),Object.fromEntries(spec.fields.map(f=>[f.key,f.max*f.scale]))];
    for(const config of configs){const p=createPlant(id,config);for(const u of [spec.inputs.map(()=>0),spec.inputs.map(()=>1),spec.inputs.map(i=>i.min)]){run(p,u,2);for(const v of Object.values(p.measure()))assert.ok(Number.isFinite(v));}p.reset();near(p.time,0);assert.equal(p.halted,false);}
    const p=createPlant(id),before=p.parameters;assert.throws(()=>p.configure({[spec.fields[0].key]:NaN}));assert.equal(p.parameters,before);assert.throws(()=>p.step([NaN],.005));
  });
}
test('Entradas múltiples: tramas atómicas, rangos firmados, copias y caducidad',()=>{
  const io=new MultiInputSource([{key:'left',min:-1,max:1},{key:'right',min:0,max:1}]);
  assert.equal(io.receive({left:-.4,right:.8},10),true);assert.deepEqual(io.tick(10),[-.4,.8]);
  assert.equal(io.receive({left:.5},20),false);assert.equal(io.receive([0,2],20),false);assert.deepEqual(io.tick(20),[-.4,.8]);
  assert.equal(io.setManual(0,.5),false);const values=io.tick(20);values[0]=1;assert.deepEqual(io.tick(20),[-.4,.8]);
  assert.deepEqual(io.tick(510),[0,0]);assert.equal(io.connected,false);assert.equal(io.setManual(0,-.2),true);assert.deepEqual(io.tick(511),[-.2,0]);
});
