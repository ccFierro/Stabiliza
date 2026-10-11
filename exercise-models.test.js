import test from 'node:test';
import assert from 'node:assert/strict';
import {exercises,simulate,randomCase,parseCSV,compare} from './exercise-models.js';
const get=id=>exercises.find(e=>e.id===id);
test('RL y RC coinciden con soluciones analíticas y cumplen Kirchhoff',()=>{
 for(const id of ['rl','rc']){const e=get(id),p=e.defaults,rows=simulate(e,p,e.duration);for(const r of rows){if(id==='rl'){const expected=p.u/p.R*(1-Math.exp(-p.R*r.t/p.L));assert.ok(Math.abs(r.i-expected)<1e-9);assert.ok(Math.abs(r.vr+r.vl-p.u)<1e-10);}else{const expected=p.u*(1-Math.exp(-r.t/((p.R1+p.R2)*p.C)));assert.ok(Math.abs(r.vc-expected)<1e-8);assert.ok(Math.abs(r.vr1+r.vr2+r.vc-p.u)<1e-10);}}}
});
test('Resorte y LC ideales preservan la oscilación analítica',()=>{
 for(const id of ['spring','lc']){const e=get(id),p=e.defaults;for(const r of simulate(e,p,e.duration)){const w=id==='spring'?Math.sqrt(p.k/p.m):1/Math.sqrt((p.L1+p.L2)*p.C);const expected=(id==='spring'?p.u/p.k:p.u)*(1-Math.cos(w*r.t));assert.ok(Math.abs((id==='spring'?r.x:r.vc)-expected)<1e-4);}}
});
test('Los dos modelos amortiguados alcanzan el equilibrio de fuerza',()=>{for(const id of ['damper','two']){const e=get(id),p=e.defaults,last=simulate(e,p,100).at(-1);assert.ok(Math.abs(last.x-p.u/(p.k+(p.k2||0)))<1e-8);assert.ok(Math.abs(last.v)<1e-8);}});
test('Casos aleatorios reproducibles, finitos y dentro del dominio',()=>{
 let seed=777;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
 for(const e of exercises)for(let i=0;i<30;i++){const {p,duration}=randomCase(e,rng),rows=simulate(e,p,duration);assert.ok(rows.every(r=>Object.values(r).every(Number.isFinite)));assert.equal(rows[0].t,0);assert.ok(Math.abs(rows.at(-1).t-duration)<1e-9);}
});
test('Comparación interpola, exige cobertura y rechaza CSV inválido',()=>{
 const e=get('rl'),data=parseCSV('t,i\n0,0\n1,2\n2,4',e);assert.equal(compare([{t:0,i:0},{t:.5,i:1},{t:2,i:4}],data,'i').rmse,0);
 assert.throws(()=>parseCSV('t,i\n0,1\n0,2',e));assert.throws(()=>parseCSV('t,i\n0,NaN\n1,2',e));assert.throws(()=>parseCSV('t,i\n0,\n1,2',e));assert.throws(()=>compare([{t:0,i:0},{t:3,i:3}],data,'i'));
});
test('Ediciones extremas no bloquean la interfaz con integración ilimitada',()=>{assert.throws(()=>simulate(get('rl'),{u:25,R:10000,L:.001},1000));assert.throws(()=>simulate(get('rl'),{u:25,R:0,L:1},1));});
