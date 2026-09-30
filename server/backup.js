// Cloud backup for free hosts whose disk is wiped on every restart (Render's
// free plan, for example). The whole database (accounts, games, places,
// thumbnails) is gzipped, encrypted with AES-256-GCM and stored as a single
// file on a branch of a GitHub repository. On start the server restores it.
//
//   ROBIS_BACKUP_TOKEN   GitHub token with "Contents: read and write" on the repo
//   ROBIS_BACKUP_REPO    owner/repo (defaults to Render's RENDER_GIT_REPO_SLUG)
//   ROBIS_BACKUP_BRANCH  branch to keep the backup on (default robis-data)
//   ROBIS_BACKUP_KEY     encryption password (defaults to ROBIS_ADMIN_CODE)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const FILE = 'robis-backup.bin';
const MAGIC = Buffer.from('ROBISBK1');

export function backupConfig(env = process.env) {
  const token = env.ROBIS_BACKUP_TOKEN;
  const repo = env.ROBIS_BACKUP_REPO || env.RENDER_GIT_REPO_SLUG;
  const secret = env.ROBIS_BACKUP_KEY || env.ROBIS_ADMIN_CODE;
  if (!token) return null;
  if (!repo || !secret) {
    console.warn('[backup] ROBIS_BACKUP_TOKEN is set but ROBIS_BACKUP_REPO or ROBIS_BACKUP_KEY/ROBIS_ADMIN_CODE is missing; backups are off.');
    return null;
  }
  return { token, repo, branch: env.ROBIS_BACKUP_BRANCH || 'robis-data', key: crypto.scryptSync(secret, 'robis-backup', 32) };
}

// ------------------------------------------------------------------ packing
function listDir(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir) : []; }

export function pack(dataDir, key) {
  const snap = { db: null, places: {}, thumbs: {} };
  const dbFile = path.join(dataDir, 'db.json');
  if (fs.existsSync(dbFile)) snap.db = fs.readFileSync(dbFile, 'utf8');
  for (const f of listDir(path.join(dataDir, 'places'))) snap.places[f] = fs.readFileSync(path.join(dataDir, 'places', f), 'utf8');
  for (const f of listDir(path.join(dataDir, 'thumbs'))) snap.thumbs[f] = fs.readFileSync(path.join(dataDir, 'thumbs', f)).toString('base64');
  const plain = zlib.gzipSync(JSON.stringify(snap));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

export function unpack(buf, dataDir, key) {
  if (!buf.subarray(0, 8).equals(MAGIC)) throw new Error('not a Robis backup');
  const iv = buf.subarray(8, 20);
  const tag = buf.subarray(20, 36);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  const snap = JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(36)), d.final()])));
  const safe = (f) => path.basename(f);
  fs.mkdirSync(path.join(dataDir, 'places'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'thumbs'), { recursive: true });
  if (snap.db) fs.writeFileSync(path.join(dataDir, 'db.json'), snap.db);
  for (const [f, v] of Object.entries(snap.places || {})) fs.writeFileSync(path.join(dataDir, 'places', safe(f)), v);
  for (const [f, v] of Object.entries(snap.thumbs || {})) fs.writeFileSync(path.join(dataDir, 'thumbs', safe(f)), Buffer.from(v, 'base64'));
}

// ------------------------------------------------------------------ GitHub
async function gh(cfg, method, url, body, accept = 'application/vnd.github+json') {
  const res = await fetch(`https://api.github.com/repos/${cfg.repo}${url}`, {
    method,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      accept,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'robis-server',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method} ${url}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}

// Downloads the backup into dataDir. Returns true if one was restored.
export async function restore(cfg, dataDir) {
  const res = await gh(cfg, 'GET', `/contents/${FILE}?ref=${encodeURIComponent(cfg.branch)}`, null, 'application/vnd.github.raw');
  if (res.status === 404) { console.log(`[backup] no backup on ${cfg.repo}@${cfg.branch} yet, starting fresh`); return false; }
  unpack(Buffer.from(await res.arrayBuffer()), dataDir, cfg.key);
  console.log(`[backup] restored from ${cfg.repo}@${cfg.branch}`);
  return true;
}

// Replaces the branch with a single commit holding the new backup, so the
// repository doesn't grow a commit per save.
export async function upload(cfg, dataDir) {
  const content = pack(dataDir, cfg.key).toString('base64');
  const blob = await (await gh(cfg, 'POST', '/git/blobs', { content, encoding: 'base64' })).json();
  const tree = await (await gh(cfg, 'POST', '/git/trees', { tree: [{ path: FILE, mode: '100644', type: 'blob', sha: blob.sha }] })).json();
  const commit = await (await gh(cfg, 'POST', '/git/commits', { message: 'Robis data backup', tree: tree.sha, parents: [] })).json();
  const ref = await gh(cfg, 'PATCH', `/git/refs/heads/${cfg.branch}`, { sha: commit.sha, force: true });
  if (ref.status === 404) await gh(cfg, 'POST', '/git/refs', { ref: `refs/heads/${cfg.branch}`, sha: commit.sha });
}

// Saves a backup at most once per `interval` while the database changes.
export function startBackups(cfg, db, interval = 60_000) {
  let dirty = false;
  let running = null;
  const mark = () => { dirty = true; };
  for (const m of ['save', 'writePlace', 'writeThumb']) {
    const orig = db[m].bind(db);
    db[m] = (...a) => { mark(); return orig(...a); };
  }
  const run = async () => {
    if (!dirty || running) return running;
    dirty = false;
    db.flush();
    running = upload(cfg, db.dir)
      .catch((e) => { dirty = true; console.error('[backup] upload failed:', e.message); })
      .finally(() => { running = null; });
    return running;
  };
  const timer = setInterval(run, interval);
  timer.unref();
  return { flush: async () => { clearInterval(timer); await running; await run(); } };
}
