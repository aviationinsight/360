import { Activity, ArrowUpRight, Boxes, Gauge, MapPinned, Plane, ShieldCheck } from "lucide-react";
import { useSessionHeaders } from "../session";
import WelcomeJourney from "./welcome-journey";

const departments = [
  { key: "amos", number: "01", title: "AMOS Picking", subtitle: "Urgent aircraft recovery & normal logistics", icon: Gauge, tone: "red", tag: "PICKING PERFORMANCE" },
  { key: "aog", number: "02", title: "AOG Delivery", subtitle: "On-time delivery from HB to destination stations", icon: Plane, tone: "green", tag: "DELIVERY CONTROL" },
  { key: "fak", number: "03", title: "FAK Analysis", subtitle: "Aircraft movement, delivery and destination network", icon: MapPinned, tone: "purple", tag: "AVIATION NETWORK" },
  { key: "marshaling", number: "04", title: "Marshaling", subtitle: "Part movement, condition and shift coverage", icon: Boxes, tone: "amber", tag: "MOVEMENT FLOW" },
];

const permitsDepartment = { key: "permits", number: "05", title: "Security Permits", subtitle: "Permit validity, renewal planning and airport gate access", icon: ShieldCheck, tone: "red", tag: "SECURE ACCESS" };

export const dynamic = "force-dynamic";
export default function PortalPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const { welcome } = searchParams;
  const requestHeaders = useSessionHeaders();
  const role = requestHeaders.get("x-sal-role") || "general";
  const name = requestHeaders.get("x-sal-name") || "Guest";
  const allowed = JSON.parse(requestHeaders.get("x-sal-permissions") || '{"amos":true,"aog":true,"fak":true,"marshaling":true}') as Record<string, boolean>;
  const visibleDepartments = role === "admin" || allowed.permits ? [...departments, permitsDepartment] : departments;
  return (
    <main className="portal-shell">
      {welcome === "1" && <WelcomeJourney name={name} personalized={role === "employee"} />}
      <header className="portal-header">
        <div className="brand-lockup compact"><span className="aviation-wordmark">AVIATION <em>INSIGHT</em></span><span>Operations Command Center</span></div>
        <div className="portal-actions">{role === "admin" && <a className="admin-control-link" href="/admin">Admin Control</a>}<span className="secure-pill"><ShieldCheck size={16} /> {role === "employee" ? name : "Secure session"}</span><form action="/api/logout" method="post"><button className="logout-button">Sign out</button></form></div>
      </header>
      <section className="command-hero">
        <div><span className="eyebrow light">AVIATION PERFORMANCE INTELLIGENCE</span><h1>One view. {visibleDepartments.length === 5 ? "Five" : "Four"} operations.<br />Complete visibility.</h1><p>Select an operational area to open its live, interactive dashboard.</p></div>
        <div className="radar-visual" aria-hidden="true"><div className="radar-ring r1" /><div className="radar-ring r2" /><div className="radar-ring r3" /><div className="radar-sweep" /><Plane className="radar-plane" size={34} /></div>
        <div className="hero-status"><Activity size={17} /><span>ALL SYSTEMS</span><strong>{visibleDepartments.length}</strong><small>Operational views</small></div>
      </section>
      <section className="section-heading"><div><span className="eyebrow">OPERATIONAL AREAS</span><h2>Choose your dashboard</h2></div><p>Updated dashboards with interactive filters and Excel data controls.</p></section>
      <section className={`department-grid ${visibleDepartments.length === 5 ? "admin-five" : ""}`}>
        {visibleDepartments.map(({ key, number, title, subtitle, icon: Icon, tone, tag }) => (
          <a className={`department-card ${tone} ${allowed[key] ? "" : "locked"}`} href={allowed[key] ? `/dashboard?tab=${key}&intro=1` : "#"} aria-disabled={!allowed[key]} key={key}>
            <div className="card-top"><span className="department-number">{number}</span><span className="open-icon"><ArrowUpRight size={20} /></span></div>
            <div className="department-icon"><Icon size={28} /></div><span className="department-tag">{tag}</span><h3>{title}</h3><p>{subtitle}</p>
            <div className="card-footer"><span>{allowed[key] ? "Open dashboard" : "Access restricted"}</span><span className={allowed[key] ? "pulse-dot" : "card-lock"}>{allowed[key] ? "" : "🔒"}</span></div>
          </a>
        ))}
      </section>
      <footer className="portal-footer"><span>AVIATION INSIGHT DASHBOARDS</span><span>Internal performance review · Confidential</span></footer>
    </main>
  );
}
