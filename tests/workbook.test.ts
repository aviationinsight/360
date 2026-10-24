import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {excelDate,workbookDates} from '../apps/backend/src/report-dates.js';
async function fixture(name:string,headers:string[],values:string[]){const zip=new JSZip();zip.file('xl/workbook.xml',`<workbook><sheets><sheet name="${name}" r:id="rId1"/></sheets></workbook>`);zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');const row=(items:string[],n:number)=>`<row r="${n}">${items.map((v,i)=>`<c r="${String.fromCharCode(65+i)}${n}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`;zip.file('xl/worksheets/sheet1.xml',`<worksheet><sheetData>${row(headers,1)}${row(values,2)}</sheetData></worksheet>`);return zip.generateAsync({type:'arraybuffer'})}
test('reporting dates use the primary sheet and preserve day/month/year across years',async()=>{assert.equal(excelDate('12/10/2026'),'2026-10-12');assert.equal(excelDate('31/02/2026'),null);for(const [dashboard,sheet,column] of [['fak','FAK Automated New','DATE'],['aog','Automated','Issued At'],['marshaling','Summry','New Date']]){const dates=await workbookDates(await fixture(sheet,[column],['2027-01-12']),dashboard);assert.deepEqual([...dates],['2027-01-12']);assert.equal(dates.has('2027-01-26'),false)}assert.deepEqual([...await workbookDates(await fixture('AMOS File',['Year ID','Month ID','Day ID'],['2026','10','26']),'amos')],['2026-10-26'])});
test('rejects missing primary sheet and declared ZIP expansion attacks',async()=>{const fixtureBuffer=await fixture('Wrong',['DATE'],['2026-10-12']);await assert.rejects(()=>workbookDates(fixtureBuffer,'fak'));const bytes=new Uint8Array(await fixture('FAK Automated New',['DATE'],['2026-10-12']));const view=new DataView(bytes.buffer);for(let i=0;i<bytes.length-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,200*1024*1024,true);break}await assert.rejects(()=>workbookDates(bytes.buffer,'fak'),/expanded size/)});
test('streams worksheets larger than the old 50 MiB limit',async()=>{
 const zip=await JSZip.loadAsync(await fixture('AMOS File',['Year ID','Month ID','Day ID'],['2026','10','24']));
 const path='xl/worksheets/sheet1.xml';const xml=await zip.file(path)!.async('string');
 zip.file(path,xml.replace('<sheetData>','<!--'+'padding '.repeat(7*1024*1024)+'--><sheetData>'));
 const bytes=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE',compressionOptions:{level:1}});
 assert.deepEqual([...await workbookDates(bytes,'amos')],['2026-10-24']);
});
test('streams shared strings and preserves referenced reporting headers and dates',async()=>{
 const zip=await JSZip.loadAsync(await fixture('AMOS File',[],[]));
 zip.file('xl/sharedStrings.xml','<sst><si><t>تفاصيل غير مطلوبة</t></si><si><t>Year ID</t></si><si><t>Month ID</t></si><si><t>Day ID</t></si><si><t>2026</t></si><si><t>10</t></si><si><t>24</t></si></sst>');
 zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="s"><v>1</v></c><c r="B1" t="s"><v>2</v></c><c r="C1" t="s"><v>3</v></c></row><row><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c><c r="C2" t="s"><v>6</v></c></row></sheetData></worksheet>');
 assert.deepEqual([...await workbookDates(await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'}),'amos')],['2026-10-24']);
});
