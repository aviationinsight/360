import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import JSZip from 'jszip';
import { analyzePs, parsePsGrid, parsePsWorkbook, psDate, redTrendAnalysis, type ExcelReader } from '../apps/frontend/src/original/dashboard/ps-volume-model.js';
import { workbookDates } from '../apps/backend/src/report-dates.js';
import { dataAdmin, currentData } from '../apps/backend/src/dashboard-data.js';

const headers = ['No', 'From Store (New)', 'From Store', 'Issued At', 'Drop Area'];
test('red trends use seven calendar days and least-squares direction with signed weekly change', () => {
  const increasing = Array.from({ length: 14 }, (_, i) => ({ combined202: i + 1 }));
  const result = redTrendAnalysis(increasing);
  assert.deepEqual(result.sma.slice(0, 6), Array(6).fill(null));
  assert.equal(result.sma[6], 4);
  assert.equal(result.sma[13], 11);
  assert.deepEqual(result.linear, increasing.map(d => d.combined202));
  assert.equal(result.change, 175);
  assert.ok(redTrendAnalysis([...increasing].reverse()).change! < 0);
  assert.equal(redTrendAnalysis(increasing.slice(0, 13)).change, null);
  assert.equal(redTrendAnalysis(Array.from({ length: 14 }, () => ({ combined202: 0 }))).change, null);
  assert.equal(redTrendAnalysis([{ combined202: 10 }]).linear.length, 0);
  assert.equal(redTrendAnalysis(Array.from({ length: 14 }, (_, i) => ({ combined202: i < 7 ? 10 : 0 }))).change, -100);
  const zerosIncluded = redTrendAnalysis([{ combined202: 7 }, ...Array.from({ length: 6 }, () => ({ combined202: 0 }))]);
  assert.equal(zerosIncluded.sma[6], 1);
});
test('destination trend combines TERMINAL and LINE 601 per day and excludes other areas', () => {
  const { rows } = parsePsGrid([headers,
    [1, 'HB & CO', 'HB', '2026-10-01', 'TERMINAL'],
    [2, 'HB & CO', 'CO', '2026-10-01', 'LINE 601'],
    [3, 'A005', 'A005', '2026-10-01', 'TERMINAL'],
    [4, 'A005', 'A005', '2026-10-01', 'LINE 601'],
    [5, 'HB & CO', 'HB', '2026-10-01', 'OTHER'],
    [6, 'A005', 'A005', '2026-10-01', 'OTHER'],
    [7, 'A005', 'A005', '2026-10-03', ' terminal '],
  ]);
  const result = analyzePs(rows, '2026-10-01', '2026-10-03');
  assert.deepEqual(result.terminalLine601Trend.map(d => [d.date, d.combined202, d.a005]), [
    ['2026-10-01', 2, 2], ['2026-10-02', 0, 0], ['2026-10-03', 0, 1],
  ]);
  assert.equal(result.trend[0].total, 6);
  assert.equal(result.summary.total, 7);
  assert.equal(analyzePs(rows, '2026-10-03', '2026-10-03').terminalLine601Trend[0].total, 1);
  const capped = analyzePs(rows, '2026-10-01', '2026-11-01');
  assert.equal(capped.terminalLine601Trend.length, 31);
  assert.deepEqual(capped.terminalLine601Trend.map(d => d.date), capped.trend.map(d => d.date));
  assert.equal(capped.terminalLine601Trend.reduce((sum, d) => sum + d.total, 0), 1);
});
test('PS numbers deduplicate globally before date and destination filtering; totals use HB + CO', () => {
  const { rows, duplicates } = parsePsGrid([headers,
    [1, 'HB & CO', 'HB', '2026-10-01', 'LINE 601'],
    [1, 'A005', 'A005', '2026-10-02', 'TERMINAL'],
    [2, 'HB & CO', 'CO', '2026-10-01', 'LINE 601'],
    [3, 'A005', 'A005', '2026-10-01', 'LINE 601'],
    [4, 'A005', 'A005', '2026-10-02', 'TERMINAL'],
  ]);
  assert.equal(duplicates, 1);
  const all = analyzePs(rows, '2026-10-01', '2026-10-02');
  assert.deepEqual(all.summary, { hb: 1, co: 1, combined202: 2, a005: 2, total: 4, share: 50 });
  assert.ok(Math.abs(all.destinations.find(d => d.destination === 'LINE 601')!.share - 100 / 3) < 1e-10);
  assert.equal(analyzePs(rows, '2026-10-02', '2026-10-02').summary.total, 1);
  const empty = analyzePs(rows, '2026-10-03', '2026-10-03');
  assert.equal(empty.summary.share, 0); assert.equal(empty.summary.total, 0);
});
test('trend has inclusive 30/31/32-day boundaries and never truncates KPIs or destination totals', () => {
  const { rows } = parsePsGrid([headers, [1, 'HB & CO', 'HB', '2026-10-01', 'LINE 601'], [2, 'A005', 'A005', '2026-11-01', 'TERMINAL']]);
  assert.equal(analyzePs(rows, '2026-10-01', '2026-10-30').trend.length, 30);
  assert.equal(analyzePs(rows, '2026-10-01', '2026-10-31').trend.length, 31);
  const result = analyzePs(rows, '2026-10-01', '2026-11-01');
  assert.equal(result.trend.length, 31); assert.equal(result.trendFrom, '2026-10-02');
  assert.equal(result.summary.total, 2); assert.equal(result.destinations.length, 2);
  assert.equal(result.trend.reduce((total, day) => total + day.total, 0), 1);
});
test('Excel serial dates retain workbook calendar day, including 1904 workbooks; malformed rows fail clearly', () => {
  const serial = (Date.UTC(2026, 9, 1) - Date.UTC(1899, 11, 30)) / 86400000;
  assert.equal(psDate(serial + .9999), '2026-10-01');
  assert.equal(psDate(serial - 1462 + .9999, true), '2026-10-01');
  assert.equal(psDate('2026-10-01T23:59:00-08:00'), '2026-10-01');
  assert.equal(psDate('31/02/2026'), null);
  assert.throws(() => parsePsGrid([['No']]), /Required columns/);
  assert.throws(() => parsePsGrid([headers, ['', 'A005', 'A005', '2026-10-01', 'TERMINAL']]), /missing/);
  assert.throws(() => parsePsGrid([headers, [1, 'A005', 'HB', '2026-10-01', 'TERMINAL']]), /does not match/);
});
test('PS uploads validate required sheet and headers, persist locally and retain last good file on rejection', async () => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>');
  const xmlRow = (values: string[], n: number) => `<row>${values.map((v, i) => `<c r="${String.fromCharCode(65 + i)}${n}" t="inlineStr"><is><t>${v.replaceAll('&', '&amp;')}</t></is></c>`).join('')}</row>`;
  zip.file('xl/worksheets/sheet1.xml', `<worksheet><sheetData>${xmlRow(headers, 1)}${xmlRow(['1', 'A005', 'A005', '2026-10-01', 'TERMINAL'], 2)}</sheetData></worksheet>`);
  const bytes = await zip.generateAsync({ type: 'arraybuffer' });
  assert.deepEqual([...await workbookDates(bytes, 'psvolume')], ['2026-10-01']);
  const saved = new Map<string, ArrayBuffer>();
  const store = { get: async (key: string) => { const value = saved.get(key); return value ? { json: async <T>() => JSON.parse(new TextDecoder().decode(value)) as T } : null; }, put: async (key: string, value: string | ArrayBuffer) => { saved.set(key, typeof value === 'string' ? new TextEncoder().encode(value).buffer : value); } };
  async function upload(content: ArrayBuffer) { const form = new FormData(); form.set('dashboard', 'psvolume'); form.set('file', new File([content], 'PS Volume Data.xlsx')); return dataAdmin(new Request('http://localhost/api/admin/dashboard-data', { method: 'POST', body: form }), { FILES: store } as never); }
  assert.equal((await upload(bytes)).status, 200);
  const previous = (await currentData({ FILES: store } as never, 'psvolume')).metadata!.key;
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Issued At</t></is></c></row></sheetData></worksheet>');
  assert.equal((await upload(await zip.generateAsync({ type: 'arraybuffer' }))).status, 400);
  assert.equal((await currentData({ FILES: store } as never, 'psvolume')).metadata!.key, previous);
});
test('provided workbook totals and dates match the current source when it is available locally', async t => {
  let bytes: Buffer;
  try { bytes = await readFile('data/dashboard-sources/PS Volume Data.xlsx'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { t.skip('Private source workbook is not tracked'); return; } throw error; }
  const context = createContext({ Uint8Array, ArrayBuffer, TextDecoder, TextEncoder });
  runInContext(await readFile('apps/frontend/public/vendor/xlsx.js', 'utf8'), context);
  const reader = context.XLSX as ExcelReader;
  const { rows } = parsePsWorkbook(new Uint8Array(bytes), reader);
  const workbook = reader.read(new Uint8Array(bytes), { type: 'array' });
  const grid = reader.utils.sheet_to_json(workbook.Sheets.Data, { header: 1, raw: true, defval: null });
  const noColumn = grid[0].indexOf('No'), storeColumn = grid[0].indexOf('From Store');
  const unique = new Map<string, unknown[]>();
  for (const row of grid.slice(1)) {
    const no = String(row[noColumn] ?? '').trim();
    if (no && !unique.has(no)) unique.set(no, row);
  }
  assert.equal(rows.length, unique.size);
  const dateBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const dates = [...await workbookDates(dateBytes, 'psvolume')].sort();
  assert.equal(rows[0].date, dates[0]); assert.equal(rows.at(-1)!.date, dates.at(-1));
  const analysis = analyzePs(rows, rows[0].date, rows.at(-1)!.date);
  const countStore = (store: string) => [...unique.values()].filter(row => row[storeColumn] === store).length;
  assert.equal(analysis.summary.hb, countStore('HB')); assert.equal(analysis.summary.co, countStore('CO'));
  assert.equal(analysis.summary.a005, countStore('A005'));
  assert.equal(analysis.summary.combined202, countStore('HB') + countStore('CO'));
  assert.ok(analysis.trend.length <= 31);
  assert.equal(analysis.destinations.reduce((sum, d) => sum + d.total, 0), unique.size);
});
