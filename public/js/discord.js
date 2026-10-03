// Robis as a Discord Activity: Robis runs inside Discord (in a voice channel,
// "Activities" button) and the players' Discord status shows what they do
// ("Playing DOORS"). Discord loads the page in an iframe on
// <app id>.discordsays.com, which forwards everything to this server.
//
// Set up in Admin Panel -> Settings -> Discord Activity (Application ID and
// Client Secret from the Discord Developer Portal).

const PARAMS = 'robis-discord-params';
const TOKEN = 'robis-discord-token';
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};

// The Robis session inside Discord (cookies don't work in its iframe).
export const discordSession = {
  get: () => { try { return localStorage.getItem('robis-session'); } catch { return null; } },
  set: (t) => { try { if (t) localStorage.setItem('robis-session', t); else localStorage.removeItem('robis-session'); } catch { /* ignore */ } },
};

// Discord adds frame_id, instance_id, platform... to the first URL only; the
// SDK needs them on every page, so they are kept and put back.
export function inDiscord() {
  if (typeof location === 'undefined') return false;
  const q = new URLSearchParams(location.search);
  if (q.get('frame_id')) {
    const keep = {};
    for (const k of ['frame_id', 'instance_id', 'platform', 'guild_id', 'channel_id', 'location_id']) if (q.get(k)) keep[k] = q.get(k);
    store.set(PARAMS, JSON.stringify(keep));
    return true;
  }
  return location.hostname.endsWith('.discordsays.com') || !!store.get(PARAMS);
}

function restoreParams() {
  const saved = store.get(PARAMS);
  if (!saved) return;
  const q = new URLSearchParams(location.search);
  if (q.get('frame_id')) return;
  for (const [k, v] of Object.entries(JSON.parse(saved))) q.set(k, v);
  history.replaceState(history.state, '', `${location.pathname}?${q}${location.hash}`);
}

let sdkPromise = null;
// Connects to Discord (once per page) and logs in to Discord so the status can be set.
export function discordSdk(appId) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    restoreParams();
    const { DiscordSDK } = await import('/vendor/discord-sdk.js');
    const sdk = new DiscordSDK(appId);
    await sdk.ready();
    let token = store.get(TOKEN);
    if (!token) {
      const { code } = await sdk.commands.authorize({ client_id: appId, response_type: 'code', state: '', prompt: 'none', scope: ['identify', 'rpc.activities.write'] });
      const r = await fetch('/api/discord/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Discord login failed');
      token = data.access_token;
      store.set(TOKEN, token);
    }
    try { await sdk.commands.authenticate({ access_token: token }); } catch (e) {
      // an old token: log in again next time
      try { sessionStorage.removeItem(TOKEN); } catch { /* ignore */ }
      throw e;
    }
    return sdk;
  })();
  sdkPromise.catch(() => {});
  return sdkPromise;
}

// "for 12 minutes" counts from when the player opened Robis in Discord
const started = +(store.get('robis-discord-start') || 0) || Math.floor(Date.now() / 1000);
store.set('robis-discord-start', String(started));
// The Discord status: details = the big line, state = the small one.
export async function setDiscordStatus(appId, details, state) {
  if (!appId || !inDiscord()) return;
  try {
    const sdk = await discordSdk(appId);
    await sdk.commands.setActivity({
      activity: {
        type: 0,
        details: String(details || 'On Robis').slice(0, 120),
        state: state ? String(state).slice(0, 120) : undefined,
        timestamps: { start: started },
        assets: { large_image: 'robis', large_text: 'Robis' },
      },
    });
  } catch (e) {
    console.warn('Discord status:', e && e.message ? e.message : e);
  }
}

// Inside Discord every request to /api carries the session (pages that use
// fetch directly, like the game page, too).
if (typeof window !== 'undefined' && inDiscord() && !window.__robisDiscordFetch) {
  window.__robisDiscordFetch = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url && (url.startsWith('/api/') || url.startsWith(location.origin + '/api/'))) {
      const headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
      headers.set('x-robis-discord', '1');
      const t = discordSession.get();
      if (t && !headers.has('x-robis-session')) headers.set('x-robis-session', t);
      init = { ...init, headers };
    }
    return orig(input, init);
  };
}
