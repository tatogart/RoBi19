// "This may be a scam": finds links and scam phrases in chat messages, game
// chat, private messages and group walls, so the page can warn the player.
// Links to this Robis itself and to the official socials are fine.

const LINK = /\b((?:https?:\/\/|www\.)[^\s<>"']+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|ru|рф|io|gg|xyz|top|site|online|club|me|ly|link|app|dev|info|biz|co|cc|tk|ml|ga|cf|gq|su|ua|by|kz|shop|store|live|fun|pw|click|win|vip|pro|tv)(?:\/[^\s<>"']*)?)/giu;
const SCAM_WORDS = [
  /free\s*(robits|robux|items?|limiteds?|bc|builders?\s*club)/i,
  /(бесплатн[а-яё]*|халяв[а-яё]*)\s*(робит[а-яё]*|robits|робукс[а-яё]*|robux|предмет[а-яё]*|лимит[а-яё]*)/iu,
  /(giveaway|раздач[а-яё]*)/iu,
  /(log\s*in|sign\s*in|verify|войди|авториз[а-яё]*|подтверди)\s.{0,30}(account|аккаунт)/iu,
  /(password|пароль|парол[ья]|cookie|куки|\.ROBISSECURITY)/iu,
  /(double|удво[а-яё]*)\s.{0,15}(robits|robux|робит)/iu,
  /admin\s*(gives|раздает|раздаёт)/iu,
];
const DEFAULT_SAFE = ['t.me/robisgame', 'vk.ru/club241960834', 'vk.com/club241960834'];
const LOOKALIKE = /(r[o0]b[i1l!]s|r[o0]bl[o0]x).{0,12}\.|\.(r[o0]b[i1l!]s|r[o0]bl[o0]x)/i;

export function findLinks(text) {
  return [...String(text || '').matchAll(LINK)].map((m) => m[0]);
}

// safe: hosts or host+path prefixes that are fine (this site, its socials).
// Returns '' (fine), 'link' (a link to somewhere else: be careful) or 'scam'.
export function scamLevel(text, safe = []) {
  const t = String(text || '');
  const ok = [...DEFAULT_SAFE, ...safe.map((s) => String(s).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''))].filter(Boolean);
  const links = findLinks(t).filter((l) => {
    const u = l.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    return !ok.some((s) => u === s || u.startsWith(s + '/') || u.startsWith(s + '?') || (!s.includes('/') && u.split('/')[0] === s));
  });
  const words = SCAM_WORDS.some((re) => re.test(t));
  if (links.length && (words || links.some((l) => LOOKALIKE.test(l)))) return 'scam';
  if (words && /(robits|robux|робит|робукс|пароль|password)/iu.test(t)) return 'scam';
  if (links.length) return 'link';
  return '';
}

export const SCAM_TEXT = {
  scam: '⚠ This looks like a SCAM! Nobody gives free Robits. Never enter your password on other sites.',
  link: '⚠ A link to another site. Be careful: never enter your Robis password there.',
};
