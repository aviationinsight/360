'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, Smartphone, X } from 'lucide-react';
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function InstallApp() {
  const { pathname } = useLocation();
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const isStandalone = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    isStandalone();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    setAndroid(/Android/i.test(navigator.userAgent));
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const done = () => { setInstalled(true); setPrompt(null); dialog.current?.close(); };
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', done);
    standalone.addEventListener('change', isStandalone);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {});
    return () => { window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', done); standalone.removeEventListener('change', isStandalone); };
  }, []);
  async function install() {
    if (!prompt) { dialog.current?.showModal(); return; }
    setBusy(true);
    try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === 'accepted') setInstalled(true); }
    catch { dialog.current?.showModal(); }
    finally { setPrompt(null); setBusy(false); }
  }
  if (installed || !['/', '/login', '/portal'].includes(pathname)) return null;
  return <>
    <button className="install-app-button" onClick={install} disabled={busy}><Download size={17} />{busy ? 'Opening…' : 'Install app'}</button>
    <dialog ref={dialog} className="install-app-dialog" aria-labelledby="install-app-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <button className="install-app-close" aria-label="Close installation instructions" onClick={() => dialog.current?.close()}><X size={20} /></button>
      <img src="/app-icons/icon-192-v2.png" width="64" height="64" alt="" /><span className="eyebrow">AVIATION INSIGHT</span><h2 id="install-app-title">Your command center.<br />On your home screen.</h2><p>Open your dashboards directly from your phone, with the same account and live data.</p>
      {ios ? <><h3>Install on iPhone or iPad</h3><ol><li>Open this website in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong> <Share size={15} />.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Enable <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li></ol></> : android ? <><h3>Install on Android</h3><ol><li>Open this website in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮ menu</strong>.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</li></ol></> : <><h3>Install from your browser</h3><p>Use the install icon in the address bar or your browser’s menu. On a phone, open this site in Safari for iPhone or Chrome for Android, then add it to your home screen.</p></>}
      <div className="install-app-note"><Smartphone size={18} /><span>Internet access is required for live dashboards. Website updates appear in the app too.</span></div>
      <button className="install-app-confirm" onClick={() => dialog.current?.close()}>Got it</button>
    </dialog>
  </>;
}
