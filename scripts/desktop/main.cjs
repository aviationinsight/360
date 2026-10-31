const {app,BrowserWindow,Menu,dialog,shell,crashReporter}=require('electron');
const {spawn,execFileSync}=require('node:child_process');
const {mkdirSync,appendFileSync,openSync,closeSync,existsSync}=require('node:fs');
const {join,dirname}=require('node:path');

const home=dirname(process.execPath);
const data=process.env.AVIATION_DATA_DIR||join(home,'AviationInsight-data');
const projectSources=join(home,'..','..','data','dashboard-sources');
const sources=process.env.AVIATION_SOURCE_DIR||(existsSync(projectSources)?projectSources:join(home,'dashboard-sources'));
mkdirSync(data,{recursive:true});
app.setName('Aviation Insight');
app.setAppUserModelId('com.aviationinsight.desktop');
app.setPath('userData',join(data,'desktop'));
const logs=join(data,'logs');
mkdirSync(logs,{recursive:true});
app.commandLine.appendSwitch('enable-logging','file');
app.commandLine.appendSwitch('log-file',join(logs,'electron.log'));
app.setPath('crashDumps',join(logs,'crashes'));
crashReporter.start({uploadToServer:false});
let window,server,origin,quitting=false;
const log=message=>appendFileSync(join(data,'desktop.log'),String(message)+'\n');
log(`${new Date().toISOString()} Starting Electron ${process.versions.electron}, PID ${process.pid}`);
app.on('child-process-gone',(_event,details)=>log(`Child process stopped: ${JSON.stringify(details)}`));
app.on('render-process-gone',(_event,_contents,details)=>log(`Window renderer stopped: ${JSON.stringify(details)}`));
function fail(error){
 log(error.stack||error);
 dialog.showErrorBox('Aviation Insight',`${error.message||error}\n\nDetails: ${join(data,'desktop.log')}`);
 app.quit();
}
const allowed=url=>{
 try{return new URL(url).origin===origin;}catch{return false;}
};
function guard(contents){
 contents.setWindowOpenHandler(({url})=>allowed(url)?{
  action:'allow',overrideBrowserWindowOptions:{title:'Aviation Insight',icon:join(__dirname,'AviationInsight.ico'),autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}
 }:{action:'deny'});
 contents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault();});
 contents.on('will-attach-webview',event=>event.preventDefault());
 contents.on('did-create-window',child=>guard(child.webContents));
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(async()=>{
  // The previous console edition holds this file with exclusive Windows sharing.
  const legacyLock=join(data,'running.lock');
  if(existsSync(legacyLock)){
   try{closeSync(openSync(legacyLock,'r+'));}
   catch{throw new Error('Close the previous Aviation Insight console window, then open this app again.');}
  }
  window=new BrowserWindow({width:1440,height:940,minWidth:900,minHeight:650,title:'Aviation Insight',icon:join(__dirname,'AviationInsight.ico'),backgroundColor:'#eef4f8',show:false,
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.once('ready-to-show',()=>window.show());
  window.on('page-title-updated',event=>event.preventDefault());
  guard(window.webContents);
  window.on('closed',()=>app.quit());
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
   callback({cancel:!allowed(details.url)&&!details.url.startsWith('file:')&&!/^(data:|blob:|devtools:)/.test(details.url)});
  });
  window.webContents.session.on('will-download',(_event,item)=>{
   const downloads=app.getPath('downloads');
   item.setSaveDialogOptions({defaultPath:join(downloads,item.getFilename())});
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
   {label:'File',submenu:[
    {label:'Open data folder',click:()=>shell.openPath(data)},
    {label:'Open Excel source folder',click:()=>shell.openPath(sources)},
    {label:'Open first-run login details',click:()=>shell.openPath(join(data,'First-run-login.txt'))},
    {type:'separator'},{role:'quit'}]},
   {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
   {label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
  ]));
  await window.loadFile(join(__dirname,'loading.html'));
  const runtime=join(__dirname,'runtime');
  server=spawn(join(runtime,'node.exe'),[join(runtime,'bootstrap.mjs')],{
   cwd:runtime,windowsHide:true,env:{...process.env,AVIATION_DATA_DIR:data,AVIATION_SOURCE_DIR:sources,AVIATION_NO_BROWSER:'1',AVIATION_NO_PAUSE:'1'},
   stdio:['ignore','pipe','pipe','ipc']
  });
  server.stdout.on('data',log);server.stderr.on('data',log);
  const ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('The local app did not start within two minutes.')),120000);
   server.once('error',error=>{clearTimeout(timer);reject(error);});
   server.once('exit',code=>{clearTimeout(timer);if(!quitting)reject(new Error(`The local app stopped (code ${code}).`));});
   server.once('message',message=>{clearTimeout(timer);if(message?.type==='aviation-ready')resolve(message.url);else reject(new Error('Unexpected startup response.'));});
  });
  origin=await ready;
  server.on('exit',code=>{if(!quitting)fail(new Error(`The local app stopped (code ${code}).`));});
  await window.loadURL(origin+'/login?admin=1');
 }).catch(fail);
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',()=>{
  quitting=true;
  if(server&&server.exitCode===null){
   try{execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});}
   catch{server.kill();}
  }
 });
}
