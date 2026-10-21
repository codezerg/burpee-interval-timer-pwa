// Levels per burpee type (proposal 2.6 g). Pass a level's test (its full
// workout without pausing) to reach it. Take it when ready, retry anytime.

export const LEVELS = {
  standard: [
    { name: 'Starter', count: 20, pace: 15 },
    { name: 'Base', count: 40, pace: 15 },
    { name: 'Steady', count: 40, pace: 12 },
    { name: 'Strong', count: 60, pace: 10 },
    { name: 'Fit', count: 80, pace: 8 },
    { name: 'Graduate', count: 100, pace: 6 },
  ],
  sixcount: [
    { name: 'Starter', count: 20, pace: 12 },
    { name: 'Base', count: 30, pace: 12 },
    { name: 'Steady', count: 40, pace: 10 },
    { name: 'Strong', count: 50, pace: 8 },
    { name: 'Fit', count: 60, pace: 7 },
    { name: 'Graduate', count: 80, pace: 5 },
  ],
  seal: [
    { name: 'Starter', count: 5, pace: 30 },
    { name: 'Base', count: 10, pace: 30 },
    { name: 'Steady', count: 10, pace: 25 },
    { name: 'Strong', count: 15, pace: 22 },
    { name: 'Fit', count: 20, pace: 20 },
    { name: 'Graduate', count: 25, pace: 18 },
  ],
};

export const LEVEL_TYPES = ['standard', 'sixcount', 'seal'];

// A test passes when the timer ran to the end with no pause. It's decided
// when the run ends (levelTest.passed), so correcting the burpee count
// afterwards can't turn a stopped test into a pass.
export function runPassed({ finished, pauses, done, target }) {
  return Boolean(finished) && (pauses ?? 0) === 0 && done >= target;
}

export function testPassed(session) {
  return session.levelTest?.passed ?? runPassed({ ...session, finished: true });
}

// Highest level passed for a type (0 = none yet) and when each was passed.
export function levelState(sessions, type) {
  const passed = new Map();
  for (const s of sessions) {
    if (s.levelTest?.type === type && testPassed(s)) {
      const n = s.levelTest.level;
      if (!passed.has(n) || s.startedAt < passed.get(n)) passed.set(n, s.startedAt);
    }
  }
  // Levels are climbed in order; a passed higher test implies the ones below.
  const level = Math.max(0, ...passed.keys());
  const next = level < LEVELS[type].length ? level + 1 : null;
  return { level, next, passedAt: passed };
}

export function levelSpec(type, level) {
  const l = LEVELS[type][level - 1];
  return { ...l, level, total: l.count * l.pace };
}
