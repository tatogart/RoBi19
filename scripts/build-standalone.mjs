// Builds the standalone Robis app into ./dist: a static site where the whole
// server (API, Lua game servers, database) runs inside the browser. Host it on
// any static host (GitHub Pages) and it works on a phone with no computer,
// and offline after the first visit.
//
//   ROBIS_BASE=/RoBi19 npm run build:standalone   # when served from a sub-path
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const BASE = (process.env.ROBIS_BASE || '').replace(/\/+$/, '');
// Only the sha256 of the admin code ships with the app. Override with ROBIS_ADMIN_CODE.
const ADMIN_HASH = process.env.ROBIS_ADMIN_CODE
  ? crypto.createHash('sha256').update(process.env.ROBIS_ADMIN_CODE.trim().toUpperCase()).digest('hex')
  : fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../standalone/admin-code.sha256'), 'utf8').trim();
const r = (...p) => path.join(ROOT, ...p);
// URL of the online server (render.yaml), linked from the phone version.
const ONLINE = (process.env.ROBIS_SERVER_URL || (fs.existsSync(r('standalone/server-url.txt')) ? fs.readFileSync(r('standalone/server-url.txt'), 'utf8') : '')).trim().replace(/\/+$/, '');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- copy the app
fs.cpSync(r('public'), OUT, { recursive: true });
fs.cpSync(r('shared'), path.join(OUT, 'shared'), { recursive: true });
const vendor = [
  ['node_modules/three/build/three.module.js', 'vendor/three/build/three.module.js'],
  ['node_modules/three/build/three.core.js', 'vendor/three/build/three.core.js'],
  ['node_modules/three/examples/jsm/controls/TransformControls.js', 'vendor/three/examples/jsm/controls/TransformControls.js'],
  ['node_modules/peerjs/dist/peerjs.min.js', 'vendor/peerjs/peerjs.min.js'],
  ['node_modules/codemirror/lib', 'vendor/codemirror/lib'],
  ['node_modules/codemirror/mode/lua', 'vendor/codemirror/mode/lua'],
  ['node_modules/codemirror/addon/edit', 'vendor/codemirror/addon/edit'],
  ['node_modules/codemirror/addon/selection', 'vendor/codemirror/addon/selection'],
  ['node_modules/codemirror/addon/search', 'vendor/codemirror/addon/search'],
  ['node_modules/codemirror/addon/comment', 'vendor/codemirror/addon/comment'],
];
for (const [from, to] of vendor) {
  if (!fs.existsSync(r(from))) continue;
  fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true });
  fs.cpSync(r(from), path.join(OUT, to), { recursive: true });
}

// ---------------------------------------------------------------- bundle the server
await esbuild.build({
  entryPoints: [r('server/local/backend.js')],
  outfile: path.join(OUT, 'js/local/backend.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [{
    name: 'robis-browser',
    setup(b) {
      // Swap Node-only modules for their browser versions.
      b.onResolve({ filter: /^(node:)?crypto$/ }, () => ({ path: r('server/local/crypto-shim.js') }));
      b.onResolve({ filter: /^express$/ }, () => ({ path: r('server/local/express-shim.js') }));
      b.onResolve({ filter: /\/db\.js$/ }, () => ({ path: r('server/local/db-local.js') }));
      // fengari only touches these when running under Node.
      b.onResolve({ filter: /^(fs|os|path|tmp|readline-sync|child_process)$/ }, (a) => ({ path: a.path, namespace: 'empty' }));
      b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'export default {};', loader: 'js' }));
    },
  }],
  // fengari reads this unconditionally; everything else checks typeof process.
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.FENGARICONF': 'undefined', __ROBIS_ADMIN_HASH__: JSON.stringify(ADMIN_HASH) },
});

// ---------------------------------------------------------------- boot script, base path
const boot = fs.readFileSync(r('standalone/boot.js'), 'utf8').replace(/__BASE__/g, BASE).replace('__ONLINE__', ONLINE);
fs.writeFileSync(path.join(OUT, 'js/local/boot.js'), boot);

const ROUTES = 'js|css|img|vendor|shared|api|ws|home|games|game|catalog|item|avatar|inventory|profile|friends|messages|develop|robits|admin|blog|help|studio|play|manifest\\.webmanifest|sw\\.js|404';
// Absolute app paths ('/js/..', '/game?id=..', '/?returnUrl=..') get the base prefix.
// A bare '/' is only a path after `href:`/`href =` or `? .. :` (not e.key === '/').
const rewrite = (text) => (BASE ? text
  .replace(new RegExp(`(["'\`(])/(?=(?:${ROUTES})\\b|\\?)`, 'g'), `$1${BASE}/`)
  .replace(/((?:href\s*[:=]\s*|:\s*)["'])\/(?=["'])/g, `$1${BASE}/`) : text);

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const files = walk(OUT);
for (const f of files) {
  const rel = path.relative(OUT, f).split(path.sep).join('/');
  if (rel.startsWith('vendor/') || rel === 'js/local/backend.js' || rel === 'js/local/boot.js') continue;
  if (!/\.(html|js|css|webmanifest)$/.test(f)) continue;
  let text = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.html')) {
    // Load the in-page server before anything else on every page.
    text = text.replace('<head>', `<head>\n<script src="/js/local/boot.js"></script>`);
  }
  fs.writeFileSync(f, rewrite(text));
}

// ---------------------------------------------------------------- offline cache
const list = walk(OUT).map((f) => '/' + path.relative(OUT, f).split(path.sep).join('/'));
const hash = crypto.createHash('sha1');
for (const f of walk(OUT).sort()) hash.update(fs.readFileSync(f));
const sw = fs.readFileSync(r('standalone/sw.js'), 'utf8')
  .replace('__VERSION__', hash.digest('hex').slice(0, 12))
  .replace('__BASE__', BASE)
  .replace('__FILES__', JSON.stringify(list));
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
// Short install command for a VPS console where pasting doesn't work:
//   curl -L tatogart.github.io/RoBi19/i.sh | bash
fs.copyFileSync(r('scripts/install-server.sh'), path.join(OUT, 'i.sh'));
fs.copyFileSync(r('scripts/install-server.sh'), path.join(OUT, 'robis.sh'));

const size = walk(OUT).reduce((a, f) => a + fs.statSync(f).size, 0);
console.log(`Standalone Robis built in dist/ (${list.length} files, ${(size / 1024 / 1024).toFixed(1)} MB, base "${BASE || '/'}")`);
