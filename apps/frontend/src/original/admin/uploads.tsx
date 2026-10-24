'use client';
import { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

const dashboards = [['amos', 'AMOS'], ['fak', 'FAK'], ['aog', 'AOG'], ['marshaling', 'Marshaling']];
type Metadata = { fileName?: string; updatedAt?: string; source?: string };
export function DashboardUploads() {
  const [metadata, setMetadata] = useState<Record<string, Metadata | null>>({});
  const [dashboard, setDashboard] = useState('amos');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    try { const response = await fetch('/api/admin/dashboard-data'); if (response.ok) setMetadata((await response.json()).dashboards || {}); }
    catch { /* Upload remains usable when status cannot be loaded. */ }
  }
  useEffect(() => { void load(); }, []);
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (!/\.xlsx$/i.test(file.name) || file.size > 25 * 1024 * 1024 || !file.size) {
      setSuccess(false); setMessage('Choose a non-empty .xlsx file up to 25 MB.'); return;
    }
    setBusy(true); setSuccess(false); setMessage('Validating and saving Excel…');
    try {
      const form = new FormData(); form.append('dashboard', dashboard); form.append('file', file);
      const response = await fetch('/api/admin/dashboard-data', { method: 'POST', body: form });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        const reference = response.headers.get('cf-ray');
        throw new Error(`The upload service returned an unexpected response (HTTP ${response.status}).${reference ? ` Reference: ${reference}.` : ''} Please check the server logs before retrying.`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed. Please try again.');
      setSuccess(true); setMessage(`${dashboard.toUpperCase()} updated successfully. Open the dashboard to view the latest data.`);
      setFile(null); if (input.current) input.current.value = ''; await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection error. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="manual-data-section" aria-labelledby="manual-data-heading">
    <div className="manual-data-heading"><div><span className="eyebrow">DATA MANAGEMENT</span><h2 id="manual-data-heading">Manual Excel update</h2><p>Keep your dashboards current when automatic sync is unavailable.</p></div><UploadCloud size={32} aria-hidden="true" /></div>
    <div className="manual-data-grid"><form onSubmit={upload} className="manual-upload-form">
      <label htmlFor="upload-dashboard">Dashboard</label><select id="upload-dashboard" value={dashboard} disabled={busy} onChange={event => { setDashboard(event.target.value); setMessage(''); }}>{dashboards.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <label htmlFor="upload-excel">Excel workbook</label><div className="manual-file-picker"><FileSpreadsheet size={28} aria-hidden="true" /><input ref={input} id="upload-excel" type="file" accept=".xlsx" disabled={busy} onChange={event => { setFile(event.target.files?.[0] || null); setMessage(''); }} /><small>Use the usual workbook and sheet structure · Maximum 25 MB</small></div>
      <p className="manual-data-note">The uploaded file becomes the dashboard’s latest data. Automatic sync takes over when a newer update arrives.</p>
      <button type="submit" disabled={!file || busy}><UploadCloud size={18} />{busy ? 'Saving…' : 'Upload & update dashboard'}</button>
      <p className={`manual-upload-message ${success ? 'success' : ''}`} role="status" aria-live="polite">{success && <CheckCircle2 size={16} />}{message}</p>
    </form><div className="manual-data-status"><h3>Current data sources</h3>{dashboards.map(([key, label]) => { const data = metadata[key]; return <div className="manual-source-row" key={key}><div><strong>{label}</strong><span>{data?.fileName || 'No update information available'}</span><small>{data?.updatedAt ? new Date(data.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' }) + ' · Riyadh' : '—'}</small></div><span className={`manual-source-badge ${data?.source === 'manual' ? 'manual' : ''}`}>{data?.source === 'manual' ? 'Manual' : data ? 'Automatic' : 'Unavailable'}</span></div>; })}</div></div>
  </section>;
}
