import {createClient} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import * as schema from '../../../database/schema/index.js';
import {config} from './config.js';
export const client=createClient({url:config.TURSO_DATABASE_URL,authToken:config.TURSO_AUTH_TOKEN});
await client.execute('PRAGMA foreign_keys=ON');
export const db=drizzle(client,{schema});
// Bounded compatibility adapter preserves the audited report state machine SQL.
export const legacyDB={prepare(sql:string){let args:unknown[]=[];const statement={bind(...values:unknown[]){args=values;return statement},async first<T>(){const r=await client.execute({sql,args:args as never[]});return (r.rows[0]||null) as T|null},async all(){const r=await client.execute({sql,args:args as never[]});return {results:r.rows}},async run(){const r=await client.execute({sql,args:args as never[]});return {meta:{changes:r.rowsAffected}}}};return statement}};
