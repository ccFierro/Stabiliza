export function signalDefinitions(pivot) {
  const factor=pivot?180/Math.PI:100,unit=pivot?'°':'cm';
  const list=[
    {key:'y',name:pivot?'Ángulo':'Altura',unit,group:'position',color:'#8fd5a8',value:s=>s.y*factor},
    {key:'r',name:'Marcador',unit,group:'position',color:'#e2d69a',dash:[5,5],value:s=>s.r*factor},
    {key:'e',name:'Desvío',unit,group:'position',color:'#cba4db',value:s=>(s.r-s.y)*factor},
    {key:'v',name:'Velocidad',unit:pivot?'rad/s':'m/s',group:'velocity',color:'#89c8df',value:s=>s.v},
    {key:'a',name:'Aceleración',unit:pivot?'rad/s²':'m/s²',group:'acceleration',color:'#dfae84',value:s=>s.a},
    {key:'u',name:'Mando',unit:'%',group:'command',color:'#b4d87f',value:s=>s.u*100},
    {key:'air',name:pivot?'Empuje':'Aire en la base',unit:pivot?'N':'m/s',group:'actuator',color:'#7bd9ca',value:s=>s.air},
    {key:'f',name:pivot?'Momento del motor':'Fuerza del aire',unit:pivot?'N·m':'N',group:'forces',color:'#80bca6',value:s=>s.f},
    {key:'g',name:pivot?'Momento del peso':'Peso',unit:pivot?'N·m':'N',group:'forces',color:'#d89595',value:s=>s.g},
    {key:'n',name:pivot?'Momento resultante':'Fuerza resultante',unit:pivot?'N·m':'N',group:'forces',color:'#bfcac6',value:s=>s.n}
  ];
  if(pivot)list.push({key:'b',name:'Momento de fricción',unit:'N·m',group:'forces',color:'#bcae83',value:s=>s.b});
  return list;
}

export function seriesRange(signals,samples,baseRange) {
  let lo=baseRange?.[0]??0,hi=baseRange?.[1]??0;
  for(const sample of samples)for(const signal of signals){const value=signal.value(sample);if(Number.isFinite(value)){lo=Math.min(lo,value);hi=Math.max(hi,value);}}
  if(hi-lo<1e-9){const pad=Math.max(Math.abs(hi)*.1,.01);return [lo-pad,hi+pad];}
  if(baseRange&&lo===baseRange[0]&&hi===baseRange[1])return [lo,hi];
  const pad=(hi-lo)*.08;return [lo-pad,hi+pad];
}

export function createScopes({pivot,getBounds,definitions,groups,initial=['y','r','u'],baseRanges,note=' La resultante excluye la reacción de los topes; la aceleración se estima por paso físico.'}){
  const $=id=>document.getElementById(id),signals=(definitions||signalDefinitions(pivot)).map(s=>({...s})),active=new Set(initial);
  const light=document.body.dataset.theme==='light';
  if(light){const colors=['#007d87','#947328','#8d599c','#3e759c','#a9693c','#438947','#23858f','#3f7066','#b25555','#5c636a','#86713c'];signals.forEach((s,i)=>{s.color=colors[i%colors.length];});}
  let mode='combined',duration=20,latest=[],clock=0;
  const canvases=new Map(),buttons=new Map();
  const groupNames=groups||{position:pivot?'Ángulo, marcador y desvío':'Altura, marcador y desvío',velocity:'Velocidad',acceleration:'Aceleración',command:'Mando del actuador',actuator:pivot?'Empuje del motor':'Aire en la base',forces:pivot?'Momentos sobre el pivote':'Fuerzas sobre la bola'};
  const fmt=n=>Math.abs(n)>=100?n.toFixed(0):Math.abs(n)>=1?n.toFixed(2):n.toFixed(3);
  for(const signal of signals){
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed','true');button.style.setProperty('--signal',signal.color);
    const dot=document.createElement('i'),name=document.createElement('span'),unit=document.createElement('small');name.textContent=signal.name;unit.textContent=signal.unit;button.append(dot,name,unit);
    button.onclick=()=>{active.has(signal.key)?active.delete(signal.key):active.add(signal.key);refresh();};
    $('signalLegend').append(button);buttons.set(signal.key,button);
  }
  function attach(canvas){
    canvas.addEventListener('pointermove',event=>{
      const layout=canvas.scopeLayout;if(!layout||!layout.samples.length)return;
      const rect=canvas.getBoundingClientRect();const t=layout.start+Math.max(0,Math.min(1,(event.clientX-rect.left-layout.left)/(layout.right-layout.left)))*duration;
      const nearest=layout.samples.reduce((a,b)=>Math.abs(a.t-t)<Math.abs(b.t-t)?a:b);
      $('chartTooltip').textContent=`t = ${nearest.t.toFixed(2)} s\n`+layout.signals.map(s=>`${s.name}: ${fmt(s.value(nearest))} ${s.unit}`).join('  ·  ');
      $('chartTooltip').hidden=false;
    });
    canvas.addEventListener('pointerleave',()=>{$('chartTooltip').hidden=true;});
  }
  attach($('chart'));
  for(const [key,name] of Object.entries(groupNames)){
    const panel=document.createElement('div');panel.className='scope-panel';const heading=document.createElement('h3');heading.textContent=name;
    const unit=document.createElement('span');unit.textContent=signals.find(s=>s.group===key).unit;heading.append(unit);
    const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${name} en ${unit.textContent}`);panel.append(heading,canvas);$('splitCharts').append(panel);canvases.set(key,{panel,canvas});attach(canvas);
  }
  function refresh(){
    for(const signal of signals)buttons.get(signal.key).setAttribute('aria-pressed',String(active.has(signal.key)));
    $('combinedView').setAttribute('aria-pressed',String(mode==='combined'));$('splitView').setAttribute('aria-pressed',String(mode==='split'));
    $('chartEmpty').hidden=active.size!==0;$('combinedPanel').hidden=mode!=='combined'||!active.size;$('splitCharts').hidden=mode!=='split'||!active.size;$('chartTooltip').hidden=true;
    $('chartNote').textContent=(mode==='combined'?'Vista conjunta: cada magnitud usa su propio rango, indicado al pasar sobre la leyenda. Eje vertical 0–100 % del rango, no unidades físicas compartidas. Pasa sobre las curvas para leer valores reales.':'Vista separada: ejes en unidades físicas. Las señales de igual magnitud comparten gráfico. Pasa sobre las curvas para leer sus valores.')+note;
    draw(latest,clock);
  }
  $('combinedView').onclick=()=>{mode='combined';refresh();};$('splitView').onclick=()=>{mode='split';refresh();};
  $('showAll').onclick=()=>{signals.forEach(s=>active.add(s.key));refresh();};$('hideAll').onclick=()=>{active.clear();refresh();};
  $('chartWindow').onchange=e=>{duration=Number(e.target.value);refresh();};
  function paint(canvas,selected,samples,start,ranges,combined){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const dpr=window.devicePixelRatio||1;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const left=52,right=w-12,top=18,bottom=h-30;const x=t=>left+(t-start)/duration*(right-left);
    const range=combined?[0,100]:ranges.get(selected[0].group);
    ctx.font='11px Segoe UI';ctx.lineWidth=1;ctx.setLineDash([]);
    for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;ctx.strokeStyle=light?'#dce6e2':'#2e4535';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle=light?'#536e75':'#789a83';ctx.fillText(combined?`${i*25}%`:fmt(range[0]+(range[1]-range[0])*i/4),2,y+3);}
    ctx.textAlign='center';for(let i=0;i<=4;i++)ctx.fillText(`${(start+duration*i/4).toFixed(1)} s`,left+(right-left)*i/4,h-7);ctx.textAlign='start';
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    for(const signal of selected){const [lo,hi]=ranges.get(signal.group);ctx.strokeStyle=signal.color;ctx.lineWidth=2;ctx.setLineDash(signal.dash||[]);ctx.beginPath();samples.forEach((sample,i)=>{const y=bottom-(signal.value(sample)-lo)/(hi-lo)*(bottom-top);i?ctx.lineTo(x(sample.t),y):ctx.moveTo(x(sample.t),y);});ctx.stroke();}
    ctx.restore();ctx.setLineDash([]);canvas.scopeLayout={start,left,right,samples,signals:selected};
  }
  function draw(samples,time){
    latest=samples;clock=time;const selected=signals.filter(s=>active.has(s.key));if(!selected.length)return;
    const start=Math.max(0,time-duration),visible=samples.filter(s=>s.t>=start&&s.t<=start+duration),ranges=new Map();
    for(const group of Object.keys(groupNames)){
      const members=selected.filter(s=>s.group===group);if(!members.length)continue;
      const base=baseRanges?baseRanges(group):group==='command'?[0,100]:group==='position'?getBounds().map(n=>n*(pivot?180/Math.PI:100)):undefined;
      const range=seriesRange(members,visible,base);ranges.set(group,range);
      for(const signal of members)buttons.get(signal.key).title=`${signal.name}: rango ${fmt(range[0])} a ${fmt(range[1])} ${signal.unit}`;
    }
    if(mode==='combined')paint($('chart'),selected,visible,start,ranges,true);
    else for(const [group,{panel,canvas}] of canvases){const members=selected.filter(s=>s.group===group);panel.hidden=!members.length;if(members.length)paint(canvas,members,visible,start,ranges,false);}
  }
  refresh();return {draw};
}
