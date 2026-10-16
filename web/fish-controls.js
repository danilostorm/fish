/* HostStorm Fish - configurable PlayStation DualShock browser bridge.
 * Persistent local settings, no server telemetry, no emulator.
 * Exported pure conversion helpers are tested under Node.
 */
(function (root, factory) {
  var api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root)root.FishControls=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const bits={select:0,start:3,up:4,right:5,down:6,left:7,l2:8,r2:9,l1:10,r1:11,triangle:12,circle:13,cross:14,square:15};
const names=['A / ✕','B / ◯','X / □','Y / △','LB / L1','RB / R1','LT / L2','RT / R2','Back / Select','Start','L3','R3','↑','↓','←','→'];
const defaults={mode:1,device:-1,deadzone:0.13,axisL:0,axisR:2,invertRY:false,invertLY:false,crank:-1,
  buttons:{cross:0,circle:1,square:2,triangle:3,l1:4,r1:5,l2:6,r2:7,select:8,start:9}};
var config=JSON.parse(JSON.stringify(defaults));
var applied={buttons:65535,axes:0x80808080,analog:1};
var currentPad=null,gameStarted=false,uiInitialized=false,previewAt=0;
function load(){
  try{
    const raw=localStorage.getItem('hoststorm-fish-controller-v2');
    const data=JSON.parse(raw);
    if(data && typeof data==='object'){
      config={...defaults,...data,buttons:{...defaults.buttons,...data.buttons}};
    }
  }catch(_){}
  validate();
}
function validate(){
  config.mode=[0,1,2].includes(Number(config.mode))?Number(config.mode):1;
  config.axisL=[0,2,4].includes(Number(config.axisL))?Number(config.axisL):0;
  config.axisR=[0,2,4].includes(Number(config.axisR))?Number(config.axisR):2;
  config.device=Number.isInteger(Number(config.device))?Number(config.device):-1;
  config.deadzone=Math.max(0,Math.min(0.4,Number(config.deadzone)||0.13));
  config.crank=Number.isInteger(Number(config.crank))?Number(config.crank):-1;
  config.invertRY=!!config.invertRY;config.invertLY=!!config.invertLY;
  for(const key of Object.keys(defaults.buttons)){
    let val=Number(config.buttons[key]);
    config.buttons[key]=(Number.isInteger(val)&&val>=0&&val<16)?val:defaults.buttons[key];
  }
}
function save(){validate();try{localStorage.setItem('hoststorm-fish-controller-v2',JSON.stringify(config));}catch(_){}
}
function selectedGamepad(pads) {
 const arr=Array.from(pads||[]).filter(p=>p&&p.connected);
 return config.device<0?arr[0]||null:arr.find(p=>p.index===config.device)||null;
}
function toByte(value,deadzone,flip) {
 let a=Number(value)||0;
 if(!Number.isFinite(a))a=0;
 a=Math.max(-1,Math.min(1,a));
 if(Math.abs(a)<deadzone)a=0;
 if(flip)a=-a;
 return a===0?128:Math.max(0,Math.min(255,Math.round(128+a*127)));
}
function sample(pad,pressed,keyboard){
 let word=0xFFFF;
 if(pressed&&keyboard)pressed.forEach(code=>{if(Object.prototype.hasOwnProperty.call(keyboard,code))word &= ~(1<<keyboard[code]);});
 const axes=[128,128,128,128];
 if(pad) {
   for(const key of Object.keys(config.buttons)) {
     const index=config.buttons[key];
     if(pad.buttons&&pad.buttons[index]&&pad.buttons[index].pressed)word &= ~(1<<bits[key]);
   }
   const a=pad.axes||[],deadzone=config.deadzone;
   axes[0]=toByte(a[config.axisL],deadzone,false);
   axes[1]=toByte(a[config.axisL+1],deadzone,config.invertLY);
   axes[2]=toByte(a[config.axisR],deadzone,false);
   axes[3]=toByte(a[config.axisR+1],deadzone,config.invertRY);
   const dpad=[12,13,14,15];
   for(const [idx,name] of dpad.map((idx,i)=>[idx,['up','down','left','right'][i]])){
     if(pad.buttons[idx]?.pressed)word &= ~(1<<bits[name]);
   }
   // Some non-standard gamepads lack a D-pad button mapping.
   if(a.length===2 && config.mode===0){
      if(Number(a[0]) < -0.5)word &= ~(1<<bits.left);
      if(Number(a[0]) > 0.5)word &= ~(1<<bits.right);
      if(Number(a[1]) < -0.5)word &= ~(1<<bits.up);
      if(Number(a[1]) > 0.5)word &= ~(1<<bits.down);
   }
   if(config.crank>=0 && pad.buttons[config.crank]?.pressed && config.mode!==0){
     const theta=(performance.now()/1000)*Math.PI*5;
     axes[2]=toByte(Math.cos(theta),0,false);
     axes[3]=toByte(Math.sin(theta),0,config.invertRY);
   }
 }
 // Optional C key simulates rotating right stick: PC players can reel.
 if(config.mode!==0 && pressed && pressed.has('KeyC')){
   const theta=(performance.now()/1000)*Math.PI*5;
   axes[2]=toByte(Math.cos(theta),0,false);
   axes[3]=toByte(Math.sin(theta),0,config.invertRY);
 }
 if(config.mode===0)axes.fill(128);
 let packed=((axes[0])|(axes[1]<<8)|(axes[2]<<16)|(axes[3]<<24))>>>0;
 return {word,packed,axes};
}
function publish(Module,started,pressed,keyboard){
 gameStarted=started;
 const pad=selectedGamepad(typeof navigator!=='undefined'&&navigator.getGamepads?navigator.getGamepads():[]);
 currentPad=pad;
 const data=sample(pad,pressed,keyboard);
 applied={buttons:data.word,axes:data.packed,raw:data.axes,analog:config.mode};
 if(Module && typeof Module._psx_web_set_pad_mode==='function')
   Module._psx_web_set_pad_mode(config.mode);
 if(started && Module){
   if(typeof Module._psx_web_set_pad_buttons==='function')Module._psx_web_set_pad_buttons(data.word);
   if(typeof Module._psx_web_set_pad_axes==='function')Module._psx_web_set_pad_axes(data.packed,pad?1:0);
 }
 if(uiInitialized && typeof performance!=='undefined' && performance.now()-previewAt>170){
   previewAt=performance.now();
   updatePreview(Module);
 }
 return data;
}
function updatePreview(Module){
 const set=(id,str)=>{const el=document.getElementById(id);if(el)el.textContent=str;};
 const readable=currentPad?currentPad.id+' (porta '+(currentPad.index+1)+')':'Nenhum controle conectado — teclado disponível';
 set('padStatusLive',readable);
 set('gamepadStatus',currentPad?'Conectado: '+currentPad.id:'Nenhum gamepad — conecte e pressione um botão');
 const mode=typeof Module?._psx_web_get_pad_analog==='function'?Module._psx_web_get_pad_analog():-1;
 set('padAnalogLive',mode===1?'DualShock analógico ativo (0x73)':mode===0?'Controle digital (0x41)':'Aguardando início do jogo');
 const el=document.getElementById('padAxesLive');
 if(el && applied.raw)el.textContent='E: '+applied.raw.slice(0,2).join(' / ')+'  •  D: '+applied.raw.slice(2).join(' / ');
 const sticks=[['padDotLeft',applied.raw?.[0],applied.raw?.[1]],['padDotRight',applied.raw?.[2],applied.raw?.[3]]];
 sticks.forEach(([id,x,y])=>{
   const dot=document.getElementById(id);
   if(dot)dot.style.transform='translate('+(((x??128)-128)/127*35).toFixed(1)+'px,'+(((y??128)-128)/127*35).toFixed(1)+'px)';
 });
 const device=document.getElementById('padDevice');
 if(device && !device.matches(':focus')){
   const padList=Array.from(navigator.getGamepads?.()||[]).filter(Boolean);
   const entries=['<option value="-1">Automático (primeiro controle)</option>'].concat(padList.map(p=>'<option value="'+p.index+'">Porta '+(p.index+1)+' — '+escapeText(p.id)+'</option>'));
   const h=entries.join('');
   if(device.innerHTML!==h)device.innerHTML=h;
   device.value=String(config.device);
 }
}
function escapeText(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function initUI(open,close){
 if(uiInitialized)return;uiInitialized=true;
 const q=id=>document.getElementById(id);
 const modal=q('padConfigModal');
 function reflect(){
   q('padMode').value=String(config.mode);
   q('padDevice').value=String(config.device);
   q('padDeadzone').value=String(Math.round(config.deadzone*100));
   q('padDeadzoneValue').textContent=Math.round(config.deadzone*100)+'%';
   q('padLeftAxis').value=String(config.axisL);
   q('padRightAxis').value=String(config.axisR);
   q('padInvertLY').checked=config.invertLY;
   q('padInvertRY').checked=config.invertRY;
   q('padCrank').value=String(config.crank);
   for(const key of Object.keys(defaults.buttons)){const el=q('map-'+key);if(el)el.value=String(config.buttons[key]);}
 }
 function show(){modal.hidden=false;reflect();modal.querySelector(".modal-box").scrollTop=0;updatePreview(window.Module);open?.();}
 function hide(){modal.hidden=true;close?.();}
 document.querySelectorAll('[data-open-pad-settings]').forEach(b=>b.addEventListener('click',show));
 q('padClose').addEventListener('click',hide);
 q('padSave').addEventListener('click',()=>{save();hide();});
 q('padReset').addEventListener('click',()=>{config=JSON.parse(JSON.stringify(defaults));save();reflect();});
 modal.addEventListener('click',e=>{if(e.target===modal)hide();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden){e.stopImmediatePropagation();hide();}},true);
 const register=(id,key,transform)=>q(id).addEventListener('change',e=>{config[key]=transform(e.target);save();reflect();});
 register('padMode','mode',el=>Number(el.value));
 register('padDevice','device',el=>Number(el.value));
 register('padLeftAxis','axisL',el=>Number(el.value));
 register('padRightAxis','axisR',el=>Number(el.value));
 register('padCrank','crank',el=>Number(el.value));
 register('padInvertLY','invertLY',el=>el.checked);
 register('padInvertRY','invertRY',el=>el.checked);
 q('padDeadzone').addEventListener('input',e=>{
    config.deadzone=Number(e.target.value)/100;q('padDeadzoneValue').textContent=e.target.value+'%';save();
 });
 for(const key of Object.keys(defaults.buttons))q('map-'+key).addEventListener('change',e=>{
    config.buttons[key]=Number(e.target.value);save();
 });
 reflect();
}
function resetForTests(){config=JSON.parse(JSON.stringify(defaults));applied={buttons:65535,axes:0x80808080,analog:1};}
load();
return {defaults,bits,names,config:()=>config,set:(opts)=>{config={...config,...opts,buttons:{...config.buttons,...(opts.buttons||{})}};save();},sample,publish,initUI,resetForTests,toByte};
});