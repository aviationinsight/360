import {readFile,writeFile,mkdir,rename,stat,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {db} from './db.js';
import {storedObject} from '../../../database/schema/index.js';
import {config} from './config.js';
const root=resolve(config.DATA_DIR);
function pathFor(key:string){if(!key||key.split('/').some(p=>p==='..'||p==='.'||p==='')||key.includes('\\')||key.includes('\0'))throw new Error('Invalid object key');const path=resolve(root,key);if(relative(root,path).startsWith('..'))throw new Error('Invalid object key');return path;}
export const objects={
 async get(key:string){try{const bytes=await readFile(pathFor(key));return {body:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),json:async<T>()=>JSON.parse(bytes.toString()) as T,text:async()=>bytes.toString()}}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}},
 async head(key:string){try{return await stat(pathFor(key))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}},
 async put(key:string,value:ArrayBuffer|Uint8Array|string){const path=pathFor(key);await mkdir(dirname(path),{recursive:true});const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value as ArrayBuffer);const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,bytes,{mode:0o600});await rename(temp,path);await db.insert(storedObject).values({key,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:storedObject.key,set:{size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),updatedAt:new Date().toISOString()}})},
 async keys(){const result:string[]=[];async function walk(dir:string){for(const e of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&!e.name.endsWith('.tmp'))result.push(relative(root,p))}}await walk(root);return result;}
};
