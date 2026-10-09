import net from 'node:net';
import {Plant,parameterFields} from './physics.js';
// Four little-endian doubles in, eight out. Physics advances only on STEP.
export class BallBridge {
  constructor(){this.plant=new Plant();this.server=null;this.client=null;this.command=0;this.status='Manual';this.armed=false;}
  snapshot(){const p=this.plant;return {armed:this.armed,connected:!!this.client,time:p.time,y:p.y,v:p.v,air:p.air,lastForce:p.lastForce,command:this.command,status:this.status};}
  async arm(config={},port=5050){
    if(this.armed)throw Error('El enlace ya está habilitado');
    const clean={};for(const f of parameterFields)if(Object.hasOwn(config,f.key))clean[f.key]=config[f.key];
    this.plant=new Plant(clean);this.command=0;
    const server=net.createServer(socket=>this.accept(socket));this.server=server;
    try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}
    catch(error){this.server=null;throw error;}
    server.on('error',error=>{this.status=error.message;});
    this.armed=true;this.status='Esperando MATLAB';return server.address().port;
  }
  accept(socket){
    if(this.client||!this.armed){socket.destroy();return;}
    this.client=socket;this.status='Conectado';socket.setNoDelay(true);socket.setTimeout(5000);
    let buffer=Buffer.alloc(0),sequence=-1,initialized=false;
    const fail=message=>{this.status=message;socket.destroy();};
    socket.on('timeout',()=>fail('Sin comandos durante 5 s'));
    socket.on('error',()=>{this.status='Conexión interrumpida';});
    socket.on('close',()=>{if(this.client===socket){this.client=null;this.command=0;if(this.status==='Conectado')this.status='MATLAB desconectado';}});
    socket.on('data',data=>{
      buffer=Buffer.concat([buffer,data]);if(buffer.length>65536){fail('Trama excesiva');return;}
      while(buffer.length>=32&&!socket.destroyed){
        const [op,seq,u,ts]=Array.from({length:4},(_,i)=>buffer.readDoubleLE(i*8));buffer=buffer.subarray(32);
        if(![op,seq,u,ts].every(Number.isFinite)||!Number.isSafeInteger(seq)){fail('Trama inválida');return;}
        if(op===0&&seq===0){this.plant.reset();this.command=0;initialized=true;sequence=0;}
        else if(op===1&&initialized&&seq===sequence+1&&u>=0&&u<=1&&ts>=.001&&ts<=.1){
          const n=Math.ceil(ts/.005);this.command=u;
          for(let i=0;i<n;i++)this.plant.step(u,ts/n);
          sequence=seq;
        }else{fail('Secuencia, mando o período inválido');return;}
        const p=this.plant,reply=Buffer.alloc(64);
        [sequence,p.time,p.y,p.v,p.air,p.lastForce,this.command,1].forEach((value,i)=>reply.writeDoubleLE(value,i*8));
        if(socket.writableLength>65536){fail('Cliente no consume las mediciones');return;}
        socket.write(reply);
      }
    });
  }
  perturb(kind){if(!this.client)throw Error('Conecta MATLAB antes de perturbar');if(kind==='up')this.plant.impulse(1);else if(kind==='down')this.plant.impulse(-1);else if(kind==='air')this.plant.loseAir();else throw Error('Perturbación inválida');}
  async stop(){this.armed=false;this.command=0;this.status='Manual';this.client?.destroy();this.client=null;const server=this.server;this.server=null;if(server)await new Promise(resolve=>server.close(resolve));}
}
