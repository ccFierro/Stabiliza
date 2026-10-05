// Updater lifecycle independent from Electron windows, so races can be tested.
class Updates {
  constructor({updater, configured, version, notify, openLab, idle, confirm, schedule=setTimeout, cancel=clearTimeout}) {
    Object.assign(this,{updater,configured,notify,openLab,idle,confirm,schedule,cancel});
    this.state={stage:'checking',version,progress:0,startup:true,target:null};
    this.checking=false;this.downloading=false;this.ready=false;this.installing=false;this.deadline=null;
    updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
    updater.on('update-available',info=>{this.clearDeadline();this.set({target:info.version});void this.download();});
    updater.on('update-not-available',()=>{this.clearDeadline();this.set({stage:'current'});if(this.state.startup)void this.enterLab();});
    updater.on('download-progress',info=>this.set({stage:'downloading',progress:Math.max(0,Math.min(100,info.percent))}));
    updater.on('update-downloaded',()=>{this.ready=true;this.set({stage:'ready',progress:100});if(this.state.startup)void this.install();});
    updater.on('error',()=>this.fail());
  }
  set(patch){Object.assign(this.state,patch);this.notify({...this.state});}
  clearDeadline(){if(this.deadline!==null)this.cancel(this.deadline);this.deadline=null;}
  async enterLab(){
    if(this.installing||!this.state.startup)return;
    this.clearDeadline();this.set({startup:false});await this.openLab();
  }
  fail(){
    this.clearDeadline();this.installing=false;this.set({stage:'error'});
    if(this.state.startup)void this.enterLab();
  }
  async check(){
    if(this.checking||this.downloading||this.installing)return;
    if(this.ready){this.set({stage:'ready'});return;}
    if(!this.configured()){this.set({stage:'unconfigured'});if(this.state.startup)await this.enterLab();return;}
    this.checking=true;this.set({stage:'checking'});
    if(this.state.startup)this.deadline=this.schedule(()=>{
      this.deadline=null;this.set({stage:'slow'});void this.enterLab();
    },10000);
    try{await this.updater.checkForUpdates();}
    catch{this.fail();}
    finally{this.checking=false;this.set({});}
  }
  async download(){
    if(this.downloading||this.ready||this.installing)return;
    this.downloading=true;this.set({stage:'downloading',progress:0});
    try{await this.updater.downloadUpdate();}
    catch{this.fail();}
    finally{this.downloading=false;this.set({});}
  }
  async install(){
    if(!this.ready||this.installing)return;
    // Startup has no plant loaded. A running session always requires consent.
    if(!this.state.startup){
      if(!await this.idle()){this.set({stage:'busy'});return;}
      if(!await this.confirm())return;
      if(!await this.idle()){this.set({stage:'busy'});return;}
    }
    // enterLab() can be invoked while awaiting confirmation.
    if(this.installing)return;
    this.installing=true;this.set({stage:'installing'});
    this.schedule(async()=>{
      if(!this.installing)return;
      if(!this.state.startup&&!await this.idle()){this.installing=false;this.set({stage:'busy'});return;}
      try{this.updater.quitAndInstall(true,true);}
      catch{this.fail();}
    },800);
  }
}
module.exports={Updates};
