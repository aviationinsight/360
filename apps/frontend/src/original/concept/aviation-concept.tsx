"use client";

import { ArrowRight, BarChart3, Gauge, LockKeyhole, Plane, Radar, Route, TimerReset } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const scenes = [
  { eyebrow: "AVIATION PERFORMANCE INTELLIGENCE", title: <>Above operations.<br/><i>Beyond visibility.</i></>, body: "A cinematic view of every critical movement, from urgency to arrival." },
  { eyebrow: "01 · AIRCRAFT MOVEMENT", title: <>See the operation<br/><i>before it moves.</i></>, body: "One connected view across aircraft, stations and time-critical logistics." },
  { eyebrow: "02 · TIME CRITICAL", title: <>Every second<br/><i>has a destination.</i></>, body: "Turn AOG response and delivery signals into focused operational action." },
  { eyebrow: "03 · LIVE INTELLIGENCE", title: <>Data at the speed<br/><i>of flight.</i></>, body: "Performance becomes visible, decisions become immediate." },
  { eyebrow: "04 · COMMAND CENTER", title: <>Control the view.<br/><i>Own the outcome.</i></>, body: "Enter one executive command center for aviation logistics performance." },
];

export function AviationConcept() {
  const root = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = root.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = Math.max(1, el.offsetHeight - innerHeight);
      setProgress(Math.max(0, Math.min(1, -rect.top / travel)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  const scene = Math.min(4, Math.floor(progress * 5));
  const local = progress * 5 - scene;
  const imageStyle = {
    "--flight-x": `${-2 + progress * 8}%`,
    "--flight-y": `${progress * -5}%`,
    "--flight-scale": `${1.03 + progress * .34}`,
  } as React.CSSProperties;

  return <main className={`av-concept av-scene-${scene}`} ref={root} style={{ "--av-progress": progress } as React.CSSProperties}>
    <div className="av-stage">
      <picture className="av-picture" style={imageStyle}>
        <source media="(max-width: 700px)" srcSet="/aviation-concept-mobile.png" />
        <img src="/aviation-concept-desktop.png" alt="Unbranded passenger aircraft flying above clouds" />
      </picture>
      <div className="av-color-grade" />
      <div className="av-grain" />
      <div className="av-grid" />
      <div className="av-horizon"><span/></div>

      <header className="av-nav">
        <a href="/" className="av-brand"><b>AVIATION</b><span>INSIGHT</span></a>
        <div className="av-nav-center"><span>FLIGHT CONCEPT · 01</span><i><b style={{width:`${progress*100}%`}}/></i></div>
        <a href="/login" className="av-login"><LockKeyhole size={15}/> LOGIN</a>
      </header>

      <aside className="av-rail" aria-hidden="true">
        <b>{String(scene + 1).padStart(2,"0")}</b><i/>
        {scenes.map((_,i)=><span key={i} className={i===scene?"active":""}>{String(i+1).padStart(2,"0")}</span>)}
      </aside>

      <div className="av-giant" aria-hidden="true">{["ALTITUDE","MOVEMENT","URGENCY","SIGNALS","COMMAND"][scene]}</div>

      <section className="av-copy" key={scene}>
        <span>{scenes[scene].eyebrow}</span>
        <h1>{scenes[scene].title}</h1>
        <p>{scenes[scene].body}</p>
        {scene === 0 && <button onClick={()=>scrollTo({top:innerHeight,behavior:"smooth"})}>BEGIN THE FLIGHT <ArrowRight size={18}/></button>}
        {scene === 4 && <a href="/login">ENTER COMMAND CENTER <ArrowRight size={18}/></a>}
      </section>

      <div className="av-telemetry" aria-hidden="true">
        <div><Radar/><span>LIVE SIGNAL</span><b>CONNECTED</b></div>
        <div><Gauge/><span>VISIBILITY</span><b>{Math.round(progress*100)}%</b></div>
        <div><Route/><span>NETWORK</span><b>ACTIVE</b></div>
      </div>

      <div className={`av-data-stack ${scene >= 3 ? "show" : ""}`} aria-hidden="true">
        <article><TimerReset/><span>AOG RESPONSE</span><b>95.8%</b><i><em/></i></article>
        <article><BarChart3/><span>DELIVERY FLOW</span><b>98.2%</b><i><em/></i></article>
        <article><Plane/><span>CONNECTED VIEWS</span><b>04</b><i><em/></i></article>
      </div>

      <footer className="av-footer"><span>SCROLL TO NAVIGATE</span><i><b style={{height:`${Math.max(8,local*100)}%`}}/></i><strong>0{scene+1} / 05</strong></footer>
    </div>
  </main>;
}
