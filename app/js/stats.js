// Weekly goal, history series and records. Pure functions over session lists
// (no storage, no DOM) so they can be unit-tested.

import { TYPE_ORDER } from './types.js';

const DAY = 24 * 60 * 60 * 1000;

// Local midnight of the first day of the week containing ts.
// startDay: 1 = Monday, 0 = Sunday.
export function weekStart(ts, startDay = 1) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7));
  return d.getTime();
}

export function dayStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Calendar-safe "add days" (DST days are 23 or 25 hours long).
export function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

function emptyByType() {
  return Object.fromEntries(TYPE_ORDER.map((t) => [t, 0]));
}

export function summarize(sessions) {
  const sum = { burpees: 0, seconds: 0, workouts: 0, byType: emptyByType() };
  for (const s of sessions) {
    sum.burpees += s.done;
    sum.seconds += s.activeSec || 0;
    sum.workouts += 1;
    sum.byType[s.type] = (sum.byType[s.type] || 0) + s.done;
  }
  return sum;
}

export const minutes = (sum) => Math.floor(sum.seconds / 60);

export function inRange(sessions, from, to) {
  return sessions.filter((s) => s.startedAt >= from && s.startedAt < to);
}

// Goal progress for one week's summary. goalType: burpees | minutes | both.
export function goalStatus(sum, settings) {
  const parts = [];
  if (settings.goalType !== 'minutes') {
    parts.push({ unit: 'burpees', value: sum.burpees, target: settings.goalBurpees });
  }
  if (settings.goalType !== 'burpees') {
    parts.push({ unit: 'min', value: minutes(sum), target: settings.goalMinutes });
  }
  for (const p of parts) p.pct = p.target > 0 ? Math.min(1, p.value / p.target) : 1;
  return { parts, hit: parts.every((p) => p.value >= p.target) };
}

// Last `count` weeks, oldest first; the last one is the current week.
export function weeklySeries(sessions, { count = 8, now = Date.now(), startDay = 1 } = {}) {
  const current = weekStart(now, startDay);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const end = addDays(start, 7);
    out.push({ start, end, sum: summarize(inRange(sessions, start, end)) });
  }
  return out;
}

// The 7 days of the week that starts at weekStartTs.
export function dailySeries(sessions, weekStartTs) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const start = addDays(weekStartTs, i);
    const end = addDays(start, 1);
    out.push({ start, end, sum: summarize(inRange(sessions, start, end)) });
  }
  return out;
}

// Last `count` calendar months, oldest first.
export function monthlySeries(sessions, { count = 12, now = Date.now() } = {}) {
  const d = new Date(now);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
    out.push({ start, end, sum: summarize(inRange(sessions, start, end)) });
  }
  return out;
}

export const DAY_MS = DAY;
