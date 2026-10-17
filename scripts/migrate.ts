import {mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {migrate} from 'drizzle-orm/libsql/migrator';
import {db,client} from '../apps/backend/src/db.js';
await migrate(db,{migrationsFolder:'database/migrations'});
await client.execute('PRAGMA foreign_keys=ON');
console.log('Database migrations applied');client.close();
