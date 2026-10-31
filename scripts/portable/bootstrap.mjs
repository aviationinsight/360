import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:net';

const runtime=dirname(fileURLToPath(import.meta.url));
const data=resolve(process.env.AVIATION_DATA_DIR||join(runtime,'../../data'));
await mkdir(data,{recursive:true});
// Keep the desktop runtime independent of the development environment.
process.chdir(runtime);
for(const key of Object.keys(process.env))if(key.startsWith('BETTER_AUTH_'))delete process.env[key];
let settings;
const settingsPath=join(data,'settings.json');
try{settings=JSON.parse(await readFile(settingsPath,'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;settings={authSecret:randomBytes(48).toString('base64')};await writeFile(settingsPath,JSON.stringify(settings,null,2),{flag:'wx',mode:0o600});}
const port=await new Promise((resolvePort,reject)=>{
 const probe=createServer();probe.on('error',reject);
 probe.listen(Number(process.env.AVIATION_PORT||0),'127.0.0.1',()=>{const value=probe.address().port;probe.close(()=>resolvePort(value));});
});
Object.assign(process.env,{
 NODE_ENV:'production',DOTENV_CONFIG_PATH:join(runtime,'no-environment-file'),
 PORT:String(port),PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,
 DATABASE_URL:pathToFileURL(join(data,'aviation.db')).href,DATA_DIR:join(data,'objects'),
 PRIVATE_SOURCE_DIR:join(runtime,'private'),
 BETTER_AUTH_SECRET:settings.authSecret,
 BETTER_AUTH_TELEMETRY:'0',DO_NOT_TRACK:'1',
 AVIATION_DATA_DIR:data
});
const localFetch=globalThis.fetch;
globalThis.fetch=(input,options)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.origin!==process.env.PUBLIC_ORIGIN)throw new Error('Internet access is disabled in the portable edition.');
 return localFetch(input,options);
};
await import('./server.mjs');
