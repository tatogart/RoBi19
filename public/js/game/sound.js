// Synthesized sound effects (no audio assets needed).
let ctx = null;
let master = null;
let volume = 0.6;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}
export function getVolume() { return volume; }

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

// The famous death sound, approximated with a formant-filtered sawtooth.
export function oof() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(130, t + 0.28);
  const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 3;
  const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1000; f2.Q.value = 4;
  const g = c.createGain();
  env(g, t, 0.02, 0.9, 0.3);
  osc.connect(f1); osc.connect(f2); f1.connect(g); f2.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + 0.4);
}

export function jump() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.12);
  const g = c.createGain();
  env(g, t, 0.01, 0.12, 0.14);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + 0.2);
}

export function explosion() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const len = c.sampleRate * 1.2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1);
  const g = c.createGain(); env(g, t, 0.01, 1, 1.1);
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start(t);
}

export function click() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 900;
  const g = c.createGain(); env(g, t, 0.002, 0.08, 0.05);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + 0.08);
}

export function unlock() { ac(); }

// A bright three-note chime (The Hunt token, rewards).
export function coin() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  [988, 1319, 1976].forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const g = c.createGain();
    env(g, t + i * 0.09, 0.005, 0.16, 0.12);
    osc.connect(g); g.connect(master);
    osc.start(t + i * 0.09); osc.stop(t + i * 0.09 + 0.3);
  });
}

// ---- 2020 sounds: footsteps, landing, equip, menus, chat
let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}
// a soft step; `mat` changes the tone (grass is dull, metal rings)
const STEP_TONE = { Grass: 500, Sand: 380, Wood: 900, WoodPlanks: 900, Metal: 2600, DiamondPlate: 2400, Concrete: 1400, Slate: 1300, Brick: 1200, Ice: 3000, Glass: 3200, Plastic: 1100, SmoothPlastic: 1100 };
let stepAlt = false;
export function step(mat = 'Plastic', loud = 1) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const src = noise(c);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = (STEP_TONE[mat] || 1100) * (stepAlt ? 1.08 : 0.94); bp.Q.value = 1.4;
  stepAlt = !stepAlt;
  const g = c.createGain(); env(g, t, 0.004, 0.09 * loud, 0.07);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.12);
}
// landing after a fall: a low thump
export function land(force = 1) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t); osc.frequency.exponentialRampToValueAtTime(55, t + 0.15);
  const g = c.createGain(); env(g, t, 0.005, Math.min(0.5, 0.2 * force), 0.16);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + 0.22);
  step('Concrete', Math.min(2, force));
}
// pulling a tool out: a quick swish
export function equip() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const src = noise(c);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
  bp.frequency.setValueAtTime(800, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
  const g = c.createGain(); env(g, t, 0.01, 0.12, 0.1);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.18);
}
// a menu opens / closes: two short soft notes
export function menu(open = true) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  (open ? [660, 880] : [880, 660]).forEach((f, i) => {
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
    const g = c.createGain(); env(g, t + i * 0.05, 0.004, 0.07, 0.07);
    osc.connect(g); g.connect(master);
    osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.12);
  });
}
// a new chat message: a tiny pop
export function pop() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, t); osc.frequency.exponentialRampToValueAtTime(1800, t + 0.05);
  const g = c.createGain(); env(g, t, 0.003, 0.05, 0.05);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + 0.1);
}
