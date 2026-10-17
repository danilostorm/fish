const assert=require('node:assert/strict');
const pad=require('../web/fish-controls.js');
pad.resetForTests();
const controller={index:0,id:'Controle padrão',connected:true,mapping:'standard',axes:[0.7,-0.65,-0.95,0.5],buttons:Array.from({length:16},()=>({pressed:false}))};
controller.buttons[0].pressed=true;
let r=pad.sample(controller,new Set(),{});
assert.equal((r.word>>14)&1,0,'Botão ✕ não chegou ao PS1');
assert.equal(r.axes.length,4);
assert.ok(r.axes[0]>200&&r.axes[1]<70);
assert.ok(r.axes[2]<20&&r.axes[3]>170);
assert.equal(r.packed,((r.axes[0]|r.axes[1]<<8|r.axes[2]<<16|r.axes[3]<<24)>>>0));
pad.set({mode:0});
r=pad.sample(controller,new Set(),{});
assert.deepEqual(r.axes,[128,128,128,128],'Modo digital não centralizou os sticks');
pad.set({mode:1,axisL:2,axisR:0});
r=pad.sample(controller,new Set(),{});
assert.ok(r.axes[0]<20&&r.axes[2]>200,'Remapeamento dos eixos falhou');
pad.set({deadzone:0.3});
controller.axes=[0.1,-0.1,0,0];
r=pad.sample(controller,new Set(),{});
assert.deepEqual(r.axes,[128,128,128,128],'Zona morta falhou');
pad.set({deadzone:0.13,axisL:0,axisR:2});
r=pad.sample(null,new Set(['KeyC']),{});
assert.ok(r.axes[2]!==128 || r.axes[3]!==128,'Manivela virtual C não girou');
pad.resetForTests();
console.log('Fish DualShock analog mapper: all unit checks passed');
// Browser-to-PS1 atomic bridge: keyboard Start must reach the digital title
// screen, be released cleanly, and reel (C / right stick) must switch to analog.
const recorded={};
const wasm={
 _psx_web_set_pad_buttons:v=>recorded.buttons=v,
 _psx_web_set_pad_axes:(v,c)=>{recorded.axes=v;recorded.connected=c;},
 _psx_web_set_pad_mode:v=>recorded.mode=v
};
let physical=null;
Object.defineProperty(global,'navigator',{configurable:true,value:{getGamepads:()=>[physical]}});
pad.resetForTests();
pad.publish(wasm,true,new Set(['Enter']),{Enter:3});
assert.equal(recorded.mode,0,'Start must identify as digital PS1 pad');
assert.equal(recorded.buttons,0xFFF7,'Browser Start pressed bit');
pad.publish(wasm,true,new Set(),{Enter:3});
assert.equal(recorded.buttons,0xFFFF,'Start must be released');
pad.publish(wasm,true,new Set(['KeyC']),{Enter:3});
assert.equal(recorded.mode,1,'Keyboard reel must engage DualShock analog');
pad.publish(wasm,true,new Set(['ArrowDown']),{ArrowDown:6});
assert.equal(recorded.mode,1,'Once reeling, d-pad must NOT flap the PS1 analog controller type');
assert.equal(recorded.buttons,0xFFBF,'Keyboard down must reach PS1');
physical={index:0,id:'Test',connected:true,mapping:'standard',axes:[0,0,.8,-.4],buttons:Array.from({length:16},()=>({pressed:false}))};
pad.publish(wasm,true,new Set(),{});
assert.equal(recorded.mode,1,'Right stick must engage DualShock analog');
assert.equal(recorded.connected,1,'Connected gamepad flag must reach WASM');
physical.axes=[0,0,0,0];physical.buttons[9].pressed=true;
pad.publish(wasm,true,new Set(),{});
assert.equal(recorded.mode,1,'Physical Start must NOT flap analog type during gameplay');
assert.equal((recorded.buttons>>3)&1,0,'Physical Start pressed');
console.log('Fish keyboard Start/release, direction and analog reel: all checks passed');

// Gamepad regressions: stable hybrid mode across idle noise, physical Start,
// A/X buttons, d-pad, thumbstick return to center, and active fishing.
pad.resetForTests();
physical.axes=[0,0,0,0];physical.buttons[9].pressed=false;
physical.buttons[0].pressed=false;
let clock=1000;
Object.defineProperty(global,'performance',{configurable:true,value:{now:()=>clock}});
for(let frame=0;frame<150;frame++){
  clock+=16;
  physical.axes=[.03*Math.sin(frame),0,.08*Math.cos(frame),.06*Math.sin(frame)];
  physical.buttons[0].pressed=(frame%18)<4;
  physical.buttons[9].pressed=(frame%39)<5;
  physical.buttons[12]={pressed:(frame%27)<7};
  pad.publish(wasm,true,new Set(),{});
  assert.equal(recorded.mode,0,'idle noise/buttons must leave digital pad stable');
}
assert.equal(pad.debug().modeSwitches,0,'no flapping while idle');
physical.buttons[0].pressed=false;physical.buttons[9].pressed=false;
physical.buttons[12].pressed=false;
for(let frame=0;frame<35;frame++){
  clock+=16;physical.axes=[0,0,.9,-.7];
  pad.publish(wasm,true,new Set(),{});
}
assert.equal(recorded.mode,1,'intentional right stick engages analog');
assert.equal(pad.debug().modeSwitches,1,'exactly one digital-to-analog switch');
for(let frame=0;frame<350;frame++){
  clock+=16;
  physical.axes=[0,0,.05*Math.sin(frame),.07*Math.cos(frame)];
  physical.buttons[9].pressed=frame%51<5;
  physical.buttons[12].pressed=frame%43<7;
  pad.publish(wasm,true,new Set(),{});
  assert.equal(recorded.mode,1,'must remain analog even with Start, d-pad, neutral axes');
}
assert.equal(pad.debug().modeSwitches,1,'must not flap modes in gameplay');
pad.returnToDigital();
clock+=16;
physical.axes=[0,0,.9,.1];
pad.publish(wasm,true,new Set(),{});
assert.equal(recorded.mode,0,'explicit digital override must win over held stick');
clock+=16;physical.axes=[0,0,0,0];
pad.publish(wasm,true,new Set(),{});
assert.equal(recorded.mode,0,'menu remains digital after release');
pad.set({mode:0});clock+=16;physical.axes=[0,0,.9,0];
pad.publish(wasm,true,new Set(),{});
assert.equal(recorded.mode,0,'manual digital mode fixed');
pad.set({mode:1});clock+=16;physical.buttons[9].pressed=true;
pad.publish(wasm,true,new Set(),{});
assert.equal(recorded.mode,1,'manual analog mode fixed');
console.log('Gamepad stable-mode regression: 0 mode flaps in 500 simulated frames');
