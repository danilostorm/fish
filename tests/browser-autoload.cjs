const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 const requests={};
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('game-data')) requests[r.url().split('/').pop()]=r.status();});
 try{
  await page.goto('http://127.0.0.1:18872/',{waitUntil:'domcontentloaded'});
  console.log('CHOOSER=',await page.locator('input[type=file]').count());
  console.log('FULLSCREEN=',await page.locator('#fullscreen').count());
  await page.waitForFunction(()=>window.Module&&typeof window.Module.callMain==='function',{timeout:60000});
  await page.waitForTimeout(10000);
  console.log('EARLY_STATUS=',await page.locator('#status').innerText());
  await page.waitForTimeout(48000);
  await page.locator('#canvas').screenshot({path:'/project/private/autoload-frame-58.png'});
  console.log('REQUESTS=',JSON.stringify(requests));
  console.log('STATUS=',await page.locator('#status').innerText());
  console.log('FILE=',await page.locator('#fileStatus').innerText());
  console.log('LOG_TAIL=',(await page.locator('#log').innerText()).slice(-2800));
  console.log('ERRORS=',JSON.stringify(errors));
  if(Object.values(requests).some(code=>code!==200))process.exitCode=1;
  if(!requests['disc.bin'] || !requests['disc.cue'])process.exitCode=2;
  if(!/iniciado/i.test(await page.locator('#status').innerText()))process.exitCode=3;
 } finally {await browser.close();}
})().catch(e=>{console.error('AUTOLOAD TEST FAILED',e.stack);process.exitCode=1});
