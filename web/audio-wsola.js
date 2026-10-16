/* Fisherman's Bait 2: streaming pitch-preserving WSOLA for the Web Audio bridge.
 * Own original processing code, no game assets. Runs on the browser main thread.
 * PS1 engine keeps producing native 44.1 kHz PCM; each block is time-stretched
 * using short matching grains instead of changing AudioBufferSource.playbackRate.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FishAudioStretch = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  var HOP=512, WINDOW=HOP*2, SEARCH=72;
  function limit(v,min,max){return Math.max(min,Math.min(max,v));}
  function createProcessor() {
    var inputL=new Float32Array(0), inputR=new Float32Array(0);
    var prevL=null,prevR=null,position=0;
    var ratio=1.25, framesOut=0,framesIn=0;
    function reset() {
      inputL=new Float32Array(0);inputR=new Float32Array(0);
      prevL=null;prevR=null;position=0;
      framesIn=0;framesOut=0;
    }
    function append(left,right) {
      if(!left||!right||left.length!==right.length) throw Error('Invalid stereo PCM');
      var n=left.length;
      var a=new Float32Array(inputL.length+n);
      var b=new Float32Array(inputR.length+n);
      a.set(inputL);b.set(inputR);
      a.set(left,inputL.length);b.set(right,inputR.length);
      inputL=a;inputR=b;framesIn+=n;
    }
    // Streaming WSOLA: correlation chooses a candidate near the expected
    // analysis position, then crossfades the previous window's remaining half.
    function drain(desiredRatio) {
      ratio=limit(Number(desiredRatio)||1,1,1.85);
      var outputL=[],outputR=[];
      if(!prevL && inputL.length >= WINDOW) {
        outputL.push(inputL.slice(0,HOP));outputR.push(inputR.slice(0,HOP));
        prevL=inputL.slice(HOP,WINDOW);
        prevR=inputR.slice(HOP,WINDOW);
        position=HOP/ratio;
      }
      var iterations=0;
      while(prevL && inputL.length >= WINDOW+HOP && iterations++<16) {
        var center=Math.round(position);
        var low=limit(center-SEARCH,0,Math.max(0,inputL.length-WINDOW));
        var high=limit(center+SEARCH,0,Math.max(0,inputL.length-WINDOW));
        if(high < low || center+SEARCH+WINDOW>inputL.length) break;
        var best=limit(center,low,high),bestScore=-Infinity;
        // Decimated mono correlation, normalized to handle volume changes.
        var prevEnergy=1e-8;
        for(var k=0;k<HOP;k+=8){
          prevEnergy+=prevL[k]*prevL[k]+prevR[k]*prevR[k];
        }
        if(prevEnergy > 0.00005) {
          for(var offset=low;offset<=high;offset+=2){
            var dot=0,energy=1e-8;
            for(var j=0;j<HOP;j+=8) {
              var currentL=inputL[offset+j],currentR=inputR[offset+j];
              dot+=currentL*prevL[j]+currentR*prevR[j];
              energy+=currentL*currentL+currentR*currentR;
            }
            var score=dot/Math.sqrt(energy*prevEnergy);
            // Prefer similarity but discourage unrelated / distant grain shifts.
            score-=0.015*Math.abs(offset-center)/SEARCH;
            if(score>bestScore){bestScore=score;best=offset;}
          }
        }
        var newL=new Float32Array(HOP),newR=new Float32Array(HOP);
        for(var i=0;i<HOP;++i) {
          // Smooth raised-cosine blend: zero slope at both boundaries.
          var alpha=0.5-0.5*Math.cos(Math.PI*i/(HOP-1));
          newL[i]=prevL[i]*(1-alpha)+inputL[best+i]*alpha;
          newR[i]=prevR[i]*(1-alpha)+inputR[best+i]*alpha;
        }
        outputL.push(newL);outputR.push(newR);
        prevL=inputL.slice(best+HOP,best+WINDOW);
        prevR=inputR.slice(best+HOP,best+WINDOW);
        position+=HOP/ratio;
        if(position>4096) {
          var drop=Math.max(0,Math.floor(position)-WINDOW);
          inputL=inputL.slice(drop);inputR=inputR.slice(drop);position-=drop;
        }
      }
      var count=outputL.length*HOP;
      if(!count) return null;
      var left=new Float32Array(count),right=new Float32Array(count);
      for(var i=0;i<outputL.length;++i){
        left.set(outputL[i],i*HOP);right.set(outputR[i],i*HOP);
      }
      framesOut+=count;
      return {left:left,right:right,frames:count};
    }
    return {append:append,drain:drain,reset:reset,stats:function(){
      return {framesIn:framesIn,framesOut:framesOut,inputBuffered:inputL.length,ratio:ratio};
    }};
  }

  function attach(state, module, options) {
    if(!state || !state.context || state._fishWsolaAttached) return false;
    if(!module) throw Error('Module required for shared memory bridge');
    options=options||{};
    var stretch=createProcessor(), ctx=state.context;
    var lastPlaybackRate=1;
    state._fishWsolaAttached=true;
    state.fishStretch=stretch;
    state.fishStretchRatio=1.25;
    state.fishStretchChunks=0;
    state.fishPitchPreserved=true;
    state.playbackRateScale=1;
    state.targetLead=limit(Number(options.targetLead)||0.140,0.100,0.230);

    function scheduleStereo(stereo) {
      var now=ctx.currentTime,lead=state.targetLead,frames=stereo.frames;
      if(!frames) return;
      // If emulator temporarily outruns real time, bound the queue. Dropping
      // output is preferable to accruing seconds of control-to-audio latency.
      if(state.started && state.nextTime-now>0.520) {
        state.bridgeDrops=(state.bridgeDrops||0)+1;
        return;
      }
      var ab=ctx.createBuffer(2,frames,44100);
      ab.copyToChannel(stereo.left,0);
      ab.copyToChannel(stereo.right,1);
      var source=ctx.createBufferSource();
      source.buffer=ab;
      source.playbackRate.value=1.0; // Never alter musical pitch
      source.connect(state.output||ctx.destination);
      var start;
      if(!state.started){
        start=now+lead;
        state.started=true;
      }else if(!state.nextTime || state.nextTime<=now){
        state.underruns=(state.underruns||0)+1;
        start=now+Math.min(lead,0.060);
      }else start=state.nextTime;
      source.start(start);
      state.nextTime=start+frames/44100;
      state.sources.add(source);
      source.onended=function(){state.sources.delete(source);};
      state.fishStretchChunks++;
    }
    state.submitPcm=function(ptr,len) {
      if(ctx.state!=='running'){
        state.started=false;state.nextTime=ctx.currentTime;stretch.reset();
        return;
      }
      var frames=(len/4)|0;if(!frames)return;
      // Externally updated guest VBlank ratio; feedback keeps lead near target.
      var needed=limit(Number(state.fishStretchRatio)||1.25,1,1.85);
      var queued=Math.max(0,(Number(state.nextTime)||0)-ctx.currentTime);
      var correction=limit((state.targetLead-queued)*1.9,-0.30,0.25);
      var target=limit(needed+correction,1,1.90);
      state.fishAppliedStretch=target;
      if(typeof globalThis.growMemViews==='function') globalThis.growMemViews();
      var heap=module.HEAP16 || (typeof HEAP16!=='undefined'?HEAP16:null);
      if(!heap) throw Error('Shared PCM memory unavailable');
      var a=new Float32Array(frames),b=new Float32Array(frames),off=ptr>>1;
      for(var i=0;i<frames;++i){
        a[i]=heap[off+i*2]/32768;
        b[i]=heap[off+i*2+1]/32768;
      }
      if(!state.started && state.fishStretchChunks > 0) stretch.reset();
      stretch.append(a,b);
      var output=stretch.drain(target);
      if(output) scheduleStereo(output);
    };
    state.fishWsolaSubmit=state.submitPcm;
    state.clearFishStretch=function(){
      stretch.reset();state.started=false;state.nextTime=ctx.currentTime;
    };
    return true;
  }
  return {createProcessor:createProcessor,attach:attach};
});
