import { workbookDates } from './report-dates.js';
import { createHash } from 'node:crypto';

export const datasets = ['amos', 'fak', 'aog', 'marshaling'];
const origin = process.env.SYNC_ORIGIN || 'https://aviation-dashboard-sync.aviationinsight4.workers.dev';
type DataEnv = { REPORT_FILES: ObjectStore };
type Manual = { dashboard: string; fileName: string; size: number; updatedAt: string; source: 'manual'; key: string };
const pointer = (dashboard: string) => `dashboard-data/${dashboard}/latest.json`;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function manualData(env: DataEnv, dashboard: string): Promise<Manual | null> {
  const object = await env.REPORT_FILES.get(pointer(dashboard));
  return object ? object.json<Manual>() : null;
}
export async function currentData(env: DataEnv, dashboard: string) {
  const manual = await manualData(env, dashboard);
  let automatic: Record<string, unknown> | null = null;
  try {
    const response = await fetch(`${origin}/metadata/${dashboard}?t=${Date.now()}`, {signal: AbortSignal.timeout(15000)});
    if (response.ok) {
      const body = await response.json() as Record<string, unknown>;
      automatic = (body.metadata || body) as Record<string, unknown>;
    }
  } catch { /* A saved manual file remains available during an upstream outage. */ }
  const newer = automatic && Number.isFinite(Date.parse(String(automatic.updatedAt))) &&
    Date.parse(String(automatic.updatedAt)) > Date.parse(manual?.updatedAt || '1970-01-01');
  if (manual && !newer) return { metadata: manual, manual };
  return { metadata: automatic ? { ...automatic, dashboard, source: 'automatic' } : null, manual: null };
}

const workbookDownloads = new WeakMap<ObjectStore, Map<string, Promise<ArrayBuffer>>>();
const workbookHeaders = { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store' };
async function automaticWorkbook(env: DataEnv, dashboard: string, metadata: Record<string, unknown> | null): Promise<ArrayBuffer> {
  const version = String(metadata?.updatedAt || '');
  const key = version ? 'dashboard-cache/' + dashboard + '/' + createHash('sha256').update(version).digest('hex') + '.xlsx' : null;
  if (key) { const cached = await env.REPORT_FILES.get(key); if (cached) return cached.arrayBuffer(); }
  let pending = workbookDownloads.get(env.REPORT_FILES);
  if (!pending) { pending = new Map(); workbookDownloads.set(env.REPORT_FILES, pending); }
  const requestKey = dashboard + ':' + version;
  const existing = pending.get(requestKey); if (existing) return existing;
  const download = (async () => {
    // The current AMOS workbook is ~23 MB. A 30-second total timeout aborted it
    // on slower links, leaving clients permanently on the embedded August data.
    const response = await fetch(origin + '/' + dashboard + '.xlsx?t=' + Date.now(), { signal: AbortSignal.timeout(15 * 60 * 1000) });
    if (!response.ok) throw new Error('Workbook download failed: HTTP ' + response.status);
    const bytes = await response.arrayBuffer();
    const signature = new Uint8Array(bytes);
    if (signature[0] !== 80 || signature[1] !== 75) throw new Error('Workbook service did not return an XLSX file');
    const expected = Number(response.headers.get('content-length'));
    if (expected && bytes.byteLength !== expected) throw new Error('Workbook download was incomplete');
    if (key) await env.REPORT_FILES.put(key, bytes);
    return bytes;
  })();
  pending.set(requestKey, download);
  try { return await download; } finally { pending.delete(requestKey); }
}

export async function currentFile(env: DataEnv, dashboard: string): Promise<Response> {
  const selected = await currentData(env, dashboard);
  if (selected.manual) {
    const file = await env.REPORT_FILES.get(selected.manual.key);
    if (!file) return json({ error: 'Saved Excel file unavailable' }, 503);
    return new Response(file.body, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store' } });
  }
  return new Response(await automaticWorkbook(env, dashboard, selected.metadata), { headers: workbookHeaders });
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
    if (!/\.xlsx$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024) return json({ error: 'Upload a non-empty .xlsx file up to 25 MB.' }, 400);
    const bytes = await file.arrayBuffer();
    // Parse the same primary sheet/date columns used by reporting before replacing data.
    const dates = await workbookDates(bytes, dashboard);
    const updatedAt = new Date().toISOString();
    const key = `dashboard-data/${dashboard}/${crypto.randomUUID()}.xlsx`;
    const metadata: Manual = { dashboard, fileName: file.name, size: file.size, updatedAt, source: 'manual', key };
    await env.REPORT_FILES.put(key, bytes, { httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    await env.REPORT_FILES.put(pointer(dashboard), JSON.stringify(metadata));
    return json({ success: true, metadata, dates: dates.size });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not save Excel file.' }, 400);
  }
}
