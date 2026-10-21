// After a workout: record banner, count correction, "How did it feel?",
// make-it-harder suggestion, body check, weekly goal + streak, Save.

import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import * as store from '../store.js';
import * as stats from '../stats.js';
import * as plan from '../plan.js';
import { newRecords, suggestion } from '../motivation.js';
import { duration, pace } from '../format.js';
import { resetTo } from '../router.js';
import { saveResult } from '../run.js';
import { icon, Stepper, toast } from '../components.js';

const { a, b, button, div, h1, h2, main, span } = van.tags;

const AREAS = [
  ['tired', 'Nothing, just tired'], ['wrists', 'Wrists'], ['shoulders', 'Shoulders'],
  ['back', 'Lower back'], ['knees', 'Knees'], ['ankles', 'Ankles / Achilles'],
];

// Gentler options for a few days (proposal 2.8 c). General tips, not medical advice.
function bodyTips(areas) {
  const tips = [];
  let workout = null;
  if (areas.includes('wrists') || areas.includes('shoulders')) {
    tips.push('Next few days: burpees without the push-up');
    if (areas.includes('wrists')) tips.push('Make a fist or use push-up handles');
    tips.push('Skip Navy SEAL until it feels fine');
    workout = 'No push-up';
  }
  if (areas.includes('knees') || areas.includes('ankles')) {
    tips.push('Step back and in instead of jumping, skip the jump at the top');
    workout ??= 'Step-back';
  }
  if (areas.includes('back')) {
    tips.push('Slow the pace down by 2–3 seconds');
    tips.push('Step back and in instead of kicking back');
    workout ??= 'Step-back';
  }
  return { tips, workout };
}

function BodyCheck(r) {
  const picked = () => r.pain || [];
  const toggle = (id) => {
    if (id === 'tired') { r.pain = picked().includes('tired') ? [] : ['tired']; return; }
    const without = picked().filter((x) => x !== id && x !== 'tired');
    r.pain = picked().includes(id) ? without : [...without, id];
  };
  const addWorkout = (name) => {
    const exists = store.data.workouts.some((w) => w.type === 'other' && w.typeName === name);
    if (!exists) store.saveWorkout({ type: 'other', typeName: name, count: r.target, pace: r.pace });
    toast(exists ? `“${name}” is already in your workouts` : `Added “${name}” to your workouts`);
  };
  return div({ class: 'stack' },
    h2({ style: 'font-size:16px' }, 'Anything hurting?'),
    span({ class: 'small muted' }, 'Tired muscles are normal. Joint pain is a sign to ease off.'),
    div({ class: 'chips wrap' }, AREAS.map(([id, text]) => button({
      'aria-pressed': () => String(picked().includes(id)), onclick: () => toggle(id),
    }, text))),
    () => {
      const { tips, workout } = bodyTips(picked());
      if (!tips.length) return div({ class: 'view' });
      return div({ class: 'body-tip' },
        b({ style: 'color:var(--ink)' }, 'Go easier for a few days'),
        tips.map((t) => span(`· ${t}`)),
        workout
          ? button({ class: 'btn small ghost', style: 'align-self:flex-start;height:38px', onclick: () => addWorkout(workout) },
            `Add a “${workout}” workout`)
          : [],
        span({ class: 'small muted' }, 'Still hurts after 2 days, or sharp pain or swelling? Rest and get it checked. General tips, not medical advice.'),
      );
    },
  );
}

function RecordBanner(r) {
  if (r.isCatchUp) return div({ class: 'view' });
  const recs = newRecords(store.data.sessions, { ...r, startedAt: r.startedAt }, store.settings().weekStartsOn);
  if (!recs.length || r.done <= 0) return div({ class: 'view' });
  const top = recs[0];
  return div({ class: 'record' },
    div({ class: 'icon' }, icon('trophy')),
    div({ class: 'stack', style: 'gap:2px' },
      span({ class: 'kicker' }, top.kind === 'first' ? 'First time' : 'New record'),
      span({ style: 'font-size:15px;font-weight:600' }, top.text),
      top.was != null ? span({ class: 'small', style: 'color:#C9CAD0' }, `Previous best: ${top.was}`) : [],
      recs.length > 1 ? span({ class: 'small', style: 'color:#C9CAD0' }, `+ ${recs.length - 1} more ${recs.length === 2 ? 'record' : 'records'}`) : [],
    ),
  );
}

function Suggestion(r) {
  const workout = r.workoutId ? store.getWorkout(r.workoutId) : null;
  if (!workout || r.isCatchUp) return div({ class: 'view' });
  const sug = suggestion({
    workout, feel: r.feel, previous: store.sessionsFor(r.workoutId), reducedWeek: r.reduced,
  });
  // Harder options only after a full workout; "repeat" fits stopped ones too.
  if (!sug || (sug.kind !== 'repeat' && r.done < r.target)) return div({ class: 'view' });
  if (sug.kind === 'repeat') {
    return div({ class: 'suggest' }, b('Hard one. Repeating it is progress too.'),
      span({ class: 'small muted' }, 'Same workout next time. It gets easier before you notice.'));
  }
  if (sug.kind === 'capped') {
    return div({ class: 'suggest' }, b('Feeling easy: nice! Keep it the same for now.'),
      span({ class: 'small muted' }, 'The next step would add more than ~10% this week. Small steps add up and keep your joints happy.'));
  }
  const label = (o) => (o.change === 'count' ? `+1 burpee` : `−0.5 s pace`);
  const detail = (o) => (o.change === 'count' ? `${o.from} → ${o.to}` : `${o.from} → ${o.to} s`);
  return div({ class: 'suggest' },
    div({ class: 'stack', style: 'gap:2px' },
      b('2 easy workouts in a row: ready for a bit more?'),
      span({ class: 'small muted' }, 'Pick one change for next time'),
    ),
    div({ class: 'options' }, sug.options.map((o, i) => button({
      class: 'choice', 'aria-pressed': () => String(r.bump === i),
      onclick: () => { r.bump = r.bump === i ? null : i; },
    }, label(o), van.tags.small(detail(o))))),
    button({ class: 'btn plain', onclick: () => { r.bump = null; } }, 'Keep it the same: repeating is progress too'),
  );
}

function WeekLine(r) {
  const s = store.settings();
  const candidate = { ...r, done: r.done, activeSec: r.activeSec };
  const sessions = [...store.data.sessions, candidate];
  const ws = stats.weekStart(Date.now(), s.weekStartsOn);
  const w = plan.weekGoal(sessions, ws, store.data.periods, s);
  const [first] = w.goal.parts;
  const streak = plan.streakInfo(sessions, store.data.periods, s).streak;
  const left = Math.max(0, first.target - first.value);
  const unit = first.unit === 'min' ? 'min' : 'burpees';
  let line;
  if (w.kind === 'break') line = 'On a break: this one is a bonus.';
  else if (w.goal.hit) line = streak > 1 ? `Goal hit: ${streak}-week streak` : 'Weekly goal hit';
  else if (streak > 0) line = `${left} more keeps your ${streak}-week streak going`;
  else line = `${left} more to hit this week’s goal`;
  return div({ class: 'card flat stack', style: 'gap:8px' },
    div({ class: 'between', style: 'font-size:14px' },
      span({ style: 'font-weight:600' }, w.kind === 'recovery' ? 'This recovery week' : 'This week'),
      span({ class: 'muted' }, b({ style: 'color:var(--ink)' }, first.value), ` / ${first.target} ${unit}`),
    ),
    div({ class: `meter${w.kind === 'recovery' ? ' teal' : ''}`, style: 'height:8px' }, div({ style: `width:${(first.pct * 100).toFixed(1)}%` })),
    span({ class: 'streak-line' }, icon('flame'), line),
  );
}

export function Summary({ result: r }) {
  const complete = r.done >= r.target;
  r.feel ??= null;
  r.pain ??= [];
  r.bump ??= null;
  const showBody = van.state(false);
  const left = () => r.target - r.done;

  const save = () => {
    if (r.bump != null) {
      const workout = store.getWorkout(r.workoutId);
      const sug = workout && suggestion({ workout, feel: r.feel, previous: store.sessionsFor(r.workoutId), reducedWeek: r.reduced });
      const option = sug?.options?.[r.bump];
      if (option) store.bumpWorkout(r.workoutId, option);
    }
    saveResult(vanX.compact(r));
  };

  const discard = () => {
    if (!confirm('Discard this workout? It will not be saved.')) return;
    resetTo('home');
  };

  return main({ class: 'screen white' },
    div({ class: 'done-head' },
      div({ class: `check${complete ? '' : ' partial'}` }, icon(complete ? 'check' : 'pauseSmall')),
      div({ class: 'stack', style: 'gap:2px' },
        h1({ style: 'font-size:24px' }, complete ? 'Workout complete!' : 'Stopped early'),
        span({ class: 'small muted' }, complete ? `${r.title} · every ${pace(r.pace)}` : 'Good effort. What you did counts.'),
      ),
    ),

    () => RecordBanner(r),

    div({ class: 'stats' },
      div(span({ class: 'label' }, 'Burpees'), span({ class: 'digits' }, () => (r.done >= r.target ? r.done : `${r.done} / ${r.target}`))),
      div(span({ class: 'label' }, 'Time'), span({ class: 'digits' }, duration(r.activeSec))),
      r.pausedSec >= 1
        ? div(span({ class: 'label' }, 'Paused'), span({ class: 'digits' }, duration(r.pausedSec)))
        : div(span({ class: 'label' }, 'Pace'), span({ class: 'digits' }, pace(r.pace))),
    ),

    div({ class: 'between card flat', style: 'padding:10px 10px 10px 16px' },
      div({ class: 'stack', style: 'gap:2px' },
        span({ style: 'font-weight:600' }, 'Burpees done'),
        span({ class: 'small muted' }, 'Fix it if you missed some'),
      ),
      Stepper({
        value: () => r.done, min: 0, max: r.target, label: 'burpees done',
        onStep: (d) => { r.done = Math.min(r.target, Math.max(0, r.done + d)); },
      }),
    ),

    () => {
      if (r.isCatchUp) return div({ class: 'note' }, b(`+${r.done} recovered. `), 'Nice bonus on top of your workout.');
      if (left() > 0) {
        return div({ class: 'note' }, b(`${left()} left. `),
          'Home will offer a short catch-up workout',
          store.settings().catchUpUntil === 'endOfDay' ? ' until the end of today.' : '.');
      }
      return div({ class: 'view' });
    },

    div({ class: 'stack' },
      div({ class: 'between', style: 'align-items:baseline' },
        h2({ style: 'font-size:16px' }, 'How did it feel?'),
        a({ href: '#', class: 'small', style: 'font-weight:600', onclick: (e) => { e.preventDefault(); showBody.val = !showBody.val; } }, 'Something hurt?'),
      ),
      div({ class: 'feel' }, [['easy', 'Easy'], ['ok', 'OK'], ['hard', 'Hard']].map(([v, text]) => button({
        'aria-pressed': () => String(r.feel === v),
        onclick: () => { r.feel = r.feel === v ? null : v; r.bump = null; },
      }, text))),
    ),

    () => Suggestion(r),
    () => ((showBody.val || (r.feel === 'hard' && store.settings().painCheck)) ? BodyCheck(r) : div({ class: 'view' })),
    () => WeekLine(r),

    div({ class: 'grow' }),
    div({ class: 'stack', style: 'gap:8px' },
      button({
        class: 'btn block', disabled: () => r.done <= 0, style: () => (r.done <= 0 ? 'opacity:.5' : ''), onclick: save,
      }, 'Save'),
      button({ class: 'btn plain block', onclick: discard }, 'Discard'),
    ),
  );
}
