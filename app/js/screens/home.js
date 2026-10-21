// Home: streak, weekly goal card (normal / recovery / restart / break),
// recovery reminder, catch-up offers, workout list.

import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import * as store from '../store.js';
import * as stats from '../stats.js';
import * as plan from '../plan.js';
import { workoutTitle } from '../types.js';
import { duration, pace, dayLabel, longDate } from '../format.js';
import { go } from '../router.js';
import { startRun } from '../run.js';
import { icon, badge, Nav, toast } from '../components.js';

const { b, button, div, h1, h2, main, s: strike, section, span } = van.tags;

const strong = (text) => b({ style: 'color:var(--ink)' }, text);
const REASONS = { sick: 'Sick', holiday: 'Holiday', injury: 'Injury', other: 'Break' };

// Run spec for a workout; in a reduced week (recovery/restart) it's the
// "easy version": same pace, fewer burpees.
export function specFromWorkout(w, factor = 1) {
  const count = plan.scaledCount(w.count, factor);
  return {
    workoutId: w.id,
    type: w.type,
    typeName: w.type === 'other' ? (w.typeName || 'Other') : undefined,
    count,
    pace: w.pace,
    title: workoutTitle(w, count),
    reduced: factor < 1,
  };
}

const shortDay = (ts) => new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

function StreakPills() {
  const info = plan.streakInfo(store.data.sessions, store.data.periods, store.settings());
  return div({ class: 'row', style: 'gap:6px' },
    span({ class: 'pill-lg', title: 'Weeks in a row with your goal hit' }, icon('flame'), `${info.streak} wk`),
    info.shields
      ? span({ class: 'pill-lg shield', 'aria-label': `${info.shields} streak ${info.shields === 1 ? 'shield' : 'shields'}` },
        icon('shield'), info.shields)
      : [],
  );
}

function BreakCard(p) {
  const info = plan.streakInfo(store.data.sessions, store.data.periods, store.settings());
  return section({ class: 'card week break', 'aria-label': 'On a break' },
    div({ class: 'between' },
      span({ class: 'eyebrow' }, `On a break · ${REASONS[p.reason] || 'Break'}`),
      span({ class: 'small muted' }, p.end ? `until ${shortDay(p.end)}` : 'until you’re back'),
    ),
    span({ style: 'font-size:15px;line-height:1.45' },
      `Since ${shortDay(p.start)}. `,
      info.streak ? ['Your ', strong(`${info.streak}-week streak`), ' is frozen, not lost. '] : '',
      'No goal and no reminders until you’re back.'),
    button({ class: 'btn small block', onclick: () => go('welcome', { fromBreak: true }) }, 'I’m back'),
  );
}

function WeekCard() {
  const now = Date.now();
  const s = store.settings();
  const all = store.data.sessions;
  const start = stats.weekStart(now, s.weekStartsOn);
  const kind = store.thisWeek(now);
  const goalSettings = plan.scaledGoal(s, kind.kind === 'break' ? 1 : kind.factor);
  const week = stats.summarize(stats.inRange(all, start, stats.addDays(start, 7)));
  const goal = stats.goalStatus(week, goalSettings);
  const [first, second] = goal.parts;
  const today = stats.dayStart(now);
  const daysLeft = Math.round((stats.addDays(start, 7) - today) / stats.DAY_MS);
  const unitLabel = first.unit === 'min' ? 'minutes' : 'burpees';
  const left = Math.max(0, first.target - first.value);
  const normalTarget = first.unit === 'min' ? s.goalMinutes : s.goalBurpees;
  const isRecovery = kind.kind === 'recovery';

  let head;
  if (isRecovery) {
    head = div({ class: 'between' },
      span({ class: 'pill-teal' }, icon('moon'), 'Recovery week'),
      span({ class: 'small muted' }, 'Goal ', strike(normalTarget), ' ', strong(first.target)));
  } else if (kind.kind === 'ramp') {
    head = div({ class: 'between' },
      span({ class: 'pill-teal' }, `Gentle restart · week ${kind.index + 1} of ${kind.of + 1}`),
      span({ class: 'small muted' }, `usually ${normalTarget}`));
  } else {
    head = div({ class: 'between' },
      span({ class: 'eyebrow' }, 'This week'),
      span({ class: 'small muted' }, goal.hit
        ? b({ class: 'goal-hit' }, 'Goal hit ✓')
        : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`));
  }

  // Recovery cycle row: always offers a recovery week, says when one is due.
  let cycle = [];
  if (isRecovery) {
    cycle = div({ class: 'cycle' },
      span(`Back to ${normalTarget} on ${shortDay(stats.addDays(start, 7))}`),
      button({ class: 'link-btn', onclick: () => { store.endRecovery(); toast('Recovery week ended'); } }, 'End early'));
  } else if (kind.kind === 'normal' && s.recoveryEvery > 0) {
    const n = plan.trainingWeeks(all, store.data.periods, s, now) + 1;
    cycle = div({ class: 'cycle' },
      icon('moon'),
      span({ class: 'grow' }, n >= s.recoveryEvery
        ? `Training week ${n} · recovery week due`
        : `Training week ${n} of ${s.recoveryEvery} · recovery week ${n === s.recoveryEvery - 1 ? 'due soon' : 'later'}`),
      button({ class: 'link-btn', onclick: () => { store.startRecovery(); toast('Recovery week started'); } }, 'Start now ›'));
  }

  return section({ class: `card week${isRecovery ? ' recovery' : ''}`, 'aria-label': 'Weekly goal' },
    head,
    div({ class: 'row', style: 'align-items:baseline;gap:8px' },
      span({ class: 'digits', style: 'font-size:64px;line-height:0.9' }, first.value),
      span({ class: 'muted', style: 'font-size:17px;font-weight:500' }, `/ ${first.target} ${unitLabel}`),
    ),
    div({
      class: `meter${isRecovery || kind.kind === 'ramp' ? ' teal' : ''}`, role: 'progressbar', 'aria-label': `Weekly ${unitLabel}`,
      'aria-valuemin': 0, 'aria-valuemax': first.target, 'aria-valuenow': first.value,
    }, div({ style: `width:${(first.pct * 100).toFixed(1)}%` })),
    div({ class: 'between small muted' },
      left > 0 ? span(strong(left), isRecovery ? ' to go · keeps your streak' : ' to go') : span(strong(first.value - first.target), ' over the goal'),
      second
        ? span(strong(second.value), ` / ${second.target} ${second.unit === 'min' ? 'min' : 'burpees'}`)
        : span(`${stats.minutes(week)} min · ${week.workouts} ${week.workouts === 1 ? 'workout' : 'workouts'}`),
    ),
    isRecovery
      ? div({ class: 'tips' },
        b({ style: 'color:var(--good)' }, 'Easy week: let your joints catch up'),
        span('· Same pace, about half the burpees'),
        span('· More 6-count, fewer Navy SEAL'),
        span('· No “make it harder” suggestions this week'))
      : [],
    div({ class: 'days' }, stats.dailySeries(all, start).map((d) => {
      const isToday = d.start === today;
      const n = d.sum.burpees;
      return div({ class: `day${isToday ? ' is-today' : ''}` },
        span(new Date(d.start).toLocaleDateString([], { weekday: 'narrow' })),
        n > 0 ? div({ class: 'day-dot done' }, n) : div({ class: `day-dot${isToday ? ' today' : ''}` }));
    })),
    cycle,
  );
}

// "Time for a recovery week" (proposal 2.8 a). Shown once due, until started
// or "Not this week". Nothing changes until the user taps Start.
function RecoveryReminder() {
  const now = Date.now();
  const s = store.settings();
  if (!s.recoveryEvery || store.thisWeek(now).kind !== 'normal') return [];
  if (store.data.ui.recoveryDismissedWeek === stats.weekStart(now, s.weekStartsOn)) return [];
  const n = plan.trainingWeeks(store.data.sessions, store.data.periods, s, now);
  if (n < s.recoveryEvery) return [];
  const easyGoal = plan.scaledGoal(s, s.recoveryPct / 100);
  const goalText = s.goalType === 'minutes' ? `${easyGoal.goalMinutes} min` : `goal ${easyGoal.goalBurpees}`;
  return section({ class: 'reminder', 'aria-label': 'Recovery week due' },
    div({ class: 'row', style: 'align-items:flex-start' },
      div({ class: 'icon teal' }, icon('moonBig')),
      div({ class: 'stack', style: 'gap:2px' },
        b({ style: 'font-size:15px;color:#0B3F3A' }, 'Time for a recovery week'),
        span({ class: 'small', style: 'color:#24413E;line-height:1.4' },
          `${n} training weeks in a row. An easy week (${goalText}) lets your joints catch up. Streak stays safe.`),
      ),
    ),
    div({ class: 'row', style: 'gap:8px' },
      button({ class: 'btn small grow teal', onclick: () => { store.startRecovery(); toast('Recovery week started'); } }, 'Start recovery week'),
      button({ class: 'btn small ghost teal-ghost', onclick: () => store.dismissRecoveryReminder() }, 'Not this week'),
    ),
    span({ class: 'small', style: 'color:#3F5F5B' }, 'Nothing changes until you tap Start.'),
  );
}

// Catch-up is a bonus, capped at half a workout so it can't become one huge session.
export const catchUpCount = (s, left) => Math.min(left, Math.max(1, Math.ceil(s.target / 2)));

function CatchUpCard(s) {
  const left = store.remaining(s);
  const count = catchUpCount(s, left);
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
          count, pace: s.pace, title: `${workoutTitle(w, count)} · catch-up`,
          catchUpOf: s.id, isCatchUp: true,
        }),
      }, count < left ? `Catch up ${count} · ${duration(count * s.pace)}` : `Catch up · ${duration(count * s.pace)}`),
      button({ class: 'btn small ghost warm', onclick: () => store.dismissCatchUp(s.id) }, 'Dismiss'),
    ),
  );
}

// One card per workout; its text follows edits and the week's easy versions.
function WorkoutCard(w) {
  const factor = () => plan.workoutFactor(store.thisWeek());
  const open = () => go('detail', { id: w.id });
  const resting = () => w.type === 'seal' && store.thisWeek().kind === 'recovery';
  return div({
    class: () => `workout${resting() ? ' resting' : ''}`, role: 'button', tabindex: 0, onclick: open,
    onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); open(); } },
  },
    () => badge(w.type),
    div({ class: 'meta' },
      span({ class: 'name' }, () => workoutTitle(w, plan.scaledCount(w.count, factor()))),
      span({ class: 'small muted' }, () => {
        const f = factor();
        const count = plan.scaledCount(w.count, f);
        const base = `Every ${pace(w.pace)} · ${duration(count * w.pace)}`;
        if (resting()) return 'Resting this week · still allowed';
        if (f < 1) return span(base, ' · ', b({ style: 'color:var(--good)' }, w.type === 'sixcount' ? 'suggested' : `usually ${w.count}`));
        return base;
      }),
    ),
    button({
      class: 'play', 'aria-label': () => `Start ${workoutTitle(w, plan.scaledCount(w.count, factor()))}`,
      onclick: (e) => { e.stopPropagation(); startRun(specFromWorkout(w, factor())); },
    }, icon('play')),
  );
}

export function Home() {
  return div({ class: 'view' },
    main({ class: 'screen with-nav' },
      div({ class: 'between', style: 'align-items:flex-end' },
        div(
          span({ class: 'small muted', style: 'font-weight:500' }, longDate()),
          h1('Burpees'),
        ),
        () => StreakPills(),
      ),
      () => {
        const p = store.activeBreak();
        return p ? BreakCard(p) : WeekCard();
      },
      () => div({ class: 'view' }, store.activeBreak() ? [] : RecoveryReminder()),
      () => div({ class: 'view' }, store.openCatchUps().slice(0, 2).map(CatchUpCard)),
      div({ class: 'between', style: 'padding-top:4px' },
        h2(() => (plan.workoutFactor(store.thisWeek()) < 1 ? 'This week’s easy versions' : 'My workouts')),
        span({ class: 'small muted' }, () => store.data.workouts.length),
      ),
      vanX.list(div({ class: 'stack' }), store.data.workouts, (v) => WorkoutCard(v.val)),
      () => div({ class: 'view' }, store.data.workouts.length ? [] : div({ class: 'empty' }, 'No workouts yet.', van.tags.br(), 'Tap + to create one.')),
    ),
    button({ class: 'fab', 'aria-label': 'New workout', onclick: () => go('editor', { isNew: true }) }, icon('plus')),
    Nav(),
  );
}
