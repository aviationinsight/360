import {cp,mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const run=resolve('artifacts','portable smoke '+Date.now());await mkdir(run,{recursive:true});
const stage=process.argv[2]?resolve(process.argv[2]):null;
const executable=stage?join(stage,'node.exe'):join(run,'AviationInsight.exe');if(!stage)await cp(resolve('dist/portable/AviationInsight.exe'),executable);
const data=join(run,'AviationInsight-data');
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`;
let child,logs='';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){
 child=spawn(executable,stage?[join(stage,'bootstrap.mjs')]:[],{cwd:run,windowsHide:true,env:{...process.env,AVIATION_SKIP_SOURCE_IMPORT:"1",AVIATION_DATA_DIR:data,AVIATION_PORT:String(port),AVIATION_NO_BROWSER:'1',AVIATION_NO_PAUSE:'1'},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<600;i++){
  if(child.exitCode!==null)throw new Error('EXE failed to start:\n'+logs);
  try{if((await fetch(origin+'/health/ready')).ok)return;}catch{}
  await delay(500);
 }
 throw new Error('EXE startup timed out:\n'+logs);
}
async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;await delay(1000);}}
async function login(){
 const credentials=await readFile(join(data,'First-run-login.txt'),'utf8');
 const password=credentials.match(/Password: (.+)/)[1].trim();
 const response=await fetch(origin+'/api/admin-login',{method:'POST',redirect:'manual',headers:{origin},body:new URLSearchParams({username:'admin',password})});
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/portal?welcome=1');
 const cookies=response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.ok(cookies);return cookies;
}
try{
 await start();
 const root=await fetch(origin);assert.equal(root.status,200);assert.match(await root.text(),/Aviation Insight/);
 assert.match(root.headers.get('content-security-policy'),/connect-src 'self'/);
 assert.equal((await fetch(origin+'/api/admin/dashboard-data')).status,403);
 let cookie=await login();
 assert.equal((await(await fetch(origin+'/api/me',{headers:{cookie}})).json()).role,'admin');
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
 zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/></sheets></workbook>');
 zip.file('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
 const row=(cells,n)=>`<row r="${n}">${cells.map((v,i)=>`<c r="${String.fromCharCode(65+i)}${n}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`;
 zip.file('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:D2"/><sheetData>'+row(['New Date','Source','Type','Old Shift'],1)+row(['2026-10-31','601','Serviceable','DAY'],2)+'</sheetData></worksheet>');
 zip.file('xl/vbaProject.bin',new Uint8Array([1,2,3,4]));
 const bytes=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
 const form=new FormData();form.set('dashboard','marshaling');form.set('file',new File([bytes],'Portable-smoke.xlsm'));
 const upload=await fetch(origin+'/api/admin/dashboard-data',{method:'POST',headers:{origin,cookie},body:form});
 assert.equal(upload.status,200);assert.equal((await upload.json()).dates,1);
 assert.equal((await fetch(origin+'/api/admin/dashboard-data',{method:'POST',headers:{origin:'https://invalid.example',cookie},body:form})).status,403);
 const headers={cookie};const file=await fetch(origin+'/api/dashboard-sync/marshaling/file',{headers});assert.deepEqual(await file.arrayBuffer(),bytes);
 await stop();await start();cookie=await login();
 const sources=await(await fetch(origin+'/api/admin/dashboard-data',{headers:{cookie}})).json();assert.equal(sources.dashboards.marshaling.fileName,'Portable-smoke.xlsm');
 // Check the local UI using the development test browser.
 const runtimeRoot=join(data,'runtime');const runtime=stage||join(runtimeRoot,(await readdir(runtimeRoot))[0]);
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();
  await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:origin};}));
  const page=await context.newPage();const pageErrors=[],external=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('**/*',route=>{if(!route.request().url().startsWith(origin+'/')&&!/^(data:|blob:)/.test(route.request().url())){external.push(route.request().url());return route.abort();}return route.continue();});
  await page.goto(origin+'/admin',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Manual Excel update'}).waitFor();
  await page.goto(origin+'/dashboard?tab=marshaling',{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('iframe.dashboard-frame').waitFor();
  await page.waitForFunction(()=>document.querySelector('iframe.dashboard-frame')?.contentDocument?.querySelector('iframe.active')?.contentWindow?.__aviationSyncStatus==='ready',{},{timeout:120000});
  await page.screenshot({path:join(run,'dashboard.png'),fullPage:true});
  assert.deepEqual(external,[],'Browser attempted external requests');assert.deepEqual(pageErrors,[],'Browser reported script errors');
 }finally{await browser.close();}
 console.log('PASS: portable EXE starts from a folder with spaces, serves local UI, signs in, accepts Marshaling Excel, preserves data after restart, and renders without external requests.');
 console.log('Verification files: '+run);
}catch(error){console.error(logs);throw error;}finally{await stop();}
