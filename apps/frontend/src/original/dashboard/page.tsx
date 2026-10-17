import { ArrowLeft, ExternalLink } from "lucide-react";
import { DashboardSwitcher } from "./dashboard-switcher";
import { DashboardExport } from "./dashboard-export";
import { useSessionHeaders } from "../session";
import { DashboardCinematic } from "./dashboard-cinematic";
const labels: Record<string, string> = { amos: "AMOS Picking", aog: "AOG Delivery", fak: "FAK Analysis", marshaling: "Marshaling", permits: "Security Permits" };
export default function DashboardPage({ searchParams }: { searchParams: { tab?: string; intro?: string } }) {
  const { tab: requested, intro } = searchParams;
  const tab = requested && labels[requested] ? requested : "amos";
  const requestHeaders = useSessionHeaders();
  const canExport = requestHeaders.get("x-sal-can-export") === "1";
  const role = requestHeaders.get("x-sal-role") || "general";
  const allowed = JSON.parse(requestHeaders.get("x-sal-permissions") || '{}') as Record<string, boolean>;
  const dashboardAccess = { ...allowed, permits: role === "admin" || allowed.permits === true };
  return (
    <main className="dashboard-shell">
      {intro === "1" && <DashboardCinematic dashboard={tab} />}
      <header className="dashboard-toolbar">
        <a href="/portal" className="back-link"><ArrowLeft size={18} /> Command Center</a>
        <DashboardSwitcher current={tab} allowed={dashboardAccess} />
        <div className="dashboard-toolbar-actions">{canExport && tab !== "permits" && <DashboardExport current={tab} allowed={allowed} />}<a href={`/secure-dashboard?tab=${tab}`} target="_blank" className="open-full">Open full screen <ExternalLink size={16} /></a></div>
      </header>
      <iframe title={labels[tab]} src={`/secure-dashboard?tab=${tab}&embedded=1`} className="dashboard-frame" />
    </main>
  );
}
