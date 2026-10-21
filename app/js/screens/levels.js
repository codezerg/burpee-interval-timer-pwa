// Levels tab: level ladder + next test per burpee type, the monthly
// challenge, and the Year in Burpees.

import van from 'vanjs-core';
import * as store from '../store.js';
import * as stats from '../stats.js';
import { TYPES } from '../types.js';
import { duration, pace } from '../format.js';
import { LEVELS, LEVEL_TYPES, levelState, levelSpec } from '../levels.js';
import { challengeOptions, challengeProgress, monthKey, monthRange, recapYear } from '../review.js';
import { go } from '../router.js';
import { startRun } from '../run.js';
import { icon, Nav, Seg, toast } from '../components.js';

const { b, button, div, h1, h2, main, section, span } = van.tags;

const levelType = van.state('standard'); // kept across visits to the tab
const changing = van.state(false);       // challenge picker open

export function levelTestSpec(type, level) {
  const l = levelSpec(type, level);
  const title = `${l.count} ${TYPES[type].name} burpees`;
  return {
    workoutId: null, type, count: l.count, pace: l.pace,
    title: `Level ${level} test · ${title}`,
    levelTest: { type, level },
  };
}

function NextTest(type) {
  const st = levelState(store.data.sessions, type);
  const name = TYPES[type].name;
  if (st.next == null) {
    return section({ class: 'test-card' },
      span({ class: 'kicker' }, 'Graduate'),
      b({ style: 'font-size:20px' }, `You passed every ${name} level.`),
      span({ class: 'small', style: 'color:#C9CAD0' }, 'Retake any test below whenever you like.'));
  }
  const l = levelSpec(type, st.next);
  const recovery = store.thisWeek().kind === 'recovery';
  return section({ class: 'test-card' },
    span({ class: 'kicker' }, st.level ? `You are Level ${st.level} · ${LEVELS[type][st.level - 1].name}` : 'Find your level'),
    b({ style: 'font-size:20px' }, `Next: Level ${st.next} · ${l.name}`),
    span({ style: 'font-size:15px' }, `${l.count} ${name} burpees`),
    span({ class: 'small', style: 'color:#C9CAD0' }, `every ${pace(l.pace)} · ${duration(l.total)} · no pausing`),
    recovery
      ? span({ class: 'small', style: 'color:#9ED9D0' }, 'No level tests during a recovery week. It’ll be here next week.')
      : button({ class: 'btn block', style: 'margin-top:6px', onclick: () => startRun(levelTestSpec(type, st.next)) }, 'Take the test'),
    span({ class: 'small', style: 'color:#C9CAD0' }, 'Take it when you feel ready. Retry as often as you like.'),
  );
}

function Ladder(type) {
  const st = levelState(store.data.sessions, type);
  return div({ class: 'ladder' }, LEVELS[type].map((l, i) => {
    const n = i + 1;
    const passed = n <= st.level;
    const isNext = n === st.next;
    return div({ class: `rung${isNext ? ' next' : ''}${passed ? ' passed' : ''}` },
      div({ class: 'rung-n' }, passed ? icon('checkSmall') : n === 6 ? '★' : n),
      div({ class: 'grow stack', style: 'gap:2px' },
        b(l.name),
        span({ class: 'small muted' }, `${l.count} every ${pace(l.pace)} · ${duration(l.count * l.pace)}`),
      ),
      passed && st.passedAt.get(n)
        ? span({ class: 'small muted' }, new Date(st.passedAt.get(n)).toLocaleDateString([], { day: 'numeric', month: 'short' }))
        : isNext ? span({ class: 'pill partial' }, 'next test') : [],
      passed ? button({ class: 'link-btn', style: 'color:var(--accent-ink)', 'aria-label': `Retake level ${n}`, onclick: () => startRun(levelTestSpec(type, n)) }, 'Retake') : [],
    );
  }));
}

function Challenge() {
  const now = Date.now();
  const s = store.settings();
  const key = monthKey(now);
  const month = new Date(now).toLocaleDateString([], { month: 'long' });
  const ch = store.data.challenges[key];
  const { start } = monthRange(now);

  if (!ch || changing.val) {
    return section({ class: 'card stack', 'aria-label': 'Monthly challenge' },
      div({ class: 'between' }, h2({ style: 'font-size:15px' }, `${month} challenge`), span({ class: 'small muted' }, 'pick one')),
      challengeOptions(s).map((o) => button({
        class: 'choice', style: 'min-height:48px;align-items:flex-start;padding:0 14px', 'aria-pressed': String(ch?.title === o.title),
        onclick: () => { store.pickChallenge(key, o); changing.val = false; toast('Challenge picked'); },
      }, o.title)),
    );
  }
  const p = challengeProgress(ch, store.data.sessions, store.data.periods, s, start, now);
  const unit = ch.kind === 'goalWeeks' ? 'weeks' : ch.kind === 'workouts' ? 'workouts' : 'burpees';
  return section({ class: 'card stack', 'aria-label': 'Monthly challenge' },
    div({ class: 'between' },
      h2({ style: 'font-size:15px' }, `${month} challenge`),
      span({ class: 'small muted' }, p.done ? '' : `${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'} left`),
    ),
    b({ style: 'font-size:17px' }, ch.title),
    div({ class: 'meter' }, div({ style: `width:${(p.pct * 100).toFixed(1)}%` })),
    div({ class: 'between small' },
      p.done ? b({ class: 'goal-hit' }, 'Challenge complete ✓') : span({ class: 'muted' }, `${p.value} of ${p.target} ${unit}`),
      p.done ? [] : button({ class: 'link-btn', style: 'color:var(--accent-ink)', onclick: () => { changing.val = true; } }, 'Change'),
    ),
  );
}

function YearCard() {
  const now = Date.now();
  const year = recapYear(now);
  if (year) {
    return section({ class: 'card year-card' },
      b({ style: 'font-size:17px' }, `Your ${year} in Burpees is ready`),
      span({ class: 'small muted' }, 'Totals, best month, best week, records.'),
      button({ class: 'btn small', onclick: () => go('year', { year }) }, 'Open'));
  }
  const y = new Date(now).getFullYear();
  const sum = stats.summarize(stats.inRange(store.data.sessions, new Date(y, 0, 1).getTime(), now + 1));
  return section({ class: 'card year-card' },
    b({ style: 'font-size:17px' }, 'Your Year in Burpees'),
    span({ class: 'small muted' }, `Ready in December. So far in ${y}: ${sum.burpees} burpees in ${sum.workouts} workouts.`));
}

export function Levels() {
  return div({ class: 'view' },
    main({ class: 'screen with-nav' },
      h1('Levels'),
      Seg(LEVEL_TYPES.map((t) => [t, TYPES[t].name]), () => levelType.val, (v) => { levelType.val = v; }),
      () => NextTest(levelType.val),
      () => Ladder(levelType.val),
      () => Challenge(),
      () => YearCard(),
    ),
    Nav(),
  );
}
