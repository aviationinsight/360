import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import JSZip from 'jszip';

async function fixture(name,head,value){
  const zip=new JSZip();
  zip.file('xl/workbook.xml',`<workbook><sheets><sheet name="${name}" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
  const headers=head.map((s,i)=>`<c r="${String.fromCharCode(65+i)}1" t="inlineStr"><is><t>${s}</t></is></c>`).join('');
  const values=value.map((v,i)=>`<c r="${String.fromCharCode(65+i)}2"><v>${v}</v></c>`).join('');
  zip.file('xl/worksheets/sheet1.xml',`<worksheet><sheetData><row r="1">${headers}</row><row r="2">${values}</row></sheetData></worksheet>`);
  return zip.generateAsync({type:'arraybuffer'});
}
function runtime(){
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE report_runs(id TEXT PRIMARY KEY,period_start TEXT,period_end TEXT,status TEXT,stage INTEGER,test_mode INTEGER,updated_at TEXT,error TEXT,download_token TEXT)');
  const objects=new Map();
  const DB = {prepare(sql) {
    const statement = (args=[]) => ({
      bind(...values) { return statement(values); },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return {results:db.prepare(sql).all(...args)}; },
      async run() { return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}; }
    });
    return statement();
  }};
  return {DB, REPORT_FILES:{
    async put(k,v){objects.set(k,v);},
    async head(k){return objects.has(k)?{}:null;},
    async get(k){return objects.has(k)?{body:objects.get(k),json:async()=>JSON.parse(objects.get(k))}:null;}
  }, REPORT_SYNC_SECRET:'test-secret', REPORT_EMAIL_HOOK:'https://email.invalid/hook',
  REPORT_EMAIL_ENABLED:'false',ASSETS:{fetch:async()=>new Response('')},db,objects};
}
const req=(path,body={})=>new Request('https://aviationinsight360.com/api/reports/'+path,{method:'POST',headers:{'X-Report-Secret':'test-secret','Content-Type':'application/json'},body:JSON.stringify(body)});
const context={waitUntil(){},passThroughOnException(){}};
test('requires all four cutoff dates, freezes workbooks, and submits each report only once',async()=>{
 const worker=(await import('../dist/server/index.js')).default,env=runtime();
 const serial=Math.floor((Date.UTC(2026,8,26)-Date.UTC(1899,11,30))/86400000);
 const books={amos:await fixture('Amos file',['YearID','MonthID','DayID'],[2026,9,26]),fak:await fixture('FAK AutomatedNew ',['DATE'],[serial]),aog:await fixture('Automated ',['Issued At'],[serial]),marshaling:await fixture(' Summry ',['New Date'],[serial-1])};
 const original=globalThis.fetch;let rendered=0,sent=0;
 globalThis.fetch=async (url,options)=>{
  const s=String(url);
  if(s.includes('/reports/render')){rendered++;const png=new Uint8Array(12000);png.set([137,80,78,71]);return new Response(png,{headers:{'Content-Type':'image/png'}});}
  if(s==='https://email.invalid/hook'){sent++;const payload=JSON.parse(options.body);assert.equal(payload.attachments.length,4);assert.equal(payload.period_end,'2026-09-26');return new Response('{}');}
  const dataset=s.match(/\/(amos|fak|aog|marshaling)\.xlsx/)?.[1];if(dataset)return new Response(books[dataset]);throw new Error('Unexpected test request '+s);
 };
 try{
  let response=await worker.fetch(req('check',{test:true,period_end:'2026-09-26'}),env,context);let body=await response.json();assert.equal(body.outcomes[0].status,'waiting');assert.deepEqual(body.outcomes[0].missing,['marshaling']);assert.equal(env.objects.size,0);
  books.marshaling=await fixture(' Summry ',['New Date'],[serial]);
  response=await worker.fetch(req('check',{test:true,period_end:'2026-09-26'}),env,context);assert.equal((await response.json()).outcomes[0].status,'pending');assert.equal(env.objects.size,4);
  await worker.fetch(req('check',{test:true,period_end:'2026-09-26'}),env,context);assert.equal(env.db.prepare('SELECT count(*) AS n FROM report_runs').get().n,1);
  for(let i=0;i<5;i++){const r=await worker.fetch(req('process'),env,context);assert.equal(r.status,200);}
  assert.equal(rendered,4);assert.equal(sent,0);assert.equal(env.db.prepare('SELECT status FROM report_runs').get().status,'ready');
  env.REPORT_EMAIL_ENABLED='true';await worker.fetch(req('process'),env,context);await worker.fetch(req('process'),env,context);assert.equal(sent,1);assert.equal(env.db.prepare('SELECT status FROM report_runs').get().status,'submitted');
  const denied=await worker.fetch(new Request('https://aviationinsight360.com/api/reports/check',{method:'POST',body:'{}'}),env,context);assert.equal(denied.status,401);
 }finally{globalThis.fetch=original;env.db.close();}
});


test('manual upload is admin-only, rejects the wrong workbook, and survives until a newer automatic update',async()=>{
 const worker=(await import('../dist/server/index.js')).default,env=runtime();
 env.SAL_ADMIN_USERNAME='admin';env.SAL_ADMIN_PASSWORD='test-password';
 const signature=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sal-admin:admin:test-password'))).toString('hex');
 const headers={Cookie:'sal_admin='+signature,Origin:'https://aviationinsight360.com'};
 const path='https://aviationinsight360.com/api/admin/dashboard-data';
 const book=await fixture('FAK AutomatedNew ',['DATE'],[46291]);
 const upload=(bytes,h=headers)=>{const form=new FormData();form.append('dashboard','fak');form.append('file',new File([bytes],'FAK.xlsx'));return new Request(path,{method:'POST',headers:h,body:form});};
 const original=globalThis.fetch;let upstreamDate='2020-01-01T00:00:00.000Z';
 globalThis.fetch=async url=>String(url).includes('/metadata/')?Response.json({metadata:{updatedAt:upstreamDate}}):new Response('new automatic file');
 try{
  assert.equal((await worker.fetch(upload(book,{}),env,context)).status,401);
  assert.equal((await worker.fetch(upload(book,{...headers,Origin:'https://other.invalid'}),env,context)).status,403);
  const wrong=await fixture('Automated ',['Issued At'],[46291]);
  assert.equal((await worker.fetch(upload(wrong),env,context)).status,400);assert.equal(env.objects.size,0);
  const saved=await worker.fetch(upload(book),env,context);assert.equal(saved.status,200);
  const current=await worker.fetch(new Request('https://aviationinsight360.com/api/dashboard-sync/fak/metadata',{headers}),env,context);
  assert.equal((await current.json()).metadata.source,'manual');
  const file=await worker.fetch(new Request('https://aviationinsight360.com/api/dashboard-sync/fak/file',{headers}),env,context);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()),new Uint8Array(book));
  globalThis.fetch=async()=>{throw new Error('upstream unavailable');};
  const offline=await worker.fetch(new Request('https://aviationinsight360.com/api/dashboard-sync/fak/file',{headers}),env,context);assert.equal(offline.status,200);
  upstreamDate='2099-01-01T00:00:00.000Z';
  globalThis.fetch=async url=>String(url).includes('/metadata/')?Response.json({metadata:{updatedAt:upstreamDate}}):new Response('new automatic file');
  const resumed=await worker.fetch(new Request('https://aviationinsight360.com/api/dashboard-sync/fak/file',{headers}),env,context);assert.equal(await resumed.text(),'new automatic file');
 }finally{globalThis.fetch=original;env.db.close();}
});
