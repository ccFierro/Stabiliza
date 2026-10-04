import test from 'node:test';
import assert from 'node:assert/strict';
import { initWorkspace } from './workspace-ui.js';

function fixture(system='ball',reduce=false){
  const nodes=new Map(),events=new Map();
  function node(id){
    const n={id,hidden:false,style:{},dataset:{},attrs:{},listeners:{},animations:[],
      setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},
      addEventListener(k,fn){this.listeners[k]=fn;},focus(){document.activeElement=this;},
      contains(target){return target===this;},querySelector(){return this;},
      animate(){const animation={cancelled:false,cancel(){this.cancelled=true;}};this.animations.push(animation);return animation;}
    };nodes.set(id,n);return n;
  }
  const names=['controls','data','charts','link','settings'];
  const tabs=names.map((id,i)=>{
    const tab=node('tab-'+id);tab.setAttribute('aria-controls','panel-'+id);
    tab.setAttribute('aria-selected',String(i===0));tab.tabIndex=i===0?0:-1;
    node('panel-'+id).hidden=i!==0;return tab;
  });
  for(const id of ['toolbox','focusMode','scenePickerToggle','sceneChoices','sceneSwitcher','viewOptions','showAnnotations','showForces','showFlow','heightMarker','angleReadout','forceVectors','thrustArrow','flow','rotorFlow'])node(id);
  nodes.get('sceneChoices').hidden=true;
  const link=node('openCharts');link.dataset.openPanel='charts';
  const classes=new Set();
  const document={body:{dataset:{system},classList:{toggle(c,on){on?classes.add(c):classes.delete(c);}}},
    getElementById:id=>nodes.get(id),querySelectorAll:s=>s==='[role="tab"]'?tabs:[link],
    addEventListener(k,fn){if(!events.has(k))events.set(k,[]);events.get(k).push(fn);}};
  const media={matches:reduce,addEventListener(){}};
  const window={matchMedia:()=>media};let layouts=0;
  initWorkspace({document,window,onLayout(){layouts++;}});
  return {nodes,tabs,document,classes,layouts:()=>layouts,key(key){for(const fn of events.get('keydown'))fn({key});}};
}

test('Cada herramienta sustituye la anterior incluso al alternar rápidamente',()=>{
  const {nodes,tabs}=fixture();
  for(const index of [2,1,4,3,0,2,2]){
    tabs[index].onclick();
    assert.deepEqual(tabs.filter(t=>t.attrs['aria-selected']==='true'),[tabs[index]]);
    assert.equal(tabs.filter(t=>!nodes.get(t.attrs['aria-controls']).hidden).length,1);
    assert.equal(tabs.filter(t=>t.tabIndex===0).length,1);
  }
  assert.ok(nodes.get('panel-charts').animations[0].cancelled);
});
test('Las pestañas admiten flechas, Inicio, Fin y acceso desde el mando',()=>{
  const f=fixture();let prevented=0;
  for(const [index,key,target] of [[0,'ArrowLeft',4],[4,'ArrowRight',0],[0,'End',4],[4,'Home',0]]){
    f.tabs[index].listeners.keydown({key,preventDefault(){prevented++;}});
    assert.equal(f.document.activeElement,f.tabs[target]);
    assert.equal(f.tabs[target].attrs['aria-selected'],'true');
  }
  f.nodes.get('openCharts').onclick();assert.equal(f.document.activeElement,f.tabs[2]);assert.equal(prevented,4);
});
test('Solo planta conserva la herramienta seleccionada y Escape la recupera',()=>{
  const f=fixture('ball',true);f.tabs[2].onclick();
  f.nodes.get('focusMode').onclick();assert.equal(f.nodes.get('toolbox').hidden,true);
  f.key('Escape');assert.equal(f.nodes.get('toolbox').hidden,false);
  assert.equal(f.tabs[2].attrs['aria-selected'],'true');assert.equal(f.layouts(),2);
  assert.equal(f.nodes.get('panel-charts').animations.length,0);
});
test('Las capas visuales controlan los elementos correctos de ambas plantas',()=>{
  for(const [system,targets] of [['ball',['heightMarker','forceVectors','flow']],['pivot',['angleReadout','thrustArrow','rotorFlow']]]){
    const f=fixture(system);
    ['showAnnotations','showForces','showFlow'].forEach((id,i)=>{
      f.nodes.get(id).onchange({target:{checked:false}});assert.equal(f.nodes.get(targets[i]).style.display,'none');
      f.nodes.get(id).onchange({target:{checked:true}});assert.equal(f.nodes.get(targets[i]).style.display,'');
    });
  }
});
test('El selector de sistemas se cierra con Escape y devuelve el foco',()=>{
  const f=fixture();f.nodes.get('scenePickerToggle').onclick();assert.equal(f.nodes.get('sceneChoices').hidden,false);
  f.key('Escape');assert.equal(f.nodes.get('sceneChoices').hidden,true);assert.equal(f.document.activeElement,f.nodes.get('scenePickerToggle'));
});
