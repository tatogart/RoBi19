// A tiny 2019-style chat filter: blocked words become hashtags.
const WORDS = ['damn', 'crap', 'stupid', 'idiot', 'dumb', 'fuck\\w*', 'shit\\w*', 'bitch\\w*', 'discord', 'password'];
const SUBSTRINGS = ['сука', 'бля', 'хуй', 'пизд', 'ебат', 'ебан', 'дурак', 'идиот', 'пароль'];
const PATTERNS = [
  ...WORDS.map((w) => new RegExp(`\\b${w}\\b`, 'gi')),
  ...SUBSTRINGS.map((w) => new RegExp(`[а-яё]*${w}[а-яё]*`, 'giu')),
  /\d[\d\s-]{5,}\d/g, // phone numbers / long digit runs
];

// Extra words the admins add in the Admin Panel (Settings).
let EXTRA = [];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function setExtraWords(words) {
  EXTRA = (words || []).map((w) => String(w).trim()).filter(Boolean).slice(0, 300).map((w) => new RegExp(escapeRe(w), 'giu'));
}

export function filterChat(text) {
  let out = String(text);
  for (const re of [...PATTERNS, ...EXTRA]) out = out.replace(re, (m) => '#'.repeat(m.length));
  return out;
}
