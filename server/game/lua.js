// Lua 5.3 (fengari) runtime with a Roblox-style API.
// Every Script runs in its own coroutine; wait()/:Wait()/WaitForChild yield
// the coroutine and the scheduler resumes it later from the server tick.
import fengari from 'fengari';
import {
  Vector3, Color3, CFrame, BrickColor, EnumItem, ENUMS, UDim2, TweenInfo, enumItem,
} from '../../shared/engine/types.js';
import {
  Instance, Signal, Connection, CLASSES, createInstance, BaseScript, ModuleScript,
} from '../../shared/engine/instances.js';

const { lua, lauxlib, lualib, to_luastring: S } = fengari;
const REG = lua.LUA_REGISTRYINDEX;
const SCRIPT_TIMEOUT_MS = 10000;

// Internal JS members that must never be reachable from Lua.
const HIDDEN = new Set(['constructor', 'setParent', 'getRoot', 'getSignal', 'hasEvent', 'on', 'getById',
  'fire', 'once', 'disconnectAll', 'handlers', 'waiters', 'signal', 'fn', 'toArray', 'equals', 'id']);

const VALUE_TYPES = [
  [Vector3, 'Vector3'], [Color3, 'Color3'], [CFrame, 'CFrame'], [BrickColor, 'BrickColor'],
  [EnumItem, 'EnumItem'], [UDim2, 'UDim2'], [TweenInfo, 'TweenInfo'], [Signal, 'RBXScriptSignal'],
  [Connection, 'RBXScriptConnection'],
];

class LuaFunction {
  constructor(rt, ref) { this.rt = rt; this.ref = ref; }
}

// Opaque JS objects exposed to Lua (Tween, DataStore, ...). Subclass and set luaType.
export class LuaObject {
  get luaType() { return 'Object'; }
}

export class LuaRuntime {
  constructor(game, host = {}) {
    this.game = game;
    this.host = host;
    this.now = host.now || (() => performance.now() / 1000);
    this.startTime = this.now();
    this.waiting = []; // {co, resumeAt, args?}
    this.scriptState = new Map(); // script -> {threads:Set, conns:Set}
    this.moduleCache = new Map();
    this.current = null; // current script context
    this.sliceStart = 0;
    this.L = lauxlib.luaL_newstate();
    this._setupLibs();
    this._setupTypes();
    this._setupGlobals();
    this._runPrelude();
  }

  // ------------------------------------------------------------ output
  out(level, msg) {
    if (this.host.output) this.host.output(level, msg, this.current);
    else console.log(`[${level}] ${msg}`);
  }

  // ------------------------------------------------------------ setup
  _setupLibs() {
    const L = this.L;
    lualib.luaL_openlibs(L);
    // Sandbox: remove anything that touches the host.
    for (const g of ['io', 'package', 'dofile', 'loadfile', 'require', 'collectgarbage']) {
      lua.lua_pushnil(L);
      lua.lua_setglobal(L, S(g));
    }
    lua.lua_getglobal(L, S('os'));
    for (const f of ['execute', 'exit', 'remove', 'rename', 'getenv', 'tmpname', 'setlocale']) {
      lua.lua_pushnil(L);
      lua.lua_setfield(L, -2, S(f));
    }
    lua.lua_pop(L, 1);
    lua.lua_getglobal(L, S('debug'));
    lua.lua_getfield(L, -1, S('traceback'));
    lua.lua_newtable(L);
    lua.lua_insert(L, -2);
    lua.lua_setfield(L, -2, S('traceback'));
    lua.lua_setglobal(L, S('debug'));
    lua.lua_pop(L, 1);
    // Script timeout guard (inherited by every coroutine).
    lua.lua_sethook(L, (L2) => {
      if (this.sliceStart && Date.now() - this.sliceStart > SCRIPT_TIMEOUT_MS) {
        this.sliceStart = Date.now();
        lauxlib.luaL_error(L2, S('Script timeout: exhausted allowed execution time'));
      }
    }, lua.LUA_MASKCOUNT, 20000);
    // Weak instance cache: id -> userdata
    lua.lua_newtable(L);
    lua.lua_newtable(L);
    lua.lua_pushstring(L, S('v'));
    lua.lua_setfield(L, -2, S('__mode'));
    lua.lua_setmetatable(L, -2);
    this.instCacheRef = lauxlib.luaL_ref(L, REG);
  }

  _setupTypes() {
    const L = this.L;
    // Instance metatable
    lauxlib.luaL_newmetatable(L, S('Instance'));
    this._setfn(L, '__index', (L) => this._instIndex(L));
    this._setfn(L, '__newindex', (L) => this._instNewIndex(L));
    this._setfn(L, '__tostring', (L) => { lua.lua_pushstring(L, S(this._ref(L, 1).Name)); return 1; });
    this._setfn(L, '__eq', (L) => { lua.lua_pushboolean(L, this._ref(L, 1) === this._ref(L, 2)); return 1; });
    lua.lua_pushstring(L, S('The metatable is locked'));
    lua.lua_setfield(L, -2, S('__metatable'));
    lua.lua_pop(L, 1);
    // Generic value metatable (Vector3, CFrame, Signal, Tween, ...)
    lauxlib.luaL_newmetatable(L, S('RobisValue'));
    this._setfn(L, '__index', (L) => this._valIndex(L));
    this._setfn(L, '__newindex', (L) => this._valNewIndex(L));
    this._setfn(L, '__tostring', (L) => { lua.lua_pushstring(L, S(String(this._ref(L, 1)))); return 1; });
    this._setfn(L, '__eq', (L) => {
      const a = this._ref(L, 1), b = this._ref(L, 2);
      lua.lua_pushboolean(L, a === b || !!(a && a.equals && a.equals(b)));
      return 1;
    });
    for (const op of ['add', 'sub', 'mul', 'div']) this._setfn(L, '__' + op, (L) => this._arith(L, op));
    this._setfn(L, '__unm', (L) => {
      const a = this._ref(L, 1);
      if (!(a instanceof Vector3)) return this._raise(L, 'attempt to perform arithmetic on a ' + this._typeof(a) + ' value');
      this.push(L, a.neg());
      return 1;
    });
    lua.lua_pushstring(L, S('The metatable is locked'));
    lua.lua_setfield(L, -2, S('__metatable'));
    lua.lua_pop(L, 1);
  }

  _setfn(L, name, fn) {
    lua.lua_pushcfunction(L, fn);
    lua.lua_setfield(L, -2, S(name));
  }

  _setGlobalFn(name, fn) {
    lua.lua_pushcfunction(this.L, fn);
    lua.lua_setglobal(this.L, S(name));
  }

  // Creates a global table with JS functions, e.g. Vector3 = {new = ...}
  _setGlobalLib(name, fns, values = {}) {
    const L = this.L;
    lua.lua_newtable(L);
    for (const [k, f] of Object.entries(fns)) {
      lua.lua_pushcfunction(L, (L) => this._wrapCall(L, () => f(...this.args(L, 1))));
      lua.lua_setfield(L, -2, S(k));
    }
    for (const [k, v] of Object.entries(values)) {
      this.push(L, v);
      lua.lua_setfield(L, -2, S(k));
    }
    lua.lua_setglobal(L, S(name));
  }

  _setupGlobals() {
    const L = this.L;
    const game = this.game;
    this.push(L, game); lua.lua_setglobal(L, S('game'));
    this.push(L, game); lua.lua_setglobal(L, S('Game'));
    this.push(L, game.Workspace); lua.lua_setglobal(L, S('workspace'));
    this.push(L, game.Workspace); lua.lua_setglobal(L, S('Workspace'));

    this._setGlobalFn('print', (L) => { this.out('print', this._joinArgs(L)); return 0; });
    this._setGlobalFn('warn', (L) => { this.out('warn', this._joinArgs(L)); return 0; });
    this._setGlobalFn('wait', (L) => {
      const t = Math.max(1 / 30, +lua.lua_tonumber(L, 1) || 0);
      return this._yieldFor(L, t);
    });
    this._setGlobalFn('tick', (L) => { lua.lua_pushnumber(L, Date.now() / 1000); return 1; });
    this._setGlobalFn('time', (L) => { lua.lua_pushnumber(L, this.now() - this.startTime); return 1; });
    this._setGlobalFn('elapsedTime', (L) => { lua.lua_pushnumber(L, this.now() - this.startTime); return 1; });
    this._setGlobalFn('spawn', (L) => {
      lauxlib.luaL_checktype(L, 1, lua.LUA_TFUNCTION);
      const fn = this.toFunction(L, 1);
      this.schedule(fn, 0, []);
      return 0;
    });
    this._setGlobalFn('delay', (L) => {
      const t = +lua.lua_tonumber(L, 1) || 0;
      lauxlib.luaL_checktype(L, 2, lua.LUA_TFUNCTION);
      this.schedule(this.toFunction(L, 2), t, []);
      return 0;
    });
    this._setGlobalFn('typeof', (L) => { lua.lua_pushstring(L, S(this._typeofAt(L, 1))); return 1; });
    this._setGlobalFn('require', (L) => this._require(L));

    this._setGlobalLib('Instance', {
      new: (cls, parent) => {
        if (typeof cls !== 'string') throw new Error('Instance.new expects a class name');
        return createInstance(cls, parent || null);
      },
    });
    this._setGlobalLib('Vector3', {
      new: (x, y, z) => new Vector3(x, y, z),
      FromNormalId: () => new Vector3(0, 1, 0),
    }, { zero: new Vector3(0, 0, 0), one: new Vector3(1, 1, 1), xAxis: new Vector3(1, 0, 0), yAxis: new Vector3(0, 1, 0), zAxis: new Vector3(0, 0, 1) });
    this._setGlobalLib('Color3', {
      new: (r, g, b) => new Color3(r, g, b),
      fromRGB: (r, g, b) => Color3.fromRGB(r || 0, g || 0, b || 0),
      fromHSV: (h, s, v) => Color3.fromHSV(h, s, v),
      fromHex: (h) => Color3.fromHex(h),
    });
    this._setGlobalLib('BrickColor', {
      new: (a, b, c) => BrickColor.new(a, b, c),
      random: () => BrickColor.random(),
      Red: () => BrickColor.Red(), Blue: () => BrickColor.Blue(), Green: () => BrickColor.Green(),
      Yellow: () => BrickColor.Yellow(), White: () => BrickColor.White(), Black: () => BrickColor.Black(),
      Gray: () => BrickColor.Gray(), palette: (i) => BrickColor.new(i),
    });
    this._setGlobalLib('CFrame', {
      new: (a, b, c, ...rest) => {
        if (a === undefined || a === null) return new CFrame();
        if (a instanceof Vector3 && b instanceof Vector3) return CFrame.lookAt(a, b);
        if (a instanceof Vector3) return CFrame.fromPosition(a);
        if (rest.length >= 9) return new CFrame(a, b, c, rest.slice(0, 9));
        return new CFrame(a, b, c);
      },
      Angles: (x, y, z) => CFrame.Angles(x, y, z),
      fromEulerAnglesXYZ: (x, y, z) => CFrame.Angles(x, y, z),
      fromOrientation: (x, y, z) => CFrame.fromOrientation(x * 180 / Math.PI, y * 180 / Math.PI, z * 180 / Math.PI),
      fromAxisAngle: (axis, a) => CFrame.fromAxisAngle(axis, a),
      lookAt: (a, b) => CFrame.lookAt(a, b),
    });
    this._setGlobalLib('UDim2', { new: (a, b, c, d) => new UDim2(a, b, c, d) });
    this._setGlobalLib('TweenInfo', {
      new: (t, style, dir, rep, rev, delay) => new TweenInfo(t ?? 1, style ?? 'Quad', dir ?? 'Out', rep ?? 0, rev ?? false, delay ?? 0),
    });
    // Enum.Material.Neon etc.
    lua.lua_newtable(L);
    for (const [type, names] of Object.entries(ENUMS)) {
      lua.lua_newtable(L);
      for (const n of names) {
        this.push(L, enumItem(type, n));
        lua.lua_setfield(L, -2, S(n));
      }
      lua.lua_pushcfunction(L, (L) => { this.push(L, names.map((n) => enumItem(type, n))); return 1; });
      lua.lua_setfield(L, -2, S('GetEnumItems'));
      lua.lua_setfield(L, -2, S(type));
    }
    lua.lua_setglobal(L, S('Enum'));
    lua.lua_newtable(L); lua.lua_setglobal(L, S('shared'));
  }

  _runPrelude() {
    const prelude = `
      unpack = table.unpack
      loadstring = function(src, name) return load(src, name, "t") end
      local _load = load
      load = function(src, name, mode, env) return _load(src, name, "t", env) end
      table.getn = function(t) return #t end
      table.foreach = function(t, f) for k, v in pairs(t) do f(k, v) end end
      math.pow = function(a, b) return a ^ b end
      math.mod = math.fmod
      math.clamp = function(x, a, b) if x < a then return a elseif x > b then return b end return x end
      math.sign = function(x) if x > 0 then return 1 elseif x < 0 then return -1 end return 0 end
      math.round = function(x) return math.floor(x + 0.5) end
      string.split = function(s, sep)
        sep = sep or ","
        local out, i = {}, 1
        if sep == "" then for c in s:gmatch(".") do out[#out + 1] = c end return out end
        while true do
          local a, b = string.find(s, sep, i, true)
          if not a then out[#out + 1] = s:sub(i) break end
          out[#out + 1] = s:sub(i, a - 1)
          i = b + 1
        end
        return out
      end
      local _tostring = tostring
      tostring = function(v)
        if math.type(v) == "float" and v == math.floor(v) and v > -1e15 and v < 1e15 then
          return string.format("%d", v)
        end
        return _tostring(v)
      end
      Random = {}
      Random.__index = Random
      function Random.new(seed)
        local self = setmetatable({}, Random)
        self._s = math.floor(seed or (os.time() + math.random(1, 100000))) % 2147483647
        if self._s <= 0 then self._s = self._s + 2147483646 end
        return self
      end
      function Random:_next() self._s = (self._s * 16807) % 2147483647 return self._s / 2147483647 end
      function Random:NextNumber(a, b) a = a or 0 b = b or 1 return a + (b - a) * self:_next() end
      function Random:NextInteger(a, b) return math.floor(a + (b - a + 1) * self:_next()) end
      _G = _G
    `;
    const L = this.L;
    if (lauxlib.luaL_loadbuffer(L, S(prelude), null, S('=prelude')) !== lua.LUA_OK || lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK) {
      throw new Error('Lua prelude failed: ' + lua.lua_tojsstring(L, -1));
    }
  }

  // ------------------------------------------------------------ value bridge
  _ref(L, idx) {
    const ud = lua.lua_touserdata(L, idx);
    return ud && typeof ud === 'object' && 'ref' in ud ? ud.ref : undefined;
  }

  push(L, v) {
    if (v === undefined || v === null) { lua.lua_pushnil(L); return; }
    switch (typeof v) {
      case 'boolean': lua.lua_pushboolean(L, v); return;
      case 'number':
        if (Number.isInteger(v) && Math.abs(v) < 2 ** 53) lua.lua_pushinteger(L, v);
        else lua.lua_pushnumber(L, v);
        return;
      case 'string': lua.lua_pushstring(L, S(v)); return;
      case 'function':
        lua.lua_pushcfunction(L, (L) => this._wrapCall(L, () => v(...this.args(L, 1))));
        return;
      default:
    }
    if (v instanceof Instance) { this._pushInstance(L, v); return; }
    if (v instanceof LuaFunction) { lua.lua_rawgeti(L, REG, v.ref); return; }
    if (Array.isArray(v)) {
      lua.lua_createtable(L, v.length, 0);
      v.forEach((x, i) => { this.push(L, x); lua.lua_rawseti(L, -2, i + 1); });
      return;
    }
    const isValue = v instanceof LuaObject || VALUE_TYPES.some(([C]) => v instanceof C);
    if (isValue) {
      const ud = lua.lua_newuserdata(L, 0);
      ud.ref = v;
      lauxlib.luaL_setmetatable(L, S('RobisValue'));
      return;
    }
    // Plain object -> table
    lua.lua_newtable(L);
    for (const [k, x] of Object.entries(v)) {
      this.push(L, x);
      lua.lua_setfield(L, -2, S(k));
    }
  }

  _pushInstance(L, inst) {
    lua.lua_rawgeti(L, REG, this.instCacheRef);
    lua.lua_getfield(L, -1, S(inst.id));
    if (lua.lua_type(L, -1) === lua.LUA_TUSERDATA) {
      lua.lua_remove(L, -2);
      return;
    }
    lua.lua_pop(L, 1);
    const ud = lua.lua_newuserdata(L, 0);
    ud.ref = inst;
    lauxlib.luaL_setmetatable(L, S('Instance'));
    lua.lua_pushvalue(L, -1);
    lua.lua_setfield(L, -3, S(inst.id));
    lua.lua_remove(L, -2);
  }

  get(L, idx, depth = 0) {
    switch (lua.lua_type(L, idx)) {
      case lua.LUA_TNIL: case lua.LUA_TNONE: return null;
      case lua.LUA_TBOOLEAN: return lua.lua_toboolean(L, idx);
      case lua.LUA_TNUMBER: return lua.lua_tonumber(L, idx);
      case lua.LUA_TSTRING: return lua.lua_tojsstring(L, idx);
      case lua.LUA_TUSERDATA: return this._ref(L, idx) ?? null;
      case lua.LUA_TFUNCTION: return this.toFunction(L, idx);
      case lua.LUA_TTABLE: return depth > 20 ? null : this._tableToJS(L, idx, depth);
      default: return null;
    }
  }

  _tableToJS(L, idx, depth) {
    idx = lua.lua_absindex(L, idx);
    const n = lua.lua_rawlen(L, idx);
    const obj = {};
    let count = 0;
    lua.lua_pushnil(L);
    while (lua.lua_next(L, idx) !== 0) {
      const kt = lua.lua_type(L, -2);
      let key;
      if (kt === lua.LUA_TSTRING) key = lua.lua_tojsstring(L, -2);
      else if (kt === lua.LUA_TNUMBER) key = lua.lua_tonumber(L, -2);
      if (key !== undefined) { obj[key] = this.get(L, -1, depth + 1); count++; }
      lua.lua_pop(L, 1);
    }
    if (n > 0 && count === n) {
      const arr = [];
      for (let i = 1; i <= n; i++) arr.push(obj[i]);
      return arr;
    }
    return obj;
  }

  args(L, from) {
    const top = lua.lua_gettop(L);
    const out = [];
    for (let i = from; i <= top; i++) out.push(this.get(L, i));
    return out;
  }

  toFunction(L, idx) {
    lua.lua_pushvalue(L, idx);
    return new LuaFunction(this, lauxlib.luaL_ref(L, REG));
  }

  _typeof(v) {
    if (v instanceof Instance) return 'Instance';
    if (v instanceof LuaObject) return v.luaType;
    for (const [C, n] of VALUE_TYPES) if (v instanceof C) return n;
    return typeof v;
  }

  _typeofAt(L, idx) {
    if (lua.lua_type(L, idx) === lua.LUA_TUSERDATA) {
      const v = this._ref(L, idx);
      if (v !== undefined) return this._typeof(v);
    }
    return luaTypeName(lua.lua_type(L, idx));
  }

  _raise(L, msg) {
    lua.lua_pushstring(L, S(String(msg)));
    return lua.lua_error(L);
  }

  // Calls fn and pushes its result. JS exceptions become Lua errors.
  _wrapCall(L, fn) {
    let r, err = null;
    try { r = fn(); } catch (e) { err = e; }
    if (err) return this._raise(L, this._where(L) + (err && err.message ? err.message : String(err)));
    if (r instanceof YieldRequest) return this._yieldRequest(L, r);
    if (r instanceof MultiReturn) { for (const v of r.values) this.push(L, v); return r.values.length; }
    if (r === undefined) return 0;
    this.push(L, r);
    return 1;
  }

  _where(L) {
    lauxlib.luaL_where(L, 1);
    const w = lua.lua_tojsstring(L, -1);
    lua.lua_pop(L, 1);
    return w;
  }

  _joinArgs(L) {
    const n = lua.lua_gettop(L);
    const parts = [];
    for (let i = 1; i <= n; i++) {
      if (lua.lua_type(L, i) === lua.LUA_TNUMBER) {
        const v = lua.lua_tonumber(L, i);
        parts.push(Number.isInteger(v) ? String(v) : String(Math.round(v * 1e10) / 1e10));
      } else {
        lauxlib.luaL_tolstring(L, i);
        parts.push(lua.lua_tojsstring(L, -1));
        lua.lua_pop(L, 1);
      }
    }
    return parts.join(' ');
  }

  // ------------------------------------------------------------ Instance metamethods
  _instIndex(L) {
    const inst = this._ref(L, 1);
    if (lua.lua_type(L, 2) !== lua.LUA_TSTRING) return this._raise(L, 'Invalid index for Instance');
    const key = lua.lua_tojsstring(L, 2);
    const C = inst.constructor;
    const d = C.schema[key];
    if (d || key === 'ClassName' || key === 'Parent' || key === 'Archivable') {
      let v = inst[key];
      if (d && d.type && d.type.startsWith('enum:') && typeof v === 'string') v = enumItem(d.type.slice(5), v);
      this.push(L, v);
      return 1;
    }
    if (C.events.includes(key)) { this.push(L, inst.getSignal(key)); return 1; }
    if (key === 'WaitForChild' || key === 'waitForChild') {
      lua.lua_pushcfunction(L, (L) => this._waitForChild(L));
      return 1;
    }
    if (!HIDDEN.has(key) && key[0] !== '_') {
      const v = inst[key];
      if (typeof v === 'function') { this._pushMethod(L, key); return 1; }
      if (v !== undefined && /^[A-Z]/.test(key)) {
        this.push(L, v);
        return 1;
      }
    }
    const child = inst.FindFirstChild(key);
    if (child) { this.push(L, child); return 1; }
    return this._raise(L, `${key} is not a valid member of ${inst.ClassName === 'DataModel' ? 'DataModel' : inst.ClassName}`);
  }

  _pushMethod(L, key) {
    lua.lua_pushcfunction(L, (L) => {
      const self = this._ref(L, 1);
      if (!(self instanceof Instance)) return this._raise(L, `Expected ':' not '.' calling member function ${key}`);
      const args = this.args(L, 2);
      return this._wrapCall(L, () => {
        const r = self[key](...args);
        return r;
      });
    });
  }

  _instNewIndex(L) {
    const inst = this._ref(L, 1);
    const key = lua.lua_tojsstring(L, 2);
    const d = inst.constructor.schema[key];
    const value = this.get(L, 3);
    if (key === 'Parent' || key === 'Archivable' || (d && !d.readonly)) {
      let err = null;
      try {
        if (key === 'Parent' && inst.ClassName === 'Player') throw new Error('Cannot change the Parent of a Player');
        inst[key] = value;
      } catch (e) { err = e; }
      if (err) return this._raise(L, this._where(L) + err.message);
      return 0;
    }
    if (d && d.readonly) return this._raise(L, `${this._where(L)}Unable to assign property ${key}. Property is read only`);
    return this._raise(L, `${this._where(L)}${key} is not a valid member of ${inst.ClassName}`);
  }

  // ------------------------------------------------------------ value metamethods
  _valIndex(L) {
    const v = this._ref(L, 1);
    const key = lua.lua_type(L, 2) === lua.LUA_TSTRING ? lua.lua_tojsstring(L, 2) : null;
    if (key === null || HIDDEN.has(key) || key[0] === '_') return this._raise(L, `${key} is not a valid member of ${this._typeof(v)}`);
    const resolve = (k) => (k in v ? k : null);
    let k = resolve(key);
    if (k === null) {
      const alt = key[0].toUpperCase() + key.slice(1);
      k = resolve(alt) || resolve(ALIASES[key] || '');
    }
    if (k === null) return this._raise(L, `${key} is not a valid member of ${this._typeof(v)}`);
    const x = v[k];
    if (typeof x === 'function') {
      lua.lua_pushcfunction(L, (L) => {
        const self = this._ref(L, 1);
        if (self === undefined || self === null || typeof self[k] !== 'function') {
          return this._raise(L, `Expected ':' not '.' calling member function ${key}`);
        }
        const args = this.args(L, 2);
        return this._wrapCall(L, () => self[k](...args));
      });
      return 1;
    }
    this.push(L, x);
    return 1;
  }

  _valNewIndex(L) {
    const v = this._ref(L, 1);
    const key = lua.lua_tojsstring(L, 2);
    if (v && v.luaWritable && v.luaWritable.includes(key)) { v[key] = this.get(L, 3); return 0; }
    return this._raise(L, `${key} cannot be assigned to`);
  }

  _arith(L, op) {
    const a = this.get(L, 1), b = this.get(L, 2);
    let r, err;
    try { r = arith(op, a, b); } catch (e) { err = e; }
    if (err || r === undefined) {
      return this._raise(L, `attempt to perform arithmetic (${op}) on ${this._typeof(a)} and ${this._typeof(b)}`);
    }
    this.push(L, r);
    return 1;
  }

  // ------------------------------------------------------------ scheduler
  _yieldFor(L, seconds) {
    this.waiting.push({ co: L, resumeAt: this.now() + seconds, started: this.now() });
    return lua.lua_yield(L, 0);
  }

  _yieldRequest(L, req) {
    if (!lua.lua_isyieldable(L)) return this._raise(L, 'attempt to yield from outside a coroutine');
    const entry = { co: L, resumeAt: Infinity };
    this.waiting.push(entry);
    let done = false;
    req.start((...values) => {
      if (done) return;
      done = true;
      entry.resumeAt = -1; // resume on next step
      entry.args = values;
    });
    return lua.lua_yield(L, 0);
  }

  _waitForChild(L) {
    const self = this._ref(L, 1);
    if (!(self instanceof Instance)) return this._raise(L, "Expected ':' not '.' calling member function WaitForChild");
    const name = lua.lua_tojsstring(L, 2);
    const timeout = lua.lua_type(L, 3) === lua.LUA_TNUMBER ? lua.lua_tonumber(L, 3) : null;
    const found = self.FindFirstChild(name);
    if (found) { this.push(L, found); return 1; }
    return this._yieldRequest(L, new YieldRequest((resume) => {
      const conn = self.getSignal('ChildAdded').Connect((c) => {
        if (c.Name === name) { conn.Disconnect(); resume(c); }
      });
      if (timeout !== null) setTimeout(() => { conn.Disconnect(); resume(null); }, timeout * 1000);
    }));
  }

  // Signal:Wait()
  signalWait(signal) {
    return new YieldRequest((resume) => signal.once((...a) => resume(...a)));
  }

  // Calls a Lua function in a fresh coroutine (event handlers, spawn, delay).
  spawnFunction(fn, args, script = this.current) {
    const L = this.L;
    const co = lua.lua_newthread(L);
    const ref = lauxlib.luaL_ref(L, REG);
    lua.lua_rawgeti(co, REG, fn.ref);
    for (const a of args) this.push(co, a);
    this._track(co, ref, script);
    this.resume(co, args.length, true);
  }

  schedule(fn, delaySeconds, args) {
    const L = this.L;
    const co = lua.lua_newthread(L);
    const ref = lauxlib.luaL_ref(L, REG);
    lua.lua_rawgeti(co, REG, fn.ref);
    for (const a of args) this.push(co, a);
    this._track(co, ref, this.current);
    this.waiting.push({ co, resumeAt: this.now() + delaySeconds, fresh: args.length });
  }

  _track(co, ref, script) {
    co.__robis = { ref, script };
    if (script) this._state(script).threads.add(co);
  }

  _state(script) {
    let s = this.scriptState.get(script);
    if (!s) this.scriptState.set(script, s = { threads: new Set(), conns: new Set() });
    return s;
  }

  // Resumes a coroutine. nargs values must already be on its stack.
  resume(co, nargs, isStart = false) {
    const meta = co.__robis || {};
    if (meta.dead) return;
    const prevScript = this.current, prevSlice = this.sliceStart;
    this.current = meta.script || null;
    this.sliceStart = Date.now();
    let status;
    try {
      status = lua.lua_resume(co, null, nargs);
    } catch (e) {
      status = -1;
      this.out('error', String(e && e.message || e));
    }
    this.current = prevScript;
    this.sliceStart = prevSlice;
    if (status === lua.LUA_YIELD) return;
    if (status !== lua.LUA_OK && status !== -1) {
      const msg = lua.lua_tojsstring(co, -1) || 'error';
      this._reportError(meta.script, msg, co);
    }
    this._finish(co);
  }

  _reportError(script, msg, co) {
    this.out('error', msg);
    if (co) {
      lauxlib.luaL_traceback(this.L, co, null, 0);
      const tb = lua.lua_tojsstring(this.L, -1);
      lua.lua_pop(this.L, 1);
      const lines = tb.split('\n').slice(1).filter((l) => !l.includes('[C]') && !l.includes('[JS]') && l.trim()).map((l) => l.trim().replace(/^\[string "(.*)"\]/, '$1'));
      if (lines.length) this.out('info', 'Stack Begin\n' + lines.join('\n') + '\nStack End');
    }
  }

  _finish(co) {
    const meta = co.__robis;
    if (!meta || meta.dead) return;
    meta.dead = true;
    lauxlib.luaL_unref(this.L, REG, meta.ref);
    if (meta.script) {
      const s = this.scriptState.get(meta.script);
      if (s) s.threads.delete(co);
    }
  }

  step() {
    const now = this.now();
    if (!this.waiting.length) return;
    const ready = [];
    const keep = [];
    for (const w of this.waiting) {
      if (w.resumeAt <= now) ready.push(w); else keep.push(w);
    }
    this.waiting = keep;
    ready.sort((a, b) => a.resumeAt - b.resumeAt);
    for (const w of ready) {
      const meta = w.co.__robis;
      if (meta && meta.dead) continue;
      if (w.fresh !== undefined) { this.resume(w.co, w.fresh, true); continue; }
      if (w.args) {
        for (const a of w.args) this.push(w.co, a);
        this.resume(w.co, w.args.length);
      } else {
        const elapsed = now - (w.started ?? now);
        lua.lua_pushnumber(w.co, elapsed);
        lua.lua_pushnumber(w.co, now - this.startTime);
        this.resume(w.co, 2);
      }
    }
  }

  // ------------------------------------------------------------ scripts
  runScript(script) {
    if (this.scriptState.get(script)?.running) return;
    const L = this.L;
    const st = this._state(script);
    st.running = true;
    const co = lua.lua_newthread(L);
    const ref = lauxlib.luaL_ref(L, REG);
    const chunk = '=' + script.getFullName();
    const src = script.Source || '';
    if (lauxlib.luaL_loadbuffer(co, S(src), null, S(chunk)) !== lua.LUA_OK) {
      this.current = script;
      this.out('error', lua.lua_tojsstring(co, -1));
      this.current = null;
      lauxlib.luaL_unref(L, REG, ref);
      return;
    }
    this._pushScriptEnv(co, script);
    lua.lua_setupvalue(co, -2, 1);
    this._track(co, ref, script);
    this.resume(co, 0, true);
  }

  _pushScriptEnv(co, script) {
    lua.lua_newtable(co);
    this.push(co, script);
    lua.lua_setfield(co, -2, S('script'));
    lua.lua_newtable(co);
    lua.lua_pushglobaltable(co);
    lua.lua_setfield(co, -2, S('__index'));
    lua.lua_pushglobaltable(co);
    lua.lua_setfield(co, -2, S('__newindex'));
    lua.lua_setmetatable(co, -2);
  }

  stopScript(script) {
    const st = this.scriptState.get(script);
    if (!st) return;
    for (const co of st.threads) {
      if (co.__robis) co.__robis.dead = true;
      if (co.__robis) lauxlib.luaL_unref(this.L, REG, co.__robis.ref);
    }
    for (const c of st.conns) c.Disconnect();
    this.scriptState.delete(script);
  }

  // Connects a Lua function to a signal, owned by the current script.
  connect(signal, fn) {
    const script = this.current;
    const conn = signal.Connect((...args) => this.spawnFunction(fn, args, script));
    if (script) this._state(script).conns.add(conn);
    return conn;
  }

  _require(L) {
    const mod = this._ref(L, 1);
    if (!(mod instanceof ModuleScript)) return this._raise(L, 'Attempted to call require with invalid argument(s).');
    if (this.moduleCache.has(mod)) {
      lua.lua_rawgeti(L, REG, this.moduleCache.get(mod));
      return 1;
    }
    const co = lua.lua_newthread(L);
    lua.lua_pop(L, 1);
    const ld = lauxlib.luaL_loadbuffer(co, S(mod.Source || ''), null, S('=' + mod.getFullName()));
    if (ld !== lua.LUA_OK) return this._raise(L, lua.lua_tojsstring(co, -1));
    this._pushScriptEnv(co, mod);
    lua.lua_setupvalue(co, -2, 1);
    const prev = this.current;
    this.current = mod;
    const st = lua.lua_resume(co, L, 0);
    this.current = prev;
    if (st === lua.LUA_YIELD) return this._raise(L, 'Module ' + mod.getFullName() + ' yielded while being required');
    if (st !== lua.LUA_OK) return this._raise(L, 'Requested module experienced an error while loading: ' + lua.lua_tojsstring(co, -1));
    if (lua.lua_gettop(co) !== 1) return this._raise(L, 'Module code did not return exactly one value');
    lua.lua_xmove(co, L, 1);
    lua.lua_pushvalue(L, -1);
    this.moduleCache.set(mod, lauxlib.luaL_ref(L, REG));
    return 1;
  }

  // Calls a Lua function synchronously (must not yield). Returns first result.
  callSync(fn, args) {
    const L = this.L;
    const co = lua.lua_newthread(L);
    lua.lua_pop(L, 1);
    lua.lua_rawgeti(co, REG, fn.ref);
    for (const a of args) this.push(co, a);
    const st = lua.lua_resume(co, null, args.length);
    if (st !== lua.LUA_OK) throw new Error(st === lua.LUA_YIELD ? 'callback yielded' : lua.lua_tojsstring(co, -1));
    return lua.lua_gettop(co) > 0 ? this.get(co, 1) : null;
  }

  // Runs a chunk of code (Studio command bar).
  exec(source, name = 'CommandBar') {
    const L = this.L;
    const co = lua.lua_newthread(L);
    const ref = lauxlib.luaL_ref(L, REG);
    if (lauxlib.luaL_loadbuffer(co, S(source), null, S('=' + name)) !== lua.LUA_OK) {
      this.out('error', lua.lua_tojsstring(co, -1));
      lauxlib.luaL_unref(L, REG, ref);
      return;
    }
    this._track(co, ref, null);
    this.resume(co, 0, true);
  }

  // fengari ignores __mode, so drop cached userdata of destroyed instances manually.
  collectInstances() {
    const L = this.L;
    lua.lua_rawgeti(L, REG, this.instCacheRef);
    const dead = [];
    lua.lua_pushnil(L);
    while (lua.lua_next(L, -2) !== 0) {
      const inst = this._ref(L, -1);
      if (inst && inst._destroyed) dead.push(lua.lua_tojsstring(L, -2));
      lua.lua_pop(L, 1);
    }
    for (const id of dead) { lua.lua_pushnil(L); lua.lua_setfield(L, -2, S(id)); }
    lua.lua_pop(L, 1);
    return dead.length;
  }

  close() {
    this.waiting = [];
    for (const s of [...this.scriptState.keys()]) this.stopScript(s);
  }
}

export class YieldRequest {
  constructor(start) { this.start = start; }
}
export class MultiReturn {
  constructor(values) { this.values = values; }
}

const ALIASES = {
  magnitude: 'Magnitude', unit: 'Unit', p: 'Position', lookVector: 'LookVector', rightVector: 'RightVector',
  upVector: 'UpVector', inverse: 'Inverse', lerp: 'Lerp', x: 'X', y: 'Y', z: 'Z', r: 'R', g: 'G', b: 'B',
  toEulerAnglesXYZ: 'toEulerAnglesXYZ', ToEulerAnglesXYZ: 'toEulerAnglesXYZ', PointToWorldSpace: 'pointToWorldSpace',
  PointToObjectSpace: 'pointToObjectSpace', VectorToWorldSpace: 'vectorToWorldSpace', VectorToObjectSpace: 'vectorToObjectSpace',
  ToWorldSpace: 'toWorldSpace', ToObjectSpace: 'toObjectSpace', ToHex: 'toHex',
};

function arith(op, a, b) {
  if (a instanceof Vector3) {
    if (op === 'add' && b instanceof Vector3) return a.add(b);
    if (op === 'sub' && b instanceof Vector3) return a.sub(b);
    if (op === 'mul') return a.mul(b);
    if (op === 'div') return a.div(b);
  }
  if (typeof a === 'number' && b instanceof Vector3) {
    if (op === 'mul') return b.mul(a);
    if (op === 'div') return new Vector3(a / b.X, a / b.Y, a / b.Z);
  }
  if (a instanceof CFrame) {
    if (op === 'mul' && (b instanceof CFrame || b instanceof Vector3)) return a.mul(b);
    if (op === 'add' && b instanceof Vector3) return a.add(b);
    if (op === 'sub' && b instanceof Vector3) return a.sub(b);
  }
  if (a instanceof UDim2 && b instanceof UDim2) {
    const s = op === 'add' ? 1 : op === 'sub' ? -1 : 0;
    if (s) return new UDim2(a.X.Scale + s * b.X.Scale, a.X.Offset + s * b.X.Offset, a.Y.Scale + s * b.Y.Scale, a.Y.Offset + s * b.Y.Offset);
  }
  return undefined;
}

function luaTypeName(t) {
  return ['nil', 'boolean', 'userdata', 'number', 'string', 'table', 'function', 'userdata', 'thread'][t] || 'nil';
}

// Signals: :Connect / :Wait need runtime access; attach Lua-facing wrappers.
{
  const proto = Signal.prototype;
  const origConnect = proto.Connect;
  proto.Connect = function (fn) {
    if (fn instanceof LuaFunction) return fn.rt.connect(this, fn);
    if (typeof fn !== 'function') throw new Error('Attempt to connect failed: Passed value is not a function');
    return origConnect.call(this, fn);
  };
  proto.connect = proto.Connect;
  proto.Wait = function () { return new YieldRequest((resume) => this.once((...a) => resume(...a))); };
  proto.wait = proto.Wait;
  proto.ConnectParallel = proto.Connect;
}

export { LuaFunction, BaseScript, CLASSES };
