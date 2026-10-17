import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentFile } from '../apps/backend/src/dashboard-data.js';

test('large live workbooks have sufficient download time and completed versions are cached',async t=>{
 const saved=new Map<string,ArrayBuffer>();
 const bucket={get:async(key:string)=>{const bytes=saved.get(key);return bytes?{body:bytes,arrayBuffer:async()=>bytes,json:async<T>()=>JSON.parse(new TextDecoder().decode(bytes)) as T,text:async()=>new TextDecoder().decode(bytes)}:null},head:async()=>null,put:async(key:string,value:ArrayBuffer|Uint8Array|string)=>{saved.set(key,typeof value==='string'?new TextEncoder().encode(value).buffer:value instanceof Uint8Array?value.slice().buffer as ArrayBuffer:value.slice(0))}};
 const env={REPORT_FILES:bucket};let version='2026-10-14T07:28:27.364Z',downloads=0,valid=true;
 const deadlines:number[]=[];t.mock.method(AbortSignal,'timeout',(ms:number)=>{deadlines.push(ms);return new AbortController().signal});
 t.mock.method(globalThis,'fetch',async(input:string|URL|Request)=>{
  if(String(input).includes('/metadata/'))return Response.json({metadata:{updatedAt:version}});
  downloads++;await new Promise(resolve=>setTimeout(resolve,10));
  return new Response(new Uint8Array(valid?[80,75,3,4,5]:[60,104,116,109,108]));
 });
 const [a,b]=await Promise.all([currentFile(env,'amos'),currentFile(env,'amos')]);
 assert.deepEqual(new Uint8Array(await a.arrayBuffer()),new Uint8Array(await b.arrayBuffer()));assert.equal(downloads,1);assert.equal(saved.size,1);assert.ok(deadlines.includes(15*60*1000));
 await currentFile(env,'amos');assert.equal(downloads,1);
 version='2026-10-15T07:28:27.364Z';await currentFile(env,'amos');assert.equal(downloads,2);assert.equal(saved.size,2);
 version='2026-10-16T07:28:27.364Z';valid=false;await assert.rejects(()=>currentFile(env,'amos'),/did not return an XLSX/);assert.equal(saved.size,2);
 valid=true;await currentFile(env,'amos');assert.equal(downloads,4);assert.equal(saved.size,3);
});
