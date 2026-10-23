import {env} from 'cloudflare:workers';
import {createHash} from 'node:crypto';
import {db} from '../apps/backend/src/db.js';
import {storedObject} from '../database/schema/index.js';
const bucket=()=>env.REPORT_FILES as R2Bucket;
function validate(key:string){if(!key||key.split('/').some(p=>!p||p==='.'||p==='..')||key.includes('\\')||key.includes('\0'))throw new Error('Invalid object key');return key;}
export const objects={
 get:(key:string)=>bucket().get(validate(key)),
 head:(key:string)=>bucket().head(validate(key)),
 async put(key:string,value:ArrayBuffer|Uint8Array|string){
  validate(key);const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value as ArrayBuffer);
  await bucket().put(key,bytes);
  const metadata={size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),updatedAt:new Date().toISOString()};
  await db.insert(storedObject).values({key,...metadata}).onConflictDoUpdate({target:storedObject.key,set:metadata});
 },
 async keys(){const keys:string[]=[];let cursor:string|undefined;do{const page=await bucket().list({cursor});keys.push(...page.objects.map(o=>o.key));cursor=page.truncated?page.cursor:undefined;}while(cursor);return keys;}
};
