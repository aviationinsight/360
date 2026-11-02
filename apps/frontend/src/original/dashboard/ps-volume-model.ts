export type PsRow = { no: string; store: 'HB' | 'CO' | 'A005'; date: string; destination: string };
export type Volume = { hb: number; co: number; combined202: number; a005: number; total: number; share: number };
export type PsWorkbook = { SheetNames: string[]; Sheets: Record<string, unknown>; Workbook?: { WBProps?: { date1904?: boolean } } };
export type ExcelReader = {
  read(bytes: Uint8Array, options: { type: string }): PsWorkbook;
  utils: { sheet_to_json(sheet: unknown, options: { header: number; raw: boolean; defval: null }): unknown[][] };
};
const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export function psDate(value: unknown, date1904 = false): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return null;
    const day = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + Math.floor(value) * 86400000);
    return day.getUTCFullYear() >= 2020 && day.getUTCFullYear() <= 2100 ? day.toISOString().slice(0, 10) : null;
  }
  const text = String(value ?? '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/);
  const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s|$)/);
  const parts = iso ? [+iso[1], +iso[2], +iso[3]] : local ? [+local[3], +local[2], +local[1]] : null;
  if (!parts) return null;
  const [y, m, d] = parts, date = new Date(Date.UTC(y, m - 1, d));
  return y >= 2020 && y <= 2100 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null;
}
export function parsePsGrid(grid: unknown[][], date1904 = false) {
  const required = ['no', 'fromstorenew', 'fromstore', 'issuedat', 'droparea'];
  const headerIndex = grid.findIndex(row => required.every(name => row.some(v => normalized(v) === name)));
  if (headerIndex < 0) throw new Error('Required columns: No, From Store (New), From Store, Issued At, Drop Area.');
  const columns = Object.fromEntries(grid[headerIndex].map((v, i) => [normalized(v), i]));
  const seen = new Set<string>(), rows: PsRow[] = [];
  let duplicates = 0;
  for (const row of grid.slice(headerIndex + 1)) {
    if (row.every(v => v === null || v === undefined || String(v).trim() === '')) continue;
    const no = String(row[columns.no] ?? '').trim();
    if (!no) throw new Error('A picking slip is missing its No value.');
    if (seen.has(no)) { duplicates++; continue; }
    seen.add(no);
    const store = String(row[columns.fromstore] ?? '').trim().toUpperCase();
    const group = String(row[columns.fromstorenew] ?? '').trim().toUpperCase();
    if (!['HB', 'CO', 'A005'].includes(store)) throw new Error(`Unrecognized From Store for PS ${no}: ${store || '(empty)'}.`);
    if (group !== (store === 'A005' ? 'A005' : 'HB & CO')) throw new Error(`Warehouse group does not match From Store for PS ${no}.`);
    const date = psDate(row[columns.issuedat], date1904);
    if (!date) throw new Error(`Invalid Issued At date for PS ${no}.`);
    const destination = String(row[columns.droparea] ?? '').trim() || '(Unspecified)';
    rows.push({ no, store: store as PsRow['store'], date, destination });
  }
  if (!rows.length) throw new Error('The Data sheet contains no usable picking slips.');
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { rows, duplicates };
}
export function parsePsWorkbook(bytes: Uint8Array, reader: ExcelReader) {
  const workbook = reader.read(bytes, { type: 'array' });
  const sheet = workbook.SheetNames.find(name => normalized(name) === 'data');
  if (!sheet) throw new Error('The workbook must contain a Data sheet.');
  return parsePsGrid(reader.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, raw: true, defval: null }), !!workbook.Workbook?.WBProps?.date1904);
}
export function volume(rows: PsRow[]): Volume {
  let hb = 0, co = 0, a005 = 0;
  for (const row of rows) { if (row.store === 'HB') hb++; else if (row.store === 'CO') co++; else a005++; }
  const total = hb + co + a005;
  return { hb, co, combined202: hb + co, a005, total, share: total ? a005 / total * 100 : 0 };
}
export function dayOffset(day: string, offset: number) {
  const date = new Date(day + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10);
}
export function analyzePs(rows: PsRow[], from: string, to: string) {
  const selected = rows.filter(row => row.date >= from && row.date <= to);
  const byDestination = new Map<string, PsRow[]>();
  for (const row of selected) { const group = byDestination.get(row.destination) || []; group.push(row); byDestination.set(row.destination, group); }
  const destinations = [...byDestination].map(([destination, group]) => ({ destination, ...volume(group) })).sort((a, b) => b.total - a.total || a.destination.localeCompare(b.destination));
  const trendFrom = from > dayOffset(to, -30) ? from : dayOffset(to, -30);
  const days = new Map<string, PsRow[]>();
  for (const row of selected) if (row.date >= trendFrom) { const day = days.get(row.date) || []; day.push(row); days.set(row.date, day); }
  const trend = [];
  for (let day = trendFrom; day <= to; day = dayOffset(day, 1)) trend.push({ date: day, ...volume(days.get(day) || []) });
  return { summary: volume(selected), destinations, trend, trendFrom };
}
