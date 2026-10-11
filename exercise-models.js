const field=(key,label,unit,min,max)=>({key,label,unit,min,max});
const mech=[field('u','Fuerza','N',.1,100),field('m','Masa','kg',.1,100),field('k','Rigidez','N/m',.01,500)];
export const exercises=[
 {id:'rl',name:'Circuito RL',group:'Eléctricos',order:1,defaults:{u:25,R:2500,L:100},duration:.5,fields:[field('u','Tensión de entrada','V',.1,100),field('R','Resistencia','Ω',1,10000),field('L','Inductancia','H',.001,500)],signals:[['i','Corriente','A'],['vr','Tensión R','V'],['vl','Tensión L','V']],equation:'L · di/dt = Ve − R · i',initial:'i(0) = 0 A',hints:['Despeja di/dt = (Ve − R·i)/L.','Un Sum (+−) resta R·i de Ve. Gain (1/L) entrega di/dt.','Un Integrator con condición inicial 0 entrega i. Realimenta i mediante Gain (R).','Obtén VR con R·i y VL con Ve − VR. Lleva las señales a Scope.']},
 {id:'rc',name:'Circuito R₁–C–R₂',group:'Eléctricos',order:1,defaults:{u:12,R1:1200,R2:3500,C:.00045},duration:12,fields:[field('u','Tensión de entrada','V',.1,100),field('R1','Resistencia R₁','Ω',1,10000),field('R2','Resistencia R₂','Ω',1,10000),field('C','Capacitancia','F',.000001,.01)],signals:[['i','Corriente','A'],['vr1','Tensión R₁','V'],['vr2','Tensión R₂','V'],['vc','Tensión C','V']],equation:'dVc/dt = (Ve − Vc) / [(R₁ + R₂) · C]',initial:'Vc(0) = 0 V',hints:['Usa Vc como estado. La corriente es i = (Ve − Vc)/(R₁ + R₂).','Sum (+−) y Gain [1/(R₁+R₂)] entregan i.','Gain (1/C) seguido de Integrator entrega Vc. Realimenta Vc al sumador.','VR₁ = R₁·i y VR₂ = R₂·i. La tensión del condensador es la salida del integrador.']},
 {id:'lc',name:'Circuito L₁–C–L₂',group:'Eléctricos',order:2,defaults:{u:15,L1:120,L2:66,C:.0002},duration:20,fields:[field('u','Tensión de entrada','V',.1,100),field('L1','Inductancia L₁','H',.001,500),field('L2','Inductancia L₂','H',.001,500),field('C','Capacitancia','F',.000001,.01)],signals:[['i','Corriente','A'],['vl1','Tensión L₁','V'],['vl2','Tensión L₂','V'],['vc','Tensión C','V']],equation:'di/dt = (Ve − Vc)/(L₁ + L₂) ; dVc/dt = i/C',initial:'i(0) = 0 A · Vc(0) = 0 V',hints:['Las inductancias son ideales, en serie y sin acoplamiento magnético.','Sum (+−) y Gain [1/(L₁+L₂)] calculan di/dt. Integrator entrega i.','Desde i, Gain (1/C) e Integrator entregan Vc. Realimenta Vc al sumador.','VL₁ = L₁·di/dt y VL₂ = L₂·di/dt. Sin resistencia no hay amortiguamiento.']},
 {id:'spring',name:'Masa y resorte',group:'Mecánicos',order:2,defaults:{u:1,m:4,k:.4},duration:100,fields:mech,signals:[['x','Posición','m'],['v','Velocidad','m/s'],['a','Aceleración','m/s²']],equation:'d²x/dt² = (u − k·x)/m',initial:'x(0) = 0 m · v(0) = 0 m/s',hints:['Despeja la aceleración a = (u − k·x)/m.','Sum (+−) y Gain (1/m) calculan a.','Dos Integrator en serie entregan v y después x, ambos con condición inicial 0.','Realimenta x mediante Gain (k). Sin amortiguador la oscilación no desaparece.']},
 {id:'damper',name:'Masa, resorte y amortiguador',group:'Mecánicos',order:2,defaults:{u:3,m:8,k:15,b:10},duration:20,fields:[...mech,field('b','Amortiguamiento','N·s/m',0,500)],signals:[['x','Posición','m'],['v','Velocidad','m/s'],['a','Aceleración','m/s²']],equation:'d²x/dt² = (u − b·v − k·x)/m',initial:'x(0) = 0 m · v(0) = 0 m/s',hints:['Sum (+−−) calcula u − b·v − k·x. Gain (1/m) entrega la aceleración.','Dos Integrator en serie entregan velocidad y posición.','Realimenta v con Gain (b) y x con Gain (k).','Compara el efecto de cambiar b manteniendo los demás parámetros.']},
 {id:'two',name:'Masa con dos resortes',group:'Mecánicos',order:2,defaults:{u:5,m:12,k:15,k2:3,b:25},duration:20,fields:[...mech.map(f=>f.key==='k'?{...f,label:'Rigidez k₁'}:f),field('k2','Rigidez k₂','N/m',.01,500),field('b','Amortiguamiento','N·s/m',0,500)],signals:[['x','Posición','m'],['v','Velocidad','m/s'],['a','Aceleración','m/s²']],equation:'d²x/dt² = [u − b·v − (k₁ + k₂)·x]/m',initial:'x(0) = 0 m · v(0) = 0 m/s',hints:['El desplazamiento se mide desde el equilibrio. Ambos resortes producen fuerza restauradora.','La rigidez equivalente es k₁ + k₂.','Sum (+−−), Gain (1/m) y dos Integrator construyen la dinámica.','Realimenta v mediante b y x mediante k₁+k₂, o usa dos ramas separadas para los resortes.']}
];
export function characteristics(e,p){
 if(e.id==='rl')return {tau:p.L/p.R};
 if(e.id==='rc')return {tau:(p.R1+p.R2)*p.C};
 if(e.id==='lc')return {omega:1/Math.sqrt((p.L1+p.L2)*p.C),zeta:0};
 const k=p.k+(p.k2||0);return {omega:Math.sqrt(k/p.m),zeta:(p.b||0)/(2*Math.sqrt(k*p.m))};
}
export function validate(e,p,duration){
 for(const f of e.fields)if(!Number.isFinite(p[f.key])||p[f.key]<f.min||p[f.key]>f.max)throw Error(`${f.label}: usa un valor entre ${f.min} y ${f.max} ${f.unit}.`);
 if(!Number.isFinite(duration)||duration<.001||duration>1000)throw Error('La duración debe estar entre 0,001 y 1000 s.');
}
export function randomCase(e,rng=Math.random){
 const between=(a,b)=>a+(b-a)*rng(),round=x=>Number(x.toPrecision(4));let p={};
 if(e.id==='rl'){p={u:round(between(5,30)),R:round(between(100,3000))};p.L=round(p.R*between(.01,.12));}
 else if(e.id==='rc'){p={u:round(between(5,30)),R1:round(between(200,2000)),R2:round(between(500,4000))};p.C=round(between(.3,2)/(p.R1+p.R2));}
 else if(e.id==='lc')p={u:round(between(5,25)),L1:round(between(10,120)),L2:round(between(10,80)),C:round(between(.0001,.001))};
 else{p={m:round(between(2,15)),k:round(between(5,35))};if(e.id==='two')p.k2=round(between(3,20));const k=p.k+(p.k2||0);p.u=round(k*between(.08,.4));if(e.id!=='spring')p.b=round(2*between(.2,1.4)*Math.sqrt(k*p.m));}
 const c=characteristics(e,p),duration=round(c.tau?6*c.tau:c.zeta?Math.max(4*2*Math.PI/c.omega,8/(c.zeta*c.omega)):4*2*Math.PI/c.omega);
 validate(e,p,duration);return {p,duration};
}
export function simulate(e,p,duration){
 validate(e,p,duration);const c=characteristics(e,p);
 // Resolve both oscillation and the fastest decay mode; reject impractical edits.
 const rate=c.tau?1/c.tau:c.omega*Math.max(1,2*c.zeta);
 const steps=Math.max(1200,Math.ceil(duration*rate*35));
 if(steps>250000)throw Error('Esta combinación requiere demasiados pasos. Reduce la duración o la diferencia entre escalas de tiempo.');
 const dt=duration/steps,stride=Math.ceil(steps/1600);let state=[0,0],rows=[];
 const deriv=s=>e.id==='rl'?[(p.u-p.R*s[0])/p.L,0]:e.id==='rc'?[(p.u-s[0])/((p.R1+p.R2)*p.C),0]:e.id==='lc'?[(p.u-s[1])/(p.L1+p.L2),s[0]/p.C]:[s[1],(p.u-(p.b||0)*s[1]-(p.k+(p.k2||0))*s[0])/p.m];
 const output=(t,s)=>{const d=deriv(s);if(e.id==='rl')return {t,i:s[0],vr:p.R*s[0],vl:p.L*d[0]};if(e.id==='rc'){const i=(p.u-s[0])/(p.R1+p.R2);return {t,i,vc:s[0],vr1:p.R1*i,vr2:p.R2*i};}if(e.id==='lc')return {t,i:s[0],vc:s[1],vl1:p.L1*d[0],vl2:p.L2*d[0]};return {t,x:s[0],v:s[1],a:d[1]};};
 for(let n=0;n<=steps;n++){if(n%stride===0||n===steps)rows.push(output(n*dt,state));if(n===steps)break;const a=deriv(state),b=deriv(state.map((v,i)=>v+dt*a[i]/2)),c=deriv(state.map((v,i)=>v+dt*b[i]/2)),d=deriv(state.map((v,i)=>v+dt*c[i]));state=state.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);}
 return rows;
}
export function parseCSV(text,e){
 const lines=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/);if(lines.length<3||lines.length>100002)throw Error('El CSV debe contener una cabecera y entre 2 y 100000 muestras.');
 const headers=lines.shift().split(',').map(s=>s.trim()),keys=e.signals.map(s=>s[0]);
 if(headers[0]!=='t'||new Set(headers).size!==headers.length||headers.length<2||headers.slice(1).some(k=>!keys.includes(k)))throw Error(`Cabecera esperada: t y una o más señales: ${keys.join(', ')}. Separador coma; decimales con punto.`);
 let previous=-Infinity;return lines.map(line=>{const cells=line.split(',');if(cells.length!==headers.length||cells.some(v=>!v.trim()||!Number.isFinite(Number(v))))throw Error('El CSV contiene filas incompletas o valores no numéricos.');const row=Object.fromEntries(headers.map((k,i)=>[k,Number(cells[i])]));if(row.t<0||row.t<=previous)throw Error('El tiempo debe ser no negativo y estrictamente creciente.');previous=row.t;return row;});
}
export function compare(reference,student,key){
 if(!(key in student[0]))return null;
 if(student[0].t>reference[0].t+1e-9||student.at(-1).t<reference.at(-1).t-1e-9)throw Error('El CSV debe cubrir todo el intervalo del ensayo.');
 let index=0,sum=0,max=0;
 for(const r of reference){while(index<student.length-2&&student[index+1].t<r.t)index++;const a=student[index],b=student[index+1],value=a[key]+(b[key]-a[key])*(r.t-a.t)/(b.t-a.t),error=Math.abs(value-r[key]);sum+=error*error;max=Math.max(max,error);}
 return {rmse:Math.sqrt(sum/reference.length),max};
}
