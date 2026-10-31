import {_electron as electron} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';

const run=resolve('artifacts','desktop smoke '+Date.now());
const data=join(run,'AviationInsight-data');
await mkdir(run,{recursive:true});
let desktop,origin;
const environment={...process.env,AVIATION_SKIP_SOURCE_IMPORT:"1",AVIATION_DATA_DIR:data};
delete environment.ELECTRON_RUN_AS_NODE;
async function launch(){
 desktop=await electron.launch({executablePath:resolve('dist/portable/AviationInsight.exe'),env:environment,timeout:120000});
 const page=await desktop.firstWindow();
 await page.waitForURL(/\/login\?admin=1$/,{timeout:120000});
 origin=new URL(page.url()).origin;
 return page;
}
try{
 let page=await launch();
 const settings=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
 assert.equal(settings.nodeIntegration,false);assert.equal(settings.contextIsolation,true);assert.equal(settings.sandbox,true);
 assert.match(await page.title(),/^Aviation Insight/);
 assert.equal(await page.getByRole('button',{name:'Install app',exact:true}).count(),0);
 const login=await readFile(join(data,'First-run-login.txt'),'utf8');
 const password=login.match(/Password: (.+)/)[1].trim();
 await page.getByLabel('Admin username').fill('admin');
 await page.getByLabel('Admin password').fill(password);
 await page.getByRole('button',{name:'Enter Platform'}).click();
 await page.waitForURL(/\/portal/);
 assert.equal(await page.getByRole('button',{name:'Install app',exact:true}).count(),0);
 await page.goto(origin+'/admin');
 await page.getByRole('heading',{name:'Manual Excel update'}).waitFor();
 await page.screenshot({path:join(run,'desktop.png')});
 await page.evaluate(()=>window.open('https://example.com'));
 assert.equal(desktop.windows().length,1,'Unexpected popup window');
 await page.goto(origin+'/dashboard?tab=marshaling&intro=1');
 await page.locator('iframe.dashboard-frame').waitFor();
 assert.equal(await page.getByRole('link',{name:'Open full screen'}).count(),0);
 // A new installation shows its embedded baseline before any workbook upload.
 // The runtime smoke test separately checks the data-ready signal after upload.
 await page.waitForFunction(()=>document.querySelector('iframe.dashboard-frame')?.contentDocument?.querySelector('iframe.active')?.contentDocument?.querySelector('.main'),{},{timeout:30000});
 await page.screenshot({path:join(run,'dashboard.png')});
 const serverOrigin=origin;
 await page.close();
 await new Promise(resolve=>setTimeout(resolve,1500));
 let stopped=false;
 try{await fetch(serverOrigin+'/health/ready',{signal:AbortSignal.timeout(3000)});}catch{stopped=true;}
 assert.ok(stopped,'Closing the desktop window left its server running');
 await desktop.close().catch(()=>{});desktop=null;
 page=await launch();
 assert.equal(await readFile(join(data,'First-run-login.txt'),'utf8'),login,'Existing administrator details changed');
 await page.getByLabel('Admin username').fill('admin');
 await page.getByLabel('Admin password').fill(password);
 await page.getByRole('button',{name:'Enter Platform'}).click();
 await page.waitForURL(/\/portal/);
 console.log('PASS: Electron app opens its own window, signs in, renders dashboards, blocks popups, preserves accounts after restart, and stops its server when closed.');
 console.log('Verification files: '+run);
}catch(error){
 if(desktop){
  const pages=desktop.windows();
  if(pages.length){
   await pages[0].screenshot({path:join(run,'failure.png')}).catch(()=>{});
   console.error(await pages[0].evaluate(()=>({url:location.href,frames:[...document.querySelectorAll('iframe')].map(f=>({src:f.src,html:f.contentDocument?.body?.innerText?.slice(0,500),frames:[...f.contentDocument?.querySelectorAll('iframe')||[]].map(i=>({className:i.className,status:i.contentWindow?.__aviationSyncStatus}))}))})).catch(()=>({})));
  }
 }
 throw error;
}finally{if(desktop)await desktop.close();}
