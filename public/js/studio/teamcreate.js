// Team Create: everyone editing the same place sees each other's changes live.
// Local commits are sent as place-diff ops; ops from others are applied here.
import { applyOps } from '/shared/engine/placediff.js';
import { savePlace } from '/shared/engine/serialize.js';
import { discordSession } from '../discord.js';
// inside Discord (no cookies) the game socket carries the session
const wsSession = () => { const t = discordSession.get(); return t ? `?rs=${t}` : ''; };

export class TeamCreate {
  constructor(studio, gameId, place = 0) {
    this.place = place;
    this.studio = studio;
    this.gameId = gameId;
    this.users = [];
    this.closed = false;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws${wsSession()}`);
    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'tc.join', gameId: this.gameId, place: this.place || undefined }));
    this.ws.onmessage = (e) => { try { this.handle(JSON.parse(e.data)); } catch (err) { console.warn(err); } };
    this.ws.onclose = () => {
      if (this.closed) return;
      // Reconnect after a short pause (server restart, network blip).
      setTimeout(() => { if (!this.closed) this.connect(); }, 3000);
    };
  }

  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  sendOps(ops) { if (ops && ops.length) this.send({ t: 'tc.ops', ops }); }

  chat(text) { this.send({ t: 'tc.chat', text }); }

  handle(m) {
    const s = this.studio;
    switch (m.t) {
      case 'tc.welcome':
      case 'tc.presence': {
        this.users = m.users;
        s.emit('team');
        break;
      }
      case 'tc.need': {
        // A teammate just opened the place: give them our current version.
        s.editor.flush();
        this.send({ t: 'tc.snapshot', for: m.for, place: savePlace(s.game, { name: s.gameInfo?.name || 'Place' }) });
        break;
      }
      case 'tc.snapshot': {
        // Newer than the published copy: switch to it, keeping our Team Create session.
        const info = s.gameInfo;
        s.loadPlaceData(m.place, info, { keepTeam: true });
        s.log('info', `Team Create: loaded the latest version from ${m.from}.`);
        break;
      }
      case 'tc.ops': {
        s.editor.flush();
        s.suspendEvents = true;
        applyOps(s.game, m.ops);
        s.suspendEvents = false;
        s.history.accept();
        s.setSelection(s.selection.filter((i) => !i._destroyed && i.getRoot && i.getRoot() === s.game));
        s.emit('tree');
        s.editor.refreshOpen?.();
        s.dirty = true;
        s.updateTitle();
        s.status(`${m.from} made a change`);
        break;
      }
      case 'tc.chat':
        s.log('info', `[Team] ${m.from}: ${m.text}`);
        break;
      case 'tc.error':
        s.log('warn', 'Team Create: ' + m.msg);
        this.close();
        break;
      default:
    }
  }

  close() {
    this.closed = true;
    try { this.send({ t: 'tc.leave' }); this.ws.close(); } catch { /* ignore */ }
    this.users = [];
    this.studio.emit('team');
  }
}
