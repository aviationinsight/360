import JSZip from 'jszip';
const decode = (s: string) => s.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi, (_, h, d, n) => h ? String.fromCodePoint(parseInt(h,16)) : d ? String.fromCodePoint(Number(d)) : ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[n]);
const attr = (s: string, name: string) => decode(s.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] || '');
const texts = (s: string) => Array.from(s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), m => decode(m[1])).join('');
const normalized = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const MiB=1024*1024;
// Read large worksheet XML incrementally instead of keeping its expanded text in memory.
async function xmlElements(file:JSZip.JSZipObject,tag:string,consume:(xml:string)=>void){
 const source=file as JSZip.JSZipObject & {internalStream(type:'uint8array'):JSZip.JSZipStreamHelper<Uint8Array>};
 const stream=source.internalStream('uint8array'),decoder=new TextDecoder();
 let pending='',expanded=0,done=false;
 const opening=new RegExp(`<${tag}(?:\\s[^>]*?)?>`),closing=`</${tag}>`;
 function parse(chunk:string){
  pending+=chunk;
  while(true){
   const start=opening.exec(pending);
   if(!start){pending=pending.slice(-256);return;}
   if(start.index)pending=pending.slice(start.index);
   if(start[0].endsWith('/>')){consume(start[0]);pending=pending.slice(start[0].length);continue;}
   const end=pending.indexOf(closing);
   if(end<0){if(pending.length>2*MiB)throw new Error('Workbook XML element exceeds limit');return;}
   consume(pending.slice(0,end+closing.length));pending=pending.slice(end+closing.length);
  }
 }
 await new Promise<void>((resolve,reject)=>{
  const fail=(error:unknown)=>{if(done)return;done=true;stream.pause();reject(error);};
  stream.on('data',chunk=>{if(done)return;try{expanded+=chunk.byteLength;if(expanded>512*MiB)throw new Error('Workbook expanded size exceeds limit');parse(decoder.decode(chunk,{stream:true}));}catch(error){fail(error);}});
  stream.on('error',fail);
  stream.on('end',()=>{if(done)return;try{parse(decoder.decode());if(opening.test(pending))throw new Error('Incomplete workbook XML');done=true;resolve();}catch(error){fail(error);}});
  stream.resume();
 });
}
export function excelDate(value: unknown, date1904 = false): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return null;
    const day = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + Math.floor(value)*86400000);
    return day.getUTCFullYear() >= 2020 && day.getUTCFullYear() <= 2100 ? day.toISOString().slice(0,10) : null;
  }
  const s=String(value ?? '').trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T|\s|$)/);
  let y:number, month:number, d:number;
  if(m){y=Number(m[1]);month=Number(m[2]);d=Number(m[3]);}
  else {
    m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(!m)return null;
    // Existing workbooks use day/month/year for text dates. Ambiguous dates are not guessed from current month.
    y=Number(m[3]);month=Number(m[2]);d=Number(m[1]);
  }
  const date=new Date(Date.UTC(y,month-1,d));
  return y>=2020 && y<=2100 && date.getUTCMonth()===month-1 && date.getUTCDate()===d ? date.toISOString().slice(0,10) : null;
}
export async function workbookDates(buffer: ArrayBuffer, dashboard: string): Promise<Set<string>> {
  // Bound declared expanded size before inflating XML (reject ZIP64/encrypted archives).
  const view=new DataView(buffer);let end=-1;
  for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break}}
  if(end<0)throw new Error('Invalid XLSX archive');
  const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
  if(count===65535||offset===0xffffffff||count>10000)throw new Error('Unsupported workbook archive');
  let position=offset,total=0;
  for(let i=0;i<count;i++){
    if(position+46>buffer.byteLength||view.getUint32(position,true)!==0x02014b50)throw new Error('Invalid archive directory');
    const size=view.getUint32(position+24,true);total+=size;
    const nameLength=view.getUint16(position+28,true);
    const name=new TextDecoder().decode(new Uint8Array(buffer,position+46,nameLength));
    const streamed=/^xl\/(?:worksheets\/[^/]+\.xml|sharedStrings\.xml)$/.test(name);
    const limit=streamed?512*MiB:/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(name)?2*MiB:50*MiB;
    if((view.getUint16(position+8,true)&1)||size>limit||total>1024*MiB)throw new Error('Workbook expanded size exceeds limit');
    position+=46+view.getUint16(position+28,true)+view.getUint16(position+30,true)+view.getUint16(position+32,true);
  }
  // CRC checking here would eagerly inflate every sheet, including unused sheets.
  const zip=await JSZip.loadAsync(buffer);
  const read=async (path:string) => { const f=zip.file(path); if(!f)throw new Error(`Workbook missing ${path}`);return f.async('string'); };
  const workbook=await read('xl/workbook.xml'), rels=await read('xl/_rels/workbook.xml.rels');
  const sharedFile=zip.file('xl/sharedStrings.xml');
  const shared=new Map<number,string>();let stringIndex=0;
  const headers=new Set(['yearid','monthid','dayid','date','issuedat','newdate']);
  if(sharedFile)await xmlElements(sharedFile,'si',xml=>{
    const value=texts(xml);
    // Remarks/descriptions are not needed to validate primary reporting dates.
    if(headers.has(normalized(value))||excelDate(value)!==null||/^\d{1,5}(?:\.\d+)?$/.test(value.trim())){
      if(shared.size>=250000)throw new Error('Workbook reporting strings exceed limit');
      shared.set(stringIndex,value);
    }
    stringIndex++;
  });
  const sheets=Array.from(workbook.matchAll(/<sheet\s([^>]+)\/?\s*>/g),m=>({name:attr(m[1],'name'),id:attr(m[1],'r:id')}));
  const sheet = dashboard==='amos' ? sheets.find(s=>normalized(s.name)==='amosfile') || sheets[0] : dashboard==='fak' ? sheets.find(s=>normalized(s.name)==='fakautomatednew') : dashboard==='aog' ? sheets.find(s=>normalized(s.name)==='automated') : sheets.find(s=>['summry','summary'].includes(normalized(s.name)));
  if(!sheet)throw new Error(`Required ${dashboard} data sheet was not found`);
  const relation=Array.from(rels.matchAll(/<Relationship\s([^>]+)\/?\s*>/g),m=>m[1]).find(s=>attr(s,'Id')===sheet.id);
  if(!relation)throw new Error('Worksheet relationship not found');
  const target=attr(relation,'Target');
  const path=target.startsWith('/') ? target.slice(1) : 'xl/'+target.replace(/^\.\//,'');
  const worksheet=zip.file(path);if(!worksheet)throw new Error(`Workbook missing ${path}`);
  const result=new Set<string>();
  const date1904=/date1904="(?:1|true)"/.test(workbook);
  let columns:Record<string,string>|null=null;
  await xmlElements(worksheet,'row',row=>{
    const cells:Record<string,unknown>={};
    for(const c of row.matchAll(/<c\s([^>]*)(?:>([\s\S]*?)<\/c>|\/>)/g)){
      const col=attr(c[1],'r').replace(/\d/g,''), type=attr(c[1],'t'), body=c[2]||'';
      const raw=body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
      cells[col]=type==='s' ? shared.get(Number(raw)) ?? '' : type==='inlineStr' ? texts(body) : raw===undefined ? '' : type==='str'||type==='d' ? decode(raw) : Number(raw);
    }
    if(!columns){
      const mapping=Object.fromEntries(Object.entries(cells).map(([col,value])=>[normalized(value),col]));
      if(dashboard==='amos' ? ['yearid','monthid','dayid'].every(k=>mapping[k]) : Boolean(mapping[dashboard==='fak'?'date':dashboard==='aog'?'issuedat':'newdate']))columns=mapping;
      return;
    }
    let value:unknown;
    if(dashboard==='amos'){
      const y=Number(cells[columns.yearid]),m=Number(cells[columns.monthid]),d=Number(cells[columns.dayid]);
      value=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    } else value=cells[columns[dashboard==='fak'?'date':dashboard==='aog'?'issuedat':'newdate']];
    const date=excelDate(value,date1904); if(date)result.add(date);
  });
  if(!columns||!result.size)throw new Error(`No valid primary reporting dates in ${dashboard}`);
  return result;
}
