import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import {Hono} from 'hono';
import {migrate} from 'drizzle-orm/libsql/migrator';
import {eq} from 'drizzle-orm';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import app from '../../apps/backend/src/app.js';
import {db,client} from '../../apps/backend/src/db.js';
import {user,account} from '../../database/schema/index.js';
import {hash} from '../../apps/backend/src/password.js';
import {objects} from '../../apps/backend/src/storage.js';
import {importSourceWorkbooks} from './source-workbooks.js';

await migrate(db,{migrationsFolder:'migrations'});
const data=process.env.AVIATION_DATA_DIR!;
if(process.env.AVIATION_SKIP_SOURCE_IMPORT!=='1'){
 const directory=process.env.AVIATION_SOURCE_DIR||join(data,'..','dashboard-sources');
 console.log('Loading dashboard source workbooks from '+directory);
 const sources=await importSourceWorkbooks(directory,objects);
 for(const source of sources)console.log(`${source.fileName}: ${source.changed?'imported':'unchanged'} (${source.dateCount} reporting dates)`);
}
const existing=await db.select().from(user).where(eq(user.username,'admin'));
if(!existing.length){
 const password=randomBytes(18).toString('base64url'),id=randomUUID(),now=new Date();
 await db.transaction(async tx=>{
  await tx.insert(user).values({id,name:'Local administrator',username:'admin',displayUsername:'admin',email:'admin@legacy.invalid',role:'admin',active:true,canExport:true,createdAt:now,updatedAt:now});
  await tx.insert(account).values({id:randomUUID(),accountId:id,providerId:'credential',userId:id,password:await hash(password),createdAt:now,updatedAt:now});
 });
 await writeFile(join(data,'First-run-login.txt'),`Aviation Insight local administrator\r\nUsername: admin\r\nPassword: ${password}\r\n\r\nKeep this file private. You can reset the password in Admin.\r\n`,{mode:0o600});
}
const local=new Hono();
local.use('*',async(c,next)=>{
 // Nested dashboard frames inherit this policy: every asset and request stays local.
 c.header('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'");
 await next();
});
for(const prefix of ['/api/*','/secure-dashboard','/health/*'])local.all(prefix,c=>app.fetch(c.req.raw));
local.use('*',serveStatic({root:'./public'}));
local.get('*',serveStatic({path:'./public/index.html'}));
const server=serve({fetch:local.fetch,hostname:'127.0.0.1',port:Number(process.env.PORT)},()=>{
 const url=process.env.PUBLIC_ORIGIN!;
 if(process.send)process.send({type:'aviation-ready',url});
 console.log(`\nAviation Insight is running locally: ${url}\nData: ${data}\nLogin details: ${join(data,'First-run-login.txt')}\nClose this window to stop the app.\n`);
 if(process.env.AVIATION_NO_BROWSER!=='1'){
  const browser=spawn('explorer.exe',[url+'/login?admin=1'],{windowsHide:true,stdio:'ignore'});
  browser.on('error',()=>console.log('Open the address above in your browser.'));browser.unref();
 }
});
function stop(){server.close(()=>{client.close();process.exit(0)});setTimeout(()=>process.exit(0),3000).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
