export function isDesktopApp(): boolean {
  return import.meta.env.VITE_DESKTOP_APP === '1'
    || (typeof navigator !== 'undefined' && /\bElectron\//i.test(navigator.userAgent));
}
