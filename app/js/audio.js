// Beeps made with the Web Audio API (no sound files).

let ctx = null;
let master = null;
let volume = 0.8;
let muted = false;
let pending = [];

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  // iPhone (Safari 16.4+): play even when the Ring/Silent switch is on Silent.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  applyGain();
  return ctx;
}

function applyGain() {
  if (master) master.gain.value = muted ? 0 : volume;
}

// Must be called from a user gesture (tap) before the first beep.
export function unlock() {
  const c = ensure();
  if (c && c.state !== 'running') c.resume();
}

export function audioState() {
  return ctx ? ctx.state : 'none';
}

export function onStateChange(fn) {
  const c = ensure();
  if (c) c.addEventListener('statechange', () => fn(c.state));
}

// Clock in seconds. Uses the audio clock so beeps and the screen agree.
export function now() {
  return ctx ? ctx.currentTime : performance.now() / 1000;
}

export function setVolume(v) { volume = v; applyGain(); }
export function setMuted(m) { muted = m; applyGain(); }
export function isMuted() { return muted; }

const SOUNDS = {
  // Start of every burpee: loud, clear, short.
  beep: [{ f: 1046, d: 0.16, type: 'square', g: 0.32 }],
  // Last 3 seconds of the get-ready countdown.
  tick: [{ f: 660, d: 0.08, type: 'square', g: 0.22 }],
  // End of workout: three rising notes.
  finish: [
    { f: 784, d: 0.14, type: 'square', g: 0.3, at: 0 },
    { f: 1046, d: 0.14, type: 'square', g: 0.3, at: 0.18 },
    { f: 1568, d: 0.45, type: 'square', g: 0.3, at: 0.36 },
  ],
};

function tone(start, { f, d, type, g }) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = f;
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(g, start + 0.005);
  env.gain.setValueAtTime(g, start + d - 0.03);
  env.gain.linearRampToValueAtTime(0, start + d);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + d + 0.02);
  return osc;
}

export function play(kind, delay = 0) {
  const c = ensure();
  if (!c) return [];
  const base = c.currentTime + Math.max(0, delay);
  return SOUNDS[kind].map((s) => tone(base + (s.at || 0), s));
}

// Interface used by the engine.
export const engineSounds = {
  schedule(events) {
    for (const e of events) pending.push(...play(e.kind, e.delay));
  },
  cancel() {
    for (const osc of pending) {
      try { osc.stop(); } catch {}
    }
    pending = [];
  },
};
