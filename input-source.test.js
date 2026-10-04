import test from 'node:test';
import assert from 'node:assert/strict';
import { InputSource } from './input-source.js';
test('El mando arranca en cero y pasa directamente a la planta',()=>{
  const input=new InputSource();assert.equal(input.tick(0),0);
  assert.equal(input.setManual(.7),true);assert.equal(input.tick(1),.7);
});
test('Los mandos externos bloquean cambios manuales y recuperan en cero al caducar',()=>{
  const input=new InputSource();input.setManual(.9);input.receive(.3,10);
  assert.equal(input.connected,true);assert.equal(input.setManual(1),false);assert.equal(input.tick(20),.3);
  input.receive(.4,400);assert.equal(input.tick(800),.4);
  assert.equal(input.tick(900),0);assert.equal(input.connected,false);
  assert.equal(input.setManual(.2),true);assert.equal(input.tick(910),.2);
});
test('Tramas inválidas no activan ni renuevan una conexión',()=>{
  const input=new InputSource();for(const value of [NaN,Infinity,-.1,1.1,'0.5',null])assert.equal(input.receive(value,0),false);
  assert.equal(input.connected,false);input.receive(.5,0);input.receive(NaN,450);assert.equal(input.tick(500),0);
  input.receive(1,501);input.disconnect();assert.equal(input.tick(502),0);
});
