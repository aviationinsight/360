import {env} from 'cloudflare:workers';
import {launch} from '@cloudflare/playwright';
import {config} from '../apps/backend/src/config.js';
export async function renderRemoteReport(url:string,cookie:string){
 if(new URL(url).origin!==config.PUBLIC_ORIGIN)throw new Error('Invalid render origin');
 const browser=await launch(env.BROWSER);
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2});
  const separator=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:config.PUBLIC_ORIGIN,httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.getElementById('report-ready')||document.getElementById('report-failed'),{},{timeout:180000});
  const image=page.locator('#report-ready');if(!await image.count())throw new Error('Report renderer failed');
  return new Response(new Uint8Array(await image.screenshot({type:'png'})),{headers:{'Content-Type':'image/png'}});
 }finally{await browser.close();}
}
