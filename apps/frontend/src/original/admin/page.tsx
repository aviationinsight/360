import { useSessionHeaders } from "../session";
import { DashboardUploads } from "./uploads";
import { AdminUsers } from "./users";

export const dynamic = "force-dynamic";
export default function AdminPage() {
  const requestHeaders = useSessionHeaders();
  return <main className="admin-shell"><header className="admin-header"><a className="brand-lockup compact" href="/portal"><span className="aviation-wordmark">AVIATION <em>INSIGHT</em></span><span>Admin Control Center</span></a><div><span>Signed in as {requestHeaders.get("x-sal-name") || "Administrator"}</span><a className="admin-control-link" href="/portal">View dashboards</a><form action="/api/logout" method="post"><button className="logout-button">Sign out</button></form></div></header><section className="admin-intro"><span className="eyebrow light">ACCESS MANAGEMENT</span><h1>Employee accounts &amp; permissions</h1><p>Create each employee account and decide exactly which dashboards and export tools they can use.</p></section><DashboardUploads /><AdminUsers /></main>;
}
