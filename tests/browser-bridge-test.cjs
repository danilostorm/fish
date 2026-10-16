const {chromium}=require('playwright');
const crypto=require('crypto');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1180,height:860}});
const errs=[];
page.on('pageerror',e=>errs.push(e.message));
try{
 await page.goto('http://127.0.0.1:18873/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.Module&&typeof window.Module.callMain==='function',{timeout:60000});
 await page.waitForTimeout(16000);
 console.log('EXPORTED=',await page.evaluate(()=>({set:typeof Module._psx_web_set_pad_buttons,get:typeof Module._psx_web_get_pad_buttons,perf:typeof Module._psx_web_perf_vblanks})));
 await page.locator('#enableAudio').click();
 const fpsA=await page.evaluate(()=>typeof Module._psx_web_perf_vblanks==='function'?Module._psx_web_perf_vblanks():-1);
 await page.waitForTimeout(38000);
 const fpsB=await page.evaluate(()=>typeof Module._psx_web_perf_vblanks==='function'?Module._psx_web_perf_vblanks():-1);
 console.log('VBLANKS_38_SEC=',fpsB-fpsA,'RATIO=',((fpsB-fpsA)/38).toFixed(2));
 const snap=async(name)=>{const b=await page.locator('#canvas').screenshot({path:'/project/private/'+name+'.png'});console.log('IMAGE',name,crypto.createHash('sha1').update(b).digest('hex').slice(0,16));};
 await snap('bridge-before');
 await page.locator('#canvas').focus();
 await page.keyboard.down('Enter');
 await page.waitForTimeout(2900);
 console.log('PAD_START_HELD=',await page.evaluate(()=>typeof Module._psx_web_get_pad_buttons==='function'?Module._psx_web_get_pad_buttons().toString(16):'unavailable'));
 await snap('bridge-start-held');
 await page.keyboard.up('Enter');
 await page.waitForTimeout(6500);
 console.log('PAD_START_UP=',await page.evaluate(()=>typeof Module._psx_web_get_pad_buttons==='function'?Module._psx_web_get_pad_buttons().toString(16):'unavailable'));
 await snap('bridge-after-start');
 await page.keyboard.down('x');
 await page.waitForTimeout(2900);
 console.log('PAD_X_HELD=',await page.evaluate(()=>typeof Module._psx_web_get_pad_buttons==='function'?Module._psx_web_get_pad_buttons().toString(16):'unavailable'));
 await snap('bridge-after-cross');
 await page.keyboard.up('x');
 console.log('STATUS=',await page.locator('#status').innerText());
 console.log('AUDIO=',await page.evaluate(()=>({state:Module.psxWebAudio?.context?.state,started:Module.psxWebAudio?.started,underruns:Module.psxWebAudio?.underruns})));
 console.log('LOG_TAIL=',(await page.locator('#log').innerText()).slice(-2000));
 console.log('ERRORS=',errs);
}finally{await browser.close();}
})().catch(e=>{console.error('BRIDGE TEST ERROR',e.stack);process.exitCode=1});
