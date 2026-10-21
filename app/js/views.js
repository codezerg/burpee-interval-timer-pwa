// Screen templates. Each returns an HTML string; main.js wires up the actions
// through data-action attributes.

import { TYPES, TYPE_ORDER, typeName, workoutTitle } from './types.js';
import { clock, duration, pace, dayLabel, longDate, esc } from './format.js';
import * as store from './store.js';

const icon = {
  play: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  playBig: '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  pauseSmall: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  stop: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  sound: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
  muted: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
  plus: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  info: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.5"/></svg>',
  check: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  redo: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
  home: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  settings: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9"/><path d="M19 6h1"/><circle cx="16" cy="6" r="2.5"/><path d="M4 12h3"/><path d="M13 12h7"/><circle cx="10" cy="12" r="2.5"/><path d="M4 18h11"/><circle cx="18" cy="18" r="2.5"/></svg>',
};

function badge(w) {
  const t = TYPES[w.type];
  return `<div class="badge" style="background:${t.tint};color:${t.ink}">${t.badge}</div>`;
}

function nav(active) {
  const tab = (id, label) =>
    `<button data-action="tab" data-tab="${id}" ${active === id ? 'aria-current="page"' : ''}>${icon[id]}${label}</button>`;
  return `<nav class="nav" aria-label="Main">${tab('home', 'Home')}${tab('settings', 'Settings')}</nav>`;
}

// ------------------------------------------------------------------ Home
export function home() {
  const list = store.workouts();
  const catchUps = store.openCatchUps().slice(0, 2);

  const catchUpCards = catchUps.map((s) => {
    const left = store.remaining(s);
    const w = { type: s.type, typeName: s.typeName };
    return `
    <section class="catchup" aria-label="Catch up">
      <div class="row" style="align-items:flex-start">
        <div class="icon">${icon.redo}</div>
        <div class="stack" style="gap:2px">
          <span style="font-weight:600;font-size:15px">${left} left from ${esc(workoutTitle(w, s.target))}</span>
          <span class="small" style="color:#6B4A1F">You stopped at ${s.done} / ${s.target} · ${esc(dayLabel(s.startedAt))}</span>
        </div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn small grow" data-action="catchup" data-id="${s.id}">Catch up · ${duration(left * s.pace)}</button>
        <button class="btn small ghost warm" data-action="dismiss-catchup" data-id="${s.id}">Dismiss</button>
      </div>
    </section>`;
  }).join('');

  const cards = list.map((w) => `
    <div class="workout" role="button" tabindex="0" data-action="open" data-id="${w.id}">
      ${badge(w)}
      <div class="meta">
        <span class="name">${esc(workoutTitle(w))}</span>
        <span class="small muted">Every ${pace(w.pace)} · ${duration(w.count * w.pace)}</span>
      </div>
      <button class="play" data-action="start" data-id="${w.id}" aria-label="Start ${esc(workoutTitle(w))}">${icon.play}</button>
    </div>`).join('');

  return `
  <main class="screen with-nav">
    <div>
      <span class="small muted" style="font-weight:500">${esc(longDate())}</span>
      <h1>Burpees</h1>
    </div>
    ${catchUpCards}
    <div class="between" style="padding-top:4px">
      <h2>My workouts</h2>
      <span class="small muted">${list.length}</span>
    </div>
    <div class="stack">
      ${cards || '<div class="empty">No workouts yet.<br>Tap + to create one.</div>'}
    </div>
  </main>
  <button class="fab" data-action="new" aria-label="New workout">${icon.plus}</button>
  ${nav('home')}`;
}

// ------------------------------------------------------------------ Workout detail
export function detail(w) {
  const all = store.sessionsFor(w.id);
  const recent = all.slice(0, 8).map((s) => {
    const caught = store.catchUpsOf(s.id).reduce((n, c) => n + c.done, 0);
    const total = s.done + caught;
    let right;
    if (total >= s.target) {
      right = `<span class="digits" style="font-size:24px">${total} / ${s.target}</span>`;
    } else {
      right = `<div class="stack" style="align-items:flex-end;gap:4px">
        <span class="digits" style="font-size:24px">${total} / ${s.target}</span>
        <span class="pill partial">Partial</span></div>`;
    }
    const sub = caught ? `${s.done} + ${caught} catch-up · every ${pace(s.pace)}` : `${duration(s.activeSec)} · every ${pace(s.pace)}`;
    return `<div class="list-item">
      <div class="stack" style="gap:3px">
        <span class="small muted">${esc(dayLabel(s.startedAt))}</span>
        <span class="small">${esc(sub)}</span>
      </div>${right}</div>`;
  }).join('');

  return `
  <main class="screen white">
    <div class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Back">${icon.back}</button>
      <button class="text-btn accent" data-action="edit" data-id="${w.id}">Edit</button>
    </div>
    <div class="stack" style="gap:8px">
      ${badge(w)}
      <h1>${esc(workoutTitle(w))}</h1>
      <div><button class="chip" data-action="howto" data-type="${w.type}">How to do it ${icon.info}</button></div>
    </div>
    <div class="stats">
      <div><span class="label">Burpees</span><span class="digits">${w.count}</span></div>
      <div><span class="label">Pace</span><span class="digits">${pace(w.pace)}</span></div>
      <div><span class="label">Duration</span><span class="digits">${duration(w.count * w.pace)}</span></div>
    </div>
    <div class="between">
      <h2>Recent</h2>
      <span class="small muted">Done ${all.length} ${all.length === 1 ? 'time' : 'times'}</span>
    </div>
    <div>${recent || '<div class="small muted">Not done yet. Your first one starts below.</div>'}</div>
    <div class="grow"></div>
    <button class="btn block" data-action="start" data-id="${w.id}">${icon.play} START</button>
  </main>`;
}

// ------------------------------------------------------------------ Editor
export function editor(draft, isNew) {
  const t = TYPES[draft.type];
  const typeButtons = TYPE_ORDER.map((id) => `
    <button class="type-btn" data-action="draft-type" data-type="${id}" aria-pressed="${draft.type === id}">
      <span class="dot" style="background:${TYPES[id].color}"></span>${TYPES[id].name}
    </button>`).join('');
  const chips = [10, 20, 30, 40].map((n) =>
    `<button data-action="draft-count" data-value="${n}" aria-pressed="${draft.count === n}">${n}</button>`).join('');

  return `
  <main class="screen white">
    <div class="topbar">
      <button class="text-btn" data-action="back">Cancel</button>
      <span class="title">${isNew ? 'New workout' : 'Edit workout'}</span>
      <button class="text-btn accent" data-action="save-workout">Save</button>
    </div>

    <div class="card flat" style="background:var(--bg);border:none">
      <div class="stack" style="gap:4px">
        <span style="font-size:20px;font-weight:700" id="draft-title">${esc(workoutTitle(draft))}</span>
        <span class="small muted">Every ${pace(draft.pace)} · total ${duration(draft.count * draft.pace)}</span>
      </div>
    </div>

    <div class="stack">
      <span class="eyebrow">Burpee type</span>
      <div class="types">${typeButtons}</div>
      ${draft.type === 'other' ? `
        <label class="field">Name of your variation
          <input type="text" id="draft-name" maxlength="30" placeholder="e.g. No push-up" value="${esc(draft.typeName || '')}">
        </label>` : `
        <div class="howto">
          ${esc(t.summary)} ${esc(t.pace)}
          <div style="margin-top:6px"><a href="#" data-action="howto" data-type="${draft.type}">Full how-to ›</a></div>
        </div>`}
    </div>

    <div class="stack">
      <div class="between">
        <span class="eyebrow">Burpees</span>
        <div class="stepper">
          <button data-action="draft-count-step" data-step="-1" aria-label="One less burpee" ${draft.count <= 1 ? 'disabled' : ''}>−</button>
          <span class="value">${draft.count}</span>
          <button data-action="draft-count-step" data-step="1" aria-label="One more burpee" ${draft.count >= 500 ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="chips">${chips}</div>
    </div>

    <div class="stack">
      <div class="between">
        <div class="stack" style="gap:2px">
          <span class="eyebrow">Seconds per burpee</span>
          <span class="small muted">Beginner 15 s · fit 4–5 s</span>
        </div>
        <div class="stepper">
          <button data-action="draft-pace-step" data-step="-0.5" aria-label="Faster pace" ${draft.pace <= 2 ? 'disabled' : ''}>−</button>
          <span class="value">${draft.pace}</span>
          <button data-action="draft-pace-step" data-step="0.5" aria-label="Slower pace" ${draft.pace >= 60 ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>

    <div class="between card flat">
      <span style="font-weight:600">Total time</span>
      <span class="digits" style="font-size:30px">${duration(draft.count * draft.pace)}</span>
    </div>

    ${isNew ? '' : '<button class="btn danger" data-action="delete-workout">Delete workout</button>'}
  </main>`;
}

// ------------------------------------------------------------------ How-to
export function howto(typeId) {
  const t = TYPES[typeId];
  const extra = [
    t.pace && `<p style="margin:0"><b>Pace.</b> ${esc(t.pace)}</p>`,
    t.easier && `<p style="margin:0"><b>Easier.</b> ${esc(t.easier)}</p>`,
    t.mistakes && `<p style="margin:0"><b>Common mistakes.</b> ${esc(t.mistakes)}</p>`,
  ].filter(Boolean).join('');
  return `
  <main class="screen white">
    <div class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Back">${icon.back}</button>
      <span></span>
    </div>
    <div class="stack" style="gap:6px">
      <span class="eyebrow" style="color:${t.ink}">How to do it</span>
      <h1>${t.name} burpee</h1>
      <span class="muted">${esc(t.summary)}</span>
    </div>
    ${t.steps.length ? `<ol class="steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
      : '<p class="muted">Your own variation. Do it the same way every time so your progress compares fairly.</p>'}
    <div class="howto stack" style="gap:8px">${extra}</div>
  </main>`;
}

// ------------------------------------------------------------------ Countdown
export function countdown(title, seconds) {
  return `
  <main class="screen white">
    <div class="countdown">
      <span class="eyebrow">Get ready</span>
      <h2 style="font-size:20px">${esc(title)}</h2>
      <span class="big" id="cd-num">${seconds}</span>
    </div>
    <div class="stack">
      <button class="btn block" data-action="skip-countdown">Start now</button>
      <button class="btn plain block" data-action="cancel-run">Cancel</button>
    </div>
  </main>`;
}

// ------------------------------------------------------------------ Run (running + paused)
const BIG_C = 2 * Math.PI * 118;
const SMALL_C = 2 * Math.PI * 58;
export const RING = { BIG_C, SMALL_C };

export function run({ title, count, paceSec, total, paused, muted }) {
  return `
  <main class="screen white run ${paused ? 'is-paused' : ''}">
    <div class="run-top">
      <div><span class="label">Elapsed</span><span class="digits" id="r-elapsed">00:00</span></div>
      <div><span class="label">Burpee</span><span class="digits" id="r-burpee">0 / ${count}</span></div>
      <div><span class="label">Pace</span><span class="digits">${pace(paceSec)}</span></div>
    </div>

    <div class="run-mid">
      ${paused
        ? `<span class="paused-pill">${icon.pauseSmall} PAUSED · <span id="r-paused">0:00</span></span>`
        : `<button class="chip" data-action="howto" data-type="${title.type}">${esc(title.text)} ${icon.info}</button>`}

      <div class="ring ring-big">
        <svg viewBox="0 0 260 260" aria-hidden="true">
          <circle cx="130" cy="130" r="118" fill="none" stroke="#F0F0F2" stroke-width="14"/>
          <circle class="bar" id="r-big" cx="130" cy="130" r="118" fill="none" stroke="#1B1B1F" stroke-width="14" stroke-linecap="round"
            stroke-dasharray="${BIG_C.toFixed(1)}" stroke-dashoffset="${BIG_C.toFixed(1)}" transform="rotate(-90 130 130)"/>
        </svg>
        <div class="center">
          <span class="eyebrow" style="font-weight:600">Total time left</span>
          <span class="digits" id="r-left">${clock(total)}</span>
          <span class="small muted">of ${duration(total)}${paused ? ' · frozen' : ''}</span>
        </div>
      </div>

      <div class="row" style="gap:16px">
        <div class="ring ring-small">
          <svg viewBox="0 0 132 132" aria-hidden="true">
            <circle cx="66" cy="66" r="58" fill="${paused ? '#FFFFFF' : '#FFF8EE'}" stroke="${paused ? '#E8E8EC' : '#FBE3C2'}" stroke-width="10"/>
            <circle class="bar" id="r-small" cx="66" cy="66" r="58" fill="none" stroke="#F28C00" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${SMALL_C.toFixed(1)}" stroke-dashoffset="${SMALL_C.toFixed(1)}" transform="rotate(-90 66 66)"/>
          </svg>
          <div class="center">
            <span class="digits" id="r-sec">${Math.ceil(paceSec)}</span>
            <span class="small" style="font-weight:600;color:${paused ? 'var(--muted)' : '#6B4A1F'}">sec</span>
          </div>
        </div>
        <div class="stack" style="gap:2px;max-width:170px">
          ${paused
            ? `<span class="eyebrow" style="font-weight:600">Take a breath</span>
               <span style="font-size:17px;font-weight:700" id="r-done">0 done · ${count} to go</span>
               <span class="small muted">Pause time isn’t counted.</span>`
            : `<span class="eyebrow" style="font-weight:600">This burpee</span>
               <span style="font-size:17px;font-weight:700" id="r-next">Next beep in ${Math.ceil(paceSec)} s</span>
               <span class="small muted">Rest until the beep</span>`}
        </div>
      </div>
    </div>

    <div class="run-bottom">
      <div>
        <button class="icon-btn" data-action="mute" aria-pressed="${muted}" aria-label="${muted ? 'Unmute beeps' : 'Mute beeps'}">${muted ? icon.muted : icon.sound}</button>
        ${muted ? 'Muted' : 'Sound'}
      </div>
      <div>
        ${paused
          ? `<button class="main-btn" data-action="resume" aria-label="Resume">${icon.playBig}</button><b style="color:var(--ink)">Resume</b>`
          : `<button class="main-btn" data-action="pause" aria-label="Pause">${icon.pause}</button>Pause`}
      </div>
      <div>
        <button class="icon-btn" data-action="stop" aria-label="Stop and save what I did">${icon.stop}</button>
        ${paused ? 'Stop &amp; save' : 'Stop'}
      </div>
    </div>
  </main>`;
}

// ------------------------------------------------------------------ Summary (complete / stopped early)
export function summary(r) {
  const complete = r.done >= r.target;
  const left = r.target - r.done;
  const title = complete ? 'Workout complete!' : 'Stopped early';
  const sub = complete ? `${esc(r.title)} · every ${pace(r.pace)}` : 'Good effort. What you did counts.';
  return `
  <main class="screen white">
    <div class="done-head">
      <div class="check ${complete ? '' : 'partial'}">${complete ? icon.check : icon.pauseSmall}</div>
      <div class="stack" style="gap:2px">
        <h1 style="font-size:24px">${title}</h1>
        <span class="small muted">${sub}</span>
      </div>
    </div>

    <div class="stats">
      <div><span class="label">Burpees</span><span class="digits">${r.done}${complete ? '' : ` / ${r.target}`}</span></div>
      <div><span class="label">Time</span><span class="digits">${duration(r.activeSec)}</span></div>
      <div><span class="label">${r.pausedSec >= 1 ? 'Paused' : 'Pace'}</span><span class="digits">${r.pausedSec >= 1 ? duration(r.pausedSec) : pace(r.pace)}</span></div>
    </div>

    <div class="between card flat" style="padding:10px 10px 10px 16px">
      <div class="stack" style="gap:2px">
        <span style="font-weight:600">Burpees done</span>
        <span class="small muted">Fix it if you missed some</span>
      </div>
      <div class="stepper">
        <button data-action="done-step" data-step="-1" aria-label="One less" ${r.done <= 0 ? 'disabled' : ''}>−</button>
        <span class="value">${r.done}</span>
        <button data-action="done-step" data-step="1" aria-label="One more" ${r.done >= r.target ? 'disabled' : ''}>+</button>
      </div>
    </div>

    ${!complete && left > 0 && !r.isCatchUp ? `
      <div class="note"><b>${left} left.</b> Home will offer a short catch-up workout with just these ${left} burpees${store.settings().catchUpUntil === 'endOfDay' ? ' until the end of today' : ''}.</div>` : ''}

    <div class="grow"></div>
    <div class="stack" style="gap:8px">
      <button class="btn block" data-action="save-session" ${r.done <= 0 ? 'disabled style="opacity:.5"' : ''}>Save</button>
      <button class="btn plain block" data-action="discard-session">Discard</button>
    </div>
  </main>`;
}

// ------------------------------------------------------------------ Settings
function installBlock(state) {
  if (state === 'installed') {
    return `<div class="between"><span style="font-weight:600">Installed on this phone</span><span class="pill good">✓ Ready offline</span></div>`;
  }
  if (state === 'prompt') {
    return `<div class="between"><span style="font-weight:600">Install as an app</span>
      <button class="btn small" style="height:40px" data-action="install">Install</button></div>`;
  }
  const how = state === 'ios'
    ? 'In Safari, tap the Share button <b>↑</b>, then <b>Add to Home Screen</b>.'
    : 'In Chrome, open the menu <b>⋮</b>, then <b>Add to Home screen</b> or <b>Install app</b>.';
  return `<div class="stack" style="gap:4px"><span style="font-weight:600">Install as an app</span>
    <span class="small muted" style="line-height:1.45">${how} It then opens full screen and works offline.</span></div>`;
}

export function settings({ install, version }) {
  const s = store.settings();
  const lastBackup = s.lastBackupAt
    ? new Date(s.lastBackupAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : 'never';
  const seg = (action, current, options) => `<div class="seg">${options.map(([v, label]) =>
    `<button data-action="${action}" data-value="${v}" aria-pressed="${String(current) === String(v)}">${label}</button>`).join('')}</div>`;
  return `
  <main class="screen with-nav">
    <h1>Settings</h1>

    <span class="group-label">App</span>
    <div class="group">${installBlock(install)}</div>

    <span class="group-label">During workout</span>
    <div class="group">
      <div class="stack">
        <span style="font-weight:600">Get-ready countdown</span>
        ${seg('set-countdown', s.countdown, [[0, 'Off'], [3, '3 s'], [5, '5 s'], [10, '10 s']])}
      </div>
      <div class="stack">
        <div class="between">
          <span style="font-weight:600">Beep volume</span>
          <button class="btn small ghost" style="height:36px;font-size:13px" data-action="test-beep">Test beep</button>
        </div>
        <input type="range" id="volume" min="0.1" max="1" step="0.05" value="${s.volume}" aria-label="Beep volume">
      </div>
      <div class="between">
        <span style="font-weight:600">Keep screen on</span>
        <button class="switch" role="switch" aria-checked="${s.keepAwake}" aria-label="Keep screen on" data-action="toggle-awake"></button>
      </div>
    </div>
    <span class="small muted" style="padding:0 4px;line-height:1.4">iPhone: if you hear no beeps, check the Ring/Silent switch and the volume buttons. Switching to another app pauses the workout.</span>

    <span class="group-label">Catch-up</span>
    <div class="group">
      <div class="stack">
        <span style="font-weight:600">Offer catch-up</span>
        ${seg('set-catchup', s.catchUpUntil, [['endOfDay', 'Until end of day'], ['untilDone', 'Until done']])}
      </div>
    </div>

    <span class="group-label">Data</span>
    <div class="group">
      <button class="text-btn between" style="padding:14px 16px" data-action="export">
        <span>Export backup</span><span class="small muted" style="font-weight:400">Last: ${lastBackup}</span>
      </button>
      <button class="text-btn" style="text-align:left;padding:14px 16px" data-action="import">Import backup</button>
      <button class="text-btn" style="text-align:left;color:var(--danger);padding:14px 16px" data-action="reset">Reset all data</button>
    </div>
    <span class="small muted" style="padding:0 4px;line-height:1.4">Your data is stored only on this phone. Export a backup now and then and keep the file somewhere safe (Files, Drive, email).</span>
    <span class="small muted" style="text-align:center;padding-top:8px">Burpee Timer · version ${esc((version || 'dev').slice(0, 7))}</span>
  </main>
  ${nav('settings')}`;
}

export { typeName };
