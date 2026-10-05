const $=id=>document.getElementById(id);
let current;
const copy={
  checking:['Buscando actualizaciones','Estamos comprobando si hay una nueva versión del laboratorio.'],
  downloading:['Actualizando Estabiliza','Descargando la nueva versión. Puedes abrir el laboratorio sin esperar.'],
  ready:['Actualización preparada','La descarga está completa. Ya puedes instalar la nueva versión.'],
  installing:['Instalando actualización','Estabiliza se cerrará un momento y volverá a abrirse automáticamente.'],
  current:['Todo está al día','Tienes la versión más reciente.'],
  slow:['La conexión está tardando','Puedes seguir trabajando mientras terminamos la comprobación.'],
  error:['No se pudo actualizar','La versión instalada sigue disponible. Puedes volver a intentarlo.'],
  busy:['Primero detén el ensayo','Pausa la simulación y desconecta el mando externo antes de instalar.'],
  unconfigured:['Versión de desarrollo','Las actualizaciones se habilitan en la aplicación instalada.']
};
function render(state){
  current=state;const [title,detail]=copy[state.stage]||copy.checking;
  $('title').textContent=title;$('detail').textContent=detail;
  $('version').textContent=`Instalada: ${state.version}${state.target?` → ${state.target}`:''}`;
  const determinate=['downloading','ready','busy'].includes(state.stage);
  $('track').classList.toggle('indeterminate',!determinate);
  $('bar').style.width=determinate?`${state.progress}%`:'';
  if(determinate)$('track').setAttribute('aria-valuenow',String(Math.round(state.progress)));else $('track').removeAttribute('aria-valuenow');
  $('percent').textContent=determinate?`${Math.round(state.progress)} %`:'';
  $('continue').textContent=state.startup?'Abrir laboratorio sin esperar':'Volver al laboratorio';
  $('continue').disabled=state.stage==='installing';
  const install=['ready','busy'].includes(state.stage);
  $('primary').hidden=!install&&state.stage!=='error';
  $('primary').textContent=install?'Reiniciar e instalar':'Reintentar';
}
$('continue').onclick=()=>window.desktopUpdates.action('continue');
$('primary').onclick=()=>window.desktopUpdates.action(['ready','busy'].includes(current.stage)?'install':'check');
if(window.desktopUpdates){window.desktopUpdates.subscribe(render);window.desktopUpdates.state().then(render);}
else{render({stage:'unconfigured',version:'web',progress:0,startup:false});$('continue').onclick=()=>location.assign('/');}
