import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  weekStart, addDays, summarize, goalStatus, weeklySeries, dailySeries,
  monthlySeries, goalWeeks, records, minutes,
} from '../app/js/stats.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const session = (ts, done, extra = {}) => ({
  id: String(ts) + done, type: 'standard', target: done, pace: 15, done, startedAt: ts, activeSec: done * 15, ...extra,
});

test('weekStart: Monday and Sunday starts', () => {
  // Wed 21 Oct 2026
  assert.equal(weekStart(at(2026, 10, 21)), at(2026, 10, 19, 0));
  assert.equal(weekStart(at(2026, 10, 21), 0), at(2026, 10, 18, 0));
  // Monday itself and Sunday night
  assert.equal(weekStart(at(2026, 10, 19, 0)), at(2026, 10, 19, 0));
  assert.equal(weekStart(at(2026, 10, 25, 23)), at(2026, 10, 19, 0));
  assert.equal(weekStart(at(2026, 10, 25, 23), 0), at(2026, 10, 25, 0));
});

test('addDays stays on local midnight across DST changes', () => {
  const start = at(2026, 3, 23, 0);
  for (let i = 0; i < 20; i++) assert.equal(new Date(addDays(start, i)).getHours(), 0);
  const fall = at(2026, 10, 26, 0);
  for (let i = -14; i < 14; i++) assert.equal(new Date(addDays(fall, i)).getHours(), 0);
});

test('summarize totals by type and minutes', () => {
  const sum = summarize([
    session(at(2026, 10, 19), 40),
    session(at(2026, 10, 20), 20, { type: 'sixcount', activeSec: 240 }),
    session(at(2026, 10, 21), 5, { type: 'seal', activeSec: 150 }),
  ]);
  assert.equal(sum.burpees, 65);
  assert.equal(sum.workouts, 3);
  assert.deepEqual(sum.byType, { standard: 40, sixcount: 20, seal: 5, other: 0 });
  assert.equal(minutes(sum), Math.floor((600 + 240 + 150) / 60));
});

test('goalStatus: burpees, minutes, both', () => {
  const sum = { burpees: 160, seconds: 25 * 60 };
  const base = { goalBurpees: 150, goalMinutes: 30 };
  assert.equal(goalStatus(sum, { ...base, goalType: 'burpees' }).hit, true);
  assert.equal(goalStatus(sum, { ...base, goalType: 'minutes' }).hit, false);
  const both = goalStatus(sum, { ...base, goalType: 'both' });
  assert.equal(both.hit, false);
  assert.deepEqual(both.parts.map((p) => [p.unit, p.value, p.target]), [['burpees', 160, 150], ['min', 25, 30]]);
  assert.equal(both.parts[0].pct, 1);
});

test('weeklySeries puts sessions in the right weeks, current week last', () => {
  const now = at(2026, 10, 21);
  const list = [session(at(2026, 10, 19, 7), 40), session(at(2026, 10, 18, 22), 30), session(at(2026, 9, 1), 99)];
  const weeks = weeklySeries(list, { count: 3, now });
  assert.deepEqual(weeks.map((w) => w.sum.burpees), [0, 30, 40]);
  assert.equal(weeks[2].start, at(2026, 10, 19, 0));
});

test('dailySeries and monthlySeries', () => {
  const list = [session(at(2026, 10, 19), 10), session(at(2026, 10, 19, 18), 5), session(at(2026, 10, 21), 7)];
  const days = dailySeries(list, at(2026, 10, 19, 0));
  assert.deepEqual(days.map((d) => d.sum.burpees), [15, 0, 7, 0, 0, 0, 0]);
  const months = monthlySeries([...list, session(at(2026, 9, 3), 50)], { count: 2, now: at(2026, 10, 21) });
  assert.deepEqual(months.map((m) => m.sum.burpees), [50, 22]);
});

test('goalWeeks counts weeks from the first workout to now', () => {
  const settings = { goalType: 'burpees', goalBurpees: 50, goalMinutes: 30, weekStartsOn: 1 };
  const list = [session(at(2026, 10, 5), 60), session(at(2026, 10, 13), 20), session(at(2026, 10, 20), 55)];
  assert.deepEqual(goalWeeks(list, settings, at(2026, 10, 21)), { hit: 2, total: 3 });
  assert.deepEqual(goalWeeks([], settings), { hit: 0, total: 0 });
});

test('records per type ignore partial and catch-up sessions for fastest pace', () => {
  const list = [
    session(at(2026, 10, 5), 40, { pace: 15 }),
    session(at(2026, 10, 6), 28, { pace: 12, target: 40 }), // partial: not a pace record
    session(at(2026, 10, 6, 18), 12, { pace: 10, catchUpOf: 'x' }), // catch-up: not a pace record
    session(at(2026, 10, 14), 41, { pace: 14.5 }),
    session(at(2026, 10, 15), 5, { type: 'seal', pace: 30 }),
  ];
  const r = records(list, 'standard');
  assert.equal(r.total, 40 + 28 + 12 + 41);
  assert.equal(r.most, 41);
  assert.equal(r.fastest, 14.5);
  assert.equal(r.bestWeek, 80);
  assert.equal(records(list, 'other'), null);
});
