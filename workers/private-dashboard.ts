import dashboard from '../apps/backend/private/dashboard-source.html';
import permits from '../apps/backend/private/permits-dashboard.html';
export async function privateDashboard(name:string){return name==='permits'?permits:dashboard;}
