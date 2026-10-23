import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
await build({
 entryPoints:['workers/index.ts'],outfile:'dist/worker/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,
 external:['cloudflare:workers','node:*'],loader:{'.html':'text'},
 alias:{'@libsql/client':'@libsql/client/web','nodemailer':resolve('workers/mail.ts')},
 plugins:[{name:'worker-adapters',setup(build){
  build.onResolve({filter:/^\.\/(storage|renderer|private-dashboard)\.js$/},args=>({path:resolve('workers',args.path.replace('.js','.ts'))}));
  build.onResolve({filter:/^dotenv\/config$/},()=>({path:'dotenv',namespace:'empty'}));
  build.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'',loader:'js'}));
  build.onLoad({filter:/[\\/]apps[\\/]backend[\\/]src[\\/]db\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replace("await client.execute('PRAGMA foreign_keys=ON');",''),loader:'ts'}));
 }}]
});
