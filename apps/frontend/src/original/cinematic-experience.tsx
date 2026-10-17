"use client";

import { Plane } from "lucide-react";
import { useEffect, useState } from "react";

export function CinematicExperience() {
  const [progress, setProgress] = useState(1);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const started = performance.now();
    const duration = 2600;
    let frame = 0;

    const tick = (now: number) => {
      const ratio = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(Math.max(1, Math.round(eased * 100)));
      if (ratio < 1) frame = requestAnimationFrame(tick);
      else window.setTimeout(() => setComplete(true), 360);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-cinematic]"));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.target.classList.toggle("is-visible", entry.isIntersecting)),
      { threshold: 0.18, rootMargin: "0px 0px -8%" },
    );
    sections.forEach((section) => observer.observe(section));
    let scrollFrame = 0;
    const updateTextMotion = () => {
      scrollFrame = 0;
      const viewportCenter = window.innerHeight / 2;
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const distance = (rect.top + rect.height / 2 - viewportCenter) / window.innerHeight;
        const shift = Math.max(-24, Math.min(24, distance * -18));
        section.style.setProperty("--text-parallax", `${shift.toFixed(1)}px`);
      });
    };
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateTextMotion);
    };
    updateTextMotion();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={`cinematic-loader ${complete ? "is-complete" : ""}`} aria-hidden={complete}>
      <div className="loader-sky" />
      <div className="loader-orbit orbit-one" />
      <div className="loader-orbit orbit-two" />
      <div className="loader-flight">
        <Plane />
        <span />
      </div>
      <div className="loader-copy">
        <span className="aviation-wordmark">AVIATION <em>INSIGHT</em></span>
        <p>PREPARING OPERATIONAL INTELLIGENCE</p>
        <div className="loader-number"><strong>{progress}</strong><span>%</span></div>
        <div className="loader-track"><i style={{ width: `${progress}%` }} /></div>
        <small>{progress < 36 ? "CONNECTING OPERATIONS" : progress < 72 ? "MAPPING THE NETWORK" : progress < 100 ? "TURNING MOVEMENT INTO INSIGHT" : "READY"}</small>
      </div>
      <div className="loader-panel loader-panel-left" />
      <div className="loader-panel loader-panel-right" />
    </div>
  );
}
