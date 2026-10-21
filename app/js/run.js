// Runs a workout: owns the timing engine, the animation loop, wake lock and
// the reactive state the run screen draws from.

import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import * as store from './store.js';
import * as audio from './audio.js';
import { WorkoutRun } from './engine.js';
import { go, replace, pop, resetTo } from './router.js';
import { toast } from './components.js';

// What the run screen shows. phase: countdown | running | paused
export const runUi = {
  phase: van.state(null),
  status: van.state(null), // engine status, refreshed every animation frame
  muted: van.state(audio.isMuted()),
  spec: null,              // { title, type, typeName, count, pace, workoutId, catchUpOf? }
  run: null,
};

let active = null; // { run, spec, startedAt, raf }
let audioWatched = false;

export const isActive = () => active != null;
export const runState = () => active?.run.state;

function phaseOf(run) {
  if (run.state === 'paused') return 'paused';
  if (run.state === 'countdown' && run.countdown > 0) return 'countdown';
  return 'running';
}

function publish() {
  runUi.phase.val = phaseOf(active.run);
  runUi.status.val = active.run.status();
}

export function startRun(spec) {
  audio.unlock();
  if (!audioWatched) {
    audioWatched = true;
    audio.onStateChange((state) => {
      // Phone call, Siri, audio interruption: pause instead of losing time.
      if (state !== 'running' && active?.run.state === 'running') pauseRun();
    });
  }
  const run = new WorkoutRun({
    count: spec.count,
    pace: spec.pace,
    countdown: store.settings().countdown,
    clock: audio.now,
    sounds: audio.engineSounds,
  });
  active = { run, spec, startedAt: Date.now(), raf: 0 };
  runUi.spec = spec;
  runUi.run = run;
  run.start();
  publish();
  setWakeLock(true);
  go('run');
  loop();
}

function loop() {
  const frame = () => {
    if (!active) return;
    if (active.run.tick() === 'finished') return finishRun();
    publish();
    active.raf = requestAnimationFrame(frame);
  };
  active.raf = requestAnimationFrame(frame);
}

export function pauseRun() {
  if (!active) return;
  active.run.pause();
  publish();
}

export function resumeRun() {
  if (!active) return;
  audio.unlock();
  active.run.resume();
  setWakeLock(true);
  publish();
}

export function skipCountdown() {
  audio.unlock();
  active?.run.skipCountdown();
}

export function toggleMute() {
  audio.setMuted(!audio.isMuted());
  runUi.muted.val = audio.isMuted();
}

function endRun() {
  cancelAnimationFrame(active.raf);
  setWakeLock(false);
  const { run, spec, startedAt } = active;
  const st = run.status();
  active = null;
  return {
    ...spec,
    target: spec.count,
    done: run.done(),
    activeSec: st.elapsed,
    pausedSec: st.pausedSec,
    pauses: run.pauses,
    startedAt,
    endedAt: Date.now(),
  };
}

function finishRun() {
  replace('summary', { result: vanX.reactive(endRun()) });
}

export function stopRun() {
  if (!active) return;
  active.run.stop();
  const r = endRun();
  if (r.done <= 0) {
    pop();
    toast('Stopped before the first burpee. Nothing saved.');
    return;
  }
  replace('summary', { result: vanX.reactive(r) });
}

export function cancelRun() {
  if (!active) return;
  active.run.stop();
  endRun();
  pop();
}

export function saveResult(r) {
  store.addSession({
    workoutId: r.workoutId,
    type: r.type,
    typeName: r.typeName,
    target: r.target,
    pace: r.pace,
    done: r.done,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    activeSec: Math.round(r.activeSec),
    pausedSec: Math.round(r.pausedSec),
    pauses: r.pauses,
    ...(r.feel ? { feel: r.feel } : {}),
    ...(r.pain?.length ? { pain: r.pain } : {}),
    ...(r.reduced ? { reduced: true } : {}),
    ...(r.catchUpOf ? { catchUpOf: r.catchUpOf } : {}),
  });
  resetTo('home');
  toast('Saved');
}

// ------------------------------------------------------------------ screen keep-awake
let wakeLock = null;
async function setWakeLock(on) {
  if (on && store.settings().keepAwake && 'wakeLock' in navigator) {
    if (wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch { /* not allowed (e.g. low battery); ignore */ }
  } else if (!on && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!active) return;
  if (document.hidden) {
    // Leaving the app pauses the workout so no time or beeps are lost.
    if (active.run.state === 'countdown' || active.run.state === 'running') pauseRun();
  } else {
    setWakeLock(true);
  }
});
