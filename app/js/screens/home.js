// Home: weekly goal card, catch-up offers, workout list.

import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import * as store from '../store.js';
import * as stats from '../stats.js';
import { workoutTitle } from '../types.js';
import { duration, pace, dayLabel, longDate } from '../format.js';
import { go } from '../router.js';
import { startRun } from '../run.js';
import { icon, badge, Nav } from '../components.js';

const { b, button, div, h1, h2, main, section, span } = van.tags;

export function specFromWorkout(w) {
  return {
    workoutId: w.id,
    type: w.type,
    typeName: w.type === 'other' ? (w.typeName || 'Other') : undefined,
    count: w.count,
    pace: w.pace,
    title: workoutTitle(w),
  };
}

function WeekCard() {
  const now = Date.now();
  const s = store.settings();
  const start = stats.weekStart(now, s.weekStartsOn);
  const all = store.data.sessions;
  const week = stats.summarize(stats.inRange(all, start, stats.addDays(start, 7)));
  const goal = stats.goalStatus(week, s);
  const [first, second] = goal.parts;
  const today = stats.dayStart(now);
  const daysLeft = Math.round((stats.addDays(start, 7) - today) / stats.DAY_MS);
  const unitLabel = first.unit === 'min' ? 'minutes' : 'burpees';
  const left = Math.max(0, first.target - first.value);
  const strong = (text) => b({ style: 'color:var(--ink)' }, text);

  return section({ class: 'card week', 'aria-label': 'Weekly goal' },
    div({ class: 'between' },
      span({ class: 'eyebrow' }, 'This week'),
      span({ class: 'small muted' }, goal.hit
        ? b({ class: 'goal-hit' }, 'Goal hit ✓')
        : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`),
    ),
    div({ class: 'row', style: 'align-items:baseline;gap:8px' },
      span({ class: 'digits', style: 'font-size:64px;line-height:0.9' }, first.value),
      span({ class: 'muted', style: 'font-size:17px;font-weight:500' }, `/ ${first.target} ${unitLabel}`),
    ),
    div({
      class: 'meter', role: 'progressbar', 'aria-label': `Weekly ${unitLabel}`,
      'aria-valuemin': 0, 'aria-valuemax': first.target, 'aria-valuenow': first.value,
    }, div({ style: `width:${(first.pct * 100).toFixed(1)}%` })),
    div({ class: 'between small muted' },
      left > 0 ? span(strong(left), ' to go') : span(strong(first.value - first.target), ' over the goal'),
      second
        ? span(strong(second.value), ` / ${second.target} ${second.unit === 'min' ? 'min' : 'burpees'}`)
        : span(`${stats.minutes(week)} min · ${week.workouts} ${week.workouts === 1 ? 'workout' : 'workouts'}`),
    ),
    div({ class: 'days' }, stats.dailySeries(all, start).map((d) => {
      const isToday = d.start === today;
      const n = d.sum.burpees;
      return div({ class: `day${isToday ? ' is-today' : ''}` },
        span(new Date(d.start).toLocaleDateString([], { weekday: 'narrow' })),
        n > 0 ? div({ class: 'day-dot done' }, n) : div({ class: `day-dot${isToday ? ' today' : ''}` }));
    })),
  );
}

function CatchUpCard(s) {
  const left = store.remaining(s);
  const w = { type: s.type, typeName: s.typeName };
  return section({ class: 'catchup', 'aria-label': 'Catch up' },
    div({ class: 'row', style: 'align-items:flex-start' },
      div({ class: 'icon' }, icon('redo')),
      div({ class: 'stack', style: 'gap:2px' },
        span({ style: 'font-weight:600;font-size:15px' }, `${left} left from ${workoutTitle(w, s.target)}`),
        span({ class: 'small', style: 'color:#6B4A1F' }, `You stopped at ${s.done} / ${s.target} · ${dayLabel(s.startedAt)}`),
      ),
    ),
    div({ class: 'row', style: 'gap:8px' },
      button({
        class: 'btn small grow',
        onclick: () => startRun({
          workoutId: s.workoutId, type: s.type, typeName: s.typeName,
          count: left, pace: s.pace, title: `${workoutTitle(w, left)} · catch-up`,
          catchUpOf: s.id, isCatchUp: true,
        }),
      }, `Catch up · ${duration(left * s.pace)}`),
      button({ class: 'btn small ghost warm', onclick: () => store.dismissCatchUp(s.id) }, 'Dismiss'),
    ),
  );
}

// One card per workout; its text follows edits to the workout.
function WorkoutCard(w) {
  const open = () => go('detail', { id: w.id });
  return div({
    class: 'workout', role: 'button', tabindex: 0, onclick: open,
    onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); open(); } },
  },
    () => badge(w.type),
    div({ class: 'meta' },
      span({ class: 'name' }, () => workoutTitle(w)),
      span({ class: 'small muted' }, () => `Every ${pace(w.pace)} · ${duration(w.count * w.pace)}`),
    ),
    button({
      class: 'play', 'aria-label': () => `Start ${workoutTitle(w)}`,
      onclick: (e) => { e.stopPropagation(); startRun(specFromWorkout(w)); },
    }, icon('play')),
  );
}

export function Home() {
  return div({ class: 'view' },
    main({ class: 'screen with-nav' },
      div(
        span({ class: 'small muted', style: 'font-weight:500' }, longDate()),
        h1('Burpees'),
      ),
      () => WeekCard(),
      () => div({ class: 'view' }, store.openCatchUps().slice(0, 2).map(CatchUpCard)),
      div({ class: 'between', style: 'padding-top:4px' },
        h2('My workouts'),
        span({ class: 'small muted' }, () => store.data.workouts.length),
      ),
      vanX.list(div({ class: 'stack' }), store.data.workouts, (v) => WorkoutCard(v.val)),
      () => div({ class: 'view' }, store.data.workouts.length ? [] : div({ class: 'empty' }, 'No workouts yet.', van.tags.br(), 'Tap + to create one.')),
    ),
    button({ class: 'fab', 'aria-label': 'New workout', onclick: () => go('editor', { isNew: true }) }, icon('plus')),
    Nav(),
  );
}
