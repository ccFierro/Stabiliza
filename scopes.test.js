import test from 'node:test';
import assert from 'node:assert/strict';
import {signalDefinitions,seriesRange} from './scopes.js';
test('Las señales convierten solo la posición a unidades de pantalla',()=>{
  const s={y:Math.PI/2,r:0,v:2,u:.5,a:1,air:3,f:4,g:-2,b:-1,n:1};
  const pivot=signalDefinitions(true);assert.equal(pivot.find(x=>x.key==='y').value(s),90);assert.equal(pivot.find(x=>x.key==='u').value(s),50);assert.equal(pivot.find(x=>x.key==='v').value(s),2);
  assert.equal(signalDefinitions(false).find(x=>x.key==='y').value({y:.5}),50);
});
test('La escala incluye desvíos negativos sin recortar y permite señales constantes',()=>{
  const signals=signalDefinitions(false).filter(s=>['y','r','e'].includes(s.key));
  const [min,max]=seriesRange(signals,[{y:1,r:.2}],[0,100]);assert.ok(min<=-80&&max>=100);
  for(const samples of [[],[{v:0}],[{v:-3}]]){
    const range=seriesRange(signalDefinitions(false).filter(s=>s.key==='v'),samples);assert.ok(Number.isFinite(range[0])&&Number.isFinite(range[1])&&range[1]>range[0]);
  }
});
