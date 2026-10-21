// Run with: npm test   (or: node --test tests/*.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkoutRun } from '../app/js/engine.js';

const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-6, msg ?? `${actual} != ${expected}`);

function setup({ count = 4, pace = 15, countdown = 5 } = {}) {
  let now = 100;
  const scheduled = [];
  let cancels = 0;
  const run = new WorkoutRun({
    count, pace, countdown,
    clock: () => now,
    sounds: {
      schedule: (events) => scheduled.push(events),
      cancel: () => { cancels++; },
    },
  });
  return {
    run,
    advance: (s) => { now += s; return run.tick(); },
    lastSchedule: () => scheduled[scheduled.length - 1],
    cancels: () => cancels,
  };
}

test('schedules countdown ticks, one beep per burpee and a finish sound', () => {
  const { run, lastSchedule } = setup({ count: 3, pace: 10, countdown: 5 });
  run.start();
  assert.deepEqual(lastSchedule(), [
    { delay: 2, kind: 'tick' },
    { delay: 3, kind: 'tick' },
    { delay: 4, kind: 'tick' },
    { delay: 5, kind: 'beep' },
    { delay: 15, kind: 'beep' },
    { delay: 25, kind: 'beep' },
    { delay: 35, kind: 'finish' },
  ]);
});

test('countdown -> running -> finished, counting burpees as beeps sound', () => {
  const { run, advance } = setup({ count: 4, pace: 15, countdown: 5 });
  run.start();
  assert.equal(run.state, 'countdown');
  assert.equal(run.status().countdownLeft, 5);
  assert.equal(run.done(), 0);

  assert.equal(advance(4.5), 'countdown');
  assert.equal(run.status().countdownLeft, 1);

  assert.equal(advance(0.5), 'running'); // t = 0, first beep
  assert.equal(run.done(), 1);
  near(run.status().burpeeLeft, 15);

  advance(14.9);
  assert.equal(run.done(), 1);
  advance(0.1); // t = 15, second beep
  assert.equal(run.done(), 2);

  assert.equal(advance(45), 'finished'); // t = 60 = 4 * 15
  assert.equal(run.done(), 4);
  near(run.status().elapsed, 60);
  near(run.status().totalLeft, 0);
});

test('pause freezes time and cancels beeps; resume reschedules only future beeps', () => {
  const { run, advance, lastSchedule, cancels } = setup({ count: 4, pace: 15, countdown: 0 });
  run.start();
  advance(20.05); // t = 20, in burpee 2
  assert.equal(run.done(), 2);

  run.pause();
  assert.equal(cancels() >= 2, true);
  advance(30); // paused for 30 s
  near(run.status().elapsed, 20);
  assert.equal(run.done(), 2);
  assert.equal(Math.round(run.status().pausedSec), 30);

  run.resume();
  assert.equal(run.state, 'running');
  const delays = lastSchedule().map((e) => [Math.round(e.delay * 100) / 100, e.kind]);
  assert.deepEqual(delays, [[10, 'beep'], [25, 'beep'], [40, 'finish']]);

  advance(10); // t = 30, third beep
  assert.equal(run.done(), 3);
});

test('stop keeps what was done and the paused time', () => {
  const { run, advance } = setup({ count: 40, pace: 15, countdown: 0 });
  run.start();
  advance(27 * 15 + 3); // in burpee 28
  run.pause();
  advance(42);
  run.stop();
  assert.equal(run.state, 'stopped');
  assert.equal(run.done(), 28);
  assert.equal(Math.round(run.status().pausedSec), 42);
  advance(100);
  assert.equal(run.done(), 28);
});

test('stopping during the countdown counts nothing', () => {
  const { run, advance } = setup();
  run.start();
  advance(2);
  run.stop();
  assert.equal(run.done(), 0);
});

test('skip countdown starts the first beep right away', () => {
  const { run, advance, lastSchedule } = setup({ count: 2, pace: 10, countdown: 10 });
  run.start();
  advance(1);
  run.skipCountdown();
  const first = lastSchedule()[0];
  assert.equal(first.kind, 'beep');
  assert.ok(first.delay < 0.1);
  assert.equal(advance(0.05), 'running');
  assert.equal(run.done(), 1);
});

test('half-second paces work', () => {
  const { run, advance } = setup({ count: 3, pace: 4.5, countdown: 0 });
  run.start();
  advance(0.05 + 9); // t = 9 -> third beep
  assert.equal(run.done(), 3);
  assert.equal(advance(4.5), 'finished');
  near(run.status().elapsed, 13.5);
});
