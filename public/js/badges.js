// Name badges (verified check, Robis icon, Star Creator), shared by the
// website and the game client. Admins hand them out in the Admin Panel.
export const BADGE_SVG = {
  verified: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#00a2ff" d="M12 1.5l2.6 2 3.2-.4 1.2 3 3 1.2-.4 3.2 2 2.6-2 2.6.4 3.2-3 1.2-1.2 3-3.2-.4-2.6 2-2.6-2-3.2.4-1.2-3-3-1.2.4-3.2-2-2.6 2-2.6-.4-3.2 3-1.2 1.2-3 3.2.4z"/><path fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M7.5 12.3l3 3 6-6.3"/></svg>',
  staff: '<img src="/img/icon.svg" width="16" height="16" alt="">',
  star: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#f6b702" stroke="#b07f00" stroke-width="1" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
};
export const BADGE_TITLE = { verified: 'Verified', staff: 'Robis Staff', star: 'Star Creator' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// HTML for the badges of a player (flags is a list like ['verified']).
export function badgesHtml(flags) {
  return (flags || []).filter((f) => BADGE_SVG[f]).map((f) => `<span class="name-badge ${f}" title="${esc(BADGE_TITLE[f])}">${BADGE_SVG[f]}</span>`).join('');
}
