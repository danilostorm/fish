const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto('http://127.0.0.1:18873/',{waitUntil:'domcontentloaded'});
  await page.locator('#playButton').click();
  console.log('OVERLAY_VISIBLE=',await page.locator('#gameOverlay').isVisible());
  await page.waitForFunction(()=>window.Module && typeof window.Module.callMain==='function',{timeout:90000});
  await page.waitForTimeout(53000);
  console.log('STATUS_53=',await page.locator('#status').textContent());
  console.log('BRIDGE=',await page.evaluate(()=>typeof Module._psx_web_set_pad_buttons));
  const before=await page.locator((await page.evaluate(()=>window.Module?.fishWebPresenter?.draws>0))?'#fishFastCanvas':'#canvas').screenshot({path:'/project/private/launcher-game-title.png'});
  await page.locator('#canvas').focus();
  await page.keyboard.down('Enter');await page.waitForTimeout(2000);await page.keyboard.up('Enter');await page.waitForTimeout(3800);
  await page.locator((await page.evaluate(()=>window.Module?.fishWebPresenter?.draws>0))?'#fishFastCanvas':'#canvas').screenshot({path:'/project/private/launcher-game-menu.png'});
  await page.keyboard.down('x');await page.waitForTimeout(1800);await page.keyboard.up('x');await page.waitForTimeout(3600);
  await page.locator((await page.evaluate(()=>window.Module?.fishWebPresenter?.draws>0))?'#fishFastCanvas':'#canvas').screenshot({path:'/project/private/launcher-game-mode.png'});
  console.log('PAD=',await page.evaluate(()=>typeof Module._psx_web_get_pad_buttons==='function' ? Module._psx_web_get_pad_buttons().toString(16):'none'));
  console.log('PERF=',await page.locator('#perfState').textContent());
  console.log('ERRORS_BEFORE_HIDE=',errors);
  await page.locator('#closeGame').click();
  await page.waitForTimeout(3000);
  console.log('HIDDEN=',await page.locator('#gameOverlay').isHidden());
  console.log('ERRORS_AFTER_HIDE=',errors);
  if(errors.length)process.exitCode=2;
 } finally {await browser.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
