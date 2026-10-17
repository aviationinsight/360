"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Image as ImageIcon, Presentation, X } from "lucide-react";
import { renderPresentation } from "./presentation-capture";
import JSZip from "jszip";

const dashboards = [
  { key: "amos", label: "AMOS Picking" },
  { key: "aog", label: "AOG Delivery" },
  { key: "fak", label: "FAK Analysis" },
  { key: "marshaling", label: "Marshaling" },
];

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const safeName = (label: string) => label.replace(/\s+/g, "_");
export function DashboardExport({ current, allowed }: { current: string; allowed: Record<string, boolean> }) {
  const available = dashboards.filter(item => allowed[item.key] !== false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([current]);
  const [ranges, setRanges] = useState<Record<string, { from: string; to: string }>>({});
  const rangeFor = (key: string) => ranges[key] || { from: "", to: "" };
  const setDate = (key: string, field: "from" | "to", value: string) => setRanges(old => ({ ...old, [key]: { ...(old[key] || { from: "", to: "" }), [field]: value } }));
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [mobileImages, setMobileImages] = useState<Array<{ name: string; blob: Blob; url: string }>>([]);
  useEffect(() => () => { mobileImages.forEach(image => URL.revokeObjectURL(image.url)); }, [mobileImages]);

  async function saveAllMobileImages() {
    const files = mobileImages.map(image => new File([image.blob], image.name, { type: "image/png" }));
    if (navigator.canShare?.({ files })) {
      try { await navigator.share({ files }); }
      catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setMessage("Sharing all images was unavailable. Please use the individual image buttons."); }
    } else { setMessage("This browser cannot share multiple images together. Use the individual image buttons."); }
  }

  async function saveMobileImage(image: { name: string; blob: Blob }) {
    const file = new File([image.blob], image.name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); }
      catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) setMessage("Press and hold the image below, then choose Save Image.");
      }
    } else {
      setMessage("Press and hold the image below, then choose Save Image or Download Image.");
    }
  }

  type DateBounds = { from: string; to: string };
  const [bounds, setBounds] = useState<Record<string, DateBounds>>({});
  const [boundsErrors, setBoundsErrors] = useState<Record<string, string>>({});
  const requestedBounds = useRef(new Set<string>());
  const boundsGeneration = useRef(0);
  useEffect(() => {
    if (!open) return;
    for (const key of selected) {
      if (requestedBounds.current.has(key)) continue;
      requestedBounds.current.add(key);
      const generation = boundsGeneration.current;
      captureDashboard(key, true).then(result => {
        if (generation !== boundsGeneration.current) return;
        const limits = result as DateBounds;
        setBounds(old => ({ ...old, [key]: limits }));
        setRanges(old => {
          const value = old[key];
          if (!value) return old;
          const clamp = (date: string) => date ? (date < limits.from ? limits.from : date > limits.to ? limits.to : date) : "";
          return { ...old, [key]: { from: clamp(value.from), to: clamp(value.to) } };
        });
      }).catch(() => {
        if (generation === boundsGeneration.current) setBoundsErrors(old => ({ ...old, [key]: "Available dates could not be loaded. Close and reopen to retry." }));
      });
    }
  }, [open, selected]);

  async function captureDashboard(key: string, boundsOnly = false) {
    const host = document.createElement("iframe");
    host.className = "export-capture-frame";
    host.style.cssText = "position:fixed;left:-20000px;top:0;width:1920px;height:1080px;border:0;";
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Dashboard loading timed out. Please retry.")), 30000);
        host.onload = () => { clearTimeout(timer); resolve(); };
        host.onerror = () => { clearTimeout(timer); reject(new Error("Dashboard could not be loaded.")); };
        host.src = `/secure-dashboard?tab=${key}&embedded=1&export=1`;
        document.body.appendChild(host);
      });
      const refreshName = { amos: "refreshAmosData", aog: "refreshAogData", fak: "refreshFakData", marshaling: "refreshMarshalingData" }[key]!;
      for (let i = 0; i < 600; i++) {
        const outer = host.contentDocument;
        if ((outer?.querySelector("#dashboard-select") as HTMLSelectElement | null)?.value !== key) { await wait(100); continue; }
        const inner = outer?.querySelector<HTMLIFrameElement>("#frame-area iframe.active");
        const win = inner?.contentWindow as (Window & { __aviationSyncStatus?: string; [key: string]: unknown }) | null;
        const doc = inner?.contentDocument;
        if (doc?.querySelector(".main") && typeof win?.[refreshName] === "function" && win.__aviationSyncStatus !== "loading") {
          // Require a successful fresh workbook event, never the embedded fallback data.
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => { cleanup(); reject(new Error("Latest data could not be confirmed. Please retry.")); }, 60000);
            const updated = () => { cleanup(); resolve(); };
            const cleanup = () => { clearTimeout(timer); win.removeEventListener("aviation:data-updated", updated); };
            win.addEventListener("aviation:data-updated", updated);
            Promise.resolve((win[refreshName] as () => Promise<void>)()).then(() => {
              if (win.__aviationSyncStatus === "error") { cleanup(); reject(new Error("Latest dashboard data could not be loaded. No images were downloaded.")); }
            }).catch(error => { cleanup(); reject(error); });
          });
          await wait(1400);
          const from = doc.querySelector<HTMLInputElement>(key === "amos" ? "#f-date-from" : "#f-from");
          const to = doc.querySelector<HTMLInputElement>(key === "amos" ? "#f-date-to" : "#f-to");
          if (!from || !to) throw new Error("Dashboard date filters were not found.");
          const limits = { from: from.min, to: to.max };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(limits.from) || !/^\d{4}-\d{2}-\d{2}$/.test(limits.to) || limits.from > limits.to) throw new Error("No available reporting dates were found.");
          if (boundsOnly) return limits;
          const range = rangeFor(key);
          if (range.from < limits.from || range.to > limits.to) throw new Error(`Available dates are ${limits.from} to ${limits.to}. Please reopen the export window to refresh them.`);
          const EventClass = (win as unknown as { Event: typeof Event }).Event;
          // Expand the end first, then apply the requested start and end.
          to.value = range.to; to.dispatchEvent(new EventClass("change", { bubbles: true }));
          from.value = range.from; from.dispatchEvent(new EventClass("change", { bubbles: true }));
          to.value = range.to; to.dispatchEvent(new EventClass("change", { bubbles: true }));
          if (from.value !== range.from || to.value !== range.to) throw new Error("The selected period is outside this dashboard's available dates. Choose dates within the available data.");
          await wait(1400);
          return await renderPresentation(doc, key);
        }
        await wait(100);
      }
      throw new Error("The latest dashboard data is still loading. Please try again.");
    } finally { host.remove(); }
  }

  async function generate() {
    if (!selected.length) { setMessage("Select at least one dashboard."); return; }
    for (const key of selected) {
      const range = rangeFor(key);
      if (!bounds[key] || !range.from || !range.to || range.from > range.to || range.from < bounds[key].from || range.to > bounds[key].to) { setMessage(`Choose a valid From / To period for ${dashboards.find(d => d.key === key)?.label}.`); return; }
    }
    setMobileImages([]); setWorking(true); setProgress(0); setMessage("Preparing presentation images…");
    try {
      const results: Array<{ name: string; blob: Blob }> = [];
      for (let index = 0; index < selected.length; index++) {
        const key = selected[index], item = dashboards.find(d => d.key === key)!;
        setMessage(`Preparing ${item.label}…`);
        results.push({ name: `${safeName(item.label)}_${rangeFor(key).from}_${rangeFor(key).to}.png`, blob: await captureDashboard(key) as Blob });
        setProgress(Math.round(((index + 1) / selected.length) * 100));
      }
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (mobile) {
        setMobileImages(results.map(result => ({ ...result, url: URL.createObjectURL(result.blob) })));
      } else if (results.length === 1) {
        const url = URL.createObjectURL(results[0].blob), a = document.createElement("a"); a.href = url; a.download = results[0].name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else {
        const zip = new JSZip(); results.forEach(result => zip.file(result.name, result.blob)); const blob = await zip.generateAsync({ type: "blob" }); const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "Aviation_Insight_PowerPoint_Reports.zip"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
      setMessage(mobile ? "Your images are ready below. Tap Save / Share and choose Save Image, or press and hold an image to save it." : "Your PowerPoint images are ready.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The export could not be completed."); }
    finally { setWorking(false); }
  }

  return <>
    <button className="export-open" onClick={() => { boundsGeneration.current++; requestedBounds.current.clear(); setBounds({}); setBoundsErrors({}); setMobileImages([]); setOpen(true); setMessage(""); setProgress(0); }}><Presentation size={16} /> Export for PowerPoint</button>
    {open && <div className="export-backdrop" role="presentation"><section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <button className="export-close" onClick={() => !working && setOpen(false)} aria-label="Close" disabled={working}><X size={20} /></button>
      <div className="export-heading"><span className="export-heading-icon"><Presentation size={22} /></span><div><span className="eyebrow">PRESENTATION EXPORT</span><h2 id="export-title">PowerPoint snapshots</h2></div></div>
      <div className="export-format"><ImageIcon size={20} /><div><strong>16:9 presentation image</strong><span>3840 × 2160 PNG · 16:9 · 4K resolution</span></div><Check size={18} /></div>
      <p className="export-note">Choose a date range for each selected dashboard. Latest data is loaded before each image is created.</p>
      <label className="export-choice select-all"><input type="checkbox" checked={selected.length === available.length} onChange={event => setSelected(event.target.checked ? available.map(d => d.key) : [])} disabled={working} /><span>Select all dashboards</span><small>{available.length} images</small></label>
      <div className="export-options">{available.map(item => <div className="export-option" key={item.key}>
        <label className="export-choice"><input type="checkbox" checked={selected.includes(item.key)} disabled={working} onChange={event => setSelected(list => event.target.checked ? [...list, item.key] : list.filter(key => key !== item.key))} /><span>{item.label}</span></label>
        {selected.includes(item.key) && <div className="export-date-range">
          <label htmlFor={`export-${item.key}-from`}>From<input id={`export-${item.key}-from`} type="date" min={bounds[item.key]?.from} max={bounds[item.key]?.to} value={rangeFor(item.key).from} onChange={event => setDate(item.key, "from", event.target.value)} disabled={working || !bounds[item.key]} /></label>
          <label htmlFor={`export-${item.key}-to`}>To<input id={`export-${item.key}-to`} type="date" min={bounds[item.key]?.from} max={bounds[item.key]?.to} value={rangeFor(item.key).to} onChange={event => setDate(item.key, "to", event.target.value)} disabled={working || !bounds[item.key]} /></label>
          <div className="export-available-period">
            <span>{bounds[item.key] ? `Available: ${bounds[item.key].from} — ${bounds[item.key].to}` : boundsErrors[item.key] || "Loading available dates…"}</span>
            <button type="button" disabled={working || !bounds[item.key]} onClick={() => setRanges(old => ({ ...old, [item.key]: { ...bounds[item.key] } }))}>Full available period</button>
          </div>
        </div>}
      </div>)}</div>
      {message && <div className={`export-status ${progress === 100 && !working ? "is-ready" : ""}`}><span>{message}</span>{working && <strong>{progress}%</strong>}{working && <i><b style={{ width: `${progress}%` }} /></i>}</div>}
      {mobileImages.length > 0 && <div className="export-mobile-images">{mobileImages.length > 1 && <button type="button" className="export-generate" onClick={saveAllMobileImages}><Download size={17} /> Save / Share all {mobileImages.length} images</button>}{mobileImages.map(image => <article className="export-mobile-image" key={image.name}>
        <img src={image.url} alt={image.name.replace(/_/g, " ").replace(/\.png$/, "")} />
        <strong>{image.name.replace(/_/g, " ").replace(/\.png$/, "")}</strong>
        <button type="button" onClick={() => saveMobileImage(image)}><Download size={16} /> Save / Share image</button>
      </article>)}</div>}
      <button className="export-generate" onClick={generate} disabled={working || !selected.length || selected.some(key => !bounds[key])}>{working ? "Preparing presentation images…" : <><Download size={17} /> Generate PowerPoint Images</>}</button>
    </section></div>}
  </>;
}
