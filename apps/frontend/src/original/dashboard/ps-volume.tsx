import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, RefreshCw, BarChart3, Package, Warehouse, Percent } from 'lucide-react';
import { analyzePs, dayOffset, parsePsWorkbook, redTrendAnalysis, type ExcelReader, type PsRow, type Volume } from './ps-volume-model';
import './ps-volume.css';

declare global { interface Window { XLSX?: ExcelReader } }
let readerPromise: Promise<ExcelReader> | undefined;
export function loadReader() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return readerPromise ||= new Promise<ExcelReader>((resolve, reject) => {
    const script = document.createElement('script'); script.src = '/vendor/xlsx.js';
    script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Excel reader is unavailable.'));
    script.onerror = () => reject(new Error('Could not load the local Excel reader.'));
    document.head.appendChild(script);
  }).catch(error => { readerPromise = undefined; throw error; });
}
const number = (n: number) => n.toLocaleString('en-GB');
const percent = (n: number) => n.toFixed(2) + '%';
const labelDate = (date: string) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
function Legend() { return <div className="ps-legend"><span><i className="ps-dot ps-red" />202 (HB &amp; CO)</span><span><i className="ps-dot ps-teal" />A005</span></div>; }
function Columns({ groups, title }: { groups: { label: string; hbco: number; a005: number }[]; title: string }) {
  const max = Math.max(1, ...groups.flatMap(g => [g.hbco, g.a005]));
  const top = Math.ceil(max / 4) * 4;
  const width = groups.length === 1 ? 210 : 320;
  const plotWidth = width - 62;
  return <svg className="ps-chart" viewBox={`0 0 ${width} 230`} role="img" aria-label={title}>
    {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="48" x2={width - 14} y1={185 - i * 36} y2={185 - i * 36} stroke="#eee3e4" /><text x="41" y={189 - i * 36} textAnchor="end">{number(top * i / 4)}</text></g>)}
    {groups.map((group, i) => { const center = 48 + (i + .5) * plotWidth / groups.length; return <g key={group.label}>
      {[{ n: group.hbco, color: '#e60a23', name: '202 (HB & CO)', x: center - 34 }, { n: group.a005, color: '#0e9384', name: 'A005', x: center + 6 }].map(bar => <g key={bar.name}>
        <rect x={bar.x} y={185 - bar.n / top * 144} width="28" height={bar.n / top * 144} rx="5" fill={bar.color}><title>{group.label} · {bar.name}: {number(bar.n)} PS</title></rect>
        <text x={bar.x + 14} y={175 - bar.n / top * 144} textAnchor="middle" className="ps-value-label">{number(bar.n)}</text>
      </g>)}<text x={center} y="210" textAnchor="middle">{group.label}</text></g>; })}
  </svg>;
}
function Trend({ days, presentation = false, trends }: { days: ({ date: string } & Volume)[]; presentation?: boolean; trends?: ReturnType<typeof redTrendAnalysis> }) {
  const width = presentation ? 1830 : 1200;
  const max = Math.max(1, ...days.flatMap(d => [d.combined202, d.a005]));
  const x = (i: number) => days.length === 1 ? width / 2 : 65 + i * (width - 100) / (days.length - 1);
  const y = (n: number) => 230 - n / max * 175;
  return <svg className="ps-trend" viewBox={`0 0 ${width} ${presentation ? 270 : 285}`} role="img" aria-label="Daily picking slip volume for 202 (HB and CO) and A005">
    {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="65" x2={width - 35} y1={230 - i * 44} y2={230 - i * 44} stroke="#eee3e4" /><text x="54" y={234 - i * 44} textAnchor="end">{number(Math.round(max * i / 4))}</text></g>)}
    {trends && <svg x="65" y="55" width={width - 100} height="175" viewBox={`65 55 ${width - 100} 175`} overflow="hidden">
      {trends.linear.length > 1 && <line data-testid="ps-linear-trend" x1={x(0)} y1={y(trends.linear[0])} x2={x(days.length - 1)} y2={y(trends.linear.at(-1)!)} stroke="#a35a64" strokeWidth="1.5" strokeDasharray="7 5"><title>202 (HB &amp; CO) linear trend</title></line>}
      <path data-testid="ps-sma-trend" d={trends.sma.reduce((path, value, i, values) => {
        if (value === null) return path;
        const previous = values[i - 1];
        if (previous === null || previous === undefined) return `M ${x(i)} ${y(value)}`;
        const middle = (x(i - 1) + x(i)) / 2;
        return `${path} C ${middle} ${y(previous)}, ${middle} ${y(value)}, ${x(i)} ${y(value)}`;
      }, '')} fill="none" stroke="#8b1630" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><title>202 (HB &amp; CO) 7-day simple moving average</title></path>
    </svg>}
    {([{ key: 'combined202', color: '#e60a23', name: '202 (HB & CO)' }, { key: 'a005', color: '#0e9384', name: 'A005' }] as const).map(series => <g key={series.key}>
      <polyline points={days.map((d, i) => `${x(i)},${y(d[series.key])}`).join(' ')} fill="none" stroke={series.color} strokeWidth="3" strokeLinejoin="round" />
      {days.map((d, i) => {
        const pointY = y(d[series.key]);
        const close = Math.abs(y(d.combined202) - y(d.a005)) < 26;
        const labelY = pointY - (series.key === 'combined202' && close ? 31 : 12);
        return <g key={d.date}><circle cx={x(i)} cy={pointY} r="4" fill={series.color} stroke="white" strokeWidth="1"><title>{labelDate(d.date)} | {series.name}: {number(d[series.key])} PS</title></circle><text className={`ps-point-label ps-point-${series.key}`} x={x(i)} y={labelY} textAnchor="middle" style={{ fill: series.color }}>{number(d[series.key])}</text></g>;
      })}
    </g>)}
    {days.map((d, i) => i % Math.max(1, Math.ceil(days.length / 8)) === 0 || i === days.length - 1 ? <text key={d.date} x={x(i)} y="260" textAnchor="middle">{labelDate(d.date)}</text> : null)}
  </svg>;
}
export type PsSnapshot = { rows: PsRow[]; duplicates: number; from: string; to: string; updatedAt: string };
export function PsVolumeDashboard({ allowed, snapshot }: { allowed: boolean; snapshot?: PsSnapshot }) {
  const [rows, setRows] = useState<PsRow[]>(snapshot?.rows || []), [duplicates, setDuplicates] = useState(snapshot?.duplicates || 0);
  const [range, setRange] = useState({ from: snapshot?.from || '', to: snapshot?.to || '' }), [busy, setBusy] = useState(!snapshot), [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(snapshot?.updatedAt || ''), refresh = useRef<() => void>(() => {});
  useEffect(() => {
    if (!allowed || snapshot) return;
    let disposed = false, syncing = false, stamp = '';
    let previousBounds: { from: string; to: string } | null = null;
    async function sync() {
      if (syncing || disposed) return;
      syncing = true; setBusy(true);
      try {
        const response = await fetch('/api/dashboard-sync/psvolume/metadata', { cache: 'no-store' });
        if (!response.ok) throw new Error(response.status === 403 ? 'You do not have access to PS Volume Analysis.' : 'Could not check the latest workbook.');
        const { metadata } = await response.json();
        if (!metadata) throw new Error('No PS workbook is available. Upload PS Volume Data.xlsx in Admin.');
        if (stamp !== metadata.updatedAt) {
          const file = await fetch('/api/dashboard-sync/psvolume/file', { cache: 'no-store' });
          if (!file.ok) throw new Error('Could not load the latest PS workbook.');
          const [bytes, reader] = await Promise.all([file.arrayBuffer(), loadReader()]);
          const parsed = parsePsWorkbook(new Uint8Array(bytes), reader);
          if (disposed) return;
          const min = parsed.rows[0].date, max = parsed.rows.at(-1)!.date;
          const oldBounds = previousBounds;
          setRange(old => {
              if (!old.from || !oldBounds || (old.from === oldBounds.from && old.to === oldBounds.to)) return { from: min, to: max };
              const from = old.from < min ? min : old.from > max ? max : old.from;
              const to = old.to > max ? max : old.to < min ? min : old.to;
              return { from, to };
          });
          previousBounds = { from: min, to: max };
          setRows(parsed.rows);
          setDuplicates(parsed.duplicates); setUpdatedAt(metadata.updatedAt); stamp = metadata.updatedAt;
        }
        if (!disposed) setError('');
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Workbook update failed.'); }
      finally { syncing = false; if (!disposed) setBusy(false); }
    }
    refresh.current = () => { void sync(); };
    const onVisible = () => { if (!document.hidden) void sync(); };
    void sync(); const timer = window.setInterval(() => void sync(), 60000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [allowed, snapshot]);
  const analysis = useMemo(() => range.from && range.to ? analyzePs(rows, range.from, range.to) : null, [rows, range]);
  const trends = useMemo(() => analysis ? redTrendAnalysis(analysis.trend) : null, [analysis]);
  if (!allowed) return <section className="ps-access" role="alert">Access restricted. Contact your administrator to enable PS Volume Analysis.</section>;
  const min = rows[0]?.date || '', max = rows.at(-1)?.date || '';
  const span = min && max ? Math.round((Date.parse(max) - Date.parse(min)) / 86400000) : 0;
  const offset = (date: string) => Math.round((Date.parse(date) - Date.parse(min)) / 86400000);
  function changeFrom(from: string) { if (from && from >= min && from <= max) setRange(old => ({ from, to: old.to < from ? from : old.to })); }
  function changeTo(to: string) { if (to && to >= min && to <= max) setRange(old => ({ from: old.from > to ? to : old.from, to })); }
  return <div className="ps-dashboard">
    <aside className="ps-sidebar"><div className="ps-brand"><Warehouse size={24} /><span>WAREHOUSE INTELLIGENCE</span></div><h1>PS Volume<br /><em>Analysis</em></h1><p>Picking slip performance across 202 (HB &amp; CO) and A005.</p>
      <div className="ps-filter-title"><CalendarDays size={16} /> REPORTING PERIOD</div>
      <label htmlFor="ps-from">From date</label><input id="ps-from" type="date" min={min} max={max} value={range.from} onChange={e => changeFrom(e.target.value)} disabled={!rows.length} />
      <label htmlFor="ps-to">To date</label><input id="ps-to" type="date" min={min} max={max} value={range.to} onChange={e => changeTo(e.target.value)} disabled={!rows.length} />
      <div className="ps-sliders"><label htmlFor="ps-range-from">Range start</label><input id="ps-range-from" type="range" min="0" max={span} value={range.from ? offset(range.from) : 0} onChange={e => changeFrom(dayOffset(min, +e.target.value))} disabled={!rows.length} /><label htmlFor="ps-range-to">Range end</label><input id="ps-range-to" type="range" min="0" max={span} value={range.to ? offset(range.to) : 0} onChange={e => changeTo(dayOffset(min, +e.target.value))} disabled={!rows.length} /></div>
      <button className="ps-reset" onClick={() => setRange({ from: min, to: max })} disabled={!rows.length}>Reset to full period</button>
      <div className="ps-source"><strong>EXCEL DATA SOURCE</strong><span>PS Volume Data.xlsx</span><small>{number(rows.length)} unique picking slips</small>{duplicates > 0 && <small>{number(duplicates)} duplicate records excluded</small>}<button onClick={() => refresh.current()} disabled={busy}><RefreshCw size={14} className={busy ? 'ps-spinning' : ''} />{busy ? 'Checking data…' : 'Refresh data'}</button>{updatedAt && <small>Updated {new Date(updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' })} · Riyadh</small>}</div>
    </aside>
    <div className="ps-main" aria-busy={busy && !rows.length}>
      <header className="ps-heading"><div><span className="ps-eyebrow">PICKING SLIP VOLUME</span><h2>{snapshot ? 'PS Volume Analysis' : 'Warehouse volume overview'}</h2><p>{range.from ? `${labelDate(range.from)} ${range.from.slice(0, 4)} — ${labelDate(range.to)} ${range.to.slice(0, 4)}` : 'Loading reporting period…'}</p></div><span className="ps-live"><i />{busy ? 'Checking data' : error ? 'Update unavailable' : 'Local Excel data'}</span></header>
      {error && <div className="ps-error" role="alert">{error}{rows.length > 0 && ' Showing the last successfully loaded data.'}<button onClick={() => refresh.current()}>Retry</button></div>}
      {!analysis ? <div className="ps-loading" role="status">{busy ? 'Loading the latest PS workbook…' : 'Upload a valid workbook in Admin to begin.'}</div> : <>
        <section className="ps-kpis" aria-label="KPI Overview">{[
          { name: '202 (HB & CO)', value: number(analysis.summary.combined202), detail: `HB ${number(analysis.summary.hb)} · CO ${number(analysis.summary.co)}`, icon: Warehouse },
          { name: 'A005', value: number(analysis.summary.a005), detail: 'Total picking slips', icon: Package },
          { name: 'Combined total PS', value: number(analysis.summary.total), detail: '202 (HB & CO) + A005', icon: BarChart3 },
          { name: 'A005 Share', value: percent(analysis.summary.share), detail: 'Of the combined total', icon: Percent },
        ].map(({ name, value, detail, icon: Icon }, i) => <article className={`ps-kpi ps-kpi-${i}`} key={name}><div><span>{name}</span><Icon size={19} /></div><strong data-testid={`ps-kpi-${i}`}>{value}</strong><small>{detail}</small></article>)}</section>
        {analysis.summary.total === 0 && <p className="ps-empty" role="status">No picking slips match the selected dates.</p>}
        <div className="ps-summary-row">
        <section className="ps-comparisons" aria-label="Volume Comparison Charts"><article className="ps-panel"><div className="ps-panel-title"><h3>Total PS volume</h3><span>FULL SELECTED PERIOD</span></div><Legend /><Columns title="Total PS volume comparison" groups={[{ label: 'Warehouse comparison', hbco: analysis.summary.combined202, a005: analysis.summary.a005 }]} /></article>
          <article className="ps-panel"><div className="ps-panel-title"><h3>LINE 601 &amp; TERMINAL</h3><span>DESTINATION COMPARISON</span></div><Legend /><Columns title="PS volumes to LINE 601 and TERMINAL" groups={['LINE 601', 'TERMINAL'].map(label => { const d = analysis.destinations.find(d => d.destination.toUpperCase() === label); return { label, hbco: d?.combined202 || 0, a005: d?.a005 || 0 }; })} /></article></section>
        <section className="ps-panel ps-distribution" aria-label="Destination Distribution"><div className="ps-panel-title"><h3>Destination distribution</h3><span>FULL SELECTED PERIOD</span></div><div className="ps-table-scroll"><table><caption className="ps-sr-only">Picking slip volume by destination for the selected reporting period</caption><thead><tr>{['Drop Area', 'HB', 'CO', '202 (HB & CO)', 'A005', 'Total PS', 'A005 Share %'].map(name => <th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{analysis.destinations.map(d => <tr key={d.destination}><th scope="row">{d.destination}</th><Cells data={d} /></tr>)}{!analysis.destinations.length && <tr><td colSpan={7}>No destinations in the selected period.</td></tr>}</tbody><tfoot><tr><th scope="row">Grand Total</th><Cells data={analysis.summary} /></tr></tfoot></table></div></section>
        </div>
        <section className="ps-panel ps-trend-panel" aria-label="Daily Volume Trend - TERMINAL & LINE 601"><div className="ps-panel-title"><h3>Daily volume trend - TERMINAL &amp; LINE 601</h3><span>{analysis.trendFrom > range.from ? 'LATEST 31 DAYS OF SELECTION' : 'FULL SELECTED PERIOD'}</span></div><div className="ps-trend-sub"><p>{labelDate(analysis.trendFrom)} — {labelDate(range.to)} · TERMINAL + LINE 601 combined · Calendar days, including zero-volume days</p><Legend /></div><Trend days={analysis.terminalLine601Trend} presentation={!!snapshot} /></section>
        {!snapshot && <section className="ps-panel ps-trend-panel" aria-label="Daily Volume Trend"><div className="ps-panel-title"><h3>Daily volume trend</h3><span>{analysis.trendFrom > range.from ? 'LATEST 31 DAYS OF SELECTION' : 'FULL SELECTED PERIOD'}</span></div><div className="ps-trend-sub"><p>{labelDate(analysis.trendFrom)} — {labelDate(range.to)} · Calendar days, including zero-volume days</p><Legend /></div>{trends && <div className="ps-trend-analysis"><div className="ps-trend-keys"><span><i className="ps-sma-key" />202 7-day SMA</span><span><i className="ps-linear-key" />202 linear trend</span></div><div className="ps-change" title="202 (HB & CO): latest 7 calendar days versus previous 7 calendar days"><span>7D Volume Change (%)</span><strong data-testid="ps-7d-change">{trends.change === null ? 'N/A' : (trends.change > 0 ? '+' : '') + trends.change.toFixed(2) + '%'}</strong></div></div>}<Trend days={analysis.trend} presentation={!!snapshot} trends={trends || undefined} /></section>}
      </>}
      <footer className="ps-footer">AVIATION INSIGHT · PS VOLUME ANALYSIS <span>Unique picking slips · Excel reporting dates</span></footer>
    </div>
  </div>;
}
function Cells({ data }: { data: Volume }) { return <>{[data.hb, data.co, data.combined202, data.a005, data.total].map((n, i) => <td key={i}>{number(n)}</td>)}<td><span className="ps-share">{percent(data.share)}</span></td></>; }
