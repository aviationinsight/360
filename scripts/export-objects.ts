import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Cloudflare R2 export requires an owner-provided S3 export directory or authenticated application URLs.
// Never collect secret values into this export.
const origin=process.env.EXPORT_ORIGIN;
if(!origin||!process.env.EXPORT_COOKIE)throw new Error('Set EXPORT_ORIGIN and a short-lived authorized EXPORT_COOKIE; cookie is never written');
const out=resolve(process.argv[2]||'artifacts/live-data');await mkdir(out,{recursive:true});
const manifest=[];
for(const dashboard of ['amos','aog','fak','marshaling']){
 const response=await fetch(`${origin}/api/dashboard-sync/${dashboard}/file`,{headers:{cookie:process.env.EXPORT_COOKIE},redirect:'error'});
 if(!response.ok)throw new Error(`Export ${dashboard}: HTTP ${response.status}`);
 const file=new Uint8Array(await response.arrayBuffer());if(file[0]!==80||file[1]!==75)throw new Error('Expected XLSX');
 await writeFile(resolve(out,`${dashboard}.xlsx`),file,{mode:0o600});manifest.push({key:`migration/${dashboard}.xlsx`,file:`${dashboard}.xlsx`});
}
await writeFile(resolve(out,'objects.json'),JSON.stringify(manifest,null,2),{mode:0o600});console.log('Authorized current workbooks exported. Historical R2 report/manual objects require a separate storage export.');
