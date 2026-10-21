// Data saved on the phone only (localStorage), held in one VanX reactive
// object. Screens read it directly and update themselves when it changes;
// a single van.derive writes it back to storage after every change.
//
// VanX gotcha: adding a NEW key to an existing object doesn't wake up code
// that read the (missing) key before. To add a field, replace the object
// (see dismissCatchUp, pickChallenge) instead of `obj.newKey = value`.

import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import { sameDay } from './format.js';
import { weekStart, addDays } from './stats.js';
import { weekKind } from './plan.js';

const KEY = 'burpee-interval-timer:v1';

const DEFAULT_SETTINGS = {
  countdown: 5,        // seconds of "get ready"
  volume: 0.8,
  keepAwake: true,
  catchUpUntil: 'endOfDay', // endOfDay | untilDone
  lastBackupAt: null,
  goalType: 'burpees', // burpees | minutes | both
  goalBurpees: 150,
  goalMinutes: 30,
  weekStartsOn: 1,     // 1 = Monday, 0 = Sunday
  recoveryEvery: 4,    // remind after N training weeks; 0 = off
  recoveryPct: 55,     // recovery-week goal, % of the normal goal
  painCheck: true,     // ask "Anything hurting?" after a Hard rating
  soundTheme: 'beep',  // beep | clave | soft (see audio.js THEMES)
  prewarn: false,      // quiet ticks 2 s and 1 s before each burpee (paces of 8 s or slower)
  mixWithMusic: false, // iPhone: let music keep playing (then the Silent switch mutes beeps)
};

const DEFAULT_UI = {
  recoveryDismissedWeek: null, // "Not this week" on the recovery reminder
  welcomeSeenFor: null,        // last session id the Welcome back screen was shown for
  reviewedWeek: null,          // week start of the last Monday review shown
};

function seed() {
  const now = Date.now();
  return {
    version: 1,
    workouts: [
      { id: uid(), type: 'standard', count: 40, pace: 15, createdAt: now },
      { id: uid(), type: 'sixcount', count: 20, pace: 12, createdAt: now + 1 },
      { id: uid(), type: 'seal', count: 5, pace: 30, createdAt: now + 2 },
    ],
    sessions: [],
    periods: [],
    plan: { days: [], cue: '' },  // planned weekdays (0 = Sunday) and the cue, from the Monday review
    challenges: {},               // { '2026-10': { kind, target, type?, title } }
    settings: { ...DEFAULT_SETTINGS },
    ui: { ...DEFAULT_UI },
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Sound styles from earlier versions (drum, glass, chime, pop, classic) map to the current default.
const SOUND_THEMES = ['beep', 'clave', 'soft'];
const soundFix = (s) => (s && !SOUND_THEMES.includes(s.soundTheme) ? { soundTheme: 'beep' } : {});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        version: 1,
        workouts: parsed.workouts || [],
        sessions: parsed.sessions || [],
        periods: parsed.periods || [],
        plan: { days: [], cue: '', ...parsed.plan },
        challenges: parsed.challenges || {},
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings, ...soundFix(parsed.settings) },
        ui: { ...DEFAULT_UI, ...parsed.ui },
      };
    }
  } catch (err) {
    console.warn('Could not read saved data', err);
  }
  return seed();
}

export const data = vanX.reactive(load());

// Persist on every change (VanX batches changes, so this runs once per update).
van.derive(() => {
  const json = JSON.stringify(vanX.compact(data));
  try {
    localStorage.setItem(KEY, json);
  } catch (err) {
    console.warn('Could not save data', err);
  }
});

// ---- settings
export const settings = () => data.settings;
export function updateSettings(patch) {
  Object.assign(data.settings, patch);
}

// ---- workouts (kept in creation order)
export const getWorkout = (id) => data.workouts.find((w) => w.id === id);

export function saveWorkout(w) {
  const existing = getWorkout(w.id);
  if (existing) Object.assign(existing, w, { updatedAt: Date.now() });
  else data.workouts.push({ ...w, id: uid(), createdAt: Date.now() });
}

// Apply a "make it harder" suggestion and remember it for the weekly cap.
export function bumpWorkout(id, option) {
  const w = getWorkout(id);
  if (!w) return;
  w[option.change] = option.to;
  w.bumps = [...(w.bumps || []).filter((b) => b.at > Date.now() - 30 * 864e5), { at: Date.now(), pct: option.pct }];
}

export function deleteWorkout(id) {
  vanX.replace(data.workouts, (list) => list.filter((w) => w.id !== id));
}

// ---- sessions
// { id, workoutId, type, typeName, target, pace, done, startedAt, endedAt,
//   activeSec, pausedSec, catchUpOf?, dismissed? }
export const sessions = () => [...data.sessions].sort((a, b) => b.startedAt - a.startedAt);

export function addSession(s) {
  const session = { ...s, id: uid() };
  data.sessions.push(session);
  return session;
}

export function sessionsFor(workoutId) {
  return sessions().filter((s) => s.workoutId === workoutId && !s.catchUpOf);
}

export function catchUpsOf(sessionId) {
  return data.sessions.filter((s) => s.catchUpOf === sessionId);
}

// Burpees still missing from a stopped-early session (after any catch-ups).
export function remaining(session) {
  const caught = catchUpsOf(session.id).reduce((n, s) => n + s.done, 0);
  return Math.max(0, session.target - session.done - caught);
}

// Stopped-early sessions that can still be caught up, newest first.
export function openCatchUps(now = Date.now()) {
  const untilDone = data.settings.catchUpUntil === 'untilDone';
  return sessions().filter((s) =>
    !s.catchUpOf && !s.dismissed && s.done < s.target && remaining(s) > 0 &&
    (untilDone || sameDay(s.startedAt, now)));
}

export function dismissCatchUp(sessionId) {
  const i = data.sessions.findIndex((x) => x.id === sessionId);
  if (i >= 0) data.sessions[i] = { ...vanX.compact(data.sessions[i]), dismissed: true };
}

// Deletes a session and any catch-ups linked to it.
export function deleteSession(sessionId) {
  vanX.replace(data.sessions, (list) => list.filter((s) => s.id !== sessionId && s.catchUpOf !== sessionId));
}

// ---- recovery weeks, breaks, restart ramps (see plan.js)
const sd = () => data.settings.weekStartsOn;

export const thisWeek = (now = Date.now()) => weekKind(weekStart(now, sd()), data.periods, now);

export function activeBreak(now = Date.now()) {
  return data.periods.find((p) => p.kind === 'break' && p.start <= now && (p.end == null || p.end > now)) || null;
}

export function startRecovery(now = Date.now()) {
  const start = weekStart(now, sd());
  data.periods.push({ kind: 'recovery', start, end: addDays(start, 7), pct: data.settings.recoveryPct });
}

export function endRecovery(now = Date.now()) {
  const p = data.periods.find((x) => x.kind === 'recovery' && x.start <= now && x.end > now);
  if (p) p.end = now;
}

// weeks: 1, 2 or null ("until I'm back")
export function startBreak(reason, weeks, now = Date.now()) {
  data.periods.push({ kind: 'break', reason, start: now, end: weeks ? addDays(now, 7 * weeks) : null });
}

export function endBreak(now = Date.now()) {
  const p = activeBreak(now);
  if (p) p.end = now;
  return p;
}

export function startRamp(factors, now = Date.now()) {
  data.periods.push({ kind: 'ramp', start: weekStart(now, sd()), factors });
}

export function dismissRecoveryReminder(now = Date.now()) {
  data.ui.recoveryDismissedWeek = weekStart(now, sd());
}

export function markWelcomeSeen(sessionId) {
  data.ui.welcomeSeenFor = sessionId;
}

// ---- Monday review, weekly plan, monthly challenge
export function markReviewed(now = Date.now()) {
  data.ui.reviewedWeek = weekStart(now, sd());
}

export function savePlan(days, cue) {
  data.plan.days = [...days].sort();
  data.plan.cue = cue.trim();
}

export function pickChallenge(key, challenge) {
  data.challenges = { ...vanX.compact(data.challenges), [key]: { ...challenge } };
}

export function resetAll() {
  vanX.replace(data, seed());
}

// ---- backup
export function exportData() {
  return JSON.stringify({ app: 'burpee-interval-timer', exportedAt: new Date().toISOString(), ...vanX.compact(data) }, null, 2);
}

export function markBackedUp() {
  data.settings.lastBackupAt = Date.now();
}

// Validates a backup file's text; throws with a readable message if it's wrong.
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a backup (not valid JSON).');
  }
  if (parsed?.app !== 'burpee-interval-timer' || !Array.isArray(parsed.workouts) || !Array.isArray(parsed.sessions)) {
    throw new Error('This file is not a Burpee Timer backup.');
  }
  if (parsed.version > 1) throw new Error('This backup is from a newer version of the app. Update the app first.');
  const okWorkout = (w) => w && typeof w.id === 'string' && typeof w.type === 'string' && w.count > 0 && w.pace > 0;
  const okSession = (s) => s && typeof s.id === 'string' && typeof s.done === 'number' && typeof s.target === 'number' && s.startedAt;
  if (!parsed.workouts.every(okWorkout) || !parsed.sessions.every(okSession)) {
    throw new Error('This backup looks damaged. Nothing was changed.');
  }
  return parsed;
}

export function importData(backup) {
  vanX.replace(data, {
    version: 1,
    workouts: backup.workouts,
    sessions: backup.sessions,
    periods: backup.periods || [],
    plan: { days: [], cue: '', ...backup.plan },
    challenges: backup.challenges || {},
    settings: { ...DEFAULT_SETTINGS, ...backup.settings },
    ui: { ...DEFAULT_UI, ...backup.ui },
  });
}
