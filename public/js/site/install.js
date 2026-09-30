// "Install Robis" (PC, Mac, Android, iPhone) and automatic updates.
import { el, modal, toast } from './ui.js';

let deferred = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { deferred = null; toast('Robis is installed! Open it from your desktop or home screen.', 'success'); });

export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function platform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'safari';
  return 'desktop';
}

const STEPS = {
  desktop: ['Click the install icon (⊕ or a small monitor with an arrow) at the right end of the address bar,', 'or open the browser menu ⋮ → "Cast, save and share" / "Apps" → "Install Robis".', 'Robis opens in its own window and gets a desktop / Start menu icon.'],
  safari: ['In the menu bar choose File → "Add to Dock".', 'Robis appears in your Dock and Launchpad.'],
  firefox: ['Firefox can\'t install web apps. Open this page in Chrome or Edge and press "Install Robis" there.'],
  android: ['Open the browser menu ⋮ → "Install app" (or "Add to Home screen").'],
  ios: ['Tap the Share button (square with an arrow) in Safari.', 'Choose "Add to Home Screen" and tap "Add".'],
};

// Tries the browser's one-click install, otherwise shows the steps.
export async function installApp() {
  if (isInstalled()) { toast('Robis is already installed on this device.', 'success'); return; }
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({}));
    deferred = null;
    if (outcome === 'accepted') return;
  }
  const p = platform();
  modal({
    title: 'Install Robis',
    body: el('div', {},
      el('p', { text: 'Install Robis like an app: it gets its own icon and window, works offline and updates itself.' }),
      el('ol', { style: { paddingLeft: '20px' } }, STEPS[p].map((s) => el('li', { text: s, style: { marginBottom: '6px' } })))),
    buttons: [{ text: 'OK', cls: 'btn-primary' }],
  });
}

export function installButton(cls = 'btn btn-green') {
  if (isInstalled()) return null;
  return el('button', { class: cls, text: 'Install Robis', onclick: installApp });
}

// ---------------------------------------------------------------- updates
// Phone/PC app (service worker): a new version is fetched in the background;
// when it takes over, the page reloads itself (not in the middle of a game).
const inGame = () => /\/(play|studio)(\.html)?$/.test(location.pathname);
function onUpdated() {
  if (inGame()) { toast('Robis was updated. The new version starts when you leave the game.', 'success'); return; }
  toast('Robis was updated!', 'success');
  setTimeout(() => location.reload(), 1200);
}

if ('serviceWorker' in navigator && window.ROBIS_STANDALONE) {
  // On the very first visit the worker takes control for the first time:
  // that is not an update, so only react when a page was already controlled.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) onUpdated(); });
  navigator.serviceWorker.ready.then((reg) => {
    const check = () => reg.update().catch(() => {});
    check();
    setInterval(check, 30 * 60 * 1000);
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => {});
} else if (!window.ROBIS_STANDALONE) {
  // Makes the site installable as an app, with an offline notice.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/app-sw.js').catch(() => {});
  // Server version: the server tells us its build; a new deploy reloads open pages.
  let first = null;
  const check = async () => {
    try {
      const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json();
      if (first === null) first = version;
      else if (version && version !== first) { first = version; onUpdated(); }
    } catch { /* offline or asleep */ }
  };
  check();
  setInterval(check, 5 * 60 * 1000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
