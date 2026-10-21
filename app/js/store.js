// Data saved on the phone only (localStorage). One JSON blob, versioned.

import { sameDay } from './format.js';

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
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      parsed.workouts ||= [];
      parsed.sessions ||= [];
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read saved data', err);
  }
  return seed();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not save data', err);
  }
}
save();

// ---- settings
export const settings = () => data.settings;
export function updateSettings(patch) {
  Object.assign(data.settings, patch);
  save();
}

// ---- workouts
export const workouts = () => [...data.workouts].sort((a, b) => a.createdAt - b.createdAt);
export const getWorkout = (id) => data.workouts.find((w) => w.id === id);

export function saveWorkout(w) {
  const existing = getWorkout(w.id);
  if (existing) Object.assign(existing, w, { updatedAt: Date.now() });
  else data.workouts.push({ ...w, id: uid(), createdAt: Date.now() });
  save();
}

export function deleteWorkout(id) {
  data.workouts = data.workouts.filter((w) => w.id !== id);
  save();
}

// ---- sessions
// { id, workoutId, type, typeName, target, pace, done, startedAt, endedAt,
//   activeSec, pausedSec, catchUpOf?, dismissed? }
export const sessions = () => [...data.sessions].sort((a, b) => b.startedAt - a.startedAt);

export function addSession(s) {
  const session = { ...s, id: uid() };
  data.sessions.push(session);
  save();
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

// Deletes a session and any catch-ups linked to it. Returns how many were removed.
export function deleteSession(sessionId) {
  const before = data.sessions.length;
  data.sessions = data.sessions.filter((s) => s.id !== sessionId && s.catchUpOf !== sessionId);
  save();
  return before - data.sessions.length;
}

export function dismissCatchUp(sessionId) {
  const s = data.sessions.find((x) => x.id === sessionId);
  if (s) { s.dismissed = true; save(); }
}

export function resetAll() {
  data = seed();
  save();
}

// ---- backup
export function exportData() {
  return JSON.stringify({ app: 'burpee-interval-timer', exportedAt: new Date().toISOString(), ...data }, null, 2);
}

export function markBackedUp() {
  data.settings.lastBackupAt = Date.now();
  save();
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
  const { app, exportedAt, ...rest } = backup;
  data = {
    version: 1,
    workouts: rest.workouts,
    sessions: rest.sessions,
    settings: { ...DEFAULT_SETTINGS, ...rest.settings },
  };
  save();
}
