import {createClient} from '@libsql/client/sqlite3';
import {drizzle} from 'drizzle-orm/libsql';
import * as schema from '../../../database/schema/index.js';
import {config} from './config.js';
export const client=createClient({url:config.DATABASE_URL});
await client.execute('PRAGMA foreign_keys=ON');
export const db=drizzle(client,{schema});
