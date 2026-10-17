"use client";

import { Plane } from "lucide-react";
import { useEffect, useState } from "react";

export default function WelcomeJourney({ name, personalized }: { name: string; personalized: boolean }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    window.history.replaceState({}, "", "/portal");
    const timer = window.setTimeout(() => setVisible(false), 5200);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <section className="welcome-journey" aria-label="Welcome to Aviation Insight">
      <button className="welcome-skip" type="button" onClick={() => setVisible(false)}>Skip intro</button>
      <div className="welcome-grid" aria-hidden="true" />
      <div className="welcome-map" aria-hidden="true">
        <svg viewBox="0 0 620 470" role="presentation">
          <defs>
            <linearGradient id="saudiGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffecf0" stopOpacity=".3" />
              <stop offset="1" stopColor="#ff4967" stopOpacity=".08" />
            </linearGradient>
            <filter id="nodeGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path className="saudi-outline" d="M102 110 174 84l73 25 49-31 82 18 42-12 29 36 55 22 9 62 42 36-19 61-50 17-21 51-62 13-52 37-62-19-63 13-54-45-45-21-10-62-31-45 28-57-9-48 27-25Z" />
          <g className="network-routes">
            <path d="M137 281 Q230 194 350 210" />
            <path d="M137 281 Q250 298 445 289" />
            <path d="M137 281 Q155 205 190 154" />
            <path d="M137 281 Q265 372 374 361" />
            <path d="M137 281 Q320 166 482 170" />
            <path d="M137 281 Q208 247 279 257" />
            <path d="M350 210 Q405 239 445 289" />
          </g>
          <g className="network-nodes" filter="url(#nodeGlow)">
            <circle className="hub-pulse" cx="137" cy="281" r="13" />
            <circle cx="137" cy="281" r="5" /><circle cx="350" cy="210" r="5" />
            <circle cx="445" cy="289" r="5" /><circle cx="190" cy="154" r="4" />
            <circle cx="374" cy="361" r="4" /><circle cx="482" cy="170" r="4" />
            <circle cx="279" cy="257" r="4" />
          </g>
          <g className="network-labels">
            <text x="105" y="309">JEDDAH</text><text x="330" y="193">RIYADH</text>
            <text x="454" y="310">DAMMAM</text><text x="157" y="141">MADINAH</text>
          </g>
        </svg>
        <div className="flight-path"><Plane size={34} strokeWidth={1.6} /></div>
      </div>
      <div className="welcome-copy">
        <div className="welcome-logo"><span className="aviation-wordmark">AVIATION <em>INSIGHT</em></span></div>
        <p className="welcome-kicker">AVIATION OPERATIONAL INTELLIGENCE</p>
        <h1>{personalized ? <>Welcome, <span>{name.split(/\s+/)[0]}</span></> : <>Welcome to <span>Aviation Insight</span></>}</h1>
        <p className="welcome-line">You are now entering the operational performance command center.</p>
        <div className="welcome-divider"><i /><b /></div>
        <p className="welcome-signature">Built for those who move aviation forward.</p>
      </div>
      <div className="welcome-progress" aria-hidden="true"><span /></div>
    </section>
  );
}
