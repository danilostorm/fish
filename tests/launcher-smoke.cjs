const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[];
 const page=await browser.newPage({viewport:{width:1536,height:950},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400 && !r.url().includes('favicon')) console.log('HTTP_ERROR',r.status(),r.url().slice(-100))});
 try{
 await page.goto('http://127.0.0.1:18873/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(6000);
 await page.screenshot({path:'/project/private/launcher-desktop.png',fullPage:true});
 console.log('UI_DESKTOP',await page.evaluate(()=>({title:document.title,hero:!!document.querySelector('.hero'),modes:document.querySelectorAll('.mode').length,gameHidden:document.getElementById('gameOverlay').hidden,sw:document.documentElement.scrollWidth,width:innerWidth,images:Array.from(document.images).map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0}))})));
 await page.locator('[data-control-tab=gamepad]').click();
 console.log('TAB_GAMEPAD',await page.locator('#gamepadKeys').isVisible());
 await page.locator('[data-control-tab=keyboard]').click();
 await page.locator('#viewGallery').click();
 console.log('GALLERY',await page.locator('#galleryMain').getAttribute('src'));
 await page.locator('#settingsBtn').click();console.log('SETTINGS',await page.locator('#optionsModal').isVisible());
 await page.locator('#closeOptions').click();
 await page.locator('#playButton').click(); console.log('PLAYER_OPEN',await page.locator('#gameOverlay').isVisible());
 await page.locator('#closeGame').click();console.log('PLAYER_CLOSED',await page.locator('#gameOverlay').isHidden());
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto('http://127.0.0.1:18873/',{waitUntil:'domcontentloaded'});
 await mobile.waitForTimeout(1800);
 await mobile.screenshot({path:'/project/private/launcher-mobile.png',fullPage:true});
 console.log('MOBILE',await mobile.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,gridColumns:getComputedStyle(document.querySelector('.mode-grid')).gridTemplateColumns})));
 await mobile.close();
 console.log('JS_ERRORS',JSON.stringify(errors));if(errors.length)process.exitCode=2;
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.stack);process.exitCode=1});
