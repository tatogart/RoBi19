// `npm run admin-password [new-password]` — sets a new password for the Robis admin account.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../db.js';
import { hashPassword } from '../auth.js';

const dir = process.env.ROBIS_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const db = new Database(dir);
const admin = Object.values(db.data.users).find((u) => u.isAdmin);
if (!admin) {
  console.error('No admin account found. Start the server once (npm start) to create the world.');
  process.exit(1);
}
const password = process.argv[2] || process.env.ROBIS_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}
Object.assign(admin, hashPassword(password));
// Log out every existing session of the admin.
for (const [token, s] of Object.entries(db.data.sessions)) if (s.userId === admin.id) delete db.data.sessions[token];
db.flush();
console.log(`New password for ${admin.username}: ${password}`);
console.log('Note: run this while the server is stopped, otherwise the running server may overwrite it.');
