const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('ballBridge',{
  arm:parameters=>ipcRenderer.invoke('ball:arm',parameters),
  stop:()=>ipcRenderer.invoke('ball:stop'),
  perturb:kind=>ipcRenderer.invoke('ball:perturb',kind),
  subscribe:callback=>{const handler=(_event,state)=>callback(state);ipcRenderer.on('ball:state',handler);return ()=>ipcRenderer.removeListener('ball:state',handler);}
});
contextBridge.exposeInMainWorld('desktopUpdates',{
  state:()=>ipcRenderer.invoke('updates:state'),
  action:action=>ipcRenderer.invoke('updates:action',action),
  subscribe:callback=>{
    const handler=(_event,state)=>callback(state);
    ipcRenderer.on('updates:state',handler);
    return ()=>ipcRenderer.removeListener('updates:state',handler);
  }
});
