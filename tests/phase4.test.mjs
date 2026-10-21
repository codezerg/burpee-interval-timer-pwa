import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekKind, scaledGoal, scaledCount, streakInfo, trainingWeeks, restartPlan, workoutFactor } from '../app/js/plan.js';
import { newRecords, suggestion, badges, paceProgress, trends, bests } from '../app/js/motivation.js';
import { addDays, weekStart } from '../app/js/stats.js';
import { WorkoutRun } from '../app/js/engine.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const W = (n) => addDays(at(2026, 9, 7, 0), 7 * n); // Monday of week n (week 0 = 7 Sep 2026)
let id = 0;
const session = (ts, done, extra = {}) => ({
  id: String(++id), type: 'standard', target: done, pace: 15, done, startedAt: ts, activeSec: done * 15, pausedSec: 0, pauses: 0, ...extra,
});
const settings = { goalType: 'burpees', goalBurpees: 100, goalMinutes: 30, weekStartsOn: 1 };
const hitWeek = (n, extra) => session(W(n) + 864e5, 100, extra);
const missWeek = (n) => session(W(n) + 864e5, 20);

test('weekKind: break, recovery (full week only), ramp, normal', () => {
  const periods = [
    { kind: 'recovery', start: W(1), end: W(2), pct: 55 },
    { kind: 'recovery', start: W(3), end: W(3) + 2 * 864e5, pct: 55 }, // ended early
    { kind: 'break', start: W(4) + 3 * 864e5, end: W(5) + 864e5, reason: 'sick' },
    { kind: 'ramp', start: W(7), factors: [0.75, 0.87] },
  ];
  const now = W(12);
  assert.equal(weekKind(W(0), periods, now).kind, 'normal');
  assert.deepEqual(weekKind(W(1), periods, now), { kind: 'recovery', factor: 0.55 });
  assert.equal(weekKind(W(3), periods, now).kind, 'normal');
  assert.equal(weekKind(W(4), periods, now).kind, 'break');
  assert.equal(weekKind(W(5), periods, now).kind, 'normal'); // break covers only 1 day of it
  assert.equal(weekKind(W(6), periods, now).kind, 'normal');
  assert.equal(weekKind(W(7), periods, now).factor, 0.75);
  assert.equal(weekKind(W(8), periods, now).factor, 0.87);
  assert.equal(weekKind(W(9), periods, now).kind, 'normal');
  // open-ended break covers up to now: 1 day into W(10) isn't half the week yet
  assert.equal(weekKind(W(9), [{ kind: 'break', start: W(9), end: null }], W(10) + 864e5).kind, 'break');
  assert.equal(weekKind(W(10), [{ kind: 'break', start: W(9), end: null }], W(10) + 864e5).kind, 'normal');
  // back the same day the break started: not a break week
  assert.equal(weekKind(W(11), [{ kind: 'break', start: W(11) + 2 * 864e5, end: W(11) + 2 * 864e5 + 3600e3 }], W(12)).kind, 'normal');
});

test('scaled goals and workout sizes', () => {
  assert.equal(scaledGoal({ goalBurpees: 150, goalMinutes: 30 }, 0.55).goalBurpees, 85);
  assert.equal(scaledGoal({ goalBurpees: 150, goalMinutes: 30 }, 0.55).goalMinutes, 17);
  assert.equal(scaledCount(40, 0.55), 22);
  assert.equal(scaledCount(1, 0.5), 1);
  assert.equal(scaledCount(40, 1), 40);
});

test('streak: hits count, a miss resets, shields cover misses', () => {
  // 4 hits -> 1 shield; miss covered; 1 more hit; then a second miss resets
  const list = [0, 1, 2, 3, 5].map((n) => hitWeek(n)).concat([missWeek(4), missWeek(6)]);
  const s1 = streakInfo(list, [], settings, W(5) + 3 * 864e5);
  assert.equal(s1.streak, 5);
  assert.equal(s1.shields, 0);
  assert.deepEqual(s1.weeks.map((w) => w.status), ['hit', 'hit', 'hit', 'hit', 'shielded', 'hit']);
  const s2 = streakInfo(list, [], settings, W(7) + 864e5);
  assert.equal(s2.streak, 0);
  assert.equal(s2.best, 5);
  assert.equal(s2.weeks[6].status, 'missed');
  assert.equal(s2.weeks[7].status, 'open'); // current week never breaks the streak
});

test('streak: recovery week counts with the easier goal, break weeks are frozen', () => {
  const list = [hitWeek(0), hitWeek(1), session(W(2) + 864e5, 60), hitWeek(4)];
  const periods = [
    { kind: 'recovery', start: W(2), end: W(3), pct: 55 },
    { kind: 'break', start: W(3), end: W(4), reason: 'holiday' },
  ];
  const s = streakInfo(list, periods, settings, W(4) + 2 * 864e5);
  assert.deepEqual(s.weeks.map((w) => [w.kind, w.status]),
    [['normal', 'hit'], ['normal', 'hit'], ['recovery', 'hit'], ['break', 'frozen'], ['normal', 'hit']]);
  assert.equal(s.streak, 4);
});

test('break week: only the normal goal counts as a hit; workouts stay full size', () => {
  const periods = [{ kind: 'break', start: W(1), end: W(2), reason: 'sick' }];
  const tiny = streakInfo([hitWeek(0), session(W(1) + 864e5, 3), hitWeek(2)], periods, settings, W(2) + 2 * 864e5);
  assert.deepEqual(tiny.weeks.map((w) => w.status), ['hit', 'frozen', 'hit']);
  const big = streakInfo([hitWeek(0), hitWeek(1), hitWeek(2)], periods, settings, W(2) + 2 * 864e5);
  assert.deepEqual(big.weeks.map((w) => w.status), ['hit', 'hit', 'hit']);
  assert.equal(workoutFactor({ kind: 'break', factor: 0 }), 1);
  assert.equal(workoutFactor({ kind: 'recovery', factor: 0.55 }), 0.55);
});

test('trainingWeeks counts weeks with workouts since the last rest', () => {
  const list = [0, 1, 2, 4, 5, 6].map((n) => missWeek(n));
  assert.equal(trainingWeeks(list, [], settings, W(7) + 864e5), 6);
  const periods = [{ kind: 'recovery', start: W(3), end: W(4), pct: 55 }];
  assert.equal(trainingWeeks(list, periods, settings, W(7) + 864e5), 3);
  assert.equal(trainingWeeks([], [], settings), 0);
});

test('restartPlan follows the time off', () => {
  assert.deepEqual(restartPlan(5).factors, [0.9]);
  assert.equal(restartPlan(16, 'holiday').pct, 75);
  assert.equal(restartPlan(16, 'sick').pct, 60);
  assert.equal(restartPlan(40).factors.length, 3);
});

test('newRecords: first workout, no-pause, most, fastest, best week', () => {
  const hist = [session(W(0), 32, { target: 40, pauses: 1 }), session(W(0) + 864e5, 30, { pauses: 0 })];
  assert.equal(newRecords([], session(W(1), 10))[0].kind, 'first');
  const recs = newRecords(hist, session(W(1), 40, { pace: 14 }));
  assert.deepEqual(recs.map((r) => r.kind), ['noPause', 'most', 'fastest']);
  assert.equal(recs[0].was, 30);
  assert.equal(newRecords(hist, session(W(1), 10)).length, 0);
  // Stopping early is never a "without a pause" record
  assert.equal(newRecords(hist, session(W(1), 35, { target: 40 })).some((r) => r.kind === 'noPause'), false);
  // Old sessions without a pause count: no paused time counts as no pause
  assert.equal(bests([{ ...hist[1], pauses: undefined, pausedSec: 0 }], 'standard').noPause, 30);
});

test('bests: fastest pace ignores partial and catch-up sessions', () => {
  const list = [
    session(W(0), 40, { pace: 15 }),
    session(W(0) + 864e5, 28, { pace: 12, target: 40 }),
    session(W(0) + 2 * 864e5, 12, { pace: 10, catchUpOf: 'x' }),
    session(W(1), 41, { pace: 14.5, pauses: 2 }),
  ];
  const r = bests(list, 'standard');
  assert.deepEqual([r.most, r.noPause, r.fastest, r.bestWeek, r.count], [41, 40, 14.5, 80, 4]);
  assert.equal(bests(list, 'other').count, 0);
});

test('suggestion: 2x easy -> harder options, capped at ~10% a week; hard -> repeat', () => {
  const workout = { count: 40, pace: 15, bumps: [] };
  const prevEasy = [{ feel: 'easy' }];
  const s = suggestion({ workout, feel: 'easy', previous: prevEasy });
  assert.equal(s.kind, 'harder');
  assert.deepEqual(s.options.map((o) => [o.change, o.to]), [['count', 41], ['pace', 14.5]]);
  assert.equal(suggestion({ workout, feel: 'easy', previous: [{ feel: 'ok' }] }), null);
  assert.equal(suggestion({ workout, feel: 'easy', previous: prevEasy, reducedWeek: true }), null);
  assert.equal(suggestion({ workout, feel: 'hard', previous: [] }).kind, 'repeat');
  const now = Date.now();
  const bumped = { ...workout, bumps: [{ at: now - 864e5, pct: 0.07 }] }; // +2.5% fits, +3.3% doesn't
  assert.deepEqual(suggestion({ workout: bumped, feel: 'easy', previous: prevEasy, now }).options.map((o) => o.change), ['count']);
  const full = { ...workout, bumps: [{ at: now - 864e5, pct: 0.1 }] };
  assert.equal(suggestion({ workout: full, feel: 'easy', previous: prevEasy, now }).kind, 'capped');
});

test('badges: earned and next with progress, never lost', () => {
  const list = Array.from({ length: 12 }, (_, i) => session(W(0) + i * 864e5, 80));
  const b = Object.fromEntries(badges(list, 5).map((x) => [x.id, x]));
  assert.equal(b.burpees.earned, 500);
  assert.equal(b.burpees.next, 1000);
  assert.equal(b.workouts.earned, 10);
  assert.equal(b.streak.earned, 4);
  assert.equal(b.standard.earned, 250);
  assert.equal(b.seal.earned, null);
  assert.equal(b.burpees.text(1000), '1k');
});

test('paceProgress and trends', () => {
  const now = W(8) + 864e5;
  const list = [session(W(1), 40, { pace: 15 }), session(W(4), 40, { pace: 14.5 }), session(W(7), 40, { pace: 14 }),
    session(W(7) + 864e5, 20, { pace: 12, target: 40 })];
  const p = paceProgress(list, 'standard', { now });
  assert.equal(p.from, 15);
  assert.equal(p.to, 14);
  assert.equal(p.pctFaster, 7);
  assert.equal(p.points.length, 8);
  assert.equal(p.points[6], 14);
  assert.equal(paceProgress(list, 'seal', { now }), null);
  const t = trends(list, now);
  assert.equal(t.burpees.now, 60);
  assert.equal(t.burpees.before, 80); // W(1) and W(4) are in the 4 weeks before
  assert.equal(t.burpees.pct, -25);
});

test('engine counts pauses, not during the countdown', () => {
  let now = 0;
  const run = new WorkoutRun({ count: 10, pace: 5, countdown: 3, clock: () => now });
  run.start();
  now += 1; run.pause(); run.resume();
  now += 5; run.pause(); run.resume();
  now += 5; run.pause();
  assert.equal(run.pauses, 2);
});

test('weekStart import sanity', () => assert.equal(weekStart(W(3) + 5 * 864e5), W(3)));
