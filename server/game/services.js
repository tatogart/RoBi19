// Server-side implementations of Roblox services that need the game loop:
// TweenService, Debris, DataStoreService, HttpService, BadgeService.
import crypto from 'node:crypto';
import { Vector3, Color3, CFrame, UDim2, TweenInfo, enumItem } from '../../shared/engine/types.js';
import { Instance, Signal, coerce } from '../../shared/engine/instances.js';
import { LuaObject, LuaFunction, YieldRequest } from './lua.js';

// ---------------------------------------------------------------- easing
const PI = Math.PI;
const EASE_IN = {
  Linear: (t) => t,
  Sine: (t) => 1 - Math.cos((t * PI) / 2),
  Quad: (t) => t * t,
  Cubic: (t) => t * t * t,
  Quart: (t) => t ** 4,
  Quint: (t) => t ** 5,
  Exponential: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  Circular: (t) => 1 - Math.sqrt(1 - t * t),
  Back: (t) => 2.70158 * t ** 3 - 1.70158 * t * t,
  Elastic: (t) => (t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * PI) / 3))),
  Bounce: (t) => 1 - bounceOut(1 - t),
};
function bounceOut(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
export function ease(style, dir, t) {
  const f = EASE_IN[style] || EASE_IN.Quad;
  if (dir === 'In') return f(t);
  if (dir === 'Out') return 1 - f(1 - t);
  return t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2;
}

function lerpValue(a, b, t) {
  if (typeof a === 'number') return a + (b - a) * t;
  if (a instanceof Vector3) return a.Lerp(b, t);
  if (a instanceof Color3) return a.Lerp(b, t);
  if (a instanceof CFrame) return a.Lerp(b, t);
  if (a instanceof UDim2) {
    const x = a.toArray(), y = b.toArray();
    return UDim2.fromArray(x.map((v, i) => v + (y[i] - v) * t));
  }
  return t < 1 ? a : b;
}

// ---------------------------------------------------------------- Tween
export class Tween extends LuaObject {
  constructor(svc, inst, info, goals) {
    super();
    this.svc = svc;
    this.Instance = inst;
    this.TweenInfo = info;
    this.goals = goals;
    this.PlaybackState = enumItem('PlaybackState', 'Begin');
    this.Completed = new Signal('Completed');
    this.elapsed = 0;
    this.from = null;
    this.iteration = 0;
    this.reversing = false;
  }
  get luaType() { return 'Tween'; }
  Play() {
    if (this.PlaybackState.Name !== 'Paused' || !this.from) {
      this.from = {};
      for (const k of Object.keys(this.goals)) this.from[k] = this.Instance[k];
      this.elapsed = -this.TweenInfo.DelayTime;
      this.iteration = 0;
      this.reversing = false;
    }
    this.PlaybackState = enumItem('PlaybackState', 'Playing');
    this.svc.active.add(this);
  }
  Pause() {
    if (this.PlaybackState.Name === 'Playing') this.PlaybackState = enumItem('PlaybackState', 'Paused');
    this.svc.active.delete(this);
  }
  Cancel() {
    this.svc.active.delete(this);
    this.PlaybackState = enumItem('PlaybackState', 'Cancelled');
    this.from = null;
    this.Completed.fire(this.PlaybackState);
  }
  Destroy() { this.svc.active.delete(this); }
  step(dt) {
    const inst = this.Instance;
    if (inst._destroyed) { this.svc.active.delete(this); return; }
    this.elapsed += dt;
    if (this.elapsed < 0) return;
    const info = this.TweenInfo;
    const T = Math.max(info.Time, 1e-6);
    let t = Math.min(1, this.elapsed / T);
    const a = ease(info.EasingStyle, info.EasingDirection, t);
    const k = this.reversing ? 1 - a : a;
    for (const key of Object.keys(this.goals)) {
      try { inst[key] = lerpValue(this.from[key], this.goals[key], k); } catch { /* ignore */ }
    }
    if (t >= 1) {
      if (info.Reverses && !this.reversing) { this.reversing = true; this.elapsed = 0; return; }
      this.reversing = false;
      if (info.RepeatCount < 0 || this.iteration < info.RepeatCount) {
        this.iteration++;
        this.elapsed = -info.DelayTime;
        return;
      }
      this.svc.active.delete(this);
      this.PlaybackState = enumItem('PlaybackState', 'Completed');
      this.Completed.fire(this.PlaybackState);
    }
  }
}

// ---------------------------------------------------------------- DataStore
class DataStore extends LuaObject {
  constructor(backend, name) { super(); this.backend = backend; this.Name = name; }
  get luaType() { return 'DataStore'; }
  _key(k) {
    if (k === null || k === undefined || String(k).length === 0) throw new Error('Key name can\'t be empty');
    if (String(k).length > 50) throw new Error('Key name exceeds the 50 character limit');
    return String(k);
  }
  GetAsync(key) { const v = this.backend.get(this.Name, this._key(key)); return v === undefined ? null : v; }
  SetAsync(key, value) { checkSerializable(value); this.backend.set(this.Name, this._key(key), value); }
  IncrementAsync(key, delta = 1) {
    const cur = +this.backend.get(this.Name, this._key(key)) || 0;
    const n = cur + (+delta || 0);
    this.backend.set(this.Name, key, n);
    return n;
  }
  UpdateAsync(key, fn) {
    const cur = this.GetAsync(key);
    const nv = fn instanceof LuaFunction ? fn.rt.callSync(fn, [cur]) : fn(cur);
    if (nv !== null && nv !== undefined) { checkSerializable(nv); this.backend.set(this.Name, this._key(key), nv); }
    return nv;
  }
  RemoveAsync(key) { const v = this.GetAsync(key); this.backend.set(this.Name, this._key(key), undefined); return v; }
}
function checkSerializable(v, depth = 0) {
  if (depth > 20) throw new Error('Data too deep');
  if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) return;
  if (v instanceof Instance || v instanceof LuaObject || v instanceof Vector3 || v instanceof CFrame || v instanceof Color3) {
    throw new Error('Cannot store ' + (v.ClassName || v.constructor.name) + ' in data store. Data stores can only accept valid UTF-8 characters.');
  }
  if (typeof v === 'object') for (const x of Object.values(v)) checkSerializable(x, depth + 1);
}

// ---------------------------------------------------------------- install
export function installServices(game, rt, backend) {
  const tweenSvc = game.GetService('TweenService');
  tweenSvc.active = new Set();
  tweenSvc.Create = (inst, info, goals) => {
    if (!(inst instanceof Instance)) throw new Error('TweenService:Create expects an Instance');
    if (!(info instanceof TweenInfo)) info = new TweenInfo();
    const schema = inst.constructor.schema;
    const clean = {};
    for (const [k, v] of Object.entries(goals || {})) {
      const d = schema[k];
      if (!d) throw new Error(`${k} is not a valid member of ${inst.ClassName}`);
      clean[k] = d.derived ? v : coerce(d.type, v);
    }
    return new Tween(tweenSvc, inst, info, clean);
  };
  tweenSvc.GetValue = (alpha, style, dir) => ease(style?.Name || style, dir?.Name || dir, +alpha);
  tweenSvc.step = (dt) => { for (const t of [...tweenSvc.active]) t.step(dt); };

  const debris = game.GetService('Debris');
  debris.AddItem = (inst, t = 10) => {
    if (!(inst instanceof Instance)) return;
    setTimeoutGame(() => { if (!inst._destroyed) inst.Destroy(); }, (+t || 0) * 1000);
  };
  debris.addItem = debris.AddItem;
  function setTimeoutGame(fn, ms) {
    const h = setTimeout(fn, ms);
    (game._timers || (game._timers = new Set())).add(h);
  }

  const http = game.GetService('HttpService');
  http.JSONEncode = (v) => JSON.stringify(v ?? null);
  http.JSONDecode = (s) => JSON.parse(String(s));
  http.GenerateGUID = (wrap = true) => {
    const g = crypto.randomUUID().toUpperCase();
    return wrap === false ? g : `{${g}}`;
  };
  http.UrlEncode = (s) => encodeURIComponent(String(s));
  http.GetAsync = () => { throw new Error('Http requests are not enabled. Enable via game settings'); };
  http.PostAsync = http.GetAsync;

  const ds = game.GetService('DataStoreService');
  const stores = new Map();
  ds.GetDataStore = (name = 'global', scope = 'global') => {
    const key = `${name}/${scope}`;
    if (!stores.has(key)) stores.set(key, new DataStore(backend.dataStore, key));
    return stores.get(key);
  };
  ds.GetGlobalDataStore = () => ds.GetDataStore('global');
  ds.GetOrderedDataStore = ds.GetDataStore;

  const badges = game.GetService('BadgeService');
  badges.AwardBadge = (userId, name) => backend.awardBadge(+userId, String(name));
  badges.UserHasBadgeAsync = (userId, name) => backend.hasBadge(+userId, String(name));
  badges.UserHasBadge = badges.UserHasBadgeAsync;

  const market = game.GetService('MarketplaceService');
  market.UserOwnsGamePassAsync = () => false;
  market.PlayerOwnsAsset = () => false;
  market.PromptPurchase = () => {};

  const chat = game.GetService('Chat');
  chat.Chat = (part, msg) => backend.bubble && backend.bubble(part, String(msg));
  return { tweenSvc };
}

export { YieldRequest };
