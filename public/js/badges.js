// Name badges (checks, Robis icon, crown, ...), shared by the website and the
// game client. Admins hand them out in the Admin Panel (Badges tab).
const svg = (body) => `<svg viewBox="0 0 24 24" width="16" height="16">${body}</svg>`;
const SEAL = 'M12 1.5l2.6 2 3.2-.4 1.2 3 3 1.2-.4 3.2 2 2.6-2 2.6.4 3.2-3 1.2-1.2 3-3.2-.4-2.6 2-2.6-2-3.2.4-1.2-3-3-1.2.4-3.2-2-2.6 2-2.6-.4-3.2 3-1.2 1.2-3 3.2.4z';
const CHECK = '<path fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M7.5 12.3l3 3 6-6.3"/>';

// In display order.
export const BADGE_SVG = {
  staff: '<img src="/img/icon.svg" width="16" height="16" alt="">',
  verified: svg(`<path fill="#00a2ff" d="${SEAL}"/>${CHECK}`),
  partner: svg(`<path fill="#f5b301" stroke="#c98d00" stroke-width=".6" d="${SEAL}"/>${CHECK}`),
  moderator: svg('<path fill="#2fae4f" stroke="#1e7d36" stroke-width=".8" d="M12 1.8l8.5 3.2v6.2c0 5.3-3.6 9.6-8.5 11-4.9-1.4-8.5-5.7-8.5-11V5z"/><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M8 12.2l2.8 2.8 5.2-5.4"/>'),
  developer: svg('<rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#7a3cff"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M8.5 8l-4 4 4 4M15.5 8l4 4-4 4M13.2 6.5l-2.4 11"/>'),
  star: svg('<path fill="#f6b702" stroke="#b07f00" stroke-width="1" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>'),
  vip: svg('<path fill="#ffc400" stroke="#a87700" stroke-width="1" stroke-linejoin="round" d="M2.5 7.5l5 4.2L12 4l4.5 7.7 5-4.2-2 11.5h-15z"/><rect x="4.5" y="19.5" width="15" height="2.4" rx="1" fill="#e0a800"/><circle cx="12" cy="14.5" r="1.6" fill="#ff3b5c"/>'),
  creator: svg('<rect x="1.5" y="4" width="21" height="16" rx="5" fill="#ff0033"/><path fill="#fff" d="M10 8.3v7.4l6-3.7z"/>'),
  champion: svg('<path fill="#f6b702" stroke="#a87700" stroke-width=".8" d="M7 3h10v6a5 5 0 01-10 0z"/><path fill="none" stroke="#a87700" stroke-width="1.6" d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3"/><rect x="10.8" y="13.5" width="2.4" height="4" fill="#e0a800"/><rect x="7.5" y="17.5" width="9" height="3.5" rx="1" fill="#8a5a00"/>'),
  bughunter: svg('<circle cx="12" cy="12" r="10.5" fill="#e8590c"/><ellipse cx="12" cy="13.2" rx="3.6" ry="4.6" fill="#fff"/><circle cx="12" cy="7.8" r="2" fill="#fff"/><path stroke="#fff" stroke-width="1.5" stroke-linecap="round" d="M6.5 10.5l2.4 1M17.5 10.5l-2.4 1M6.3 14.5h2.5M17.7 14.5h-2.5M7 18.3l2.2-1.5M17 18.3l-2.2-1.5"/><path stroke="#e8590c" stroke-width="1" d="M12 9.5v8"/>'),
  supporter: svg('<path fill="#ff4d8d" stroke="#d6336c" stroke-width=".8" d="M12 21s-8.5-5.2-8.5-11.2A4.8 4.8 0 0112 7a4.8 4.8 0 018.5 2.8C20.5 15.8 12 21 12 21z"/>'),
  og: svg('<circle cx="12" cy="12" r="10.5" fill="#1b1b1b" stroke="#f6b702" stroke-width="1.4"/><text x="12" y="15.6" font-family="Arial, sans-serif" font-size="9.5" font-weight="bold" text-anchor="middle" fill="#f6b702">OG</text>'),
};
export const BADGE_TITLE = {
  staff: 'Robis Staff', verified: 'Verified', partner: 'Partner', moderator: 'Moderator', developer: 'Developer',
  star: 'Star Creator', vip: 'VIP', creator: 'Video Creator', champion: 'Champion', bughunter: 'Bug Hunter',
  supporter: 'Supporter', og: 'OG Player',
};
const ORDER = Object.keys(BADGE_SVG);
export const sortBadges = (flags) => (flags || []).filter((f) => BADGE_SVG[f]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// HTML for the badges of a player (flags is a list like ['verified']).
export function badgesHtml(flags) {
  return sortBadges(flags).map((f) => `<span class="name-badge ${f}" title="${esc(BADGE_TITLE[f])}">${BADGE_SVG[f]}</span>`).join('');
}
