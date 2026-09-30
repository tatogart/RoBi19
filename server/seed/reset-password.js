// `npm run reset-password <username> [new-password]` — sets a new password for an account
// (for players who forgot theirs). Run it while the server is stopped.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../db.js';
import { hashPassword } from '../auth.js';

const [username, given] = process.argv.slice(2);
if (!username) {
  console.error('Usage: npm run reset-password <username> [new-password]');
  process.exit(1);
}
const dir = process.env.ROBIS_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const db = new Database(dir);
const user = Object.values(db.data.users).find((u) => u.username.toLowerCase() === username.toLowerCase());
if (!user || user.system) {
  console.error(`No player account named "${username}".`);
  process.exit(1);
}
const password = given || crypto.randomBytes(9).toString('base64url');
if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}
Object.assign(user, hashPassword(password));
for (const [token, s] of Object.entries(db.data.sessions)) if (s.userId === user.id) delete db.data.sessions[token];
db.flush();
console.log(`New password for ${user.username}: ${password}`);
