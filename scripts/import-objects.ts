import {readFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {objects} from '../apps/backend/src/storage.js';
import {client} from '../apps/backend/src/db.js';
import {z} from 'zod';
const manifest=resolve(process.argv[2]||'artifacts/objects.json'),root=dirname(manifest);
const entries=z.array(z.object({key:z.string().min(1),file:z.string().min(1)})).parse(JSON.parse(await readFile(manifest,'utf8')));
for(const e of entries){const file=resolve(root,e.file);if(relative(root,file).startsWith('..'))throw new Error('File outside export directory');if(await objects.head(e.key))continue;await objects.put(e.key,await readFile(file))}
console.log(`Processed ${entries.length} private objects; existing objects retained`);client.close();
