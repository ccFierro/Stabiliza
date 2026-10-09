import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {BallBridge} from './ball-bridge.js';
const frame=(op,seq,u=0,ts=.01)=>{const b=Buffer.alloc(32);[op,seq,u,ts].forEach((v,i)=>b.writeDoubleLE(v,i*8));return b;};
async function fixture(t){const b=new BallBridge();const port=await b.arm({},0);const c=net.connect(port,'127.0.0.1');c.on('error',()=>{});await once(c,'connect');t.after(async()=>{c.destroy();await b.stop();});return {b,c};}
function receive(c,count=64){return new Promise(resolve=>{let data=Buffer.alloc(0);const listener=chunk=>{data=Buffer.concat([data,chunk]);if(data.length>=count){c.off('data',listener);resolve(data);}};c.on('data',listener);});}
test('TCP admite tramas fragmentadas, avanza por comandos y conserva secuencia',async t=>{
 const {b,c}=await fixture(t);let response=receive(c);const init=frame(0,0);c.write(init.subarray(0,7));c.write(init.subarray(7));assert.equal((await response).readDoubleLE(8),0);
 response=receive(c,128);c.write(Buffer.concat([frame(1,1,.6),frame(1,2,.6)]));const data=await response;assert.equal(data.readDoubleLE(64),2);assert.ok(Math.abs(b.plant.time-.02)<1e-10);const time=b.plant.time;await new Promise(r=>setTimeout(r,20));assert.equal(b.plant.time,time);
});
test('rechaza secuencias duplicadas y mandos no finitos sin avanzar',async t=>{
 for(const invalid of [frame(1,0,.5),frame(1,1,NaN)]){const {b,c}=await fixture(t);const r=receive(c);c.write(frame(0,0));await r;const closed=once(c,'close');c.write(invalid);await closed;assert.equal(b.plant.time,0);assert.equal(b.command,0);}
});
test('permite un único cliente y cierra el enlace al volver a manual',async t=>{
 const {b,c}=await fixture(t);const other=net.connect(b.server.address().port,'127.0.0.1');other.on('error',()=>{});await once(other,'close');assert.equal(b.client!==null,true);const closed=once(c,'close');await b.stop();await closed;assert.equal(b.armed,false);
});
