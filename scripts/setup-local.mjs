import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
await mkdir('.data',{recursive:true});
try{await readFile('.env');console.log('Existing .env preserved')}catch(e){if(e.code!=='ENOENT')throw e;let text=await readFile('.env.example','utf8');text=text.replace('BETTER_AUTH_SECRET=','BETTER_AUTH_SECRET='+randomBytes(48).toString('base64')).replace('REPORT_SYNC_SECRET=','REPORT_SYNC_SECRET='+randomBytes(48).toString('base64'));await writeFile('.env',text,{mode:0o600});console.log('Local configuration created; no secrets printed')}
