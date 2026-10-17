"use client";

import { useEffect, useRef } from "react";

export function SalNetworkGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let start = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (now: number) => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(box.width * dpr) || canvas.height !== Math.round(box.height * dpr)) {
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);
      const cx = box.width / 2, cy = box.height / 2, r = Math.min(box.width, box.height) * .34;
      const t = reduced ? 0 : (now - start) / 1000;

      ctx.save();
      ctx.shadowColor = "rgba(62,173,255,.55)"; ctx.shadowBlur = 50;
      const glow = ctx.createRadialGradient(cx-r*.32,cy-r*.38,r*.05,cx,cy,r);
      glow.addColorStop(0,"#c8f0ff"); glow.addColorStop(.34,"#3e9fd4"); glow.addColorStop(.72,"#0b477c"); glow.addColorStop(1,"#041b35");
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); ctx.restore();

      ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
      ctx.strokeStyle="rgba(216,244,255,.22)"; ctx.lineWidth=1;
      for(let i=-3;i<=3;i++){const yy=cy+i*r*.22; ctx.beginPath(); ctx.ellipse(cx,yy,r,Math.max(10,r*.18*(1-Math.abs(i)*.08)),0,0,Math.PI*2);ctx.stroke();}
      for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(cx,cy,r*.22+i*r*.035,r,Math.sin(t*.16+i)*.08,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle="rgba(223,246,255,.2)";
      const lands=[[-.28,-.18,.28,.18],[.12,-.3,.34,.14],[-.1,.2,.23,.3],[.32,.08,.2,.25],[-.42,.16,.18,.12]];
      lands.forEach(([x,y,w,h],i)=>{ctx.beginPath();ctx.ellipse(cx+x*r+Math.sin(t*.14+i)*5,cy+y*r,w*r,h*r,i*.45,0,Math.PI*2);ctx.fill();});
      ctx.restore();

      const hub={x:cx+r*.18,y:cy+r*.02};
      const nodes=[{x:cx-r*.92,y:cy-r*.45},{x:cx+r*.9,y:cy-r*.55},{x:cx+r*1.02,y:cy+.18*r},{x:cx-r*.72,y:cy+r*.72},{x:cx+r*.54,y:cy+r*.77}];
      nodes.forEach((n,i)=>{
        const lift=r*(.72+(i%2)*.22); const mx=(hub.x+n.x)/2, my=Math.min(hub.y,n.y)-lift;
        ctx.strokeStyle="rgba(245,27,65,.72)";ctx.lineWidth=1.6;ctx.setLineDash([6,7]);ctx.lineDashOffset=-t*18-i*6;
        ctx.beginPath();ctx.moveTo(hub.x,hub.y);ctx.quadraticCurveTo(mx,my,n.x,n.y);ctx.stroke();ctx.setLineDash([]);
        const p=(t*.18+i*.17)%1, ax=(1-p)*(1-p)*hub.x+2*(1-p)*p*mx+p*p*n.x, ay=(1-p)*(1-p)*hub.y+2*(1-p)*p*my+p*p*n.y;
        ctx.fillStyle="#fff";ctx.shadowColor="#ff1745";ctx.shadowBlur=13;ctx.beginPath();ctx.arc(ax,ay,3.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        ctx.fillStyle="#f20a35";ctx.beginPath();ctx.arc(n.x,n.y,4,0,Math.PI*2);ctx.fill();
      });
      ctx.fillStyle="#fff";ctx.shadowColor="#ff1745";ctx.shadowBlur=18;ctx.beginPath();ctx.arc(hub.x,hub.y,6,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(raf);
  },[]);

  return <canvas ref={ref} className="sal-network-canvas" aria-label="Animated global network originating from Saudi Arabia" />;
}
