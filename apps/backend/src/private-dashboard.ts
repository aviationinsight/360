import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export function privateDashboard(dashboard:string){
 return readFile(resolve(process.env.PRIVATE_SOURCE_DIR||'apps/backend/private',dashboard==='permits'?'permits-dashboard.html':'dashboard-source.html'),'utf8');
}
