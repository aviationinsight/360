import {serve} from '@hono/node-server';
import {mkdir} from 'node:fs/promises';
import app from './app.js';
import {config} from './config.js';
await mkdir(config.DATA_DIR,{recursive:true});
serve({fetch:app.fetch,port:config.PORT});
console.log(`Aviation API listening on ${config.PORT}`);
