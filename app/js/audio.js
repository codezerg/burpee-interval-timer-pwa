// Beeps made with the Web Audio API (no sound files).

let ctx = null;
let master = null;
let volume = 0.8;
let muted = false;
let theme = 'drum';
let pending = [];

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  // iPhone (Safari 16.4+): play even when the Ring/Silent switch is on Silent.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  ctx = new AC();
  // volume -> compressor -> make-up gain: softer, rounder tones stay as loud
  // and clear as plain beeps without clipping.
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 8;
  comp.ratio.value = 5;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  const makeup = ctx.createGain();
  makeup.gain.value = 1.6;
  master.connect(comp).connect(makeup).connect(ctx.destination);
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
export function setTheme(t) { if (THEMES[t]) theme = t; }
export function setMuted(m) { muted = m; applyGain(); }
export function isMuted() { return muted; }

// A sound is a list of notes. Each note: frequency f (Hz), length d (s),
// wave type, gain g, start offset `at`, optional pitch `sweep` to a target
// frequency over `sweepT` seconds, extra `partials` [[ratio, gain]] for a
// bell-like timbre, and `decay`: 'ring' (natural fade) or 'flat' (beep).
// A `noise` note is filtered white noise instead of a tone (drum skins,
// snares, cymbals): `filter` type, `ff` cutoff/centre (Hz), `q`.
const NOTE = { C6: 1046.5, E6: 1318.5, G6: 1568, A6: 1760, C7: 2093, E7: 2637 };

// Drum pieces. Tuned above ~150 Hz so phone speakers can play them.
const SNARE = [
  { noise: true, filter: 'bandpass', ff: 1900, q: 0.8, d: 0.17, g: 1.0 },
  { noise: true, filter: 'highpass', ff: 6500, d: 0.06, g: 0.35 },
  { f: 250, sweep: 175, sweepT: 0.05, d: 0.11, type: 'triangle', g: 0.75, decay: 'ring' },
];
const RIM = [
  { f: 1050, sweep: 820, sweepT: 0.02, d: 0.06, type: 'sine', g: 0.6, decay: 'ring' },
  { noise: true, filter: 'bandpass', ff: 3800, q: 2.5, d: 0.035, g: 0.5 },
];
const tom = (f, at) => [
  { f, sweep: f * 0.62, sweepT: 0.12, d: 0.24, type: 'triangle', g: 0.85, at, decay: 'ring' },
  { noise: true, filter: 'bandpass', ff: f * 4, q: 1.2, d: 0.06, g: 0.35, at },
];
const at = (notes, t, gain = 1) => notes.map((n) => ({ ...n, at: (n.at || 0) + t, g: n.g * gain }));

export const THEMES = {
  // Snare hit per burpee, rim clicks to count down, tom fill + crash to finish (default).
  drum: {
    label: 'Drum',
    beep: SNARE,
    tick: RIM,
    finish: [
      ...tom(330, 0), ...tom(262, 0.11), ...tom(196, 0.22),
      ...at(SNARE, 0.36, 0.6),
      { noise: true, filter: 'highpass', ff: 4500, d: 1.5, g: 0.4, at: 0.36 },
    ],
  },
  // Short, clean glass tap with a fast, soft decay, in the spirit of phone and
  // watch alerts (default). Original sounds, not copies of any product's.
  glass: {
    label: 'Glass',
    beep: [
      { f: 1975.5, d: 0.28, type: 'sine', g: 0.55, partials: [[2.76, 0.08]], decay: 'ring' },
      { f: 2637, d: 0.22, type: 'sine', g: 0.3, at: 0.045, decay: 'ring' },
    ],
    tick: [{ f: 1318.5, d: 0.12, type: 'sine', g: 0.4, decay: 'ring' }],
    finish: [
      { f: 1318.5, d: 0.35, type: 'sine', g: 0.45, at: 0, partials: [[2.76, 0.06]], decay: 'ring' },
      { f: 1661.2, d: 0.35, type: 'sine', g: 0.45, at: 0.09, partials: [[2.76, 0.06]], decay: 'ring' },
      { f: 1975.5, d: 0.35, type: 'sine', g: 0.45, at: 0.18, partials: [[2.76, 0.06]], decay: 'ring' },
      { f: 2637, d: 1.1, type: 'sine', g: 0.5, at: 0.27, partials: [[2, 0.12]], decay: 'ring' },
    ],
  },
  // Soft bell strike: rounder and a little longer.
  chime: {
    label: 'Chime',
    beep: [{ f: NOTE.E6, d: 0.5, type: 'sine', g: 0.6, partials: [[2, 0.3], [3.01, 0.12]], decay: 'ring' }],
    tick: [{ f: NOTE.A6 / 2, d: 0.14, type: 'triangle', g: 0.4, decay: 'ring' }],
    finish: [
      { f: NOTE.C6, d: 0.5, type: 'sine', g: 0.5, at: 0, partials: [[2, 0.25]], decay: 'ring' },
      { f: NOTE.E6, d: 0.5, type: 'sine', g: 0.5, at: 0.13, partials: [[2, 0.25]], decay: 'ring' },
      { f: NOTE.G6, d: 0.5, type: 'sine', g: 0.5, at: 0.26, partials: [[2, 0.25]], decay: 'ring' },
      { f: NOTE.C7, d: 1.3, type: 'sine', g: 0.55, at: 0.39, partials: [[2, 0.3], [3.01, 0.1]], decay: 'ring' },
    ],
  },
  // The original square-wave beeps.
  classic: {
    label: 'Classic',
    beep: [{ f: 1046, d: 0.16, type: 'square', g: 0.32, decay: 'flat' }],
    tick: [{ f: 660, d: 0.08, type: 'square', g: 0.22, decay: 'flat' }],
    finish: [
      { f: 784, d: 0.14, type: 'square', g: 0.3, at: 0, decay: 'flat' },
      { f: 1046, d: 0.14, type: 'square', g: 0.3, at: 0.18, decay: 'flat' },
      { f: 1568, d: 0.45, type: 'square', g: 0.3, at: 0.36, decay: 'flat' },
    ],
  },
};

// For tests: render one sound offline and return the samples.
export async function renderOffline(kind, themeId) {
  const off = new OfflineAudioContext(1, 48000 * 2.5, 48000);
  const saved = { ctx, master, noiseBuffer };
  ctx = off;
  noiseBuffer = null;
  master = off.createGain();
  master.connect(off.destination);
  try {
    THEMES[themeId][kind].flatMap((n) => note(0.01 + (n.at || 0), n));
    return (await off.startRendering()).getChannelData(0);
  } finally {
    ({ ctx, master, noiseBuffer } = saved);
  }
}

function voice(start, f, n, gain) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = n.type;
  osc.frequency.setValueAtTime(f, start);
  if (n.sweep) osc.frequency.exponentialRampToValueAtTime(f * (n.sweep / n.f), start + n.sweepT);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.004);
  if (n.decay === 'ring') {
    env.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
  } else {
    env.gain.setValueAtTime(gain, start + n.d - 0.03);
    env.gain.linearRampToValueAtTime(0, start + n.d);
  }
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + n.d + 0.03);
  return osc;
}

let noiseBuffer = null;
function noiseVoice(start, n) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = noiseBuffer.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = n.filter;
  filter.frequency.value = n.ff;
  if (n.q) filter.Q.value = n.q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(n.g, start + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
  src.connect(filter).connect(env).connect(master);
  src.start(start);
  src.stop(start + n.d + 0.03);
  return src;
}

function note(start, n) {
  if (n.noise) return [noiseVoice(start, n)];
  const oscs = [voice(start, n.f, n, n.g)];
  for (const [ratio, rel] of n.partials || []) oscs.push(voice(start, n.f * ratio, { ...n, d: n.d * 0.6 }, n.g * rel));
  return oscs;
}

export function play(kind, delay = 0, themeId = theme) {
  const c = ensure();
  if (!c) return [];
  const base = c.currentTime + Math.max(0, delay);
  return THEMES[themeId][kind].flatMap((n) => note(base + (n.at || 0), n));
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
