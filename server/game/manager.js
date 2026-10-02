// Keeps track of running game servers and routes players to them.
import { GameServer } from './GameServer.js';

export class GameManager {
  constructor(db) {
    this.db = db;
    this.servers = new Map();
    this.resolveAvatar = () => ({ bodyColors: {}, items: [] });
  }

  allServers() { return [...this.servers.values()].filter((s) => !s.closed); }
  // Public servers only; private ones are reached through their own id.
  // (every place of the game; reserved group servers aren't listed either)
  serversFor(gameId) { return this.allServers().filter((s) => !s.isTest && !s.privateId && !s.reserved && s.gameId === gameId); }

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
      // Game passes (set up by the API: see manager.passes in server/api.js).
      passes: this.passes ? {
        owns: (userId, passId) => this.passes.owns(userId, passId),
        info: (passId, userId) => this.passes.info(passId, userId),
        buy: (userId, passId) => this.passes.buy(userId, passId),
        perks: (userId) => this.passes.perks(userId, gameId),
        list: (userId) => this.passes.forGame(gameId, userId),
      } : null,
      // The Hunt (set up by server/hunt.js).
      hunt: this.hunt ? {
        eligible: (userId) => this.hunt.eligible(userId),
        inEvent: () => this.hunt.inEvent(gameId),
        collect: (userId) => this.hunt.collect(userId, gameId),
        progress: (userId) => this.hunt.progress(userId),
        // the hub's own little quests (star fragments) and the shared rift counter
        fragment: (userId, n) => this.hunt.fragment(userId, n, gameId),
        global: () => this.hunt.global(),
        kind: () => this.hunt.kind(),
        quest: () => this.hunt.quest(gameId),
        hubQuest: (userId) => this.hunt.hubQuest(userId, gameId),
        isHub: () => this.hunt.isHub(gameId),
      } : null,
    };
  }

  _create(opts) {
    const server = new GameServer({ ...opts, manager: this, onClose: (s) => this.servers.delete(s.id) });
    this.servers.set(server.id, server);
    return server;
  }

  // place: a sub-place id of the game (0 = its start place).
  serverForGame(gameId, serverId, place = 0) {
    const game = this.db.data.games[gameId];
    if (!game) throw new Error('Game not found');
    const placeId = place || 0;
    if (serverId) {
      const s = this.servers.get(serverId);
      if (s && !s.closed && s.gameId === gameId && (s.subPlace || 0) === placeId && !s.isFull) return s;
    }
    const open = this.serversFor(gameId).filter((s) => (s.subPlace || 0) === placeId && !s.isFull).sort((a, b) => b.playerCount - a.playerCount);
    if (open.length) return open[0];
    return this._newPlaceServer(game, placeId);
  }

  _newPlaceServer(game, placeId, opts = {}) {
    const place = this.db.readPlace(placeId || game.id);
    if (!place) throw new Error('Place file missing');
    return this._create({
      gameId: game.id, name: game.name, creatorId: game.creatorId, maxPlayers: game.maxPlayers, place,
      subPlace: placeId, placeName: placeId ? (this.places ? this.places.name(placeId) : '') : '',
      backend: this.backendFor(game.id), ...opts,
    });
  }

  // A fresh server only for a group (TeleportPartyAsync): returns its id.
  reserve(gameId, placeId = 0) {
    const game = this.db.data.games[gameId];
    if (!game) throw new Error('Game not found');
    return this._newPlaceServer(game, placeId, { reserved: true }).id;
  }

  // A private server: one running instance per private server id.
  serverForPrivate(gameId, privateId) {
    const game = this.db.data.games[gameId];
    if (!game) throw new Error('Game not found');
    const running = this.allServers().find((s) => s.privateId === privateId && !s.isFull);
    if (running) return running;
    if (this.allServers().some((s) => s.privateId === privateId)) throw new Error('This private server is full.');
    const place = this.db.readPlace(gameId);
    if (!place) throw new Error('Place file missing');
    const ps = this.db.data.privateServers?.[privateId];
    return this._create({
      gameId, name: game.name, creatorId: game.creatorId, maxPlayers: game.maxPlayers, place, privateId,
      privateName: ps ? ps.name : 'Private server', privateOwnerId: ps ? ps.ownerId : 0,
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
