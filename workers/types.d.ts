/// <reference types="@cloudflare/workers-types" />
declare module '*.html' {const text:string;export default text;}
declare namespace Cloudflare {
 interface Env {REPORT_FILES:R2Bucket;BROWSER:import('@cloudflare/playwright').BrowserWorker;}
}
