import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const source=fs.readFileSync(new URL('../apps/backend/private/dashboard-source.html',import.meta.url),'utf8');
const embedded=key=>JSON.parse(source.match(new RegExp('<script type="application/json" id="data-'+key+'">([\\s\\S]*?)</script>'))[1]);

test('dashboard dates, totals and batched redraws',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
 try{
  for(const key of ['amos','aog','fak','marshaling'])await t.test(key,async()=>{
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>route.abort());
   await page.setContent(embedded(key),{waitUntil:'domcontentloaded'});
   const result=await page.evaluate(async key=>{
    const getDate=r=>key==='amos'?rowDateNum(r):r.datenum;
    const getBounds=()=>{ensureDateIndex();return[indexedDates[0],indexedDates.at(-1)]};
    const dateFields=()=>[...document.querySelectorAll('input[type=date]')].map(el=>el.value);
    const expected=()=>rows.filter(r=>getDate(r)>=state.fromNum&&getDate(r)<=state.toNum&&(key!=='amos'||((state.store==='all'||r.store===+state.store)&&(state.shift==='all'||r.shift===+state.shift))));
    const initialLatest=getBounds()[1],initial={latest:state.fromNum===getBounds()[0]&&state.toNum===initialLatest,count:getFiltered().length,expected:expected().length,fields:dateFields()};
    // A new workbook with the same row count must invalidate the date index.
    const original=rows;const newest=rows.find(r=>getDate(r)===initialLatest);const tomorrow=key==='amos'?{...newest,day:newest.day+1}:{...newest,datenum:dateToNum(new Date(numToDate(newest.datenum).getTime()+86400000))};
    rows=[...rows.slice(1),tomorrow];if(key==='amos')refreshDateDomain(true);else resetDateRange();
    const refreshedLatest=state.fromNum===getBounds()[0]&&state.toNum===getDate(tomorrow)&&getFiltered().includes(tomorrow);
    rows=original;if(key==='amos')refreshDateDomain(true);else resetDateRange();
    let renders=0;const realRender=render;render=()=>{renders++;realRender()};
    const started=performance.now();for(let i=0;i<30;i++){if(key==='amos'){rangeFrom.value=i%2;applyRange('from')}else{rFrom.value=i%2;syncFromSlider()}}
    if(key==='amos'){rangeFrom.value=0;applyRange('from')}else{rFrom.value=0;syncFromSlider()}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const changeMs=performance.now()-started,matching=getFiltered().length===expected().length;
    const chosen=[state.fromNum,state.toNum];rows=[...rows,tomorrow];if(key==='amos')refreshDateDomain(true);else resetDateRange();
    const preserved=state.fromNum===chosen[0]&&state.toNum===chosen[1];
    let aggregates=true;
    if(key==='amos'){
     const data=getFiltered(),summary=summarizeAmos(data);aggregates=summary.aog===data.filter(r=>r.prio===1).length&&summary.aogOn===data.filter(r=>r.prio===1&&r.ontime===1).length&&summary.normalOn===data.filter(r=>r.prio===0&&r.ontime===1).length;
     for(const [store,s] of summary.stores){const rs=data.filter(r=>r.store===store);aggregates&&=s.total===rs.length&&s.aOn===rs.filter(r=>r.prio===1&&r.ontime===1).length&&s.nOn===rs.filter(r=>r.prio===0&&r.ontime===1).length}
     for(const p of [0,1])for(const on of [0,1])for(let hour=0;hour<24;hour++)aggregates&&=summary.hours[p][on][hour]===data.filter(r=>r.prio===p&&r.ontime===on&&r.hour===hour).length;
     for(const [shift,counts] of summary.shifts)for(const p of [0,1])for(const on of [0,1])aggregates&&=counts[p][on]===data.filter(r=>r.shift===shift&&r.prio===p&&r.ontime===on).length;
     state.store=String(data[0].store);state.shift=String(data[0].shift);aggregates&&=getFiltered().length===expected().length;
    }
    return{initial,refreshedLatest,matching,preserved,renders,aggregates,changeMs};
   },key);
   assert.equal(result.initial.latest,true);assert.equal(result.initial.count,result.initial.expected);assert.ok(result.initial.fields[0]<=result.initial.fields[1]);
   assert.equal(result.refreshedLatest,true);assert.equal(result.matching,true);assert.equal(result.preserved,true);assert.equal(result.renders,1);assert.equal(result.aggregates,true);assert.deepEqual(errors,[]);
   t.diagnostic(key+': 31 slider events coalesced into one render in '+result.changeMs.toFixed(1)+' ms');await page.close();
  });
  await t.test('saved category filters do not override the full date range',async()=>{
   const page=await browser.newPage();await page.route('http://dashboard.test/**',route=>route.request().url().includes('/metadata')?route.fulfill({status:503}):route.fulfill({contentType:'text/html',body:source}));await page.route(url=>url.protocol==='https:',route=>route.abort());
   await page.goto('http://dashboard.test/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>frames.amos?.contentWindow?.__aviationSyncStatus==='error');
   assert.match(await page.evaluate(()=>frames.amos.contentDocument.getElementById('workbook-status').textContent),/Showing saved snapshot/);assert.equal(await page.evaluate(()=>[...frames.amos.contentDocument.querySelectorAll('.sidebar select,.sidebar button.filter-select')].every(el=>!el.disabled)),true);
   assert.equal(await page.evaluate(()=>frames.amos.contentDocument.querySelectorAll('.chart-is-loading,.chart-skeleton').length),0);
   const result=await page.evaluate(async()=>{
    const frame=frames.amos;await new Promise(resolve=>{if(frame.contentDocument.readyState==='complete')resolve();else frame.addEventListener('load',resolve,{once:true})});
    const w=frame.contentWindow,d=w.document,from=d.getElementById('f-date-from'),to=d.getElementById('f-date-to'),latest=from.max,earliest=from.min;
    localStorage.setItem('sal-dashboard-filters-amos',JSON.stringify({'f-date-from':from.min,'f-date-to':to.min,'f-range-from':'0','f-range-to':'0','f-store':'0','f-remarks':'remark:obsolete'}));
    w.restoreDashboardFilters();await new Promise(resolve=>w.requestAnimationFrame(()=>w.requestAnimationFrame(resolve)));
    return{from:from.value,to:to.value,latest,earliest,store:d.getElementById('f-store').value,remarks:d.getElementById('f-remarks').value};
   });
   assert.equal(result.from,result.earliest);assert.equal(result.to,result.latest);assert.equal(result.store,'0');assert.equal(result.remarks,'all');await page.close();
  });
  await t.test('automatic sync follows newer data and skips unchanged workbooks',async()=>{
   const fixture=await browser.newPage();await fixture.route('**/*',route=>route.abort());await fixture.setContent(embedded('amos'),{waitUntil:'domcontentloaded'});
   const workbooks=await fixture.evaluate(()=>[16,17].map(day=>{
    const book=XLSX.utils.book_new();const grid=[['YearID','MonthID','Month Name','Day ID','Shift Time','Store','Prio','Flag','Shift Name','Picking List','Time Taken in min'],[2026,10,'Oct',day,'08:00','900','AOG','on time','1 - Day Shift',1001,12]];
    grid.push([2026,10,'Oct',day-1,'09:00','900','Normal','on time','1 - Day Shift',1002,10]);XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Cover sheet']]),'Overview');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(grid),'AMOS File');return Array.from(new Uint8Array(XLSX.write(book,{type:'array',bookType:'xlsx'})));
   }));await fixture.close();
   let version=0,fileRequests=0,releaseDownload;const initialDownload=new Promise(resolve=>releaseDownload=resolve);const page=await browser.newPage();
   await page.route(url=>url.protocol==='https:',route=>route.abort());
   await page.route('http://sync.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/metadata'))return route.fulfill({json:{metadata:{updatedAt:version?'2026-10-17T08:00:00Z':'2026-10-16T08:00:00Z'}}});
    if(url.pathname.endsWith('/file')){fileRequests++;if(version===0)await initialDownload;return route.fulfill({contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:Buffer.from(workbooks[version])})}
    if(url.pathname.endsWith('/client-event'))return route.fulfill({status:204});
    return route.fulfill({contentType:'text/html',body:source});
   });
   await page.goto('http://sync.test/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>frames.amos?.contentWindow?.__aviationSyncStatus==='loading');
   const loading=await page.evaluate(()=>[...frames.amos.contentDocument.querySelectorAll('input[type=date]')].every(el=>el.disabled&&el.value===''));assert.equal(loading,true);assert.equal(await page.evaluate(()=>[...frames.amos.contentDocument.querySelectorAll('.sidebar select,.sidebar button.filter-select')].every(el=>el.disabled)),true);
   const skeletons=await page.evaluate(()=>[...frames.amos.contentDocument.querySelectorAll('.chart-is-loading')].map(el=>({busy:el.getAttribute('aria-busy'),inert:el.inert,skeleton:!!el.querySelector(':scope>.chart-skeleton')})));assert.ok(skeletons.length>=8);assert.ok(skeletons.every(el=>el.busy==='true'&&el.inert&&el.skeleton));releaseDownload();
   await page.waitForFunction(()=>frames.amos?.contentWindow?.__aviationSyncStatus==='ready');
   const dates=()=>page.evaluate(()=>[...frames.amos.contentDocument.querySelectorAll('input[type=date]')].map(el=>el.value));
   assert.match(await page.evaluate(()=>frames.amos.contentDocument.getElementById('workbook-status').textContent),/Latest data: 2026-10-16/);
   assert.deepEqual(await dates(),['2026-10-15','2026-10-16']);assert.equal(fileRequests,1);assert.equal(await page.evaluate(()=>[...frames.amos.contentDocument.querySelectorAll('.sidebar select,.sidebar button.filter-select')].every(el=>!el.disabled)),true);
   assert.equal(await page.evaluate(()=>frames.amos.contentDocument.querySelectorAll('.chart-is-loading,.chart-skeleton').length),0);
   const confirmation=await page.evaluate(async()=>{const w=frames.amos.contentWindow;let confirmed=false;w.addEventListener('aviation:data-updated',event=>{confirmed=event.detail.unchanged===true},{once:true});await w.refreshAmosData();return confirmed});assert.equal(confirmation,true);assert.equal(fileRequests,1);
   version=1;await page.evaluate(()=>frames.amos.contentWindow.refreshAmosData());
   assert.deepEqual(await dates(),['2026-10-16','2026-10-17']);assert.equal(fileRequests,2);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
   const count=()=>page.evaluate(()=>frames.amos.contentDocument.getElementById('kpi-total').textContent);
   await page.evaluate(()=>frames.amos.contentWindow.eval("rangeFrom.value=0;applyRange('from')"));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await count(),'2');
   await new Promise(resolve=>setTimeout(resolve,1100));assert.equal(await count(),'2');await page.close();
  });
  await t.test('AMOS Remarks combines with other filters and survives saved HTML',async()=>{
   const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent(embedded('amos'),{waitUntil:'domcontentloaded'});
   const result=await page.evaluate(async()=>{
    const header=['YearID','MonthID','Month Name','Day ID','Shift Time','Store','Prio','Flag','Shift Name','Picking List','Time Taken in min','Remarks'];
    const special='Repair, urgent; </script><b>check</b>';
    rows=[];mergeNewData([header,[2026,10,'Oct',11,.5,'A','AOG','on time','Day',1001,10,special],[2026,10,'Oct',12,.5,'B','Normal','on time','Night',1002,10,'Routine'],[2026,10,'Oct',12,.5,'A','AOG','on time','Day',1003,10,special],[2026,10,'Oct',12,.5,'A','AOG','on time','Day',1004,10,null]]);
    const options=remarkChoices.map(o=>o.label);state.remark='remark:'+special;renderRemarkOptions();remarkSel.value=state.remark;remarkSel.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const selected=getFiltered().length,kpi=document.getElementById('kpi-total').textContent;
    state.fromNum=state.toNum=dateDomain.at(-1);state.store=String(STORE_NAMES.indexOf('A'));state.shift=String(SHIFT_NAMES.indexOf('Day'));const combined=getFiltered().length;
    state.remark='remark:';const blanks=getFiltered().length;state.remark='all';const all=getFiltered().length;
    return{options,selected,kpi,combined,blanks,all,html:buildUpdatedHtml()};
   });
   assert.ok(result.options.includes('(Blank)'));assert.ok(result.options.includes('Routine'));assert.ok(result.options.includes('Repair, urgent; </script><b>check</b>'));assert.equal(result.selected,2);assert.equal(result.kpi,'2');assert.equal(result.combined,1);assert.equal(result.blanks,1);assert.equal(result.all,2);
   const restored=await browser.newPage();const errors=[];restored.on('pageerror',e=>errors.push(e.message));await restored.route('**/*',route=>route.abort());await restored.setContent(result.html,{waitUntil:'domcontentloaded'});
   assert.equal(await restored.evaluate(()=>{state.remark='remark:Repair, urgent; </script><b>check</b>';return getFiltered().length}),2);assert.deepEqual(errors,[]);
   const search=await restored.evaluate(()=>{remarkChoices=Array.from({length:1500},(_,i)=>({value:'remark:Item '+i,label:'Item '+i,search:'item '+i}));state.remark='all';renderRemarkOptions();const bounded=remarksPopup.querySelectorAll('#remarks-options input').length<=100;const input=document.getElementById('f-remarks-search');input.value='Item 1499';input.dispatchEvent(new Event('input',{bubbles:true}));return{bounded,found:remarksPopup.querySelector('#remarks-options').textContent.includes('Item 1499'),count:remarksPopup.querySelectorAll('#remarks-options input').length}});assert.deepEqual(search,{bounded:true,found:true,count:1});await restored.close();await page.close();
  });
  await t.test('Remarks dropdown supports internal search, multi-select and Select All',async()=>{
   const page=await browser.newPage({viewport:{width:390,height:844}});await page.route('**/*',route=>route.abort());await page.setContent(embedded('amos'),{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>{rows=[];mergeNewData([['YearID','MonthID','Month Name','Day ID','Shift Time','Store','Prio','Flag','Shift Name','Picking List','Time Taken in min','Remarks'],[2026,10,'Oct',12,.5,'A','AOG','on time','Day',1,10,'Alpha'],[2026,10,'Oct',12,.5,'A','AOG','on time','Day',2,10,'Beta'],[2026,10,'Oct',12,.5,'A','AOG','on time','Day',3,10,null]])});
   await page.locator('#f-remarks-button').click();await page.locator('#remarks-popup').waitFor({state:'visible'});assert.equal(await page.locator('#f-remarks-button').getAttribute('aria-expanded'),'true');
   await page.locator('#remarks-all').uncheck();assert.equal(await page.evaluate(()=>getFiltered().length),0);
   await page.getByRole('searchbox',{name:'Search remarks'}).fill('Alpha');await page.locator('#remarks-options label').filter({hasText:'Alpha'}).locator('input').check();
   await page.getByRole('searchbox',{name:'Search remarks'}).fill('Beta');await page.locator('#remarks-options label').filter({hasText:'Beta'}).locator('input').check();assert.equal(await page.evaluate(()=>getFiltered().length),2);assert.match(await page.locator('#f-remarks-button').textContent(),/2 selected/);
   await page.getByRole('searchbox',{name:'Search remarks'}).fill('');assert.equal(await page.locator('#remarks-all').evaluate(el=>el.indeterminate),true);
   await page.locator('#remarks-all').check();assert.equal(await page.evaluate(()=>getFiltered().length),3);
   const box=await page.locator('#remarks-popup').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844);
   await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.locator('#remarks-popup').isVisible(),false);await page.close();
  });
  await t.test('Remarks virtual list exposes all 15,128 matches with bounded DOM rows',async()=>{
   const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent(embedded('amos'),{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>{remarkChoices=Array.from({length:15128},(_,i)=>({value:'remark:RUH '+i,label:'RUH '+i,search:'ruh '+i}));state.remark=JSON.stringify({include:[]});renderRemarkOptions()});
   await page.locator('#f-remarks-button').click();await page.getByRole('searchbox',{name:'Search remarks'}).fill('ruh');await page.locator('#remarks-all').check();
   assert.equal(await page.locator('#f-remarks-button').textContent(),'All');assert.equal(await page.evaluate(()=>remarkSelection().values.size),15128);assert.ok(await page.locator('#remarks-options input:checked').count()<30);
   await page.locator('#remarks-options [role=list]').evaluate(el=>el.scrollTop=el.scrollHeight);await page.locator('#remarks-options label').filter({hasText:'RUH 15127'}).waitFor();await page.locator('#remarks-options label').filter({hasText:'RUH 15127'}).locator('input').uncheck();assert.equal(await page.evaluate(()=>remarkSelection().values.size),15127);assert.ok(await page.locator('#remarks-options input').count()<30);
   await page.locator('#remarks-all').check();await page.locator('#remarks-all').uncheck();assert.equal(await page.locator('#f-remarks-button').textContent(),'None selected');await page.close();
  });
 }finally{await browser.close()}
});
