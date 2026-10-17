"use client";

import { ArrowRight, Boxes, CheckCircle2, Gauge, LockKeyhole, MapPinned, Plane, Radar, Route, TimerReset } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const dashboards = [
  { title: "AMOS Picking", label: "Emergency response", icon: Gauge },
  { title: "AOG Delivery", label: "Time-critical delivery", icon: Plane },
  { title: "FAK Analysis", label: "Movement & destinations", icon: MapPinned },
  { title: "Marshalling", label: "Operational flow", icon: Boxes },
];

const chapterTitles = ["AVIATION INSIGHT", "AMOS PICKING", "AOG DELIVERY", "FAK ANALYSIS", "MARSHALLING", "CONNECTED REACH"];
const aircraftFrames = [
  { at: 0, left: 67, top: 56, rotate: -13, scale: 1.04, opacity: .95 },
  { at: .2, left: 50, top: 51, rotate: -7, scale: .92, opacity: .94 },
  { at: .4, left: 53, top: 49, rotate: 7, scale: 1, opacity: .95 },
  { at: .6, left: 48, top: 52, rotate: -12, scale: .94, opacity: .93 },
  { at: .8, left: 52, top: 49, rotate: 4, scale: .84, opacity: .92 },
  { at: 1, left: 58, top: 39, rotate: 18, scale: .3, opacity: 0 },
];

const mobileAircraftFrames = [
  { at: 0, left: 70, top: 71, rotate: -10, scale: .78, opacity: .82 },
  { at: .2, left: 54, top: 72, rotate: -5, scale: .72, opacity: .84 },
  { at: .4, left: 57, top: 71, rotate: 6, scale: .76, opacity: .84 },
  { at: .6, left: 52, top: 72, rotate: -9, scale: .7, opacity: .82 },
  { at: .8, left: 55, top: 70, rotate: 4, scale: .64, opacity: .76 },
  { at: .9, left: 58, top: 74, rotate: 12, scale: .46, opacity: .28 },
  { at: 1, left: 62, top: 78, rotate: 18, scale: .25, opacity: 0 },
];

function RotatingEarth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, `attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision highp float;varying vec2 uv;uniform sampler2D earth;uniform float turn;const float PI=3.14159265359;void main(){vec2 q=(uv-.5)*2.;float r=dot(q,q);if(r>1.)discard;float z=sqrt(1.-r);vec3 screenN=normalize(vec3(q.x,-q.y,z));float tilt=.32;mat3 rx=mat3(1.,0.,0.,0.,cos(tilt),-sin(tilt),0.,sin(tilt),cos(tilt));mat3 ry=mat3(cos(turn),0.,sin(turn),0.,1.,0.,-sin(turn),0.,cos(turn));vec3 n=ry*rx*screenN;vec2 mapUv=vec2(fract(atan(n.z,n.x)/(2.*PI)+.5),clamp(asin(clamp(n.y,-1.,1.))/PI+.5,.001,.999));vec3 col=texture2D(earth,mapUv).rgb;float light=.38+.72*max(dot(screenN,normalize(vec3(-.7,.35,.9))),0.);float rim=pow(1.-screenN.z,3.);col*=light;col+=vec3(.12,.55,.9)*rim*.22;gl_FragColor=vec4(col,1.);}`));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const image = new Image();
    let frame = 0;
    let ready = false;
    const started = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const size = Math.min(1400, Math.max(500, Math.round(canvas.clientWidth * devicePixelRatio)));
      if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const draw = (now: number) => {
      resize();
      gl.uniform1f(gl.getUniformLocation(program, "turn"), reduced ? .35 : ((now - started) / 90000) * Math.PI * 2);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      ready = true;
      draw(performance.now());
    };
    image.src = "/earth-rotation-texture.png";
    return () => { if (ready) cancelAnimationFrame(frame); };
  }, []);

  return <canvas ref={canvasRef} className="earth-globe-canvas" aria-hidden="true" />;
}

function aircraftMotion(progress: number, compact = false) {
  const frames = compact ? mobileAircraftFrames : aircraftFrames;
  const end = frames.findIndex((frame) => frame.at >= progress);
  const next = frames[Math.max(1, end)];
  const previous = frames[Math.max(0, end - 1)];
  const amount = Math.max(0, Math.min(1, (progress - previous.at) / Math.max(.001, next.at - previous.at)));
  const mix = (from: number, to: number) => from + (to - from) * amount;
  return {
    left: `${mix(previous.left, next.left)}%`,
    top: `${mix(previous.top, next.top)}%`,
    opacity: mix(previous.opacity, next.opacity),
    transform: `translate(-50%, -50%) rotate(${mix(previous.rotate, next.rotate)}deg) scale(${mix(previous.scale, next.scale)})`,
  };
}

export function SalFlightStory() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const update = () => {
      const rect = root.getBoundingClientRect();
      const range = Math.max(1, rect.height - window.innerHeight);
      const value = Math.max(0, Math.min(1, -rect.top / range));
      setProgress(reduced ? 1 : value);
      root.style.setProperty("--flight-progress", String(value));
      frame = 0;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let locked = false;
    const move = (direction: number) => {
      if (locked) return;
      const rect = root.getBoundingClientRect();
      if (rect.top > 2 || rect.bottom < innerHeight - 2) return;
      const range = root.offsetHeight - innerHeight;
      const current = Math.round(Math.max(0, Math.min(1, -rect.top / Math.max(1, range))) * 5);
      const next = Math.max(0, Math.min(5, current + direction));
      if (next === current) return;
      locked = true;
      scrollTo({ top: scrollY + rect.top + range * (next / 5), behavior: "smooth" });
      window.setTimeout(() => { locked = false; }, 850);
    };
    const wheel = (event: WheelEvent) => { if (Math.abs(event.deltaY) < 8) return; event.preventDefault(); move(event.deltaY > 0 ? 1 : -1); };
    let touchY = 0;
    const touchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; };
    const touchEnd = (event: TouchEvent) => { const end = event.changedTouches[0]?.clientY ?? touchY; if (Math.abs(touchY-end) > 35) move(touchY > end ? 1 : -1); };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    return () => { window.removeEventListener("wheel", wheel); window.removeEventListener("touchstart", touchStart); window.removeEventListener("touchend", touchEnd); };
  }, []);

  const scene = Math.min(5, Math.floor(progress * 6));
  const visibility = Math.min(100, Math.round(progress * 135));
  const aircraftStyle = aircraftMotion(progress, compact);

  return (
    <div ref={rootRef} className={`flight-story flight-scene-${scene}`}>
      <div className="flight-sticky">
        <nav className="flight-nav">
          <a href="/" className="flight-brand"><span className="aviation-wordmark">AVIATION <em>INSIGHT</em></span></a>
          <div className="flight-nav-center"><strong>{chapterTitles[scene]}</strong><span>AVIATION LOGISTICS PERFORMANCE INTELLIGENCE</span><div className="flight-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div></div>
          <a href="/login" className="flight-login"><LockKeyhole size={15} /> LOGIN</a>
        </nav>
        <div className="flight-visual" aria-hidden="true">
          <div className="cabin-layer" /><div className="sky-layer" /><div className="sky-haze" />
          <div className="story-word">{["INSIGHT","AMOS","AOG","FAK","FLOW","CONNECTED"][scene]}</div>
          <img className="story-aircraft" src="/neutral-aircraft-top.png" alt="" style={aircraftStyle} />
          <div className="speed-lines"><i /><i /><i /><i /></div>
          <div className="flight-orbit"><i/><i/><i/></div>
          <div className="aircraft-hud"><span>LIVE</span><b>OPERATIONAL ASSET</b><small>STATUS · CONNECTED</small></div>
          <div className="earth-network">
            <div className="earth-stars" />
            <div className="earth-globe-shell">
              <RotatingEarth />
              <div className="earth-globe-light" />
            </div>
            <div className="earth-shade" />
          </div>
        </div>
        <div className="story-rail" aria-hidden="true"><span>01</span><i/><span>AMOS</span><span>AOG</span><span>FAK</span><span>MAR</span><i/><span>08</span></div>
        <div className="flight-scenes">
          <section className="flight-copy scene-zero"><span>AVIATION PERFORMANCE INTELLIGENCE</span><h1>Operational clarity<br/>at every altitude.</h1><p>One connected command center transforming aviation logistics data into confident operational decisions.</p><div className="flight-intro-grid"><b>04<small>LIVE DASHBOARDS</small></b><b>01<small>CONNECTED VIEW</small></b><b>100%<small>OPERATIONAL FOCUS</small></b></div><a className="flight-start" href="#" onClick={(e)=>{e.preventDefault();scrollTo({top:innerHeight,behavior:"smooth"})}}>EXPLORE THE JOURNEY <ArrowRight/></a></section>
          <section className="flight-copy scene-one"><span>01 · AMOS PICKING</span><h2>Urgent when it matters.<br/>Precise every time.</h2><p>See AOG response and normal logistics performance in one decisive operational view.</p><div className="flight-chips"><b><TimerReset/>AOG RESPONSE</b><b><CheckCircle2/>NORMAL FLOW</b></div></section>
          <section className="flight-copy scene-two"><span>02 · AOG DELIVERY</span><h2>Time-critical.<br/>Destination-ready.</h2><p>Follow every delivery from HB to destination station and turn delay signals into focused action.</p><div className="flight-detail"><Plane/><b>DELIVERY CONTROL</b><small>On-time visibility by station</small></div></section>
          <section className="flight-copy scene-three"><span>03 · FAK ANALYSIS</span><h2>Every destination.<br/>Connected.</h2><p>Bring aircraft movement, delivery flow and destination coverage together across passenger and cargo aircraft.</p><div className="flight-chips"><b><MapPinned/>DESTINATIONS</b><b><Route/>NETWORK FLOW</b></div></section>
          <section className="flight-copy scene-four"><span>04 · MARSHALLING</span><h2>Every part.<br/>Every condition.</h2><p>See movement, serviceability and shift coverage inside one controlled performance story.</p><div className="flight-dashboard-list">{dashboards.map(({title,label,icon:Icon})=><div key={title}><Icon size={19}/><strong>{title}</strong><small>{label}</small></div>)}</div></section>
          <section className="flight-copy scene-five"><span>CONNECTED REACH</span><h2>One network.<br/>Without boundaries.</h2><div className="network-modes"><b>DOMESTIC</b><i/><b>INTERNATIONAL</b></div><p>Global operational visibility.</p><a href="/login">ENTER AVIATION INSIGHT <ArrowRight size={19}/></a></section>
        </div>
        <div className="flight-visibility"><span>OPERATIONAL VISIBILITY</span><strong>{visibility}%</strong></div>
        <div className="flight-counter"><Radar size={17}/><span>{String(scene+1).padStart(2,"0")} / 06</span></div>
      </div>
    </div>
  );
}
