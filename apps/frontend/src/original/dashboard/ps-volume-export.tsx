import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { loadReader, PsVolumeDashboard } from './ps-volume';
import { parsePsWorkbook } from './ps-volume-model';
import { renderPresentation } from './presentation-capture';

export async function capturePsVolume(range?: { from: string; to: string }): Promise<Blob | { from: string; to: string }> {
  const metadataResponse = await fetch('/api/dashboard-sync/psvolume/metadata?export=1', { cache: 'no-store' });
  if (!metadataResponse.ok) throw new Error('Latest PS data could not be confirmed, or export access was denied.');
  const { metadata } = await metadataResponse.json();
  if (!metadata) throw new Error('No PS workbook is available for export.');
  const fileResponse = await fetch('/api/dashboard-sync/psvolume/file?export=1', { cache: 'no-store' });
  if (!fileResponse.ok) throw new Error('Latest PS workbook could not be loaded. No image was created.');
  const [bytes, reader] = await Promise.all([fileResponse.arrayBuffer(), loadReader()]);
  const parsed = parsePsWorkbook(new Uint8Array(bytes), reader);
  const bounds = { from: parsed.rows[0].date, to: parsed.rows.at(-1)!.date };
  if (!range) return bounds;
  if (!range.from || !range.to || range.from > range.to || range.from < bounds.from || range.to > bounds.to) throw new Error(`Choose a reporting period within ${bounds.from} to ${bounds.to}.`);
  // Render an immutable workbook snapshot, independently of the live page's filters.
  const styles = await Promise.all([...document.querySelectorAll('style,link[rel="stylesheet"]')].map(async node => {
    if (node.tagName === 'STYLE') return node.textContent || '';
    const response = await fetch((node as HTMLLinkElement).href);
    if (!response.ok) throw new Error('Presentation styles could not be loaded.');
    return response.text();
  }));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1920px;height:1080px;border:0;pointer-events:none';
  document.body.append(frame);
  const doc = frame.contentDocument!;
  const style = doc.createElement('style'); style.textContent = styles.join('\n'); doc.head.append(style);
  const container = doc.createElement('div'); doc.body.append(container);
  const root = createRoot(container);
  try {
    flushSync(() => root.render(<PsVolumeDashboard allowed snapshot={{ ...parsed, ...range, updatedAt: metadata.updatedAt }} />));
    return await renderPresentation(doc, 'psvolume');
  } finally { root.unmount(); frame.remove(); }
}
