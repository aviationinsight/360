import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {secureHeaders} from 'hono/secure-headers';
import {bodyLimit} from 'hono/body-limit';
import {eq,and,sql} from 'drizzle-orm';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {z} from 'zod';
import {timingSafeEqual,randomUUID} from 'node:crypto';
import {db,client,legacyDB} from './db.js';
import {auth} from './auth.js';
import {config} from './config.js';
import {objects} from './storage.js';
import {user,account,session,permission} from '../../../database/schema/index.js';
import {dashboardKeys,type Principal} from '../../../packages/shared/src/index.js';
import {currentData,currentFile,dataAdmin} from './dashboard-data.js';
import {reportEndpoint,reportGrant,snapshotFile} from './report-service.js';
import {hash} from './password.js';
const env={DB:legacyDB,REPORT_FILES:objects,...config};
const app=new Hono<{Variables:{principal:Principal|null;grant:Awaited<ReturnType<typeof reportGrant>>}}>();
const equal=(a:string,b:string)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const service=(request:Request)=>Boolean(config.REPORT_SYNC_SECRET&&equal(request.headers.get('X-Report-Secret')||'',config.REPORT_SYNC_SECRET));
app.use('*',secureHeaders({xFrameOptions:'SAMEORIGIN',referrerPolicy:'same-origin',crossOriginResourcePolicy:'same-origin'}));
app.use('*',cors({origin:config.PUBLIC_ORIGIN,credentials:true,allowMethods:['GET','POST','PATCH','DELETE','OPTIONS'],allowHeaders:['Content-Type','X-Report-Secret']}));
app.use('*',bodyLimit({maxSize:26*1024*1024,onError:c=>c.json({error:'Request too large'},413)}));
app.use('*',async(c,next)=>{c.header('Cache-Control','no-store');if(['POST','PATCH','DELETE','PUT'].includes(c.req.method)&&!service(c.req.raw)&&c.req.header('origin')!==config.PUBLIC_ORIGIN)return c.json({error:'Invalid origin'},403);await next()});
app.use('*',async(c,next)=>{
 if(c.req.path.startsWith('/api/auth')||/login$/.test(c.req.path)){
  // Do not trust a forwarded IP from the public internet. Shared login budget is persistent across restarts/replicas.
  const key='authentication',window=Math.floor(Date.now()/60000);
  const result=await client.execute({sql:'INSERT INTO rate_limit(key,count,window) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count',args:[key,window]});
  if(Number(result.rows[0].count)>90){c.header('Retry-After','60');return c.json({error:'Too many attempts; retry shortly'},429)}
 }
 await next();
});
app.get('/health/live',c=>c.json({status:'ok'}));
app.get('/health/ready',async c=>{await client.execute('SELECT 1');return c.json({status:'ready'})});
app.use('*',async(c,next)=>{
 const grant=await reportGrant(c.req.raw,env);c.set('grant',grant);
 const info=await auth.api.getSession({headers:c.req.raw.headers});let principal:Principal|null=null;
 if(info){const rows=await db.select().from(user).where(eq(user.id,info.user.id));const u=rows[0];if(u?.active){const access=await db.select().from(permission).where(eq(permission.userId,u.id));principal={id:u.id,name:u.name,role:u.role as Principal['role'],canExport:u.canExport,permissions:Object.fromEntries(dashboardKeys.map(k=>[k,u.role==='admin'||(u.role==='general'&&k!=='permits')||access.some(p=>p.dashboard===k&&p.allowed)])) as Principal['permissions']}}}
 c.set('principal',principal);await next();
});
app.all('/api/auth/*',async c=>{
 // Original application is administrator-provisioned. No anonymous sign-up or role assignment.
 if(c.req.path.includes('/sign-up/'))return c.json({error:'Accounts are created by an administrator'},403);
 return auth.handler(c.req.raw);
});
app.get('/api/me',c=>{const p=c.get('principal'),grant=c.get('grant');if(p)return c.json(p);if(grant)return c.json({id:'report-render',name:'Report renderer',role:'report',canExport:true,permissions:{[grant.dashboard]:true},report:true});return c.json({error:'Unauthorized'},401)});
for(const [route,kind] of [['/api/login','general'],['/api/employee-login','employee'],['/api/admin-login','admin']] as const){
 app.post(route,async c=>{
  const form=await c.req.formData();const password=String(form.get('password')||'');let username=String(form.get('username')||'').trim().toLowerCase();
  if(kind==='general')username='executive.portal';
  if(password.length>128||username.length>40)return c.redirect('/login?error=1',303);
  const found=(await db.select().from(user).where(eq(user.username,username)))[0];
  const failure=kind==='admin'?'admin_error':kind==='employee'?'employee_error':'error';
  if(!found?.active||(kind==='admin'&&found.role!=='admin'))return c.redirect(`/login?${failure}=1`,303);
  const response=await auth.api.signInUsername({body:{username,password},headers:c.req.raw.headers,asResponse:true});
  if(!response.ok)return c.redirect(`/login?${failure}=1`,303);
  const headers=new Headers({Location:'/portal?welcome=1','Cache-Control':'no-store'});for(const cookie of response.headers.getSetCookie())headers.append('Set-Cookie',cookie);return new Response(null,{status:303,headers});
 });
}
app.post('/api/logout',async c=>{const r=await auth.api.signOut({headers:c.req.raw.headers,asResponse:true});const h=new Headers({Location:'/'});for(const cookie of r.headers.getSetCookie())h.append('Set-Cookie',cookie);return new Response(null,{status:303,headers:h})});
const permissionBody=z.object({name:z.string().trim().min(1).max(120),canAmos:z.boolean().default(false),canAog:z.boolean().default(false),canFak:z.boolean().default(false),canMarshaling:z.boolean().default(false),canPermits:z.boolean().default(false),canExport:z.boolean().default(false),isAdmin:z.boolean().default(false),active:z.boolean().default(true),password:z.string().max(128).optional(),email:z.string().email().optional()});
async function applyPermissions(id:string,b:z.infer<typeof permissionBody>){for(const key of dashboardKeys){const field=('can'+key[0].toUpperCase()+key.slice(1)) as keyof typeof b;await db.insert(permission).values({userId:id,dashboard:key,allowed:Boolean(b[field])}).onConflictDoUpdate({target:[permission.userId,permission.dashboard],set:{allowed:Boolean(b[field])}})}}
app.use('/api/admin/*',async(c,next)=>{if(c.get('principal')?.role!=='admin')return c.json({error:'Forbidden'},403);await next()});
app.get('/api/admin/users',async c=>{const users=await db.select().from(user).where(sql`username != 'executive.portal'`);const grants=await db.select().from(permission);return c.json({users:users.map(u=>({id:u.legacyId||u.id,name:u.name,username:u.username,email:u.email.endsWith('@legacy.invalid')?null:u.email,is_admin:Number(u.role==='admin'),can_export:Number(u.canExport),active:Number(u.active),created_at:u.createdAt.toISOString(),updated_at:u.updatedAt.toISOString(),...Object.fromEntries(dashboardKeys.map(k=>['can_'+k,Number(grants.some(g=>g.userId===u.id&&g.dashboard===k&&g.allowed))]))}))})});
app.post('/api/admin/users',async c=>{const b=permissionBody.extend({username:z.string().regex(/^[a-z0-9._-]{3,40}$/),password:z.string().min(8).max(128)}).parse(await c.req.json());const id=randomUUID(),now=new Date();await db.transaction(async tx=>{await tx.insert(user).values({id,name:b.name,email:b.email||`${b.username}@legacy.invalid`,emailVerified:false,username:b.username,displayUsername:b.username,role:b.isAdmin?'admin':'employee',active:true,canExport:b.canExport,createdAt:now,updatedAt:now});await tx.insert(account).values({id:randomUUID(),userId:id,accountId:id,providerId:'credential',password:await hash(b.password),createdAt:now,updatedAt:now})});await applyPermissions(id,b);return c.json({ok:true},201)});
app.patch('/api/admin/users/:id',async c=>{const b=permissionBody.parse(await c.req.json());if(b.password&&b.password.length<8)return c.json({error:'Password must contain at least 8 characters'},400);const raw=c.req.param('id');const u=(await db.select().from(user).where(/^\d+$/.test(raw)?eq(user.legacyId,Number(raw)):eq(user.id,raw)))[0];if(!u)return c.json({error:'Not found'},404);if(u.id===c.get('principal')!.id&&(!b.isAdmin||!b.active))return c.json({error:'Cannot remove your own administrator access'},409);await db.update(user).set({name:b.name,role:b.isAdmin?'admin':'employee',active:b.active,canExport:b.canExport,updatedAt:new Date(),...(b.email?{email:b.email,emailVerified:false}:{})}).where(eq(user.id,u.id));await applyPermissions(u.id,b);if(b.password)await db.update(account).set({password:await hash(b.password),updatedAt:new Date()}).where(and(eq(account.userId,u.id),eq(account.providerId,'credential')));await db.delete(session).where(eq(session.userId,u.id));return c.json({ok:true})});
app.delete('/api/admin/users/:id',async c=>{const raw=c.req.param('id');const u=(await db.select().from(user).where(/^\d+$/.test(raw)?eq(user.legacyId,Number(raw)):eq(user.id,raw)))[0];if(!u)return c.json({error:'Not found'},404);if(u.id===c.get('principal')!.id)return c.json({error:'Cannot delete your own account'},409);await db.delete(user).where(eq(user.id,u.id));return c.json({ok:true})});
app.on(['GET','POST'],'/api/admin/dashboard-data',c=>dataAdmin(c.req.raw,env));
app.all('/api/reports/*',async c=>await reportEndpoint(c.req.raw,env,c.get('principal')?.role==='admin')||c.json({error:'Not found'},404));
app.get('/api/dashboard-sync/:dashboard/:resource',async c=>{
 const d=c.req.param('dashboard'),resource=c.req.param('resource');if(!['amos','aog','fak','marshaling'].includes(d)||!['metadata','file'].includes(resource))return c.json({error:'Not found'},404);
 const grant=c.get('grant');if(grant?.dashboard===d){if(resource==='metadata')return c.json({updatedAt:grant.job.updated_at,dashboard:d,reportSnapshot:true});const f=await snapshotFile(env,grant.job,d);return f?new Response(f.body,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Cache-Control':'no-store'}}):c.json({error:'Snapshot missing'},404)}
 const p=c.get('principal');if(!p)return c.json({error:'Unauthorized'},401);if(!p.permissions[d as keyof typeof p.permissions])return c.json({error:'Forbidden'},403);
 if(resource==='metadata')return c.json({success:true,dashboard:d,metadata:(await currentData(env,d)).metadata});const response=await currentFile(env,d);if(!response.ok)return c.json({error:'Excel temporarily unavailable'},502);return new Response(response.body,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Cache-Control':'no-store'}});
});
app.post('/api/dashboard-sync/client-event',async c=>{if(!c.get('principal')&&!c.get('grant'))return c.json({error:'Unauthorized'},401);z.object({dashboard:z.string().max(12),status:z.string().max(24)}).passthrough().parse(await c.req.json());return c.body(null,204)});
app.get('/secure-dashboard',async c=>{
 const d=c.req.query('tab')||'amos',p=c.get('principal'),grant=c.get('grant');if(!dashboardKeys.includes(d as never))return c.json({error:'Not found'},404);if(!p&&grant?.dashboard!==d)return c.redirect('/login',303);if(p&&!p.permissions[d as keyof typeof p.permissions])return c.json({error:'Forbidden'},403);if(c.req.query('export')==='1'&&!p?.canExport&&grant?.dashboard!==d)return c.json({error:'Export forbidden'},403);
 let html=await readFile(resolve(process.env.PRIVATE_SOURCE_DIR||'apps/backend/private',d==='permits'?'permits-dashboard.html':'dashboard-source.html'),'utf8');
 if(d!=='permits'){
  // Do not send other departments' embedded baseline records to restricted accounts.
  for(const key of ['amos','aog','fak','marshaling'])if(key!==d)html=html.replace(new RegExp('(<script type="application/json" id="data-'+key+'">)[\\s\\S]*?(</script>)'),'$1""$2');
  html=html.replace(/<\/body>\s*<\/html>\s*$/,`<script>try{showTab("${d}")}catch(e){}</script></body></html>`);
 }
 if(c.req.query('embedded')==='1')html=html.replace('</head>','<style>.topbar{display:none!important}body{overflow-x:hidden!important}.frame-area{width:100%!important}</style></head>');
 return c.html(html);
});
app.notFound(c=>c.json({error:'Not found'},404));
app.onError((error,c)=>{if(error instanceof z.ZodError)return c.json({error:'Invalid request',issues:error.issues.map(i=>({path:i.path,message:i.message}))},400);console.error('Request failed',c.req.method,c.req.path,error.name);return c.json({error:'Request failed'},500)});
export default app;
