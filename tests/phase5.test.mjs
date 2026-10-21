import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelState, levelSpec, testPassed, runPassed } from '../app/js/levels.js';
import { weekReview, challengeOptions, challengeProgress, monthKey, monthRange, yearRecap, recapYear } from '../app/js/review.js';
import { addDays } from '../app/js/stats.js';

const W = (n) => addDays(new Date(2026, 8, 7).getTime(), 7 * n); // Monday 7 Sep 2026 = week 0
let id = 0;
const session = (ts, done, extra = {}) => ({
  id: String(++id), type: 'standard', target: done, pace: 15, done, startedAt: ts, activeSec: done * 15, pausedSec: 0, pauses: 0, ...extra,
});
const settings = { goalType: 'burpees', goalBurpees: 100, goalMinutes: 30, weekStartsOn: 1 };

test('levels: tables, passing tests in order, spec', () => {
  for (const t of Object.keys(LEVELS)) assert.equal(LEVELS[t].length, 6);
  const list = [
    session(W(0), 20, { levelTest: { type: 'standard', level: 1 } }),
    session(W(1), 40, { levelTest: { type: 'standard', level: 2 }, pauses: 1 }), // paused: not passed
    session(W(2), 30, { target: 40, levelTest: { type: 'standard', level: 2 } }), // stopped: not passed
    session(W(3), 40, { levelTest: { type: 'standard', level: 2 } }),
  ];
  const st = levelState(list, 'standard');
  assert.equal(st.level, 2);
  assert.equal(st.next, 3);
  assert.equal(st.passedAt.get(2), W(3));
  assert.deepEqual(levelState(list, 'seal'), { level: 0, next: 1, passedAt: new Map() });
  assert.equal(levelSpec('standard', 3).total, 480);
  assert.equal(testPassed({ done: 5, target: 5 }), true);
  // Decided at the end of the run: a stopped test stays failed even if the count is corrected to the target
  assert.equal(runPassed({ finished: false, pauses: 0, done: 40, target: 40 }), false);
  assert.equal(runPassed({ finished: true, pauses: 1, done: 40, target: 40 }), false);
  assert.equal(testPassed({ done: 40, target: 40, levelTest: { type: 'standard', level: 2, passed: false } }), false);
  const top = levelState([session(W(0), 100, { levelTest: { type: 'standard', level: 6 } })], 'standard');
  assert.equal(top.next, null);
});

test('weekReview: building / holding / resting against the 4-week average', () => {
  const base = [1, 2, 3, 4].map((n) => session(W(n) + 864e5, 100));
  const now = W(6) + 864e5; // review of week 5
  const up = weekReview([...base, session(W(5) + 864e5, 120)], [], settings, now);
  assert.equal(up.avg, 100);
  assert.equal(up.pct, 20);
  assert.equal(up.status, 'building');
  assert.equal(up.goalHit, true);
  assert.equal(weekReview([...base, session(W(5) + 864e5, 98)], [], settings, now).status, 'holding');
  assert.equal(weekReview([...base, session(W(5) + 864e5, 40)], [], settings, now).status, 'resting');
  const rec = weekReview([...base, session(W(5) + 864e5, 60)], [{ kind: 'recovery', start: W(5), end: W(6), pct: 55 }], settings, now);
  assert.equal(rec.status, 'resting');
  assert.equal(rec.goalHit, true);
});

test('weekReview highlight: first Navy SEAL, best week ever', () => {
  const base = [session(W(1), 50), session(W(2), 60)];
  const now = W(4) + 864e5;
  const seal = weekReview([...base, session(W(3) + 864e5, 5, { type: 'seal' })], [], settings, now);
  assert.match(seal.highlight, /First Navy SEAL burpees: 5/);
  const best = weekReview([...base, session(W(3) + 864e5, 70)], [], settings, now);
  assert.match(best.highlight, /Best week ever: 70/);
});

test('monthly challenge options and progress', () => {
  const opts = challengeOptions(settings);
  assert.equal(opts.find((o) => o.kind === 'burpees').target, 450);
  const month = monthRange(new Date(2026, 8, 15).getTime()).start; // September 2026
  assert.equal(monthKey(month), '2026-09');
  // Week 3 (28 Sep - 4 Oct) ends in October, so it counts for October.
  const list = [session(W(0) + 864e5, 100), session(W(1) + 864e5, 100), session(W(2), 20, { type: 'seal' }), session(W(2) + 864e5, 100), session(W(3) + 864e5, 100)];
  const now = new Date(2026, 8, 30).getTime();
  const weeks = challengeProgress(opts[0], list, [], settings, month, now);
  assert.equal(weeks.value, 3);
  assert.equal(weeks.done, true);
  assert.equal(challengeProgress(opts[3], list, [], settings, month, now).value, 20);
  assert.equal(challengeProgress(opts[2], list, [], settings, month, now).value, 5);
  assert.equal(challengeProgress(opts[2], list, [], settings, month, now).daysLeft, 1);
});

test('yearRecap and when it shows', () => {
  const list = [session(new Date(2026, 2, 3).getTime(), 40), session(new Date(2026, 2, 4).getTime(), 40, { type: 'seal' }),
    session(new Date(2026, 9, 1).getTime(), 30), session(new Date(2025, 11, 1).getTime(), 99)];
  const r = yearRecap(list, [], settings, 2026);
  assert.equal(r.burpees, 110);
  assert.equal(r.workouts, 3);
  assert.equal(r.bestMonth, 2);
  assert.equal(r.bestWeek, 80);
  assert.equal(r.favourite, 'standard');
  assert.equal(r.days, 3);
  assert.equal(r.activeWeeks, 2);
  assert.equal(recapYear(new Date(2026, 11, 5).getTime()), 2026);
  assert.equal(recapYear(new Date(2027, 0, 5).getTime()), 2026);
  assert.equal(recapYear(new Date(2026, 9, 5).getTime()), null);
});
