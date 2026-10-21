// Timer sounds made with the Web Audio API (no sound files).
//
// Design (research notes in docs/sounds.md): one simple voice family; cues are
// told apart by pitch and number of pulses, like beep tests and sports watches.
//   countdown tick  low (587 Hz), 1 short pulse per second
//   first burpee    mid (880 Hz), 1 long pulse ("3-2-1-GO")
//   each burpee     mid (880 Hz), 1 short pulse
//   last burpee     mid, 2 quick pulses
//   finish          mid x3, then one long high (1175 Hz) tone
//   pre-warning     optional quiet low ticks 2 s and 1 s before each beep (slow paces)
// Pitches sit where phone speakers are loud (~0.6-3.5 kHz with harmonics).

let ctx = null;
let master = null;
let volume = 0.8;
let muted = false;
let theme = 'beep';
let mixWithMusic = false;
let pending = [];

function sessionType() {
  // iPhone (Safari 16.4+): 'playback' plays even on Silent but pauses other
  // audio; 'ambient' mixes with your music but obeys the Silent switch.
  try { if (navigator.audioSession) navigator.audioSession.type = mixWithMusic ? 'ambient' : 'playback'; } catch {}
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  sessionType();
  ctx = new AC();
  // volume -> compressor (catches peaks so nothing clips) -> output
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.002;
  comp.release.value = 0.1;
  const makeup = ctx.createGain();
  makeup.gain.value = 2.0; // the filtered voices are ~5 dB quieter than raw square waves
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
export function setMixWithMusic(on) { mixWithMusic = on; sessionType(); }
export function setMuted(m) { muted = m; applyGain(); }
export function isMuted() { return muted; }

// ------------------------------------------------------------------ sounds
const LOW = 587.3;   // D5
const MID = 880;     // A5
const HIGH = 1174.7; // D6

// A pulse: pitch f, envelope attack/hold/decay in ms, peak gain g, start `at` (s).
const pulse = (f, a, h, d, g, at = 0) => ({ f, a: a / 1000, h: h / 1000, d: d / 1000, g, at });

// Which pulses each cue plays. The voice (timbre) comes from the theme.
const CUES = {
  tick: [pulse(LOW, 3, 20, 60, 0.25)],
  first: [pulse(MID, 4, 250, 200, 0.35)],
  beep: [pulse(MID, 4, 60, 90, 0.35)],
  last: [pulse(MID, 4, 40, 90, 0.35), pulse(MID, 4, 40, 90, 0.35, 0.13)],
  pre: [pulse(LOW, 3, 15, 50, 0.13)],
  finish: [
    pulse(MID, 4, 40, 60, 0.35), pulse(MID, 4, 40, 60, 0.35, 0.16), pulse(MID, 4, 40, 60, 0.35, 0.32),
    pulse(HIGH, 5, 300, 500, 0.35, 0.62),
  ],
};

// Voices: how one pulse is synthesized.
export const THEMES = {
  // Warm beep: filtered sawtooth (4 harmonics in the speaker's best range) plus a tiny click.
  beep: {
    label: 'Beep',
    voice: (p) => [
      { ...p, wave: 'sawtooth', lowpass: 3500 },
      ...(p.g >= 0.2 ? [{ noise: true, ff: 3000, q: 1, a: 0.001, h: 0.002, d: 0.004, g: 0.12, at: p.at }] : []),
    ],
  },
  // Clave: a short woodblock "tock". Same pitch steps, scaled up to the wood range.
  clave: {
    label: 'Clave',
    voice: (p) => {
      const f = p.f * (1800 / MID);
      const d = Math.max(0.045, Math.min(0.3, p.h + p.d) * 0.5);
      return [
        { ...p, f, wave: 'sine', a: 0.001, h: 0, d, g: p.g * 1.3 },
        { ...p, f: f * 1.5, wave: 'sine', a: 0.001, h: 0, d: d * 0.7, g: p.g * 0.65 },
        { noise: true, ff: 2500, q: 1.5, a: 0.001, h: 0.002, d: 0.005, g: p.g * 0.4, at: p.at },
      ];
    },
  },
  // Soft: the same beeps, gentler (triangle wave, darker filter). Quieter rooms/headphones.
  soft: {
    label: 'Soft',
    voice: (p) => [{ ...p, wave: 'triangle', lowpass: 2500 }],
  },
};

export const THEME_IDS = Object.keys(THEMES);

let noiseBuffer = null;
function noise() {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    const ch = noiseBuffer.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// One voice: source -> (filter) -> envelope -> master. Returns the source so it can be stopped.
function voice(start, v) {
  let src, node;
  if (v.noise) {
    src = ctx.createBufferSource();
    src.buffer = noise();
    node = ctx.createBiquadFilter();
    node.type = 'bandpass';
    node.frequency.value = v.ff;
    node.Q.value = v.q;
    src.connect(node);
  } else {
    src = ctx.createOscillator();
    src.type = v.wave;
    src.frequency.value = v.f;
    node = src;
    if (v.lowpass) {
      node = ctx.createBiquadFilter();
      node.type = 'lowpass';
      node.frequency.value = v.lowpass;
      node.Q.value = 0.7;
      src.connect(node);
    }
  }
  const env = ctx.createGain();
  const peak = start + v.a;
  const end = peak + v.h + v.d;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(v.g, peak);
  env.gain.setValueAtTime(v.g, peak + v.h);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  node.connect(env).connect(master);
  src.start(start);
  src.stop(end + 0.02);
  return src;
}

function voicesFor(kind, themeId) {
  return CUES[kind].flatMap((p) => THEMES[themeId].voice(p));
}

export function play(kind, delay = 0, themeId = theme) {
  const c = ensure();
  if (!c) return [];
  const base = c.currentTime + Math.max(0, delay);
  return voicesFor(kind, themeId).map((v) => voice(base + (v.at || 0), v));
}

// Previews in Settings: a new preview stops the previous one, so repeated
// taps never stack up. `sequence` is [[kind, startSeconds], ...].
let previewing = [];
export function stopPreview() {
  for (const src of previewing) {
    try { src.stop(); } catch {}
  }
  previewing = [];
}
export function preview(sequence, themeId = theme) {
  stopPreview();
  previewing = sequence.flatMap(([kind, t]) => play(kind, t, themeId));
}

// For checks: render one cue offline (without the compressor) and return the samples.
export async function renderOffline(kind, themeId) {
  const off = new OfflineAudioContext(1, 48000 * 2, 48000);
  const saved = { ctx, master };
  ctx = off;
  master = off.createGain();
  master.connect(off.destination);
  try {
    voicesFor(kind, themeId).forEach((v) => voice(0.01 + (v.at || 0), v));
    return (await off.startRendering()).getChannelData(0);
  } finally {
    ({ ctx, master } = saved);
  }
}

// Interface used by the engine.
export const engineSounds = {
  schedule(events) {
    for (const e of events) pending.push(...play(e.kind, e.delay));
  },
  cancel() {
    for (const src of pending) {
      try { src.stop(); } catch {}
    }
    pending = [];
  },
};
