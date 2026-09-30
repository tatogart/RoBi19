// Password hashing (scrypt), session cookies and request authentication.
import crypto from 'node:crypto';

export const COOKIE = 'robis_session';
const SESSION_DAYS = 30;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

export function checkPassword(user, password) {
  if (!user.hash || !user.salt) return false; // system accounts can't log in
  const { hash } = hashPassword(password, user.salt);
  // Constant-time comparison of the two hex strings.
  if (hash.length !== user.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ user.hash.charCodeAt(i);
  return diff === 0;
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.data.sessions[token] = { userId, created: Date.now(), expires: Date.now() + SESSION_DAYS * 86400e3 };
  db.save();
  return token;
}

export function destroySession(db, token) {
  delete db.data.sessions[token];
  db.save();
}

export function userFromToken(db, token) {
  if (!token) return null;
  const s = db.data.sessions[token];
  if (!s) return null;
  if (s.expires < Date.now()) { delete db.data.sessions[token]; db.save(); return null; }
  return db.data.users[s.userId] || null;
}

export function userFromRequest(db, req) {
  return userFromToken(db, parseCookies(req.headers.cookie)[COOKIE]);
}

export function sessionCookie(token, maxAgeDays = SESSION_DAYS) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeDays * 86400)}`;
}

export function validUsername(name) {
  return typeof name === 'string' && /^[A-Za-z0-9_]{3,20}$/.test(name) && !/^_|_$/.test(name) && (name.match(/_/g) || []).length <= 1;
}
