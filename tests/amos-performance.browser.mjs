import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {build} from 'esbuild';

test('AMOS thresholds and readable store headers match on screen and export',async()=>{
 const source=readFileSync('apps/backend/private/dashboard-source.html','utf8');
 const html=JSON.parse(source.match(/<script type="application\/json" id="data-amos">([\s\S]*?)<\/script>/)[1]);
 const bundle=await build({entryPoints:['apps/frontend/src/original/dashboard/presentation-capture.ts'],bundle:true,write:false,format:'iife',globalName:'Presentation',platform:'browser'});
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.route('**/*',r=>r.abort());await page.setContent(html,{waitUntil:'domcontentloaded'});
  const cases=[['aog',95,'pill-good'],['aog',94.99,'pill-warn'],['aog',90,'pill-warn'],['aog',89.99,'pill-bad'],['normal',90,'pill-good'],['normal',89.99,'pill-warn'],['normal',80,'pill-warn'],['normal',79.99,'pill-bad']];
  for(const [priority,pct,want] of cases)assert.equal(await page.evaluate(([p,n])=>pillClass(n,p),[priority,pct]),want);
  // Render actual records at the inclusive green/yellow boundaries.
  await page.evaluate(()=>{
   const records=[];
   for(const [prio,on] of [[1,95],[0,80]])for(let i=0;i<100;i++)records.push({store:0,shift:0,hour:0,prio,ontime:i<on?1:0});
   getFiltered=()=>records;render();
  });
  const verify=async()=>{
   assert.equal(await page.locator('#tbl-store tr').first().locator('td').nth(4).locator('.pill').getAttribute('class'),'pill pill-warn');
   assert.equal(await page.locator('#tbl-store tr').first().locator('td').nth(5).locator('.pill').getAttribute('class'),'pill pill-good');
   assert.equal(await page.locator('.store-story th').first().evaluate(e=>getComputedStyle(e).color),'rgb(89, 54, 63)');
   assert.equal(await page.locator('#kpi-normalpct').evaluate(e=>getComputedStyle(e).color),'rgb(214, 138, 31)');
  };
  await verify();
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>Presentation.arrangePresentation(document,'amos'));
  await verify();
 }finally{await browser.close();}
});
