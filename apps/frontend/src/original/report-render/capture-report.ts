import { renderPresentation } from "../dashboard/presentation-capture";
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function captureReport(key: string, range: { from: string; to: string }) {
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
          // Live refresh starts 900 ms counters after two animation frames.
          // Let them finish before filtering so they cannot overwrite period totals.
          await wait(1400);
          const from = doc.querySelector<HTMLInputElement>(key === "amos" ? "#f-date-from" : "#f-from");
          const to = doc.querySelector<HTMLInputElement>(key === "amos" ? "#f-date-to" : "#f-to");
          if (!from || !to) throw new Error("Dashboard date filters were not found.");
          const limits = { from: from.min, to: to.max };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(limits.from) || !/^\d{4}-\d{2}-\d{2}$/.test(limits.to) || limits.from > limits.to) throw new Error("No available reporting dates were found.");
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
