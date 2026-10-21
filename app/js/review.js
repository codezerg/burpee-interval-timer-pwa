// Monday review of last week, monthly challenges and the Year in Burpees.
// Pure functions over sessions (proposal 2.6 f and h).

import { TYPES } from './types.js';
import { weekStart, addDays, summarize, inRange, minutes } from './stats.js';
import { weekGoal, streakInfo } from './plan.js';
import { testPassed } from './levels.js';

const DAY = 864e5;

// ------------------------------------------------------------------ Monday review
// Status words never guilt: a lower week is "Resting", not "missed".
export function weekReview(sessions, periods, settings, now = Date.now()) {
  const sd = settings.weekStartsOn;
  const ws = addDays(weekStart(now, sd), -7);
  const week = weekGoal(sessions, ws, periods, settings, now);
  const prev = [1, 2, 3, 4].map((i) => summarize(inRange(sessions, addDays(ws, -7 * i), addDays(ws, -7 * (i - 1)))).burpees);
  const active = prev.filter((n) => n > 0);
  const avg = active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : null;
  const total = week.sum.burpees;
  const pct = avg ? Math.round(((total - avg) / avg) * 100) : null;
  let status;
  if (week.kind === 'recovery' || week.kind === 'break' || total === 0) status = 'resting';
  else if (pct == null || pct >= 5) status = 'building';
  else if (pct > -15 || week.goal.hit) status = 'holding';
  else status = 'resting';
  const streak = streakInfo(sessions, periods, settings, now).streak;
  return {
    start: ws, end: addDays(ws, 7), kind: week.kind, total, avg, pct, status,
    goalHit: week.goal.hit, workouts: week.sum.workouts, minutes: minutes(week.sum), streak,
    highlight: highlight(sessions, ws, sd),
  };
}

// The nicest true thing about last week.
function highlight(sessions, ws, sd) {
  const we = addDays(ws, 7);
  const week = inRange(sessions, ws, we);
  const before = sessions.filter((s) => s.startedAt < ws);
  const passed = week.find((s) => s.levelTest && testPassed(s));
  if (passed) return `Passed ${TYPES[passed.levelTest.type].name} level ${passed.levelTest.level}`;
  for (const t of ['seal', 'sixcount', 'standard']) {
    const first = week.find((s) => s.type === t);
    if (first && !before.some((s) => s.type === t)) {
      const n = week.filter((s) => s.type === t).reduce((a, s) => a + s.done, 0);
      return `First ${TYPES[t].name} burpees: ${n} done`;
    }
  }
  const total = summarize(week).burpees;
  const bestBefore = Math.max(0, ...weeklyTotals(before, sd));
  if (total > 0 && total > bestBefore && before.length) return `Best week ever: ${total} burpees`;
  if (!week.length) return null;
  const byDay = new Map();
  for (const s of week) {
    const d = new Date(s.startedAt).toDateString();
    byDay.set(d, (byDay.get(d) || 0) + s.done);
  }
  const [day, n] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  return `Biggest day: ${new Date(day).toLocaleDateString([], { weekday: 'long' })}, ${n} burpees`;
}

function weeklyTotals(sessions, sd) {
  const m = new Map();
  for (const s of sessions) {
    const k = weekStart(s.startedAt, sd);
    m.set(k, (m.get(k) || 0) + s.done);
  }
  return [...m.values()];
}

// ------------------------------------------------------------------ monthly challenge
export const monthKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function monthRange(ts) {
  const d = new Date(ts);
  return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
}

const round = (n, step) => Math.max(step, Math.round(n / step) * step);

// Challenges to pick from, sized from the weekly goal.
export function challengeOptions(settings) {
  const monthBurpees = round(settings.goalBurpees * 4.3, 50);
  return [
    { kind: 'goalWeeks', target: 3, title: 'Hit your weekly goal 3 times' },
    { kind: 'burpees', target: monthBurpees, title: `${monthBurpees} burpees this month` },
    { kind: 'workouts', target: 12, title: '12 workouts this month' },
    { kind: 'type', type: 'seal', target: 100, title: 'Navy SEAL month: 100 SEALs' },
    { kind: 'type', type: 'sixcount', target: 300, title: '6-count month: 300 6-counts' },
  ];
}

// Progress of a challenge within its month.
export function challengeProgress(ch, sessions, periods, settings, monthStart, now = Date.now()) {
  const { end } = monthRange(monthStart);
  const list = inRange(sessions, monthStart, end);
  let value;
  if (ch.kind === 'goalWeeks') {
    // Weeks that end inside this month and hit their goal.
    value = 0;
    for (let ws = weekStart(monthStart, settings.weekStartsOn); ws < end; ws = addDays(ws, 7)) {
      const we = addDays(ws, 7);
      if (we <= monthStart || we > end) continue;
      if (weekGoal(sessions, ws, periods, settings, now).goal.hit) value += 1;
    }
  } else if (ch.kind === 'burpees') value = summarize(list).burpees;
  else if (ch.kind === 'workouts') value = list.length;
  else value = list.filter((s) => s.type === ch.type).reduce((a, s) => a + s.done, 0);
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
  return { value, target: ch.target, done: value >= ch.target, pct: Math.min(1, value / ch.target), daysLeft };
}

// ------------------------------------------------------------------ Year in Burpees
export function yearRecap(sessions, periods, settings, year) {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const list = inRange(sessions, start, end);
  const sum = summarize(list);
  const months = Array.from({ length: 12 }, (_, m) =>
    summarize(inRange(list, new Date(year, m, 1).getTime(), new Date(year, m + 1, 1).getTime())).burpees);
  const bestMonth = months.indexOf(Math.max(...months));
  const weeks = new Map();
  for (const s of list) {
    const k = weekStart(s.startedAt, settings.weekStartsOn);
    weeks.set(k, (weeks.get(k) || 0) + s.done);
  }
  const [bestWeekStart, bestWeek] = [...weeks.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const favourite = Object.entries(sum.byType).sort((a, b) => b[1] - a[1])[0];
  const days = new Set(list.map((s) => new Date(s.startedAt).toDateString())).size;
  const streak = streakInfo(sessions.filter((s) => s.startedAt < end), periods, settings, Math.min(Date.now(), end - 1));
  return {
    year, burpees: sum.burpees, workouts: sum.workouts, minutes: minutes(sum), days, months,
    bestMonth: sum.burpees ? bestMonth : null, bestWeek, bestWeekStart,
    favourite: favourite && favourite[1] > 0 ? favourite[0] : null,
    byType: sum.byType, bestStreak: streak.best, activeWeeks: weeks.size,
  };
}

// The recap is shown in December and January (for the year that ended).
export function recapYear(now = Date.now()) {
  const d = new Date(now);
  if (d.getMonth() === 11) return d.getFullYear();
  if (d.getMonth() === 0) return d.getFullYear() - 1;
  return null;
}
