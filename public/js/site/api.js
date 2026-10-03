// Thin wrapper around the Robis REST API.
import { inDiscord, discordSession } from '../discord.js';
async function request(method, url, body) {
  // The standalone build prefixes site paths with its base (e.g. /RoBi19);
  // API paths like '/games' can get caught by that, so undo it here.
  const base = window.ROBIS_BASE;
  if (base && url.startsWith(base + '/')) url = url.slice(base.length);
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  // inside a Discord Activity: the session goes in a header (no cookies there)
  const discord = inDiscord();
  if (discord) {
    headers['x-robis-discord'] = '1';
    const t = discordSession.get();
    if (t) headers['x-robis-session'] = t;
  }
  const res = await fetch('/api' + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (discord && data && data.session) discordSession.set(data.session);
  if (discord && url === '/auth/logout') discordSession.set(null);
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b = {}) => request('POST', u, b),
  put: (u, b = {}) => request('PUT', u, b),
  patch: (u, b = {}) => request('PATCH', u, b),
  del: (u) => request('DELETE', u),
};

let meCache;
export async function getMe(force = false) {
  if (!meCache || force) meCache = api.get('/auth/me').then((r) => r.user).catch(() => null);
  return meCache;
}
