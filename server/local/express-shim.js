// Just enough of express.Router() to run server/api.js inside the browser.
function compile(pattern) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([A-Za-z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  return { re, keys };
}

class Router {
  constructor() { this.routes = []; this.fallback = []; }
  _add(method, path, handlers) { this.routes.push({ method, ...compile(path), handlers }); }
  get(p, ...h) { this._add('GET', p, h); }
  post(p, ...h) { this._add('POST', p, h); }
  put(p, ...h) { this._add('PUT', p, h); }
  patch(p, ...h) { this._add('PATCH', p, h); }
  delete(p, ...h) { this._add('DELETE', p, h); }
  use(...h) { this.fallback.push(...h.filter((x) => typeof x === 'function')); }

  // Runs the matching handlers; resolves once a response was sent.
  handle(req, res) {
    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(req.path);
      if (!m) continue;
      req.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return run(r.handlers, req, res);
    }
    return run(this.fallback, req, res);
  }
}

async function run(handlers, req, res) {
  for (const h of handlers) {
    let next = false;
    await h(req, res, () => { next = true; });
    if (!next) return;
  }
}

export default { Router: () => new Router() };
