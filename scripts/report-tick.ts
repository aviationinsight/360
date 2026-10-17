import 'dotenv/config';
const origin=process.env.REPORT_API_ORIGIN||process.env.PUBLIC_ORIGIN,secret=process.env.REPORT_SYNC_SECRET;
if(!origin||!secret)throw new Error('Report origin and service secret required');
for(const action of ['check','process']){const r=await fetch(`${origin}/api/reports/${action}`,{method:'POST',headers:{'X-Report-Secret':secret,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error(`Report ${action}: HTTP ${r.status}`);console.log(action,await r.json())}
