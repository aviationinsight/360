import {build} from 'esbuild';
import {cp,mkdir,readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {rcedit} from 'rcedit';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const desktop=!process.argv.includes('--console');
process.chdir(root);
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Build this edition on Windows x64 with Node.js 24 or later.');
if(Number(process.versions.node.split('.')[0])<24)throw new Error('Node.js 24 or later is required.');
const buildId=new Date().toISOString().replace(/\D/g,'');
const work=join(root,'dist','portable-build',buildId),stage=join(work,'app');
const output=join(root,'dist','portable');
await mkdir(stage,{recursive:true});await mkdir(output,{recursive:true});
for(const name of ['AMOS.xlsx','AOG.xlsm','FAK.xlsx','MARSHALING.xlsx','PS Volume Data.xlsx']){
 await stat(join(root,'data','dashboard-sources',name));
}
console.log('Building the local interface...');
execFileSync(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build'],{cwd:join(root,'apps/frontend'),stdio:'inherit',env:{...process.env,VITE_DESKTOP_APP:desktop?'1':'0'}});
await build({entryPoints:['scripts/portable/server.ts'],outfile:join(stage,'server.mjs'),bundle:true,packages:'external',platform:'node',format:'esm',target:'node24'});
await cp('scripts/portable/bootstrap.mjs',join(stage,'bootstrap.mjs'));
await cp('apps/frontend/dist',join(stage,'public'),{recursive:true});
await mkdir(join(stage,'private'),{recursive:true});
for(const name of ['dashboard-source.html','permits-dashboard.html'])await cp(join('apps/backend/private',name),join(stage,'private',name));
await cp('database/migrations',join(stage,'migrations'),{recursive:true});
await cp(process.execPath,join(stage,'node.exe'));
await cp(join(dirname(process.execPath),'LICENSE'),join(stage,'NODE-LICENSE.txt'));
await writeFile(join(stage,'package.json'),JSON.stringify({private:true,type:'module'}));

// Preserve nested package versions and native SQLite bindings. Copy only the
// production dependency tree; do not copy .env, databases, uploads or exports.
console.log('Packaging installed runtime dependencies...');
const npmCli=join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const listing=execFileSync(process.execPath,[npmCli,'ls','--omit=dev','--all','--parseable'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const moduleRoot=join(root,'node_modules')+sep;
const paths=[...new Set(listing.split(/\r?\n/).map(s=>s.trim()).filter(s=>s.startsWith(moduleRoot)&&!s.startsWith(join(root,'node_modules','@aviation')+sep)))].sort((a,b)=>a.length-b.length);
const copied=[];
for(const path of paths){
 if(copied.some(parent=>path.startsWith(parent+sep)))continue;
 await cp(path,join(stage,relative(root,path)),{recursive:true,dereference:true,filter:source=>!/\.(?:map|d\.[cm]?ts)$/i.test(source)});copied.push(path);
}

// Each nested dashboard is JSON-encoded HTML. Replace remote font links inside
// it as well as in the enclosing page, using the fonts already in this repo.
const localFonts=html=>html.replace(/<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi,'')
 .replace('</head>','<link rel="stylesheet" href="/presentation/fonts.css"></head>');
for(const name of await readdir(join(stage,'private'))){
 if(!name.endsWith('.html'))continue;
 const path=join(stage,'private',name);let text=await readFile(path,'utf8');
 text=text.replace(/(^<script type="application\/json" id="data-(?:amos|aog|fak|marshaling)">)([\s\S]*?)(<\/script>)/gm,(_,open,json,close)=>open+JSON.stringify(localFonts(JSON.parse(json))).replace(/<\/script/gi,'<\\/script')+close);
 await writeFile(path,localFonts(text));
}
const indexPath=join(stage,'public','index.html');await writeFile(indexPath,localFonts(await readFile(indexPath,'utf8')));
await writeFile(join(stage,'build.json'),JSON.stringify({buildId,node:process.version,platform:'win32-x64',offline:true},null,2));
await mkdir(join(output,'dashboard-sources'),{recursive:true});
for(const name of ['AMOS.xlsx','AOG.xlsm','FAK.xlsx','MARSHALING.xlsx','PS Volume Data.xlsx'])await cp(join(root,'data','dashboard-sources',name),join(output,'dashboard-sources',name));
if(desktop){
 console.log('Packaging the Electron desktop application...');
 const electron=join(root,'node_modules','electron','dist');
 await stat(join(electron,'electron.exe'));
 await cp(electron,output,{recursive:true,filter:source=>source!==join(electron,'electron.exe')});
 await cp(join(electron,'electron.exe'),join(output,'AviationInsight.exe'));
 const icon=join(work,'AviationInsight.ico');
 execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'scripts/desktop/create-icon.ps1'),'-Source',join(root,'apps/frontend/public/app-icons/icon-512-v2.png'),'-Output',icon],{stdio:'inherit'});
 await rcedit(join(output,'AviationInsight.exe'),{icon,'version-string':{ProductName:'Aviation Insight',FileDescription:'Aviation Insight Desktop',CompanyName:'Aviation Insight',OriginalFilename:'AviationInsight.exe'},'file-version':'1.0.0','product-version':'1.0.0'});
 const appDir=join(output,'resources','app');
 await mkdir(appDir,{recursive:true});
 const runtimeOutput=join(appDir,'runtime');
 if(relative(output,runtimeOutput)!==join('resources','app','runtime'))throw new Error('Invalid runtime replacement target');
 await rm(runtimeOutput,{recursive:true,force:true});
 await cp(stage,runtimeOutput,{recursive:true});
 await cp('scripts/desktop/main.cjs',join(appDir,'main.cjs'));
 await cp('scripts/desktop/loading.html',join(appDir,'loading.html'));
 await cp(icon,join(appDir,'AviationInsight.ico'));
 await cp('apps/frontend/public/app-icons/icon-512-v2.png',join(appDir,'logo.png'));
 await writeFile(join(appDir,'package.json'),JSON.stringify({name:'aviation-insight',productName:'Aviation Insight',version:'1.0.0',main:'main.cjs'}));
 // Chromium's sandbox must be able to read its installed assets. Workspace
 // ACLs can otherwise cause a native breakpoint before the window appears.
 // Grant read/execute only to application assets, never the local data folder.
 const appRead='*S-1-15-2-1:(RX)',assetRead='*S-1-15-2-1:(OI)(CI)(RX)';
 const grantRead=(path,access)=>{
  const acl=execFileSync('icacls.exe',[path],{encoding:'utf8'});
  if(/(?:ALL APPLICATION PACKAGES|S-1-15-2-1):/.test(acl))return;
  execFileSync('icacls.exe',[path,'/grant',access],{stdio:'pipe'});
 };
 grantRead(output,appRead);
 for(const entry of await readdir(output,{withFileTypes:true})){
  // Runtime logs are not application assets and may be owned or locked by a prior run.
  if(entry.isFile()&&!entry.name.toLowerCase().endsWith('.log'))grantRead(join(output,entry.name),appRead);
 }
 for(const name of ['resources','locales'])grantRead(join(output,name),assetRead);
}else{
const launcher=join(work,'Launcher.cs');await writeFile(launcher,(await readFile('scripts/portable/Launcher.cs','utf8')).replace('__BUILD_ID__',buildId));
console.log('Creating the self-extracting EXE. This may take a few minutes...');
execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'scripts/portable/Pack.ps1'),'-Stage',stage,'-Payload',join(work,'payload.zip'),'-Launcher',launcher,'-Output',join(output,'AviationInsight.exe')],{stdio:'inherit'});
}
await cp('docs/PORTABLE.md',join(output,'README.md'));
const exe=await readFile(join(output,'AviationInsight.exe'));
await writeFile(join(output,'SHA256.txt'),createHash('sha256').update(exe).digest('hex')+'  AviationInsight.exe\n');
console.log(`\nCreated ${join(output,'AviationInsight.exe')} (${desktop?'Electron desktop app':Math.round(exe.length/1024/1024)+' MB'}).\nDouble-click the EXE to start. No Node.js installation or internet is required to run it.\nBuild staging: ${stage}`);
