import { workbookDates } from './report-dates.js';

export const datasets = ['amos', 'fak', 'aog', 'marshaling', 'psvolume'];
type DataEnv = { FILES: LocalFileStore; };
type Manual = { dashboard: string; fileName: string; size: number; updatedAt: string; source: 'manual'|'project'; key: string };
const pointer = (dashboard: string) => `dashboard-data/${dashboard}/latest.json`;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function manualData(env: DataEnv, dashboard: string): Promise<Manual | null> {
  const object = await env.FILES.get(pointer(dashboard));
  return object ? object.json<Manual>() : null;
}
export async function currentData(env: DataEnv, dashboard: string) {
 const manual=await manualData(env,dashboard);
 return {metadata:manual,manual};
}

export async function currentFile(env: DataEnv, dashboard: string): Promise<Response> {
  const selected = await currentData(env, dashboard);
  if (selected.manual) {
    const file = await env.FILES.get(selected.manual.key);
    if (!file) return json({ error: 'Saved Excel file unavailable' }, 503);
    return new Response(file.body, { headers: { 'Content-Type': selected.manual.fileName.toLowerCase().endsWith('.xlsm') ? 'application/vnd.ms-excel.sheet.macroEnabled.12' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store' } });
  }
  return json({error:'No local workbook is available. Check the Excel source folder or upload a workbook in Admin.'},404);
}
export async function dataAdmin(request: Request, env: DataEnv): Promise<Response> {
  if (request.method === 'GET') {
    const entries = await Promise.all(datasets.map(async dashboard => [dashboard, (await currentData(env, dashboard)).metadata]));
    return json({ dashboards: Object.fromEntries(entries) });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 26 * 1024 * 1024) return json({ error: 'Maximum file size is 25 MB.' }, 413);
  try {
    const form = await request.formData();
    const dashboard = String(form.get('dashboard') || '');
    const file = form.get('file');
    if (!datasets.includes(dashboard) || !(file instanceof File)) return json({ error: 'Choose a dashboard and an Excel file.' }, 400);
    if (!/\.xls[xm]$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024) return json({ error: 'Upload a non-empty .xlsx or .xlsm file up to 25 MB.' }, 400);
    const bytes = await file.arrayBuffer();
    // Parse the same primary sheet/date columns used by reporting before replacing data.
    const dates = await workbookDates(bytes, dashboard);
    const updatedAt = new Date().toISOString();
    const extension = file.name.toLowerCase().endsWith(".xlsm") ? "xlsm" : "xlsx";
    const key = `dashboard-data/${dashboard}/${crypto.randomUUID()}.${extension}`;
    const metadata: Manual = { dashboard, fileName: file.name, size: file.size, updatedAt, source: 'manual', key };
    await env.FILES.put(key, bytes, { httpMetadata: { contentType: extension === 'xlsm' ? 'application/vnd.ms-excel.sheet.macroEnabled.12' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    await env.FILES.put(pointer(dashboard), JSON.stringify(metadata));
    return json({ success: true, metadata, dates: dates.size });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not save Excel file.' }, 400);
  }
}
