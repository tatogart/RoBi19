// Robis standalone boot: makes the site work with no server by answering
// /api requests and the /ws game socket from a backend that runs in this page.
(function () {
  var BASE = '__BASE__';
  var TOKEN = 'robis.session';
  window.ROBIS_STANDALONE = true;
  window.ROBIS_BASE = BASE;
  // Shared online server (everyone in one world), if the owner has one.
  window.ROBIS_ONLINE_URL = '__ONLINE__';
  // With a server, this app is just the way in: go to the same page there.
  // (?offline=1 keeps the old on-device world, e.g. with no internet.)
  var offline = /[?&]offline=1/.test(location.search);
  try { if (offline) sessionStorage.setItem('robis.offline', '1'); offline = offline || sessionStorage.getItem('robis.offline') === '1'; } catch (e) { /* private mode */ }
  if (window.ROBIS_ONLINE_URL && !offline && navigator.onLine !== false) {
    var rest = location.pathname.slice(BASE.length) || '/';
    document.documentElement.style.display = 'none';
    location.replace(window.ROBIS_ONLINE_URL + rest + location.search + location.hash);
    return;
  }
  var backend = null;
  function load() { return backend || (backend = import(BASE + '/js/local/backend.js')); }
  window.robisBackend = load;
  function token() { try { return localStorage.getItem(TOKEN); } catch (e) { return null; } }
  function setToken(t) {
    try { if (t) localStorage.setItem(TOKEN, t); else localStorage.removeItem(TOKEN); } catch (e) { /* ignore */ }
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    var url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || url.pathname.indexOf(BASE + '/api/') !== 0) return realFetch(input, init);
    return load().then(function (b) {
      var body;
      try { body = init.body ? JSON.parse(init.body) : undefined; } catch (e) { body = undefined; }
      var query = {};
      url.searchParams.forEach(function (v, k) { query[k] = v; });
      return b.handle({
        method: (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase(),
        path: url.pathname.slice((BASE + '/api').length), query: query, body: body, token: token(),
      });
    }).then(function (r) {
      if (r.token !== undefined) setToken(r.token);
      return new Response(r.body, { status: r.status, headers: r.headers });
    });
  };

  // In-page stand-in for WebSocket('/ws').
  function LocalSocket() {
    var self = this;
    this.readyState = 0;
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    this._deliver = function (data) { if (self.readyState === 1 && self.onmessage) self.onmessage({ data: data }); };
    this._closed = function () {
      if (self.readyState === 3) return;
      self.readyState = 3;
      if (self.onclose) self.onclose({ code: 1000 });
    };
    load().then(function (b) { return b.connect(token(), self); }).then(function () {
      self.readyState = 1;
      if (self.onopen) self.onopen({});
    }, function (e) { console.error(e); self._closed(); });
  }
  LocalSocket.prototype.send = function (data) { if (this.readyState === 1) this._toServer(String(data)); };
  LocalSocket.prototype.close = function () {
    if (this.readyState > 1) return;
    if (this._server) this._server.close(); else this._closed();
  };
  LocalSocket.prototype.addEventListener = function (ev, fn) { this['on' + ev] = fn; };

  var RealWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    // A friend's room (see js/game/rooms.js) or this device's own server.
    if (/\/ws$/.test(String(url)) && window.ROBIS_ROOM_SOCKET) return window.ROBIS_ROOM_SOCKET();
    if (/\/ws$/.test(String(url))) return new LocalSocket();
    return new RealWS(url, protocols);
  };
  window.WebSocket.OPEN = 1;

  // Offline support: cache the whole app on the device.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', function () { navigator.serviceWorker.register(BASE + '/sw.js', { updateViaCache: 'none' }).catch(function () {}); });
  }
})();
