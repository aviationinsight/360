import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {db,client} from '../../apps/backend/src/db.js';
import {user,account,permission,reportRuns} from '../schema/index.js';
import {z} from 'zod';
const directory=resolve(process.argv[2]||'database/import/exports');
const Employee=z.object({id:z.number().int().positive(),name:z.string(),username:z.string().min(3),password_hash:z.string().regex(/^[a-f0-9]{64}$/i),password_salt:z.string().regex(/^[a-f0-9]+$/i),is_admin:z.number(),active:z.number(),can_export:z.number(),created_at:z.string().datetime(),updated_at:z.string().datetime(),can_amos:z.number(),can_aog:z.number(),can_fak:z.number(),can_marshaling:z.number(),can_permits:z.number()});
const employees=z.object({complete:z.literal(true),rows:z.array(Employee)}).parse(JSON.parse(await readFile(resolve(directory,'employees.json'),'utf8')));
const reports=z.object({complete:z.literal(true),rows:z.array(z.object({id:z.string(),period_start:z.string(),period_end:z.string(),status:z.string(),stage:z.number(),test_mode:z.number(),updated_at:z.string(),error:z.string().nullable(),download_token:z.string()}))}).parse(JSON.parse(await readFile(resolve(directory,'report_runs.json'),'utf8')));
await db.transaction(async tx=>{
 for(const e of employees.rows){const id=String(e.id),createdAt=new Date(e.created_at),updatedAt=new Date(e.updated_at);
  await tx.insert(user).values({id,legacyId:e.id,name:e.name,username:e.username,displayUsername:e.username,email:`${e.username}@legacy.invalid`,role:e.is_admin?'admin':'employee',active:!!e.active,canExport:!!e.can_export,createdAt,updatedAt}).onConflictDoNothing();
  await tx.insert(account).values({id:`legacy-${e.id}`,accountId:id,userId:id,providerId:'credential',password:`pbkdf2$100000$${e.password_salt}$${e.password_hash}`,createdAt,updatedAt}).onConflictDoNothing();
  for(const d of ['amos','aog','fak','marshaling','permits'] as const)await tx.insert(permission).values({userId:id,dashboard:d,allowed:!!e[`can_${d}`]}).onConflictDoNothing();
 }
 for(const job of reports.rows)await tx.insert(reportRuns).values(job).onConflictDoNothing();
});
console.log(`Imported/retained ${employees.rows.length} employee identities and ${reports.rows.length} reports; existing target records/passwords unchanged.`);client.close();
