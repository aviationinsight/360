import {timingSafeEqual} from 'node:crypto';
const secretEqual=(a:string,b:string)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
import { renderRemoteReport } from './renderer.js';
import { currentFile } from './dashboard-data.js';
import { workbookDates } from './report-dates.js';
export const reportDashboards=['amos','fak','aog','marshaling'];
const syncOrigin=process.env.SYNC_ORIGIN || 'https://aviation-dashboard-sync.aviationinsight4.workers.dev';
const siteOrigin=process.env.PUBLIC_ORIGIN!;
export interface ReportEnv { DB:LegacyDatabase; REPORT_FILES:ObjectStore; REPORT_SYNC_SECRET?:string; REPORT_EMAIL_HOOK?:string; REPORT_EMAIL_ENABLED?:string; }
type Job={id:string;period_start:string;period_end:string;status:string;stage:number;test_mode:number;updated_at:string;error:string|null;download_token:string};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function sign(s:string,secret:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(s)));}
export async function reportCookie(job:Job,dashboard:string,env:ReportEnv){const raw=`${job.id}.${dashboard}.${Date.now()+10*60000}`;return `${raw}.${await sign(raw,env.REPORT_SYNC_SECRET!)}`;}
export async function reportGrant(request:Request,env:ReportEnv):Promise<{job:Job;dashboard:string}|null>{
  if(!env.REPORT_SYNC_SECRET)return null;
  const value=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('aviation_report='))?.slice(16)||'';
  const [id,dashboard,expiry,signature]=value.split('.');
  if(!reportDashboards.includes(dashboard)||!id||(!Number.isFinite(Number(expiry))||Number(expiry)<Date.now())||!signature)return null;
  if(!secretEqual(signature,await sign(`${id}.${dashboard}.${expiry}`,env.REPORT_SYNC_SECRET)))return null;
  const job=await env.DB.prepare('SELECT * FROM report_runs WHERE id=?').bind(id).first<Job>();
  return job&&['pending','processing','error'].includes(job.status)?{job,dashboard}:null;
}
async function getJob(env:ReportEnv,id:string){return env.DB.prepare('SELECT * FROM report_runs WHERE id=?').bind(id).first<Job>();}
async function saveState(env:ReportEnv,id:string,status:string,stage:number,error:string|null=null){await env.DB.prepare('UPDATE report_runs SET status=?,stage=?,error=?,updated_at=? WHERE id=?').bind(status,stage,error,new Date().toISOString(),id).run();}
const key=(job:Job,dataset:string,kind='png')=>`reports/${job.id}/${dataset}.${kind}`;
export async function reportEndpoint(request:Request,env:ReportEnv,admin:boolean):Promise<Response|null>{
  const url=new URL(request.url);
  const attachment=url.pathname.match(/^\/api\/reports\/attachment\/([a-z0-9_-]+)\/(amos|fak|aog|marshaling)\.png$/);
  if(attachment&&request.method==='GET'){
    const job=await getJob(env,attachment[1]);
    if(!job||url.searchParams.get('token')!==job.download_token)return json({error:'Not found'},404);
    const file=await env.REPORT_FILES.get(key(job,attachment[2]));
    if(!file)return json({error:'Report image not ready'},404);
    return new Response(file.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="${attachment[2].toUpperCase()}_${job.period_start}_${job.period_end}.png"`,'X-Content-Type-Options':'nosniff'}});
  }
  if(!url.pathname.startsWith('/api/reports/'))return null;
  const service=Boolean(env.REPORT_SYNC_SECRET&&secretEqual(request.headers.get('X-Report-Secret')||'',env.REPORT_SYNC_SECRET));
  if(!service&&!admin)return json({error:'Unauthorized'},401);
  try{
    if(url.pathname==='/api/reports/status'&&request.method==='GET'){
      const rows=await env.DB.prepare('SELECT id,period_start,period_end,status,stage,test_mode,error,updated_at FROM report_runs ORDER BY updated_at DESC LIMIT 12').all();return json({reports:rows.results});
    }
    if(url.pathname==='/api/reports/check'&&request.method==='POST'){
      const body=await (request.json() as Promise<{test?:boolean;period_end?:string}>).catch(()=>({} as {test?:boolean;period_end?:string}));
      // A specific historic test is deliberately separate from the automatic production periods.
      const test=body.test===true;
      const localToday=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
      const ends:string[]=[];
      if(test){if(!/^\d{4}-\d{2}-(12|26)$/.test(body.period_end||'')||body.period_end!>localToday)return json({error:'Choose an existing 12th or 26th test period'},400);ends.push(body.period_end!);}
      else {
        // Retain overdue periods after month rollover. Automatic delivery begins October 2026.
        const current=localToday.slice(0,7), previous=new Date(Date.UTC(Number(current.slice(0,4)),Number(current.slice(5))-2,1)).toISOString().slice(0,7);
        for(const month of [previous,current])for(const day of ['12','26']){const end=`${month}-${day}`;if(end>= '2026-10-01'&&end<=localToday)ends.push(end);}
      }
      if(!ends.length)return json({status:'waiting',message:'No reporting cutoff has passed yet'});
      const existingOutcomes=[];
      for(let i=ends.length-1;i>=0;i--){const id=`${test?'test':'report'}_${ends[i]}`,existing=await getJob(env,id);if(existing){existingOutcomes.unshift({id,status:existing.status});ends.splice(i,1);}}
      if(!ends.length)return json({outcomes:existingOutcomes});
      // Read all actual primary date columns; upload timestamps never imply readiness.
      const snapshots:Record<string,ArrayBuffer>={}, dates:Record<string,Set<string>>={};
      for(const dashboard of reportDashboards){const response=await currentFile(env,dashboard);if(!response.ok)throw new Error(`${dashboard} Excel is unavailable`);const bytes=await response.arrayBuffer();snapshots[dashboard]=bytes;dates[dashboard]=await workbookDates(bytes,dashboard);}
      const outcomes:Record<string,unknown>[]=[...existingOutcomes];
      for(const end of ends){
        const id=`${test?'test':'report'}_${end}`;
        const existing=await getJob(env,id);
        if(existing){outcomes.push({id,status:existing.status});continue;}
        const missing=reportDashboards.filter(d=>!dates[d].has(end));
        if(missing.length){outcomes.push({period_end:end,status:'waiting',missing});continue;}
        // Store immutable Excel snapshots, so sequential images all reflect the same checked data.
        const token=crypto.randomUUID().replace(/-/g,'');
        const inserted=await env.DB.prepare("INSERT OR IGNORE INTO report_runs(id,period_start,period_end,status,stage,test_mode,updated_at,download_token) VALUES(?,?,?,'preparing',0,?,?,?)").bind(id,end.slice(0,7)+'-01',end,test?1:0,new Date().toISOString(),token).run();
        if(!inserted.meta.changes){outcomes.push({id,status:'already queued'});continue;}
        const job=await getJob(env,id);
        try{for(const d of reportDashboards)await env.REPORT_FILES.put(key(job!,d,'xlsx'),snapshots[d]);await saveState(env,id,'pending',0);outcomes.push({id,status:'pending'});}catch(error){await saveState(env,id,'error',0,String(error));throw error;}
      }
      return json({outcomes});
    }
    if(url.pathname==='/api/reports/rebuild-test'&&request.method==='POST'){
      if(env.REPORT_EMAIL_ENABLED==='true')return json({error:'Pause report email before rebuilding a test'},409);
      const body=await (request.json() as Promise<{id?:string}>);
      const job=body.id?await getJob(env,body.id):null;
      if(!job||!job.test_mode||!['ready','error'].includes(job.status))return json({error:'Only an unsent, inactive test can be rebuilt'},409);
      const reset=await env.DB.prepare("UPDATE report_runs SET status='pending',stage=0,error=NULL,updated_at=? WHERE id=? AND test_mode=1 AND status IN ('ready','error')").bind(new Date().toISOString(),job.id).run();
      return json({id:job.id,status:reset.meta.changes?'pending':'busy'});
    }
    if(url.pathname==='/api/reports/process'&&request.method==='POST'){
      await env.DB.prepare("UPDATE report_runs SET status='error',error='Rendering interrupted; retrying' WHERE status='processing' AND stage<4 AND updated_at<?").bind(new Date(Date.now()-15*60000).toISOString()).run();
      const job=await env.DB.prepare("SELECT * FROM report_runs WHERE status='pending' OR (status='ready' AND ?='true') OR (status='error' AND updated_at<?) ORDER BY period_end,test_mode DESC LIMIT 1").bind(env.REPORT_EMAIL_ENABLED || 'false',new Date(Date.now()-15*60000).toISOString()).first<Job>();
      if(!job)return json({status:'idle'});
      const claimed=await env.DB.prepare("UPDATE report_runs SET status='processing',updated_at=? WHERE id=? AND status IN ('pending','error','ready')").bind(new Date().toISOString(),job.id).run();
      if(!claimed.meta.changes)return json({status:'busy'});
      try{
        if(job.stage<4){
          const dashboard=reportDashboards[job.stage], token=await reportCookie(job,dashboard,env);
          const response=await renderRemoteReport(`${siteOrigin}/report-render?dashboard=${dashboard}&from=${job.period_start}&to=${job.period_end}`,`aviation_report=${token}`);
          if(!response.ok)throw new Error(`Rendering ${dashboard}: ${response.status} ${(await response.text()).slice(0,500)}`);
          const png=await response.arrayBuffer(),signature=new Uint8Array(png);
          if(png.byteLength<10000||signature[0]!==137||signature[1]!==80)throw new Error(`Invalid ${dashboard} report image`);
          await env.REPORT_FILES.put(key(job,dashboard),png,{httpMetadata:{contentType:'image/png'}});
          await saveState(env,job.id,'pending',job.stage+1);
          return json({id:job.id,status:'image ready',dashboard,images:job.stage+1});
        }
        if(env.REPORT_EMAIL_ENABLED!=='true'){await saveState(env,job.id,'ready',4);return json({id:job.id,status:'ready',message:'Four images ready; email paused until attachments are configured'});}
        if(!env.REPORT_EMAIL_HOOK)throw new Error('Report email webhook is not configured');
        for(const d of reportDashboards)if(!await env.REPORT_FILES.head(key(job,d)))throw new Error(`${d} report image missing`);
        const attachments=reportDashboards.map(d=>`${siteOrigin}/api/reports/attachment/${job.id}/${d}.png?token=${job.download_token}`);
        const subject=`${job.test_mode?'[TEST] ':''}Aviation Insight — Performance Report | ${job.period_start} to ${job.period_end}`;
        const text=`Dear Team,\n\nPlease find attached the four dashboard performance reports for ${job.period_start} to ${job.period_end}.\n\nAll four datasets include ${job.period_end}. The report images use the saved Excel data for this period.\n${job.test_mode?'\nThis is a test report for review before enabling delivery to the final recipients.\n':''}\nAviation Insight\nhttps://aviationinsight360.com`;
        // Claim before external delivery. An ambiguous network failure is never automatically resent.
        await saveState(env,job.id,'sending',4);
        const response=await fetch(env.REPORT_EMAIL_HOOK,{signal:AbortSignal.timeout(30000),method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_id:job.id,subject,body:text,period_start:job.period_start,period_end:job.period_end,attachments,attachment_amos:attachments[0],attachment_fak:attachments[1],attachment_aog:attachments[2],attachment_marshaling:attachments[3],test:Boolean(job.test_mode)})});
        if(!response.ok){await saveState(env,job.id,'delivery_unknown',4,`Webhook HTTP ${response.status}; check Zap history before retry`);return json({id:job.id,status:'delivery_unknown'},502);}
        await saveState(env,job.id,'submitted',4);
        return json({id:job.id,status:'submitted',message:'Accepted by Zapier; verify Gmail delivery in Zap history'});
      }catch(error){const latest=await getJob(env,job.id);await saveState(env,job.id,latest?.status==='sending'?'delivery_unknown':'error',job.stage,error instanceof Error?error.message:String(error));throw error;}
    }
    return json({error:'Not found'},404);
  }catch(error){console.error('[reports] operation failed');return json({error:'Report processing failed; check the restricted job status'},500);}
}
export async function snapshotFile(env:ReportEnv,job:Job,dashboard:string){return env.REPORT_FILES.get(key(job,dashboard,'xlsx'));}
