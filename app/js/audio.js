// Beeps made with the Web Audio API (no sound files).

let ctx = null;
let master = null;
let volume = 0.8;
let muted = false;
let theme = 'glass';
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
const NOTE = { C6: 1046.5, E6: 1318.5, G6: 1568, A6: 1760, C7: 2093, E7: 2637 };

export const THEMES = {
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
  // Quick rising blip, like a modern app notification.
  pop: {
    label: 'Pop',
    beep: [{ f: 520, sweep: 1500, sweepT: 0.05, d: 0.2, type: 'sine', g: 0.7, partials: [[2, 0.15]], decay: 'ring' }],
    tick: [{ f: 420, sweep: 900, sweepT: 0.03, d: 0.09, type: 'sine', g: 0.45, decay: 'ring' }],
    finish: [
      { f: 520, sweep: 1500, sweepT: 0.05, d: 0.2, type: 'sine', g: 0.6, at: 0, decay: 'ring' },
      { f: 660, sweep: 1900, sweepT: 0.05, d: 0.2, type: 'sine', g: 0.6, at: 0.14, decay: 'ring' },
      { f: 800, sweep: 2400, sweepT: 0.06, d: 0.7, type: 'sine', g: 0.65, at: 0.28, partials: [[2, 0.15]], decay: 'ring' },
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

function note(start, n) {
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
