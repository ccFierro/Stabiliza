import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createLocalServer } from './server.js';
const { canInstall } = createRequire(import.meta.url)('./desktop/update-policy.cjs');
test('actualizar exige una planta pausada y sin control externo', () => {
  assert.equal(canInstall({paused:true,connected:false}),true);
  for (const state of [undefined,{}, {paused:false,connected:false},{paused:true,connected:true},{paused:true}]) assert.equal(canInstall(state),false);
});
test('el servidor de escritorio usa puerto libre y solo expone recursos de la app', async t => {
  const server=createLocalServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const route of ['/','/pivot.html','/lab.html?system=maglev','/plants.js','/gallery.html','/gallery.js','/gallery.css']) {
    const response=await fetch(origin+route);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
    await response.text();
  }
  for(const route of ['/desktop/main.cjs','/package.json','/.env']) {
    const response=await fetch(origin+route);assert.equal(response.status,404);await response.text();
  }
  for(const route of ['/pivot.html','/lab.html?system=pendulum']){const response=await fetch(origin+route,{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/gallery.html');}
});
