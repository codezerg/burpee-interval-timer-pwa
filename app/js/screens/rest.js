// Take a break (sick / holiday / injury) and Welcome back (gentle restart).

import van from 'vanjs-core';
import * as store from '../store.js';
import * as plan from '../plan.js';
import { workoutTitle } from '../types.js';
import { duration, pace } from '../format.js';
import { back, resetTo } from '../router.js';
import { icon, Seg, toast } from '../components.js';

const { b, button, div, h1, main, span } = van.tags;

const DAY = 864e5;

// ------------------------------------------------------------------ take a break
export function TakeBreak() {
  const reason = van.state('sick');
  const weeks = van.state(null);
  const start = () => {
    store.startBreak(reason.val, weeks.val);
    resetTo('home');
    toast('Break started. Your streak is frozen.');
  };
  const streak = plan.streakInfo(store.data.sessions, store.data.periods, store.settings()).streak;
  const choice = (v, text) => button({ class: 'choice', 'aria-pressed': () => String(reason.val === v), onclick: () => { reason.val = v; } }, text);

  return main({ class: 'screen white' },
    div({ class: 'topbar' }, button({ class: 'icon-btn', 'aria-label': 'Back', onclick: back }, icon('back')), span()),
    div({ class: 'stack', style: 'gap:4px' },
      h1('Take a break'),
      span({ class: 'muted' }, 'Life happens. Your streak waits for you.'),
    ),
    div({ class: 'stack' },
      span({ class: 'eyebrow' }, 'Why?'),
      div({ class: 'choices-2' }, choice('sick', 'Sick'), choice('holiday', 'Holiday'), choice('injury', 'Injury'), choice('other', 'Other')),
    ),
    div({ class: 'stack' },
      span({ class: 'eyebrow' }, 'How long?'),
      Seg([[1, '1 week'], [2, '2 weeks'], [null, 'Until I’m back']], () => weeks.val, (v) => { weeks.val = v; }),
    ),
    div({ class: 'info-list' },
      b('During the break'),
      div(icon('shield'), span(streak ? ['Your ', b(`${streak}-week streak is frozen`), ': not lost, no shields used'] : 'Your streak is frozen: not lost, no shields used')),
      div(icon('pauseSmall'), span('No weekly goal and no reminders. These weeks show grey in History.')),
      div(icon('check'), span('When you’re back, the app suggests a gentle restart.')),
    ),
    () => (reason.val === 'sick'
      ? span({ class: 'small muted', style: 'line-height:1.4' }, 'After a fever, wait until you’ve been symptom-free for a few days before training again.')
      : div({ class: 'view' })),
    div({ class: 'grow' }),
    button({ class: 'btn block', onclick: start }, 'Start break'),
    button({ class: 'btn plain block', onclick: back }, 'Cancel'),
  );
}

// ------------------------------------------------------------------ welcome back
// Most-used workout, for the "your first workout back" example.
function favouriteWorkout() {
  const counts = new Map();
  for (const s of store.data.sessions) counts.set(s.workoutId, (counts.get(s.workoutId) || 0) + 1);
  return [...store.data.workouts].sort((x, y) => (counts.get(y.id) || 0) - (counts.get(x.id) || 0))[0];
}

export function lastSession() {
  return store.sessions()[0] || null;
}

export function WelcomeBack() {
  const now = Date.now();
  const s = store.settings();
  const brk = store.activeBreak(now);
  const last = lastSession();
  const sinceTs = last ? last.startedAt : (brk ? brk.start : now);
  const daysOff = Math.max(1, Math.round((now - sinceTs) / DAY));
  const restart = plan.restartPlan(daysOff, brk?.reason);
  const factors = [...restart.factors, 1];
  const minutesGoal = s.goalType === 'minutes';
  const target = (f) => (minutesGoal ? plan.scaledGoal(s, f).goalMinutes : plan.scaledGoal(s, f).goalBurpees);
  const fav = favouriteWorkout();

  const finish = (withPlan) => {
    store.endBreak(now);
    if (withPlan) store.startRamp(restart.factors, now);
    if (last) store.markWelcomeSeen(last.id);
    resetTo('home');
    if (withPlan) toast('Gentle restart planned');
  };

  return main({ class: 'screen white' },
    div({ class: 'icon', style: 'width:56px;height:56px;border-radius:18px;background:var(--accent-tint-2);color:var(--accent-ink);display:flex;align-items:center;justify-content:center' }, icon('redo')),
    div({ class: 'stack', style: 'gap:6px' },
      h1('Welcome back!'),
      span({ style: 'font-size:15px;color:var(--ink-2);line-height:1.45' },
        `${daysOff} ${daysOff === 1 ? 'day' : 'days'} off${brk ? ` (${brk.reason === 'other' ? 'break' : brk.reason})` : ''}. `,
        'You lost less than you think: fitness fades slowly. Let’s ease back in so your joints can catch up.'),
    ),
    div({ class: 'card flat stack', style: 'gap:14px' },
      span({ class: 'eyebrow' }, `Your ${factors.length}-week ramp back`),
      factors.map((f, i) => div({ class: 'ramp' },
        span({ style: `font-size:14px;font-weight:${i === 0 ? 700 : 600}` }, `Week ${i + 1}`),
        div({ class: 'meter' }, div({ style: `width:${f * 100}%;${i === 0 ? '' : 'background:#F9C27A'}` })),
        span({ class: 'digits', style: 'font-size:20px;text-align:right' }, target(f)),
      )),
      fav
        ? div({ class: 'row', style: 'background:var(--bg);border-radius:14px;padding:10px 12px' },
          div({ class: 'stack', style: 'gap:2px' },
            span({ style: 'font-weight:600' }, workoutTitle(fav, plan.scaledCount(fav.count, restart.factors[0]))),
            span({ class: 'small muted' }, `Every ${pace(fav.pace)} · ${duration(plan.scaledCount(fav.count, restart.factors[0]) * fav.pace)} · usually ${fav.count}`),
          ))
        : [],
      span({ class: 'small muted', style: 'line-height:1.4' }, `Same pace as before, fewer burpees. ${minutesGoal ? 'Minutes' : 'Burpees'} per week goal shown on the right.`),
    ),
    div({ class: 'grow' }),
    button({ class: 'btn block', onclick: () => finish(true) }, 'Start gentle plan'),
    button({ class: 'btn plain block', onclick: () => finish(false) }, `Skip, go straight back to ${target(1)}`),
  );
}
