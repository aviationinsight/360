import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {workbookDates} from '../../apps/backend/src/report-dates.js';

export const sourceWorkbooks=[['amos','AMOS.xlsx'],['aog','AOG.xlsm'],['fak','FAK.xlsx'],['marshaling','MARSHALING.xlsx']] as const;
type Store={get(key:string):Promise<{json<T>():Promise<T>}|null>;head(key:string):Promise<unknown>;put(key:string,value:ArrayBuffer|Uint8Array|string):Promise<unknown>};
type SourceMetadata={source:string;sourceHash:string;key:string;dateCount:number};

export async function importSourceWorkbooks(directory:string,store:Store){
 const pending=[];
 const results=[];
 // Validate all changed workbooks before replacing any currently selected source.
 for(const [dashboard,fileName] of sourceWorkbooks){
  const path=join(directory,fileName);
  const info=await stat(path);
  if(!info.isFile()||!info.size||info.size>25*1024*1024)throw new Error(`${fileName}: expected a non-empty workbook up to 25 MB`);
  const bytes=await readFile(path);
  const sourceHash=createHash('sha256').update(bytes).digest('hex');
  const pointer=`dashboard-data/${dashboard}/latest.json`;
  const object=await store.get(pointer);
  const previous=object?await object.json<SourceMetadata>():null;
  if(previous?.source==='project'&&previous.sourceHash===sourceHash&&await store.head(previous.key)){
   results.push({dashboard,fileName,changed:false,dateCount:previous.dateCount});continue;
  }
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
  let dates:Set<string>;
  try{dates=await workbookDates(buffer,dashboard);}catch(error){throw new Error(`${fileName}: ${error instanceof Error?error.message:String(error)}`);}
  const extension=fileName.split('.').pop();
  const key=`dashboard-data/${dashboard}/project-${sourceHash}.${extension}`;
  const metadata={dashboard,fileName,size:bytes.length,updatedAt:new Date().toISOString(),source:'project',sourceHash,key,dateCount:dates.size};
  pending.push({pointer,key,bytes,metadata});
  results.push({dashboard,fileName,changed:true,dateCount:dates.size});
 }
 for(const item of pending){
  await store.put(item.key,item.bytes);
  await store.put(item.pointer,JSON.stringify(item.metadata));
 }
 return results;
}
