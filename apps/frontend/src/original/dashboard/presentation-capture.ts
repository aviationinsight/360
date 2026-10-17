import { presentationStyles, truckIcon } from './presentation-layouts';
import { airportPoints, worldLand } from './presentation-map';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let fontsPromise: Promise<string> | undefined;
function fonts() {
  return fontsPromise ||= fetch('/presentation/fonts.css').then(r => { if (!r.ok) throw new Error('Presentation fonts could not be loaded. Please retry.'); return r.text(); }).catch(error => { fontsPromise = undefined; throw error; });
}

function buildMap(doc: Document) {
  const counts: Record<string, number> = {};
  doc.querySelectorAll('#tbl-flights tr').forEach(row => {
    const code = row.children[5]?.textContent?.trim().toUpperCase();
    if (code && airportPoints[code]) counts[code] = (counts[code] || 0) + 1;
  });
  const destinations = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const start = airportPoints.JED;
  let routes = '';
  destinations.forEach(([code], i) => {
    if (code === 'JED') return;
    const end = airportPoints[code];
    routes += `<path d="M${start} Q${(start[0]+end[0])/2},${Math.min(start[1],end[1])-40} ${end}" fill="none" stroke="${i<3?'#e60a23':'#7a3fc9'}" stroke-width="${i<3?2.4:1.5}" opacity=".6" stroke-dasharray="5 5"/><circle cx="${end[0]}" cy="${end[1]}" r="5" fill="#e60a23" stroke="white" stroke-width="2"/>`;
    if (i<6 && code !== 'SZX') routes += `<text x="${end[0]}" y="${end[1]-(code==='HKG'?-19:11)}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="14" fill="#780414" stroke="white" stroke-width="4" paint-order="stroke">${code}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1055 418" style="width:100%;height:418px;display:block;background:#edf2f5"><g>${worldLand}${routes}<circle cx="${start[0]}" cy="${start[1]}" r="11" fill="#0e9384" fill-opacity=".2"/><circle cx="${start[0]}" cy="${start[1]}" r="6" fill="#0e9384" stroke="white" stroke-width="2"/><text x="${start[0]-12}" y="${start[1]+22}" font-family="Inter" font-weight="700" font-size="16" fill="#066d62" stroke="white" stroke-width="4" paint-order="stroke">JED</text></g><text x="1040" y="403" text-anchor="end" font-family="Inter" font-size="10" fill="#6d7b86">Map: Natural Earth · Routes from selected data</text></svg>`;
  doc.querySelector('#leaflet-map')?.remove();
  doc.querySelector('#route-map')?.remove();
  doc.querySelector('#route-map-shell')?.insertAdjacentHTML('beforeend', svg);
}

export function arrangePresentation(doc: Document, key: string) {
  if (key === 'amos') {
    const tbody = doc.querySelector('#tbl-store');
    if (tbody && !tbody.querySelector('.total-row')) {
      const row = doc.createElement('tr'); row.className = 'total-row';
      for (const id of ['', 'kpi-total', 'aog-late', 'normal-late', 'kpi-normalpct', 'kpi-aogpct']) {
        const cell = doc.createElement('td'); cell.textContent = id ? doc.getElementById(id)?.textContent || '0' : 'Total'; if (id) cell.className = 'num'; row.append(cell);
      }
      tbody.append(row);
    }
    const title = doc.querySelector('.runway-group:nth-child(2) h3');
    if (title) title.innerHTML = `<img src="${truckIcon}" style="width:22px;height:22px;vertical-align:middle;margin-right:5px"/>Normal logistics flow · 60 min`;
    doc.querySelectorAll('#normal-runways .op-runway-icon').forEach(e => e.innerHTML = `<img src="${truckIcon}" style="width:22px;height:22px"/>`);
  }
  if (key === 'fak') {
    const left = doc.querySelector('.row-main>.stack');
    const map = doc.querySelector('.destination-map-panel');
    // Read destination counts before removing the table from the export.
    buildMap(doc);
    left?.querySelector('.flight-scroll')?.closest('.panel')?.remove();
    if (map) left?.append(map);
  }
  if (key === 'marshaling') {
    doc.querySelector('#daily-pulse')?.closest('section')?.remove();
    doc.querySelector('#movement-heatmap')?.closest('section')?.remove();
    doc.querySelector('details')?.remove();
  }
  // Vector icons have identical geometry on desktop and iOS.
  const planeSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';
  const walker = doc.createTreeWalker(doc.body, 4);
  const nodes: Text[] = [];
  while (walker.nextNode()) { const node = walker.currentNode as Text; if (/[✈📦]/u.test(node.data)) nodes.push(node); }
  nodes.forEach(node => {
    const fragment = doc.createDocumentFragment();
    node.data.split(/([✈📦]\uFE0F?)/u).forEach(part => {
      if (/^[✈📦]/u.test(part)) {
        const icon = doc.createElement('span');
        icon.style.cssText = 'display:inline-block;width:1em;height:1em;vertical-align:-.12em;line-height:1';
        icon.innerHTML = part.startsWith('✈') ? planeSVG : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18v15H3z"/><path fill="none" stroke="white" stroke-width="1.5" d="M3 9h18M12 5v5"/></svg>';
        fragment.append(icon);
      } else fragment.append(doc.createTextNode(part));
    });
    node.replaceWith(fragment);
  });
  doc.querySelectorAll('.aviation-update-toast').forEach(e => e.remove());
  const style = doc.createElement('style');
  style.textContent = presentationStyles[key] + `
    html,body{-webkit-text-size-adjust:none!important;text-size-adjust:none!important}
    html,body{width:1920px!important;height:1080px!important;min-width:1920px!important;min-height:0!important}
    .main{transform:none!important;max-width:none!important;min-width:0!important;margin:0!important}
    .render-pulse,.aviation-chart-updated{opacity:1!important;transform:none!important}
    .topbar{min-height:0!important}.topbar>div{min-height:0!important}
    .priority-story.normal .route-track::after{content:'';width:26px;height:26px;top:7px;background:url('${truckIcon}') center/contain no-repeat}
    .story-head::after,.runway-headline::after{content:''!important;background:url('data:image/svg+xml,${encodeURIComponent(planeSVG.replace('currentColor', '#ffffff'))}') center/contain no-repeat!important;width:74px!important;height:74px!important;opacity:.08!important}
    .leaflet-control-container{display:none!important}
    .mix-content{grid-template-columns:145px minmax(0,1fr)!important;align-items:center!important}.mix-ring{margin:0!important;flex-shrink:0!important}.insight-chip{min-width:0!important}
    /* Keep exported cards clean: WebKit paints these large shadows as rectangular
       wedges inside foreignObject. Decorative ranks/watermarks are not report data. */
    .priority-story,.priority-story.target-achieved{background:#fff!important;box-shadow:none!important}
    .priority-story::before,.runway-panel::after,.location-card::after,.reach-main::after{content:none!important;display:none!important}
    .score-orbit,.priority-story.target-achieved .score-orbit,.mix-ring,.shift-dial{box-shadow:none!important;filter:none!important}
    .reach-main{box-shadow:none!important}
  `;
  doc.head.append(style);
  // Fit every AMOS store row into the approved table area, including longer lists.
  if (key === 'amos') {
    const n = doc.querySelectorAll('#tbl-store tr').length;
    if (n > 18) {
      const height = Math.max(15, Math.floor(555/n));
      style.textContent += `.store-story td{height:${height}px!important;line-height:${Math.max(12,height-4)}px!important;font-size:${Math.min(17,height-3)}px!important;padding:1px 7px!important}.store-story .pill{font-size:${Math.min(15,height-4)}px!important;line-height:${Math.max(12,height-4)}px!important;padding:0 4px!important}`;
    }
  }
}

// Browser-native SVG rendering preserves conic gradients, SVG charts and fonts.
// The isolated snapshot contains rendered values only: no data-loading scripts run.
export async function renderPresentation(source: Document, key: string): Promise<Blob> {
  const fontCSS = await fonts();
  const host = document.createElement('iframe');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1920px;height:1080px;border:0;pointer-events:none;';
  document.body.append(host);
  try {
    const doc = host.contentDocument!;
    const clone = source.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script,link,base,iframe').forEach(e => e.remove());
    doc.open(); doc.write('<!doctype html>' + clone.outerHTML); doc.close();
    const fontStyle = doc.createElement('style'); fontStyle.textContent = fontCSS; doc.head.append(fontStyle);
    arrangePresentation(doc, key);
    // Force layout and load every exported face before freezing the snapshot.
    doc.querySelector('.app')!.getBoundingClientRect();
    await Promise.all(['Inter', 'Space Grotesk'].flatMap(family => [400, 500, 600, 700, 800].map(weight => doc.fonts.load(`${weight} 16px "${family}"`))));
    await doc.fonts.ready;
    await pause(150);
    // Freeze embedded bitmap images before serialization; do not silently omit them.
    await Promise.all(Array.from(doc.images).map(async image => {
      if (!image.src.startsWith('data:')) {
        const response = await fetch(image.src); if (!response.ok) throw new Error('An export image could not be loaded.');
        const blob = await response.blob();
        image.src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
      }
      await image.decode();
    }));
    const content = doc.createElement('div');
    content.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    content.style.cssText = 'width:1920px;height:1080px;overflow:hidden;font-family:Inter,sans-serif;color:#2b1d20;' ;
    doc.querySelectorAll('style').forEach(style => content.append(style.cloneNode(true)));
    const app = doc.querySelector('.app')!;
    const frozen = app.cloneNode(true) as HTMLElement;
    const originals = [app, ...Array.from(app.querySelectorAll('*'))];
    const copies = [frozen, ...Array.from(frozen.querySelectorAll('*'))];
    // Inline the resolved desktop layout so SVG/WebKit cannot reapply mobile rules.
    originals.forEach((element, index) => {
      const computed = doc.defaultView!.getComputedStyle(element);
      const copy = copies[index] as HTMLElement;
      for (let i = 0; i < computed.length; i++) {
        const property = computed[i];
        copy.style.setProperty(property, computed.getPropertyValue(property));
      }
      copy.style.setProperty('animation', 'none', 'important');
      copy.style.setProperty('transition', 'none', 'important');
    });
    content.append(frozen);
    const serialized = new XMLSerializer().serializeToString(content).replace(/✈(?:\uFE0F)?/g, '✈\uFE0E');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><foreignObject width="1920" height="1080">${serialized}</foreignObject></svg>`;
    const image = new Image();
    const imageSource = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    image.src = imageSource;
    await image.decode();
    // WebKit can decode a foreignObject before its embedded fonts are painted.
    // Warm the image renderer, then redraw the same immutable snapshot.
    const webkit = /AppleWebKit/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//i.test(navigator.userAgent);
    if (webkit) {
      const warm = document.createElement('canvas'); warm.width = 1920; warm.height = 1080;
      warm.getContext('2d')!.drawImage(image, 0, 0);
      await pause(500);
      image.src = imageSource + '#ready';
      await image.decode();
      await pause(150);
      warm.width = 0; warm.height = 0;
    }
    const canvas = document.createElement('canvas'); canvas.width=3840; canvas.height=2160;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle='#f7f8fb'; ctx.fillRect(0,0,3840,2160); ctx.drawImage(image,0,0,3840,2160);
    return await new Promise<Blob>((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image could not be created.')), 'image/png'));
  } finally { host.remove(); }
}
