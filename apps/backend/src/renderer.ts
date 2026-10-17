import {config} from './config.js';
export async function renderRemoteReport(url:string,cookie:string){
 if(new URL(url).origin!==config.PUBLIC_ORIGIN)throw new Error('Invalid render origin');
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 try{const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2});const [name,value]=cookie.split('=');await context.addCookies([{name,value,url:config.PUBLIC_ORIGIN,httpOnly:true,secure:config.PUBLIC_ORIGIN.startsWith('https://'),sameSite:'Lax'}]);const page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>document.getElementById('report-ready')||document.getElementById('report-failed'),{},{timeout:180000});const img=page.locator('#report-ready');if(!await img.count())throw new Error('Report renderer failed');const png=await img.screenshot({type:'png'});return new Response(new Uint8Array(png),{headers:{'Content-Type':'image/png'}})}finally{await browser.close()}
}
