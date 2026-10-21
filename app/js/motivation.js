// Motivation: new-record detection, "make it harder" suggestions, badges,
// pace progress and trends. Pure functions over sessions/workouts.

import { TYPES } from './types.js';
import { weekStart, addDays, summarize, inRange } from './stats.js';

const DAY = 864e5;
const isFull = (s) => !s.catchUpOf && s.done >= s.target;
// Sessions saved before pause counting existed: no paused time = no pause.
export const noPause = (s) => (s.pauses != null ? s.pauses === 0 : !s.pausedSec);

// ------------------------------------------------------------------ records
// Best values for one type: most in a session, longest without a pause,
// fastest pace (full workouts only), best week.
export function bests(sessions, type, startDay = 1) {
  const list = sessions.filter((s) => s.type === type);
  const weeks = new Map();
  for (const s of list) {
    const k = weekStart(s.startedAt, startDay);
    weeks.set(k, (weeks.get(k) || 0) + s.done);
  }
  const full = list.filter(isFull);
  const unpaused = full.filter(noPause);
  return {
    count: list.length,
    most: list.length ? Math.max(...list.map((s) => s.done)) : 0,
    noPause: unpaused.length ? Math.max(...unpaused.map((s) => s.done)) : 0,
    fastest: full.length ? Math.min(...full.map((s) => s.pace)) : null,
    bestWeek: weeks.size ? Math.max(...weeks.values()) : 0,
  };
}

// Records broken by `session` compared with the earlier `history`.
export function newRecords(history, session, startDay = 1) {
  const name = `${TYPES[session.type].name}`;
  const before = bests(history, session.type, startDay);
  if (before.count === 0) return [{ kind: 'first', text: `First ${name} workout`, was: null }];
  const after = bests([...history, session], session.type, startDay);
  const out = [];
  // "Without a pause" only counts full workouts, so stopping early isn't a record.
  if (isFull(session) && noPause(session) && session.done > before.noPause) {
    out.push({ kind: 'noPause', text: `${session.done} ${name} burpees without a pause`, was: before.noPause || null });
  }
  if (after.most > before.most) {
    out.push({ kind: 'most', text: `Most ${name} burpees in one workout: ${after.most}`, was: before.most });
  }
  if (after.fastest != null && (before.fastest == null || after.fastest < before.fastest)) {
    out.push({ kind: 'fastest', text: `Fastest ${name} pace: ${after.fastest} s`, was: before.fastest == null ? null : `${before.fastest} s` });
  }
  if (after.bestWeek > before.bestWeek) {
    out.push({ kind: 'bestWeek', text: `Best ${name} week: ${after.bestWeek}`, was: before.bestWeek });
  }
  return out;
}

// ------------------------------------------------------------------ suggestions
export const MAX_WEEKLY_INCREASE = 0.10;

// After a workout: 2x Easy in a row -> offer +1 burpee or -0.5 s pace,
// Hard -> encourage repeating. `previous` = earlier full sessions of this
// workout, newest first. Increases are capped at ~10% per week per workout.
export function suggestion({ workout, feel, previous, reducedWeek, now = Date.now() }) {
  if (!workout || !feel) return null;
  if (feel === 'hard') return { kind: 'repeat' };
  if (feel !== 'easy' || reducedWeek) return null;
  if (previous[0]?.feel !== 'easy') return null;
  const recent = (workout.bumps || []).filter((b) => b.at > now - 7 * DAY).reduce((n, b) => n + b.pct, 0);
  const countPct = 1 / workout.count;
  const pacePct = 0.5 / workout.pace;
  const options = [];
  if (recent + countPct <= MAX_WEEKLY_INCREASE + 1e-9 && workout.count < 500) {
    options.push({ change: 'count', from: workout.count, to: workout.count + 1, pct: countPct });
  }
  if (recent + pacePct <= MAX_WEEKLY_INCREASE + 1e-9 && workout.pace > 2) {
    options.push({ change: 'pace', from: workout.pace, to: workout.pace - 0.5, pct: pacePct });
  }
  return options.length ? { kind: 'harder', options } : { kind: 'capped' };
}

// ------------------------------------------------------------------ badges
const MILESTONES = {
  burpees: [100, 500, 1000, 5000, 10000],
  workouts: [10, 25, 50, 100],
  streak: [4, 8, 12, 26, 52],
};
const TYPE_MILESTONES = [50, 250, 1000];

const short = (n) => (n >= 1000 ? `${n / 1000}k` : String(n));

// Per category: the highest badge earned and the next one with progress.
// Badges are computed from all-time totals, so they can never be lost.
export function badges(sessions, bestStreak) {
  const sum = summarize(sessions);
  const cats = [
    { id: 'burpees', label: 'burpees', value: sum.burpees, steps: MILESTONES.burpees },
    { id: 'workouts', label: 'workouts', value: sum.workouts, steps: MILESTONES.workouts },
    { id: 'streak', label: 'week streak', value: bestStreak, steps: MILESTONES.streak, suffix: ' wk' },
    ...['standard', 'sixcount', 'seal'].map((t) => ({
      id: t, label: `${TYPES[t].name}`, value: sum.byType[t] || 0, steps: TYPE_MILESTONES, type: t,
    })),
  ];
  return cats.map((c) => {
    const earned = c.steps.filter((s) => c.value >= s);
    const next = c.steps.find((s) => c.value < s) ?? null;
    return {
      ...c,
      earned: earned.length ? earned[earned.length - 1] : null,
      earnedCount: earned.length,
      next,
      text: (n) => `${short(n)}${c.suffix || ''}`,
    };
  });
}

// ------------------------------------------------------------------ pace & trends
// Pace progress for one type: first vs latest full workout, plus the best
// pace of each of the last 8 weeks (null for weeks without a full workout).
export function paceProgress(sessions, type, { now = Date.now(), startDay = 1 } = {}) {
  const full = sessions.filter((s) => s.type === type && isFull(s)).sort((a, b) => a.startedAt - b.startedAt);
  if (full.length < 2) return null;
  const first = full[0];
  const current = Math.min(...full.slice(-3).map((s) => s.pace)); // best of the last 3
  const cw = weekStart(now, startDay);
  const points = [];
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(cw, -7 * i);
    const inWeek = inRange(full, ws, addDays(ws, 7));
    points.push(inWeek.length ? Math.min(...inWeek.map((s) => s.pace)) : null);
  }
  return {
    from: first.pace,
    to: current,
    since: first.startedAt,
    pctFaster: Math.round(((first.pace - current) / first.pace) * 100),
    points,
  };
}

// Last 4 weeks vs the 4 before: burpees and workouts, as % change.
export function trends(sessions, now = Date.now()) {
  const recent = summarize(inRange(sessions, now - 28 * DAY, now + 1));
  const before = summarize(inRange(sessions, now - 56 * DAY, now - 28 * DAY));
  const pct = (a, b) => (b === 0 ? null : Math.round(((a - b) / b) * 100));
  return {
    burpees: { now: recent.burpees, before: before.burpees, pct: pct(recent.burpees, before.burpees) },
    workouts: { now: recent.workouts, before: before.workouts, pct: pct(recent.workouts, before.workouts) },
  };
}
