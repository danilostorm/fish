'use strict';
const assert=require('assert');
const {createProcessor}=require('../web/audio-wsola.js');
function testTone(rate,hz=440,stereoHz=440) {
  const total=44100*2,processor=createProcessor(),results=[];
  let off=0;
  while(off<total){
    const size=Math.min(1470,total-off),left=new Float32Array(size),right=new Float32Array(size);
    for(let i=0;i<size;i++){
      left[i]=Math.sin(2*Math.PI*hz*(off+i)/44100)*0.5;
      right[i]=Math.sin(2*Math.PI*stereoHz*(off+i)/44100)*0.5;
    }
    processor.append(left,right);
    const out=processor.drain(rate);if(out)results.push(out);
    off+=size;
  }
  const frames=results.reduce((a,v)=>a+v.frames,0);
  let output=new Float32Array(frames),index=0;
  for(let r of results){output.set(r.left,index);index+=r.frames;}
  const lower=Math.floor(output.length*0.2),upper=Math.floor(output.length*0.8);
  let up=0;
  for(let i=lower+1;i<upper;i++)if(output[i-1]<0&&output[i]>=0)up++;
  const measured=up*44100/(upper-lower);
  assert.ok(Math.abs(measured-hz)<(stereoHz===hz?3:10),'Pitch drift '+measured+' at rate '+rate);
  assert.ok(Math.abs(frames/total-rate)<0.025,'Stretch ratio '+(frames/total)+' instead of '+rate);
  return {rate,renderedSeconds:frames/44100,pitchHz:measured};
}
for(const rate of [1,1.18,1.33,1.5]) console.log(testTone(rate));
console.log("Different stereo components:",testTone(1.33,440,220));
console.log('Pitch-preserving WSOLA PCM unit tests passed');
