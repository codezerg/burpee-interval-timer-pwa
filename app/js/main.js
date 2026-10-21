// App controller: navigation, actions, and the workout run loop.

import * as store from './store.js';
import * as audio from './audio.js';
import * as views from './views.js';
import * as backup from './backup.js';
import { WorkoutRun } from './engine.js';
import { TYPES, workoutTitle } from './types.js';
import { clock, duration } from './format.js';

const app = document.getElementById('app');

// ------------------------------------------------------------------ navigation
// Internal screen stack. One extra browser-history entry lets the phone's
// Back button/gesture go back inside the app instead of closing it.
let stack = [{ name: 'home' }];
let guarded = false;

const top = () => stack[stack.length - 1];

function go(name, params = {}) {
  stack.push({ name, params });
  render(true);
}

function replace(name, params = {}) {
  stack[stack.length - 1] = { name, params };
  render(true);
}

function resetTo(name, params = {}) {
  if (updateReady && name === 'home') return location.reload();
  stack = [{ name, params }];
  render(true);
}

function syncGuard() {
  if (stack.length > 1 && !guarded) {
    history.pushState({ guard: true }, '');
    guarded = true;
  }
}

window.addEventListener('popstate', () => {
  guarded = false;
  handleBack();
  syncGuard();
});

function handleBack() {
  const screen = top().name;
  if (screen === 'run') {
    if (!active) return;
    const st = active.run.state;
    if (st === 'countdown') return cancelRun();
    if (st === 'running') { pauseRun(); return; }
    return; // paused: Resume or Stop & save
  }
  if (screen === 'summary') { toast('Save or discard first'); return; }
  if (stack.length > 1) { stack.pop(); render(true); }
}

// ------------------------------------------------------------------ rendering
let editorDraft = null;
let result = null; // pending summary

function render(scrollTop = false) {
  const { name, params } = top();
  let html;
  switch (name) {
    case 'home': html = views.home(); break;
    case 'settings': html = views.settings({ install: backup.installState(), version: backup.currentVersion() }); break;
    case 'detail': {
      const w = store.getWorkout(params.id);
      if (!w) { stack = [{ name: 'home' }]; return render(); }
      html = views.detail(w);
      break;
    }
    case 'editor': html = views.editor(editorDraft, params.isNew); break;
    case 'howto': html = views.howto(params.type); break;
    case 'run': html = runView(); break;
    case 'summary': html = views.summary(result); break;
    default: html = views.home();
  }
  app.innerHTML = html;
  bindInputs();
  if (scrollTop) window.scrollTo(0, 0);
  syncGuard();
  if (name === 'run') updateRun();
}

function bindInputs() {
  const name = document.getElementById('draft-name');
  if (name) {
    name.addEventListener('input', () => {
      editorDraft.typeName = name.value;
      document.getElementById('draft-title').textContent = workoutTitle(editorDraft);
    });
  }
  const vol = document.getElementById('volume');
  if (vol) {
    vol.addEventListener('input', () => {
      const v = Number(vol.value);
      audio.setVolume(v);
      store.updateSettings({ volume: v });
    });
    vol.addEventListener('change', () => { audio.unlock(); audio.play('beep'); });
  }
}

let toastTimer = null;
function toast(text) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

// ------------------------------------------------------------------ workout run
let active = null; // { run, spec, startedAt, phase, raf }
let audioWatched = false;

function startRun(spec) {
  audio.unlock();
  if (!audioWatched) {
    audioWatched = true;
    audio.onStateChange((state) => {
      // Phone call, Siri, audio interruption: pause instead of losing time.
      if (state !== 'running' && active && active.run.state === 'running') {
        pauseRun();
      }
    });
  }
  const run = new WorkoutRun({
    count: spec.count,
    pace: spec.pace,
    countdown: store.settings().countdown,
    clock: audio.now,
    sounds: audio.engineSounds,
  });
  active = { run, spec, startedAt: Date.now(), phase: null, raf: 0 };
  run.start();
  setWakeLock(true);
  go('run');
  loop();
}

function phaseOf(run) {
  if (run.state === 'paused') return 'paused';
  if (run.state === 'countdown' && run.countdown > 0) return 'countdown';
  return 'running';
}

function runView() {
  const { run, spec } = active;
  const phase = phaseOf(run);
  active.phase = phase;
  if (phase === 'countdown') return views.countdown(spec.title, Math.ceil(-run.t()));
  return views.run({
    title: { text: spec.title, type: spec.type },
    count: run.count,
    paceSec: run.pace,
    total: run.total,
    paused: phase === 'paused',
    muted: audio.isMuted(),
  });
}

function loop() {
  cancelAnimationFrame(active?.raf);
  const frame = () => {
    if (!active) return;
    const state = active.run.tick();
    if (state === 'finished') return finishRun();
    if (top().name === 'run') {
      if (phaseOf(active.run) !== active.phase) render();
      else updateRun();
    }
    active.raf = requestAnimationFrame(frame);
  };
  active.raf = requestAnimationFrame(frame);
}

const $ = (id) => document.getElementById(id);
function setText(id, text) {
  const el = $(id);
  if (el && el.textContent !== text) el.textContent = text;
}

function updateRun() {
  if (!active) return;
  const { run } = active;
  const st = run.status();
  if (active.phase === 'countdown') {
    setText('cd-num', String(Math.max(1, st.countdownLeft)));
    return;
  }
  setText('r-elapsed', clock(Math.floor(st.elapsed)));
  setText('r-burpee', `${st.burpee} / ${run.count}`);
  setText('r-left', clock(Math.ceil(st.totalLeft - 1e-6)));
  const secLeft = Math.max(0, Math.ceil(st.burpeeLeft - 1e-6));
  setText('r-sec', String(secLeft));
  const big = $('r-big');
  if (big) big.setAttribute('stroke-dashoffset', (views.RING.BIG_C * (1 - st.progress)).toFixed(1));
  const small = $('r-small');
  if (small) small.setAttribute('stroke-dashoffset', (views.RING.SMALL_C * (st.burpeeLeft / run.pace)).toFixed(1));
  if (active.phase === 'paused') {
    setText('r-paused', duration(run.clock() - run.pauseStartedAt));
    const done = run.done();
    setText('r-done', `${done} done · ${run.count - done} to go`);
  } else {
    setText('r-next', st.burpee >= run.count ? `Last one · done in ${secLeft} s` : `Next beep in ${secLeft} s`);
  }
}

function pauseRun() {
  if (!active) return;
  active.run.pause();
  if (top().name === 'run') render();
}

function resumeRun() {
  if (!active) return;
  audio.unlock();
  active.run.resume();
  setWakeLock(true);
  render();
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
    startedAt,
    endedAt: Date.now(),
  };
}

function finishRun() {
  result = endRun();
  replace('summary');
}

function stopRun() {
  if (!active) return;
  active.run.stop();
  const r = endRun();
  if (r.done <= 0) {
    stack.pop();
    render(true);
    toast('Stopped before the first burpee. Nothing saved.');
    return;
  }
  result = r;
  replace('summary');
}

function cancelRun() {
  if (!active) return;
  active.run.stop();
  endRun();
  stack.pop();
  render(true);
}

function saveResult() {
  const r = result;
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
    ...(r.catchUpOf ? { catchUpOf: r.catchUpOf } : {}),
  });
  result = null;
  resetTo('home');
  toast('Saved');
}

function specFromWorkout(w) {
  return {
    workoutId: w.id,
    type: w.type,
    typeName: w.type === 'other' ? (w.typeName || 'Other') : undefined,
    count: w.count,
    pace: w.pace,
    title: workoutTitle(w),
  };
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

// ------------------------------------------------------------------ updates
// When the app comes back to the screen, check for a new deploy. Reload right
// away on a calm screen; otherwise wait until the next return to Home.
let updateReady = false;
const CALM_SCREENS = ['home', 'settings', 'detail', 'howto'];

async function checkForUpdate() {
  if (updateReady || !(await backup.updateAvailable())) return;
  updateReady = true;
  if (!active && CALM_SCREENS.includes(top().name)) location.reload();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !active) checkForUpdate();
  if (!active) return;
  if (document.hidden) {
    // Leaving the app pauses the workout so no time or beeps are lost.
    if (active.run.state === 'countdown' || active.run.state === 'running') pauseRun();
  } else {
    setWakeLock(true);
  }
});

// ------------------------------------------------------------------ actions
const clampPace = (p) => Math.min(60, Math.max(2, Math.round(p * 2) / 2));

const actions = {
  tab: (el) => resetTo(el.dataset.tab),
  back: () => handleBack(),
  open: (el) => go('detail', { id: el.dataset.id }),
  start: (el) => {
    const w = store.getWorkout(el.dataset.id);
    if (w) startRun(specFromWorkout(w));
  },
  new: () => {
    editorDraft = { type: 'standard', typeName: '', count: 20, pace: 15 };
    go('editor', { isNew: true });
  },
  edit: (el) => {
    editorDraft = { ...store.getWorkout(el.dataset.id) };
    go('editor', { isNew: false });
  },
  howto: (el) => go('howto', { type: el.dataset.type }),

  // editor
  'draft-type': (el) => {
    const type = el.dataset.type;
    if (top().params.isNew && !editorDraft.paceTouched) editorDraft.pace = TYPES[type].defaultPace;
    editorDraft.type = type;
    render();
    if (type === 'other' && !editorDraft.typeName) document.getElementById('draft-name')?.focus();
  },
  'draft-count': (el) => { editorDraft.count = Number(el.dataset.value); render(); },
  'draft-count-step': (el) => {
    editorDraft.count = Math.min(500, Math.max(1, editorDraft.count + Number(el.dataset.step)));
    render();
  },
  'draft-pace-step': (el) => {
    editorDraft.pace = clampPace(editorDraft.pace + Number(el.dataset.step));
    editorDraft.paceTouched = true;
    render();
  },
  'save-workout': () => {
    const { paceTouched, ...w } = editorDraft;
    if (w.type === 'other') w.typeName = (w.typeName || '').trim() || 'Other';
    else delete w.typeName;
    store.saveWorkout(w);
    const isNew = top().params.isNew;
    editorDraft = null;
    if (isNew) resetTo('home');
    else { stack.pop(); render(true); }
    toast('Workout saved');
  },
  'delete-workout': () => {
    if (!confirm(`Delete "${workoutTitle(editorDraft)}"? Past sessions stay in your history.`)) return;
    store.deleteWorkout(editorDraft.id);
    editorDraft = null;
    resetTo('home');
    toast('Workout deleted');
  },

  // catch-up
  catchup: (el) => {
    const s = store.sessions().find((x) => x.id === el.dataset.id);
    if (!s) return;
    const left = store.remaining(s);
    const w = { type: s.type, typeName: s.typeName };
    startRun({
      workoutId: s.workoutId,
      type: s.type,
      typeName: s.typeName,
      count: left,
      pace: s.pace,
      title: `${workoutTitle(w, left)} · catch-up`,
      catchUpOf: s.id,
      isCatchUp: true,
    });
  },
  'dismiss-catchup': (el) => { store.dismissCatchUp(el.dataset.id); render(); },

  // run
  'skip-countdown': () => { audio.unlock(); active?.run.skipCountdown(); },
  'cancel-run': () => cancelRun(),
  pause: () => pauseRun(),
  resume: () => resumeRun(),
  stop: () => stopRun(),
  mute: () => { audio.setMuted(!audio.isMuted()); render(); },

  // summary
  'done-step': (el) => {
    result.done = Math.min(result.target, Math.max(0, result.done + Number(el.dataset.step)));
    render();
  },
  'save-session': () => { if (result.done > 0) saveResult(); },
  'discard-session': () => {
    if (!confirm('Discard this workout? It will not be saved.')) return;
    result = null;
    resetTo('home');
  },

  // settings
  'set-countdown': (el) => { store.updateSettings({ countdown: Number(el.dataset.value) }); render(); },
  'set-catchup': (el) => { store.updateSettings({ catchUpUntil: el.dataset.value }); render(); },
  'toggle-awake': () => { store.updateSettings({ keepAwake: !store.settings().keepAwake }); render(); },
  'test-beep': () => { audio.unlock(); audio.play('beep'); },
  install: () => backup.promptInstall(),
  export: async () => {
    const how = await backup.exportBackup();
    if (how === 'cancelled') return;
    render();
    toast(how === 'shared' ? 'Backup ready' : 'Backup downloaded');
  },
  import: async () => {
    let data;
    try {
      data = await backup.pickBackup();
    } catch (err) {
      alert(err.message);
      return;
    }
    if (!data) return;
    const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'unknown date';
    const msg = `Replace everything on this phone with this backup?

Backup from ${when}: ` +
      `${data.workouts.length} workouts, ${data.sessions.length} sessions.`;
    if (!confirm(msg)) return;
    store.importData(data);
    audio.setVolume(store.settings().volume);
    resetTo('home');
    toast('Backup restored');
  },
  reset: () => {
    if (!confirm('Delete all workouts and history on this phone? This cannot be undone.')) return;
    store.resetAll();
    audio.setVolume(store.settings().volume);
    resetTo('home');
    toast('All data reset');
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el);
});

app.addEventListener('keydown', (e) => {
  const el = e.target.closest('[role="button"][data-action]');
  if (el && (e.key === 'Enter' || e.key === ' ') && e.target === el) {
    e.preventDefault();
    actions[el.dataset.action]?.(el);
  }
});

// ------------------------------------------------------------------ start
audio.setVolume(store.settings().volume);
backup.watchInstall(() => { if (top().name === 'settings') render(); });
backup.registerServiceWorker();
backup.initVersion();
render();
