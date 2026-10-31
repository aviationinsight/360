import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentFile, currentData, dataAdmin } from '../apps/backend/src/dashboard-data.js';
import JSZip from 'jszip';

test('offline uploads remain local, survive reload, and never contact automatic sync',async t=>{
 const saved=new Map<string,ArrayBuffer>();
 const bucket={get:async(key:string)=>{const bytes=saved.get(key);return bytes?{body:bytes,arrayBuffer:async()=>bytes,json:async<T>()=>JSON.parse(new TextDecoder().decode(bytes)) as T,text:async()=>new TextDecoder().decode(bytes)}:null},head:async()=>null,put:async(key:string,value:ArrayBuffer|Uint8Array|string)=>{saved.set(key,typeof value==='string'?new TextEncoder().encode(value).buffer:value instanceof Uint8Array?value.slice().buffer as ArrayBuffer:value.slice(0))}};
 const env={FILES:bucket};
 t.mock.method(globalThis,'fetch',()=>{throw new Error('Offline mode must not use the network');});
 assert.equal((await currentData(env,'marshaling')).metadata,null);
 assert.equal((await currentFile(env,'marshaling')).status,404);
 const zip=new JSZip();
 zip.file('xl/workbook.xml','<workbook><sheets><sheet name="Summary" r:id="rId1"/></sheets></workbook>');
 zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
 zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>New Date</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>2026-10-31</t></is></c></row></sheetData></worksheet>');
 const bytes=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
 const form=new FormData();form.set('dashboard','marshaling');form.set('file',new File([bytes],'Marshaling.xlsx'));
 const response=await dataAdmin(new Request('http://localhost/api/admin/dashboard-data',{method:'POST',body:form}),env);
 assert.equal(response.status,200);assert.equal((await response.json()).dates,1);
 assert.equal((await currentData(env,'marshaling')).manual?.fileName,'Marshaling.xlsx');
 assert.deepEqual(new Uint8Array(await(await currentFile(env,'marshaling')).arrayBuffer()),new Uint8Array(bytes));
 // XLSM retains its VBA payload, but validation reads only worksheet data.
 zip.file('xl/vbaProject.bin',new Uint8Array([1,2,3,4]));
 const macroBytes=await zip.generateAsync({type:'arraybuffer'});
 const macroForm=new FormData();macroForm.set('dashboard','marshaling');macroForm.set('file',new File([macroBytes],'Marshaling.XLSM'));
 const macroResponse=await dataAdmin(new Request('http://localhost/api/admin/dashboard-data',{method:'POST',body:macroForm}),env);
 assert.equal(macroResponse.status,200);
 const macroFile=await currentFile(env,'marshaling');
 assert.equal(macroFile.headers.get('Content-Type'),'application/vnd.ms-excel.sheet.macroEnabled.12');
 assert.deepEqual(new Uint8Array(await macroFile.arrayBuffer()),new Uint8Array(macroBytes));
 assert.match((await currentData(env,'marshaling')).manual!.key,/\.xlsm$/);
 const invalid=new FormData();invalid.set('dashboard','marshaling');invalid.set('file',new File(['invalid'],'Broken.xlsm'));
 assert.equal((await dataAdmin(new Request('http://localhost/api/admin/dashboard-data',{method:'POST',body:invalid}),env)).status,400);
 assert.equal((await currentData(env,'marshaling')).manual?.fileName,'Marshaling.XLSM');
});
