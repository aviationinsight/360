"use client";

import { Check, Clock3, Gauge, MapPinned, Package, Plane, ScanLine, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

const stories = {
  amos: { eyebrow: "AMOS PICKING OPERATIONS", title: "Every second matters.", line: "From urgent request to aircraft recovery.", tone: "crimson" },
  aog: { eyebrow: "AOG DELIVERY CONTROL", title: "Urgency in motion.", line: "Reliability in every critical delivery.", tone: "teal" },
  fak: { eyebrow: "FAK AVIATION NETWORK", title: "Every movement connected.", line: "Every destination visible.", tone: "violet" },
  marshaling: { eyebrow: "MARSHALING CONTROL", title: "Precision in every movement.", line: "Every part accounted for.", tone: "amber" },
  permits: { eyebrow: "SECURE ACCESS CONTROL", title: "Every permit visible.", line: "Every gate connected.", tone: "crimson" },
} as const;

type DashboardKey = keyof typeof stories;

function AmosScene() {
  return <div className="cinema-scene amos-scene" aria-hidden="true"><div className="shelf-lines"><i/><i/><i/></div><div className="request-beacon"><Gauge/><span>AOG</span></div><div className="picked-part"><Package/></div><div className="amos-route"/><Plane className="scene-plane"/><div className="scan-line"/></div>;
}
function AogScene() {
  return <div className="cinema-scene aog-scene" aria-hidden="true"><div className="aog-rings"><i/><i/><i/></div><Plane className="grounded-plane"/><div className="urgent-clock"><Clock3/><b>30</b><small>MIN</small></div><div className="delivery-pulse"><Package/></div><div className="delivery-track"/><div className="release-status"><Check/><span>READY</span></div></div>;
}
function FakScene() {
  return <div className="cinema-scene fak-scene" aria-hidden="true"><div className="fak-map"><MapPinned className="map-center"/><div className="fak-routes"><i/><i/><i/><i/><i/></div>{["JED","RUH","DMM","MED","NETWORK"].map((n,i)=><span className={`fak-node n${i+1}`} key={n}><b/>{n}</span>)}<Plane className="fak-plane"/></div><div className="fak-data-stream"><i/><i/><i/><i/><i/></div></div>;
}
function MarshalingScene() {
  return <div className="cinema-scene marshaling-scene" aria-hidden="true"><div className="mar-feed"><Package/><Package/><Package/></div><div className="mar-scanner"><ScanLine/><span>SCANNING MOVEMENT</span></div><div className="mar-path one"/><div className="mar-path two"/><div className="mar-result serviceable"><ShieldCheck/><span>SERVICEABLE</span><b>CONTROLLED</b></div><div className="mar-result unserviceable"><X/><span>UNSERVICEABLE</span><b>IDENTIFIED</b></div></div>;
}

export function DashboardCinematic({ dashboard }: { dashboard: string }) {
  const key = (dashboard in stories ? dashboard : "amos") as DashboardKey;
  const story = stories[key];
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    window.history.replaceState({}, "", `/dashboard?tab=${key}`);
    const timer = window.setTimeout(() => setVisible(false), 4700);
    return () => window.clearTimeout(timer);
  }, [key]);

  if (!visible) return null;
  return (
    <section className={`dashboard-cinema ${story.tone}`} aria-label={`${story.eyebrow} introduction`}>
      <button type="button" className="cinema-skip" onClick={() => setVisible(false)}>Skip intro</button>
      <div className="cinema-grain" aria-hidden="true"/><div className="cinema-horizon" aria-hidden="true"/>
      {key === "amos" && <AmosScene/>}{key === "aog" && <AogScene/>}{key === "fak" && <FakScene/>}{key === "marshaling" && <MarshalingScene/>}{key === "permits" && <FakScene/>}
      <div className="cinema-copy"><div className="cinema-brand"><span className="aviation-wordmark">AVIATION <em>INSIGHT</em></span></div><p>{story.eyebrow}</p><h1>{story.title}</h1><h2>{story.line}</h2><div className="cinema-rule"><span/><i/></div></div>
      <div className="cinema-aperture" aria-hidden="true"/><div className="cinema-progress" aria-hidden="true"><span/></div>
    </section>
  );
}
