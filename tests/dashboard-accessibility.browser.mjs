import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {build} from 'esbuild';

const source=readFileSync('apps/backend/private/dashboard-source.html','utf8');
const embedded=key=>JSON.parse(source.match(new RegExp('<script type="application/json" id="data-'+key+'">([\\s\\S]*?)</script>'))[1]);
test('keyboard dates commit complete values and long export dates fit the header',async t=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const key of ['amos','aog','fak','marshaling'])await t.test(key+' keyboard date entry',async()=>{
   const page=await browser.newPage();await page.route('**/*',r=>r.abort());
   await page.setContent(embedded(key),{waitUntil:'domcontentloaded'});
   const input=page.locator('input[type=date]').first();
   const before=await page.evaluate(()=>state.fromNum);
   const value=await input.getAttribute('min');
   await input.focus();
   await input.evaluate(el=>{el.value='0002-01-01';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
   assert.equal(await page.evaluate(()=>state.fromNum),before,'Partial year changed the filter');
   const chosen=await input.evaluate(el=>new Date((Date.parse(el.min)+Date.parse(el.max))/2).toISOString().slice(0,10));
   await input.fill(chosen);
   assert.equal(await input.inputValue(),chosen);
   assert.equal(await page.evaluate(()=>state.fromNum),before,'Typing committed before Enter');
   await input.press('Enter');
   assert.equal(await input.inputValue(),chosen);
   assert.equal(await page.evaluate(()=>state.fromNum),key==='amos'?Math.floor(Date.parse(chosen+'T00:00:00Z')/86400000):Number(chosen.replaceAll('-','')));
   // Blur/Tab also applies a complete date.
   await input.fill(value);await input.press('Tab');
   assert.equal(await input.inputValue(),value);
   await page.close();
  });
  for(const count of [4,5])await t.test(`AOG export with ${count} stations`,async()=>{
   const bundle=await build({entryPoints:['apps/frontend/src/original/dashboard/presentation-capture.ts'],bundle:true,write:false,format:'iife',globalName:'Presentation',platform:'browser'});
   const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.route('**/*',r=>r.abort());
   await page.setContent(embedded('aog'),{waitUntil:'domcontentloaded'});
   await page.addScriptTag({content:bundle.outputFiles[0].text});
   const result=await page.evaluate(count=>{
    const grid=document.querySelector('.station-cards'),card=grid.querySelector('.station-card').cloneNode(true);
    grid.replaceChildren(...Array.from({length:count},()=>card.cloneNode(true)));
    Presentation.arrangePresentation(document,'aog');
    const panel=grid.closest('.panel').getBoundingClientRect();
    return {columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,fits:[...grid.children].every(c=>c.getBoundingClientRect().bottom<=panel.bottom)};
   },count);
   assert.equal(result.columns,count===4?2:3);assert.equal(result.fits,true);
   mkdirSync('artifacts/date-fixes',{recursive:true});await page.screenshot({path:`artifacts/date-fixes/aog-${count}-stations.png`});await page.close();
  });
  for(const key of ['amos','aog','fak','marshaling'])await t.test(key+' single-line export date',async()=>{
   const bundle=await build({entryPoints:['apps/frontend/src/original/dashboard/presentation-capture.ts'],bundle:true,write:false,format:'iife',globalName:'Presentation',platform:'browser'});
   const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.route('**/*',r=>r.abort());
   await page.setContent(embedded(key),{waitUntil:'domcontentloaded'});
   await page.addScriptTag({content:bundle.outputFiles[0].text});
   const result=await page.evaluate(key=>{
    document.querySelector('#scope-badge').textContent='September 1, 2026 – December 31, 2026 · All stores · All shifts';
    Presentation.arrangePresentation(document,key);
    const badge=document.querySelector('#scope-badge'),head=document.querySelector('.story-head,.topbar');
    const b=badge.getBoundingClientRect(),h=head.getBoundingClientRect();
    const range=document.createRange();range.selectNodeContents(badge);
    return {singleLine:range.getClientRects().length===1,width:b.width,fontSize:parseFloat(getComputedStyle(badge).fontSize),fits:badge.scrollHeight<=badge.clientHeight&&badge.scrollWidth<=badge.clientWidth,inside:b.top>=h.top&&b.bottom<=h.bottom&&b.right<=h.right};
   },key);
   assert.equal(result.singleLine,true);assert.ok(result.width>=640);assert.ok(result.fontSize>=18);assert.equal(result.fits,true);assert.equal(result.inside,true);
   mkdirSync('artifacts/date-fixes',{recursive:true});await page.screenshot({path:`artifacts/date-fixes/${key}-single-line-header.png`});await page.close();
  });
 }finally{await browser.close();}
});
