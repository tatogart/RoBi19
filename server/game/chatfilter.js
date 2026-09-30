// A tiny 2019-style chat filter: blocked words become hashtags.
const WORDS = ['damn', 'crap', 'stupid', 'idiot', 'dumb', 'fuck\\w*', 'shit\\w*', 'bitch\\w*', 'discord', 'password'];
const SUBSTRINGS = ['сука', 'бля', 'хуй', 'пизд', 'ебат', 'ебан', 'дурак', 'идиот', 'пароль'];
const PATTERNS = [
  ...WORDS.map((w) => new RegExp(`\\b${w}\\b`, 'gi')),
  ...SUBSTRINGS.map((w) => new RegExp(`[а-яё]*${w}[а-яё]*`, 'giu')),
  /\d[\d\s-]{5,}\d/g, // phone numbers / long digit runs
];

export function filterChat(text) {
  let out = String(text);
  for (const re of PATTERNS) out = out.replace(re, (m) => '#'.repeat(m.length));
  return out;
}
