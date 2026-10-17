"use client";

import { ArrowDown, ArrowRight, LockKeyhole, MousePointer2, Plane, Radio, Wind } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const chapters = [
  { no: "01", label: "TAKE OFF", word: "MOVE", title: <>Made to<br/><em>move.</em></>, note: "Operational intelligence should feel as fast as the operation itself." },
  { no: "02", label: "ABOVE THE CLOUDS", word: "SEE", title: <>See more.<br/><em>Miss less.</em></>, note: "One clear view across every critical aviation movement." },
  { no: "03", label: "LIVE SIGNALS", word: "KNOW", title: <>Every signal.<br/><em>In motion.</em></>, note: "Live performance becomes a visual language built for decisions." },
  { no: "04", label: "COMMAND", word: "LEAD", title: <>Clarity at<br/><em>every altitude.</em></>, note: "From aircraft movement to executive action—connected in one place." },
];

export function FlightLab() {
  const root = useRef<HTMLElement>(null);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const distance = Math.max(1, el.offsetHeight - innerHeight);
      const p = Math.max(0, Math.min(1, -rect.top / distance));
      el.style.setProperty("--flight-progress", String(p));
      const next = Math.min(3, Math.floor(p * 4));
      setChapter(current => current === next ? current : next);
    };
    const move = (event: PointerEvent) => {
      el.style.setProperty("--pointer-x", String((event.clientX / innerWidth - .5) * 2));
      el.style.setProperty("--pointer-y", String((event.clientY / innerHeight - .5) * 2));
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", scroll);
    addEventListener("pointermove", move, { passive: true });
    return () => { removeEventListener("scroll", scroll); removeEventListener("resize", scroll); removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, []);

  const data = chapters[chapter];
  return (
    <main ref={root} className={`flight-lab flight-lab-${chapter}`}>
      <div className="fl-stage">
        <div className="fl-sky" /><div className="fl-sun" />
        <div className="fl-orbit fl-orbit-a" /><div className="fl-orbit fl-orbit-b" />
        <div className="fl-cloud fl-cloud-a" /><div className="fl-cloud fl-cloud-b" /><div className="fl-cloud fl-cloud-c" />
        <div className="fl-speed-lines" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i}/>)}</div>
        <header className="fl-header">
          <a href="/" className="fl-logo"><b>AVIATION</b><span>INSIGHT</span></a>
          <nav><a href="#journey">Journey</a><a href="/login">Command center</a></nav>
          <a className="fl-login" href="/login"><LockKeyhole size={15}/> Login</a>
        </header>
        <div className="fl-marquee" aria-hidden="true"><span>AVIATION · INTELLIGENCE · IN MOTION · AVIATION · INTELLIGENCE · IN MOTION · </span></div>
        <section className="fl-copy" key={chapter}>
          <div className="fl-eyebrow"><i/>{data.no} / {data.label}</div>
          <h1>{data.title}</h1><p>{data.note}</p>
        </section>
        <div className="fl-word" key={`word-${chapter}`}>{data.word}</div>
        <div className="fl-plane-wrap" aria-hidden="true">
          <div className="fl-plane-glow" /><img src="/neutral-aircraft-top.png" alt="" className="fl-plane" />
          <span className="fl-wing-label fl-wing-one">LIVE<br/>VISIBILITY</span><span className="fl-wing-label fl-wing-two">CONNECTED<br/>OPERATIONS</span>
        </div>
        <aside className="fl-side-note"><MousePointer2 size={15}/><span>Move to explore</span></aside>
        <div className="fl-readout">
          <div><Radio/><span>STATUS</span><b>LIVE</b></div><div><Wind/><span>FLOW</span><b>CONNECTED</b></div><div><Plane/><span>VIEW</span><b>360°</b></div>
        </div>
        <div className="fl-chapters">{chapters.map((item,i)=><button key={item.no} className={i===chapter?"active":""} onClick={()=>scrollTo({top:(root.current?.offsetTop||0)+(root.current!.offsetHeight-innerHeight)*(i/3),behavior:"smooth"})}><span>{item.no}</span><i/></button>)}</div>
        <footer className="fl-bottom">
          <button onClick={()=>scrollBy({top:innerHeight*.85,behavior:"smooth"})}><ArrowDown size={17}/> Scroll to fly</button>
          <div><span>FLIGHT PROGRESS</span><i><b/></i></div>
          {chapter === 3 ? <a href="/login">Enter command center <ArrowRight size={17}/></a> : <span className="fl-coordinates">21.6796° N · 39.1565° E</span>}
        </footer>
      </div>
    </main>
  );
}
