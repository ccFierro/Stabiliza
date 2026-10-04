// Shared workspace for both plants. Switching tools never resets the simulation.
export function initWorkspace({document,window,onLayout=()=>{},layers}){
  const $=id=>document.getElementById(id);
  const tabs=[...document.querySelectorAll('[role="tab"]')];
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let animation=null;
  function selectPanel(tab,focus=false){
    animation?.cancel();animation=null;
    for(const candidate of tabs){
      const active=candidate===tab;
      candidate.setAttribute('aria-selected',String(active));
      candidate.tabIndex=active?0:-1;
      $(candidate.getAttribute('aria-controls')).hidden=!active;
    }
    const panel=$(tab.getAttribute('aria-controls'));
    if(!reducedMotion.matches)animation=panel.animate([
      {opacity:.5,transform:'translateY(7px)'},
      {opacity:1,transform:'translateY(0)'}
    ],{duration:180,easing:'ease-out'});
    if(focus)tab.focus();
  }
  for(const [index,tab] of tabs.entries()){
    tab.onclick=()=>selectPanel(tab);
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();selectPanel(tabs[next],true);}
    });
  }
  for(const button of document.querySelectorAll('[data-open-panel]')){
    button.onclick=()=>selectPanel($(`tab-${button.dataset.openPanel}`),true);
  }
  reducedMotion.addEventListener('change',event=>{if(event.matches){animation?.cancel();animation=null;}});

  const picker=$('scenePickerToggle'),choices=$('sceneChoices');
  function setPicker(open){choices.hidden=!open;picker.setAttribute('aria-expanded',String(open));}
  picker.onclick=()=>setPicker(choices.hidden);
  document.addEventListener('pointerdown',event=>{
    if(!$('sceneSwitcher').contains(event.target))setPicker(false);
    if(!$('viewOptions').contains(event.target))$('viewOptions').open=false;
  });
  let focusMode=false;
  function setFocusMode(enabled){
    focusMode=enabled;
    document.body.classList.toggle('focus-mode',enabled);
    $('toolbox').hidden=enabled;
    $('focusMode').setAttribute('aria-expanded',String(!enabled));
    $('focusMode').textContent=enabled?'Mostrar herramientas':'Solo planta ⛶';
    onLayout();
  }
  $('focusMode').onclick=()=>setFocusMode(!focusMode);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(!choices.hidden){setPicker(false);picker.focus();}
    else if($('viewOptions').open){$('viewOptions').open=false;$('viewOptions').querySelector('summary').focus();}
    else if(focusMode){setFocusMode(false);$('focusMode').focus();}
  });
  const pivot=document.body.dataset.system==='pivot';
  const layerIds=layers||{showAnnotations:pivot?'angleReadout':'heightMarker',showForces:pivot?'thrustArrow':'forceVectors',showFlow:pivot?'rotorFlow':'flow'};
  for(const [control,target] of Object.entries(layerIds))$(control).onchange=e=>{$(target).style.display=e.target.checked?'':'none';};
}
