import test from 'node:test';
import assert from 'node:assert/strict';
import {PivotPlant,pivotFields} from './physics.js';
const dt=.005;
function run(p,t,u){for(let i=0;i<t/dt;i++)p.step(u,dt);}
test('El brazo cae sin mando y sube con empuje suficiente',()=>{
  const p=new PivotPlant();p.y=0;run(p,5,0);assert.equal(p.y,-p.parameters.angleLimit);
  run(p,5,1);assert.equal(p.y,p.parameters.angleLimit);
});
test('El equilibrio calculado balancea los momentos',()=>{
  for(const angle of [-.5,0,.5]){const p=new PivotPlant();p.y=angle;const u=p.equilibrium(angle);p.air=p.parameters.maxThrust*u*u;run(p,1,u);assert.ok(Math.abs(p.y-angle)<1e-10);}
});
test('Al duplicar la longitud se cuadruplica la inercia',()=>{
  const p=new PivotPlant({length:.2}),q=new PivotPlant({length:.4});assert.ok(Math.abs(q.inertia/p.inertia-4)<1e-10);
});
test('El equilibrio inferior restaura y el superior amplifica una desviación',()=>{
  const lower=new PivotPlant(),upper=new PivotPlant();
  for(const [p,a] of [[lower,-.5],[upper,.5]]){p.y=a+.001;const u=p.equilibrium(a);p.air=p.parameters.maxThrust*u*u;run(p,10,u);}
  assert.ok(Math.abs(lower.y+.5)<.0001);assert.ok(Math.abs(upper.y-.5)>.1);
});
test('La pérdida de empuje es temporal y reiniciar elimina el estado',()=>{
  const p=new PivotPlant();run(p,2,.5);const f=p.air;p.loseAir();run(p,.5,.5);assert.ok(p.air<f*.65);run(p,2,.5);assert.ok(Math.abs(p.air-f)<.001);p.reset();assert.equal(p.air,0);assert.equal(p.time,0);assert.equal(p.lossUntil,0);assert.equal(p.v,0);
});
test('Configuración inválida se rechaza sin alterar el brazo',()=>{
  const p=new PivotPlant();p.y=.1;for(const config of [{length:0},{damping:NaN},{motorMass:-1},{angleLimit:Math.PI}])assert.throws(()=>p.configure(config),RangeError);assert.equal(p.y,.1);
});
test('Extremos de parámetros mantienen finitud y topes angulares',()=>{
  for(let mask=0;mask<2**pivotFields.length;mask++){
    const config=Object.fromEntries(pivotFields.map((f,i)=>[f.key,(mask&(1<<i)?f.max:f.min)*f.scale]));const p=new PivotPlant(config);
    for(let i=0;i<2000;i++){p.step(i<1000?1:0,dt);assert.ok(Number.isFinite(p.v)&&Number.isFinite(p.air));assert.ok(Math.abs(p.y)<=p.parameters.angleLimit);}
  }
});
