// Transport-independent arbitration. The Simulink transport is not implemented yet.
export class InputSource {
  constructor(timeoutMs = 500) {
    this.timeoutMs = timeoutMs;
    this.manual = 0;
    this.external = 0;
    this.connected = false;
    this.lastReceived = -Infinity;
  }
  setManual(value) {
    if (this.connected || !Number.isFinite(value) || value < 0 || value > 1) return false;
    this.manual = value;
    return true;
  }
  receive(value, now) {
    if (!Number.isFinite(value) || value < 0 || value > 1 || !Number.isFinite(now)) return false;
    this.external = value;
    this.lastReceived = now;
    this.connected = true;
    return true;
  }
  disconnect() {
    this.connected = false;
    this.manual = 0;
    this.external = 0;
    this.lastReceived = -Infinity;
  }
  tick(now) {
    if (this.connected && now - this.lastReceived >= this.timeoutMs) this.disconnect();
    return this.connected ? this.external : this.manual;
  }
}

// Named/vector commands for plants with signed or multiple actuators.
// Every external frame is complete and validated atomically.
export class MultiInputSource {
  constructor(inputs,timeoutMs=500){this.inputs=inputs;this.timeoutMs=timeoutMs;this.disconnect();}
  parse(value){
    let values;
    if(typeof value==='number'&&this.inputs.length===1)values=[value];
    else if(Array.isArray(value))values=[...value];
    else if(value&&typeof value==='object'&&Object.keys(value).length===this.inputs.length&&this.inputs.every(i=>Object.hasOwn(value,i.key)))values=this.inputs.map(i=>value[i.key]);
    else return null;
    return values.length===this.inputs.length&&values.every((v,i)=>Number.isFinite(v)&&v>=this.inputs[i].min&&v<=this.inputs[i].max)?values:null;
  }
  setManual(index,value){if(this.connected||!this.inputs[index]||!Number.isFinite(value)||value<this.inputs[index].min||value>this.inputs[index].max)return false;this.manual[index]=value;return true;}
  receive(value,now){const values=this.parse(value);if(!values||!Number.isFinite(now))return false;this.external=values;this.lastReceived=now;this.connected=true;return true;}
  disconnect(){this.connected=false;this.manual=this.inputs.map(()=>0);this.external=this.inputs.map(()=>0);this.lastReceived=-Infinity;}
  tick(now){if(this.connected&&now-this.lastReceived>=this.timeoutMs)this.disconnect();return [...(this.connected?this.external:this.manual)];}
}
