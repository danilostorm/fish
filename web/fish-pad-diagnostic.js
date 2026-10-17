/* FISH support telemetry is opt-in: 12 seconds of button indexes only,
 * PS1 input bitmask, analog/digital mode and VBlank. No gamepad ID, IP,
 * URL, keyboard keys, audio, game images or browser data are collected. */
(function(){
 'use strict';
 var running=false,results=[];
 const get=id=>document.getElementById(id);
 function sample(){
  const conf=window.FishControls?.config()||{};
  const pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p&&p.connected);
  const pad=conf.device<0?pads[0]:pads.find(p=>p.index===conf.device);
  const buttons=[];
  if(pad)for(let i=0;i<(pad.buttons||[]).length;i++){
    const b=pad.buttons[i];if(b&&(b.pressed||b.value>0.65))buttons.push(i);
  }
  const mod=window.Module;
  const wasm=typeof mod?._psx_web_get_pad_buttons==='function'?(mod._psx_web_get_pad_buttons()&65535):-1;
  return {ms:Math.round(performance.now()),connected:!!pad,raw:buttons,mapped:window.FishControls?.sample(pad,new Set(),{})?.word??65535,wasm:wasm,
    ps1Mode:typeof mod?._psx_web_get_pad_analog==='function'?mod._psx_web_get_pad_analog():-1,
    vblanks:typeof mod?._psx_web_perf_vblanks==='function'?Math.round(mod._psx_web_perf_vblanks()):0,
    connectedCount:pads.length,index:pad?.index??-1,buttonCount:pad?.buttons?.length||0,
    expectedStart:conf.buttons?.start??9,configMode:conf.mode??-1,analogMode:window.FishControls?.debug()?.effectiveMode??-1};
 }
 async function sendReport(report){
  const query=new URLSearchParams({v:'1',d:JSON.stringify(report)}).toString();
  const response=await fetch('/pad-diagnostic?'+query,{mode:'same-origin',cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Servidor retornou '+response.status);
 }
 function summarise(samples){
  const counts={},startIndexes={};
  for(const s of samples){
   for(const n of s.raw)counts[n]=(counts[n]||0)+1;
   if((s.mapped & (1<<3))===0)startIndexes.mapped=(startIndexes.mapped||0)+1;
   if(s.wasm>=0&&(s.wasm & (1<<3))===0)startIndexes.wasm=(startIndexes.wasm||0)+1;
  }
  const first=samples[0]||{},last=samples[samples.length-1]||{};
  const transitions=[];
  let prior='';
  for(const s of samples){
   const key=s.raw.join(',')+'-'+s.ps1Mode;
   if(key===prior)continue;
   prior=key;
   if(transitions.length<38)transitions.push([Math.round(s.ms-first.ms),s.raw,s.ps1Mode,(s.mapped&8)===0?1:0,s.wasm>=0&&(s.wasm&8)===0?1:0]);
  }
  return {v:1,duration:Math.round((last.ms-first.ms)/1000),samples:samples.length,padCount:last.connectedCount,connectedSamples:samples.filter(s=>s.connected).length,
    index:last.index,buttonCount:last.buttonCount,expectedStart:last.expectedStart,configuredMode:last.configMode,
    sawButton:counts,mappedStartSamples:startIndexes.mapped||0,wasmStartSamples:startIndexes.wasm||0,
    initialVblanks:first.vblanks,finalVblanks:last.vblanks,guestMode:first.ps1Mode+'-'+last.ps1Mode,modeTransitions:window.FishControls?.debug()?.modeSwitches??-1,
    transitions};
 }
 async function begin(){
  if(running)return;running=true;results=[];
  const button=get('padRunDiagnostic'),state=get('padDiagStatus');
  button.disabled=true;
  state.textContent='Teste iniciado! Pressione START várias vezes no controle durante 12 segundos. Apenas os índices dos botões serão enviados.';
  const start=performance.now();
  const interval=setInterval(async ()=>{
   results.push(sample());
   const elapsed=(performance.now()-start)/1000;
   state.textContent='Gravando comandos: '+Math.min(12,Math.floor(elapsed))+'/12 s. Pressione START agora.';
   if(elapsed<12)return;
   clearInterval(interval);
   const summary=summarise(results);
   window.FishPadLastReport=summary;running=false;
   button.disabled=false;
   try{await sendReport(summary);state.textContent=summary.finalVblanks===0?'Diagnóstico enviado, mas o jogo ainda não estava rodando. Abra o jogo e refaça o teste de START.':'Diagnóstico enviado ao AEROCOOL! Resultado: '+summary.mappedStartSamples+' amostras de START mapeadas e '+summary.wasmStartSamples+' recebidas pelo runtime. Avise no chat que enviou.';}
   catch(e){state.textContent='Não consegui enviar automaticamente ('+e.message+'). Use Copiar diagnóstico e cole no chat.';}
   get('padCopyDiagnostic').disabled=false;
  },100);
 }
 async function copy(){
  if(!window.FishPadLastReport)return;
  const content=JSON.stringify(window.FishPadLastReport,null,2);
  try{await navigator.clipboard.writeText(content);get('padDiagStatus').textContent='Diagnóstico copiado! Cole no chat.';}
  catch(e){const area=get('padDiagText');area.hidden=false;area.value=content;area.select();get('padDiagStatus').textContent='Selecione e copie o texto abaixo.';}
 }
 get('padRunDiagnostic')?.addEventListener('click',begin);
 get('padDiagShortcut')?.addEventListener('click',()=>{begin();});
 get('padCopyDiagnostic')?.addEventListener('click',copy);
})();