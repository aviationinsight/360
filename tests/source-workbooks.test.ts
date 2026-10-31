import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {importSourceWorkbooks,sourceWorkbooks} from '../scripts/portable/source-workbooks.js';

async function workbook(dashboard:string,date='2026-10-29'){
 const zip=new JSZip(),sheet=dashboard==='amos'?'AMOS Data':dashboard==='aog'?'AOG Data Automated':dashboard==='fak'?'FAK Data Automated':'Summary Marshaling Data';
 const headers=dashboard==='amos'?['Year ID','Month ID','Day ID']:[dashboard==='aog'?'Issued At':dashboard==='fak'?'DATE':'New Date'];
 const values=dashboard==='amos'?date.split('-'):[date];
 const row=(cells:string[],n:number)=>`<row>${cells.map((v,i)=>`<c r="${String.fromCharCode(65+i)}${n}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`;
 zip.file('xl/workbook.xml',`<workbook><sheets><sheet name="${sheet}" r:id="rId1"/></sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
 zip.file('xl/worksheets/sheet1.xml',`<worksheet><sheetData>${row(headers,1)}${row(values,2)}</sheetData></worksheet>`);
 return zip.generateAsync({type:'nodebuffer'});
}
test('cold start imports sources, skips identical files, restores overrides and preserves data on invalid files',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'aviation-sources-'));
 const saved=new Map<string,Buffer>();let writes=0;
 const store={get:async(key:string)=>{const bytes=saved.get(key);return bytes?{json:async<T>()=>JSON.parse(bytes.toString()) as T}:null;},head:async(key:string)=>saved.has(key),put:async(key:string,value:ArrayBuffer|Uint8Array|string)=>{writes++;saved.set(key,typeof value==='string'?Buffer.from(value):Buffer.from(value as Uint8Array));}};
 try{
  for(const [dashboard,name] of sourceWorkbooks)await writeFile(join(directory,name),await workbook(dashboard));
  assert.equal((await importSourceWorkbooks(directory,store)).filter(s=>s.changed).length,4);
  writes=0;
  assert.ok((await importSourceWorkbooks(directory,store)).every(s=>!s.changed));assert.equal(writes,0);
  await writeFile(join(directory,'AOG.xlsm'),await workbook('aog','2026-10-30'));
  assert.deepEqual((await importSourceWorkbooks(directory,store)).filter(s=>s.changed).map(s=>s.dashboard),['aog']);
  saved.set('dashboard-data/amos/latest.json',Buffer.from(JSON.stringify({source:'manual',key:'override'})));
  assert.deepEqual((await importSourceWorkbooks(directory,store)).filter(s=>s.changed).map(s=>s.dashboard),['amos']);
  assert.equal(JSON.parse(saved.get('dashboard-data/amos/latest.json')!.toString()).source,'project');
  await writeFile(join(directory,'AMOS.xlsx'),await workbook('amos','2026-10-31'));
  await writeFile(join(directory,'FAK.xlsx'),'invalid');writes=0;
  const previousPointer=saved.get('dashboard-data/amos/latest.json')!.toString();
  await assert.rejects(()=>importSourceWorkbooks(directory,store),/FAK.xlsx/);assert.equal(writes,0);
  assert.equal(saved.get('dashboard-data/amos/latest.json')!.toString(),previousPointer);
 }finally{await rm(directory,{recursive:true,force:true});}
});
