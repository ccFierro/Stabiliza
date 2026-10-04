// Minimal DOM fixture for application wiring; deliberately does not emulate layout.
import assert from 'node:assert/strict';
const voidTags=new Set(['input','link','meta','br','hr','img','source','wbr']);
const walk=n=>n.children.flatMap(c=>[c,...walk(c)]);
export function createTestDOM(html,system){
  let document,now=0,frame;const timers=[];
  const canvas=new Proxy({},{get:()=> (...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),'Finite drawing coordinates');}});
  class Element{
    constructor(tag='div'){this.tagName=tag.toLowerCase();this.attrs={};this.children=[];this.parentElement=null;this.style={setProperty(){}};this.dataset={};this.listeners={};this.hidden=false;this.value='';this.checked=true;this.clientWidth=360;this.clientHeight=230;this.disabled=false;this._text='';}
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='hidden')this.hidden=true;if(k==='value')this.value=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
    getAttribute(k){return this.attrs[k]??null;}
    get id(){return this.attrs.id;}set id(v){this.attrs.id=v;}
    get className(){return this.attrs.class||'';}set className(v){this.attrs.class=v;}
    get classList(){const self=this;return {toggle(k,on){const list=new Set(self.className.split(' ').filter(Boolean));if(on===undefined)on=!list.has(k);on?list.add(k):list.delete(k);self.className=[...list].join(' ');return on;},add(k){this.toggle(k,true)},remove(k){this.toggle(k,false)}};}
    get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}set textContent(v){this.children=[];this._text=String(v);}
    set innerHTML(html){this.children=[];this._text='';parse(html,this);}
    append(...items){for(let n of items){if(typeof n==='string'){const text=new Element('#text');text._text=n;n=text;}if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);n.parentElement=this;this.children.push(n);}}
    replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
    addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
    focus(){document.activeElement=this;}
    contains(n){return n===this||walk(this).includes(n);}
    getBoundingClientRect(){return {left:0,top:0,right:360,bottom:230,width:360,height:230};}
    getContext(){return canvas;}
    animate(){return {cancel(){}};}
    showModal(){this.open=true;}close(){this.open=false;}click(){this.onclick?.({target:this});}
    matches(s){if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return this.className.split(' ').includes(s.slice(1));const a=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(a)return Object.hasOwn(this.attrs,a[1])&&(a[2]===undefined||this.attrs[a[1]]===a[2]);return this.tagName===s;}
    querySelectorAll(selector){const parts=selector.split(' ');return walk(this).filter(n=>{if(!n.matches(parts.at(-1)))return false;let ancestor=n.parentElement;for(let i=parts.length-2;i>=0;i--){while(ancestor&&!ancestor.matches(parts[i]))ancestor=ancestor.parentElement;if(!ancestor)return false;ancestor=ancestor.parentElement;}return true;});}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
  }
  function parse(html,root){
    const stack=[root];
    for(const m of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)){
      const tag=m[1].toLowerCase();if(m[0].startsWith('</')){const index=stack.findLastIndex(n=>n.tagName===tag);if(index>0)stack.length=index;continue;}
      const n=new Element(tag);for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))n.setAttribute(a[1],a[2]??'');
      stack.at(-1).append(n);if(!voidTags.has(tag)&&!m[0].endsWith('/>'))stack.push(n);
    }
  }
  document=new Element('document');parse(html,document);document.body=document.querySelector('body');document.body.dataset.system=system;document.body.dataset.theme='light';document.hidden=false;
  document.getElementById=id=>document.querySelector('#'+id);
  document.createElement=tag=>new Element(tag);document.createElementNS=(_,tag)=>new Element(tag);document.createTextNode=t=>{const n=new Element('#text');n._text=t;return n;};
  const window={devicePixelRatio:1,addEventListener(){},matchMedia(){return {matches:false,addEventListener(){}}}};
  return {document,window,install(){globalThis.document=document;globalThis.window=window;globalThis.location={search:'?system='+system};globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frame=fn};},advance(ms){now+=ms;frame(now);},checkIds(){const ids=document.querySelectorAll('[id]').map(n=>n.id);assert.equal(ids.length,new Set(ids).size,'Unique connected IDs');for(const n of walk(document))for(const key of ['aria-controls','aria-labelledby'])if(n.attrs[key])for(const id of n.attrs[key].split(' '))assert.ok(document.getElementById(id),'Resolved '+id);}};
}
