const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopUpdates',{
  state:()=>ipcRenderer.invoke('updates:state'),
  action:action=>ipcRenderer.invoke('updates:action',action),
  subscribe:callback=>{
    const handler=(_event,state)=>callback(state);
    ipcRenderer.on('updates:state',handler);
    return ()=>ipcRenderer.removeListener('updates:state',handler);
  }
});
