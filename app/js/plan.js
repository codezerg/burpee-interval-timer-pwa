// Week planning: recovery weeks, breaks, restart ramps, the effective weekly
// goal and the weekly streak with shields. Pure functions (no storage/DOM).
//
// periods (stored in data.periods):
//   { kind: 'recovery', start, end }            start/end = week boundaries; ended early -> end < week end
//   { kind: 'break', start, end|null, reason }  end null = "until I'm back"
//   { kind: 'ramp', start, factors: [0.75, 0.87] }  one factor per week from `start`

import { weekStart, addDays, summarize, inRange, goalStatus } from './stats.js';

export const SHIELD_EVERY = 4; // good weeks per shield
export const MAX_SHIELDS = 3;

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

// What kind of week starts at `ws`, and how much of the normal goal applies.
// A break week is one the break covers at least half of (open-ended breaks
// count up to now), so a short break or coming back mid-week keeps the goal.
export function weekKind(ws, periods = [], now = Date.now()) {
  const we = addDays(ws, 7);
  for (const p of periods) {
    if (p.kind !== 'break') continue;
    const covered = Math.min(we, p.end == null ? now : p.end) - Math.max(ws, p.start);
    if (covered >= (we - ws) / 2) return { kind: 'break', factor: 0 };
  }
  for (const p of periods) {
    if (p.kind === 'recovery' && p.start <= ws && p.end >= we) return { kind: 'recovery', factor: p.pct / 100 };
  }
  for (const p of periods) {
    if (p.kind === 'ramp') {
      const i = Math.round((ws - p.start) / (7 * 864e5));
      if (i >= 0 && i < p.factors.length) return { kind: 'ramp', factor: p.factors[i], index: i, of: p.factors.length };
    }
  }
  return { kind: 'normal', factor: 1 };
}

// The settings with goal targets scaled for a reduced week.
export function scaledGoal(settings, factor) {
  if (factor >= 1) return settings;
  return {
    ...settings,
    goalBurpees: round5(settings.goalBurpees * factor),
    goalMinutes: Math.max(5, Math.round(settings.goalMinutes * factor)),
  };
}

// How much of each workout to do this week: recovery and restart weeks
// shrink workouts; breaks don't (training during a break is a bonus).
export const workoutFactor = (kind) => (kind.kind === 'recovery' || kind.kind === 'ramp' ? kind.factor : 1);

// Workout size for a reduced week (same pace, fewer burpees).
export const scaledCount = (count, factor) => (factor >= 1 ? count : Math.max(1, Math.round(count * factor)));

// Goal state of one week, accounting for its kind. A break week has no goal
// of its own: it only counts (as a hit) if the normal goal was reached anyway.
export function weekGoal(sessions, ws, periods, settings, now = Date.now()) {
  const kind = weekKind(ws, periods, now);
  const goalSettings = scaledGoal(settings, kind.kind === 'break' ? 1 : kind.factor);
  const sum = summarize(inRange(sessions, ws, addDays(ws, 7)));
  return { ...kind, sum, goal: goalStatus(sum, goalSettings), settings: goalSettings };
}

// Weekly streak from the first workout up to now.
//  hit      -> streak + 1 (every SHIELD_EVERY hits earns a shield, max MAX_SHIELDS)
//  break    -> frozen: skipped, unless the goal was hit anyway
//  missed   -> a shield covers it, otherwise the streak resets
//  current week only adds when hit; it never breaks the streak while in progress.
export function streakInfo(sessions, periods, settings, now = Date.now()) {
  const empty = { streak: 0, shields: 0, best: 0, weeks: [] };
  if (!sessions.length) return empty;
  const sd = settings.weekStartsOn;
  const first = weekStart(Math.min(...sessions.map((s) => s.startedAt)), sd);
  const current = weekStart(now, sd);
  let streak = 0, shields = 0, best = 0, sinceShield = 0;
  const weeks = [];
  for (let ws = first; ws <= current; ws = addDays(ws, 7)) {
    const w = weekGoal(sessions, ws, periods, settings, now);
    const isCurrent = ws === current;
    let status;
    if (w.goal.hit) {
      status = 'hit';
      streak += 1;
      sinceShield += 1;
      if (sinceShield >= SHIELD_EVERY) { sinceShield = 0; shields = Math.min(MAX_SHIELDS, shields + 1); }
    } else if (isCurrent) {
      status = 'open';
    } else if (w.kind === 'break') {
      status = 'frozen';
    } else if (shields > 0) {
      status = 'shielded';
      shields -= 1;
    } else {
      status = 'missed';
      streak = 0;
      sinceShield = 0;
    }
    best = Math.max(best, streak);
    weeks.push({ start: ws, kind: w.kind, status, sum: w.sum });
  }
  return { streak, shields, best, weeks };
}

// Completed training weeks since the last recovery week or break
// (weeks with at least one workout). Starting a recovery week resets it.
export function trainingWeeks(sessions, periods, settings, now = Date.now()) {
  if (!sessions.length) return 0;
  const sd = settings.weekStartsOn;
  const firstWeek = weekStart(Math.min(...sessions.map((s) => s.startedAt)), sd);
  let n = 0;
  for (let ws = addDays(weekStart(now, sd), -7); ws >= firstWeek; ws = addDays(ws, -7)) {
    const kind = weekKind(ws, periods, now).kind;
    if (kind === 'recovery' || kind === 'break') break;
    if (inRange(sessions, ws, addDays(ws, 7)).length) n += 1;
  }
  return n;
}

// Restart plan after time off (proposal 2.8 e).
export function restartPlan(daysOff, reason) {
  if (daysOff <= 7) return { pct: 90, factors: [0.9] };
  if (daysOff <= 21 && reason !== 'sick') return { pct: 75, factors: [0.75, 0.87] };
  if (daysOff <= 21) return { pct: 60, factors: [0.6, 0.8] };
  return { pct: 55, factors: [0.55, 0.7, 0.85] };
}
