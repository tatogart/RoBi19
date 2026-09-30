// Keeps track of running game servers and routes players to them.
import { GameServer } from './GameServer.js';

export class GameManager {
  constructor(db) {
    this.db = db;
    this.servers = new Map();
    this.resolveAvatar = () => ({ bodyColors: {}, items: [] });
  }

  allServers() { return [...this.servers.values()].filter((s) => !s.closed); }
  serversFor(gameId) { return this.allServers().filter((s) => !s.isTest && s.gameId === gameId); }

  findUser(userId) {
    for (const server of this.allServers()) {
      const session = server.sessions.get(userId);
      if (session) return { server, session };
    }
    return null;
  }

  backendFor(gameId) {
    const D = this.db.data;
    const db = this.db;
    return {
      dataStore: {
        get: (store, key) => D.datastores[gameId]?.[store]?.[key],
        set: (store, key, v) => {
          const g = D.datastores[gameId] || (D.datastores[gameId] = {});
          const s = g[store] || (g[store] = {});
          if (v === undefined) delete s[key]; else s[key] = JSON.parse(JSON.stringify(v));
          db.save();
        },
      },
      awardBadge: (userId, name) => {
        if (!D.users[userId]) return false;
        const list = D.badges[userId] || (D.badges[userId] = []);
        if (list.some((b) => b.gameId === gameId && b.name === name)) return false;
        list.push({ gameId, name, awarded: Date.now(), gameName: D.games[gameId]?.name || 'Game' });
        db.save();
        return true;
      },
      hasBadge: (userId, name) => (D.badges[userId] || []).some((b) => b.gameId === gameId && b.name === name),
    };
  }

  _create(opts) {
    const server = new GameServer({ ...opts, manager: this, onClose: (s) => this.servers.delete(s.id) });
    this.servers.set(server.id, server);
    return server;
  }

  serverForGame(gameId, serverId) {
    const game = this.db.data.games[gameId];
    if (!game) throw new Error('Game not found');
    if (serverId) {
      const s = this.servers.get(serverId);
      if (s && !s.closed && s.gameId === gameId && !s.isFull) return s;
    }
    const open = this.serversFor(gameId).filter((s) => !s.isFull).sort((a, b) => b.playerCount - a.playerCount);
    if (open.length) return open[0];
    const place = this.db.readPlace(gameId);
    if (!place) throw new Error('Place file missing');
    return this._create({
      gameId, name: game.name, creatorId: game.creatorId, maxPlayers: game.maxPlayers, place,
      backend: this.backendFor(gameId),
    });
  }

  createTestServer(place, user, gameId = 0) {
    const game = this.db.data.games[gameId];
    return this._create({
      gameId, name: game ? game.name : 'Studio Test', creatorId: user.id, maxPlayers: 1, place, test: true,
      backend: gameId && game && (game.creatorId === user.id || user.isAdmin) ? this.backendFor(gameId) : undefined,
    });
  }

  shutdown() { for (const s of this.allServers()) s.close(); }
}
