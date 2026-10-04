import test from 'node:test';
import assert from 'node:assert/strict';
import { Plant, parameters, parameterFields } from './physics.js';
const dt=.005;
function run(plant,seconds,command){for(let i=0;i<seconds/dt;i++)plant.step(typeof command==='function'?command():command,dt);}
test('Sin flujo, la bola cae y permanece en el tope inferior',()=>{const p=new Plant();p.y=.8;run(p,3,0);assert.equal(p.y,0);assert.equal(p.v,0);});
test('El mando de equilibrio sostiene la altura',()=>{const p=new Plant();p.y=.5;const u=p.equilibrium(.5);p.air=12*u;run(p,10,u);assert.ok(Math.abs(p.y-.5)<1e-8);});
test('El amortiguamiento físico recupera el equilibrio con mando constante',()=>{
  const p=new Plant();const u=p.equilibrium(.5);p.y=.5;p.air=p.parameters.fanSpeed*u;
  p.impulse(1);run(p,15,u);assert.ok(Math.abs(p.y-.5)<.001);assert.ok(Math.abs(p.v)<.001);
});
test('Sin atenuación no hay restauración pasiva de altura',()=>{
  const p=new Plant({decay:0});const u=p.equilibrium(.5);p.y=.5;p.air=p.parameters.fanSpeed*u;
  p.impulse(1);run(p,15,u);assert.ok(p.y>.65);assert.ok(Math.abs(p.v)<.001);
});
test('La planta permanece finita y dentro del tubo bajo saturación',()=>{const p=new Plant();for(let i=0;i<10000;i++){p.step(i%2000<1000?2:-1,dt);assert.ok(Number.isFinite(p.y)&&Number.isFinite(p.v));assert.ok(p.y>=0&&p.y<=1);}});
test('El reinicio elimina perturbaciones y estado dinámico',()=>{const p=new Plant();p.impulse(1);p.loseAir();run(p,.3,1);p.reset();assert.equal(p.time,0);assert.equal(p.y,0);assert.equal(p.v,0);assert.equal(p.air,0);assert.equal(p.lossUntil,0);});
test('La configuración modifica el equilibrio y respeta la nueva altura',()=>{
  const p=new Plant({mass:.006,height:.3});
  assert.ok(Math.abs(p.equilibrium(.2)/new Plant().equilibrium(.2)-Math.sqrt(2))<1e-12);
  run(p,10,1);assert.equal(p.y,.3);
  p.configure({height:2});assert.equal(p.y,0);assert.equal(p.time,0);
  run(p,20,1);assert.ok(p.y>1&&p.y<=2);
});
test('Los parámetros inválidos no alteran una planta existente',()=>{
  const p=new Plant();p.y=.4;
  for(const config of [{mass:0},{height:NaN},{fanTau:-1},{drag:Infinity},{decay:2}])assert.throws(()=>p.configure(config),RangeError);
  assert.equal(p.y,.4);assert.equal(p.parameters.mass,parameters.mass);
});
test('Una referencia sin potencia suficiente no se alcanza',()=>{
  const p=new Plant({mass:.01,fanSpeed:6,drag:.0005});
  assert.ok(p.equilibrium(.5)>1);run(p,10,1);assert.equal(p.y,0);
});
test('Todas las combinaciones extremas configurables permanecen finitas',()=>{
  for(let mask=0;mask<2**parameterFields.length;mask++){
    const config=Object.fromEntries(parameterFields.map((f,i)=>[f.key,(mask&(1<<i)?f.max:f.min)*f.scale]));
    const p=new Plant(config);
    for(let i=0;i<2000;i++){
      p.step(i<1000?1:0,dt);
      assert.ok(Number.isFinite(p.v)&&Number.isFinite(p.air)&&p.y>=0&&p.y<=p.parameters.height);
    }
  }
});
