import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {plantSpecs} from './plants.js';
import {createTestDOM} from './ui-test-dom.js';

for(const id of Object.keys(plantSpecs))test(`${id}: página completa, mandos, gráficos, CSV y entrada externa`,async()=>{
  const f=createTestDOM(fs.readFileSync(new URL('./lab.html',import.meta.url),'utf8'),id);f.install();
  await import('./lab.js?test='+id);const $=s=>f.document.getElementById(s),api=f.window.estabiliza,spec=plantSpecs[id];
  f.checkIds();assert.equal(f.document.querySelectorAll('.systems a').length,8);assert.equal(api.readMeasurement().paused,true);
  assert.equal(api.readSchema().inputs.length,spec.inputs.length);
  $('actuator-0').oninput({target:{value:50}});$('pause').click();for(let i=0;i<30;i++)f.advance(16);
  assert.ok(api.readMeasurement().time>.45);assert.equal(api.readMeasurement().commands[0],.5);
  for(const s of spec.signals)assert.ok(Number.isFinite(api.readMeasurement()[s.key]));
  const t=api.readMeasurement().time;
  for(const name of ['data','charts','settings','link','controls']){$('tab-'+name).click();assert.equal(api.readMeasurement().time,t);assert.equal(f.document.querySelectorAll('[role="tabpanel"]').filter(n=>!n.hidden).length,1);}
  $('splitView').click();assert.equal($('splitCharts').hidden,false);$('hideAll').click();assert.equal($('chartEmpty').hidden,false);$('showAll').click();assert.equal($('chartEmpty').hidden,true);
  $('showAnnotations').onchange({target:{checked:false}});assert.equal($('annotations').style.display,'none');
  $('focusMode').click();assert.equal($('toolbox').hidden,true);$('focusMode').click();assert.equal($('toolbox').hidden,false);
  const original=URL.createObjectURL;let csv;
  URL.createObjectURL=blob=>{csv=blob;return 'blob:test';};$('export').click();URL.createObjectURL=original;
  const content=await csv.text();assert.ok(content.startsWith('time_s,'));assert.ok(content.includes('command_'+spec.inputs[0].key));assert.ok(content.split('\n').length>=10);assert.ok(!content.includes('NaN'));
  const command=Object.fromEntries(spec.inputs.map(i=>[i.key,.3]));assert.equal(api.receiveExternalCommand(command),true);assert.equal($('localInputs').disabled,true);assert.equal($('configurationInputs').disabled,true);
  assert.equal(api.receiveExternalCommand({invalid:1}),false);f.advance(510);assert.equal(api.readMeasurement().connected,false);assert.ok(api.readMeasurement().commands.every(v=>v===0));
  $('reset').click();assert.equal(api.readMeasurement().time,0);assert.equal(api.readMeasurement().paused,true);
  const p=spec.fields[0],value=$('config-'+p.key).value;$('config-'+p.key).value='NaN';$('parameterForm').onsubmit({preventDefault(){}});assert.match($('configStatus').textContent,/rango/);$('config-'+p.key).value=value;
  $('parameterForm').onsubmit({preventDefault(){}});assert.equal(api.readMeasurement().time,0);f.checkIds();
});
for(const system of ['ball','pivot'])test(`${system}: las plantas existentes conservan integración e interfaz`,async()=>{
  const f=createTestDOM(fs.readFileSync(new URL(system==='ball'?'./index.html':'./pivot.html',import.meta.url),'utf8'),system);f.install();
  await import('./app.js?regression='+system);f.checkIds();f.document.getElementById('power').oninput({target:{value:65}});for(let i=0;i<30;i++)f.advance(16);
  assert.equal(f.window.estabiliza.readMeasurement().command,.65);assert.equal(f.document.querySelectorAll('.systems a').length,8);
  const schema=f.window.estabiliza.readSchema();assert.equal(schema.version,2);assert.equal(f.window.estabiliza.receiveExternalCommand({[schema.inputs[0].key]:.4}),true);assert.equal(f.window.estabiliza.receiveExternalCommand([.3,.4]),false);
});
