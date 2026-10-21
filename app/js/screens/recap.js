// Monday review (first open of a new week) and the Year in Burpees recap.

import van from 'vanjs-core';
import * as store from '../store.js';
import { TYPES } from '../types.js';
import { hoursMinutes } from '../format.js';
import { weekReview, yearRecap } from '../review.js';
import { resetTo, back } from '../router.js';
import { icon, toast } from '../components.js';

const { b, button, div, h1, input, label, main, span } = van.tags;

const STATUS = {
  building: { title: 'Nice week!', pill: '↑ Building' },
  holding: { title: 'Solid week', pill: '→ Holding' },
  resting: { title: 'Rest week', pill: 'Resting' },
};

const shortDate = (ts) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
const range = (a, b2) => `${shortDate(a)} – ${shortDate(b2 - 1)}`;

export function WeekReview() {
  const s = store.settings();
  const r = weekReview(store.data.sessions, store.data.periods, s);
  const st = STATUS[r.status];
  const days = van.state([...store.data.plan.days]);
  let cue = store.data.plan.cue;

  let vsAvg;
  if (r.avg == null) vsAvg = 'Your first full week. Nice start.';
  else if (r.pct >= 0) vsAvg = `${r.pct}% more than your 4-week average (${r.avg})`;
  else if (r.status === 'resting') vsAvg = `Lighter than your 4-week average (${r.avg}), and that’s fine. Rest is part of it.`;
  else vsAvg = `Close to your 4-week average (${r.avg})`;

  const goalTile = r.kind === 'break' ? 'On a break' : r.goalHit ? 'Hit ✓' : 'Not this time';
  const order = s.weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const dayName = (d) => new Date(2026, 9, 18 + d).toLocaleDateString([], { weekday: 'narrow' }); // 18 Oct 2026 is a Sunday
  const toggle = (d) => { days.val = days.val.includes(d) ? days.val.filter((x) => x !== d) : [...days.val, d]; };

  const finish = (save) => {
    if (save) store.savePlan(days.val, cue);
    store.markReviewed();
    resetTo('home');
    if (save) toast(days.val.length ? 'Week planned' : 'Have a good week');
  };

  return main({ class: 'screen white' },
    div({ class: 'between', style: 'align-items:flex-start' },
      div({ class: 'stack', style: 'gap:2px' },
        span({ class: 'eyebrow' }, `Your week · ${range(r.start, r.end)}`),
        h1({ style: 'font-size:26px' }, st.title),
      ),
      span({ class: `pill-teal${r.status === 'resting' ? ' grey' : ''}`, style: 'text-transform:none;letter-spacing:0;font-size:13px' }, st.pill),
    ),
    div({ class: 'stack', style: 'gap:2px' },
      div({ class: 'row', style: 'align-items:baseline;gap:8px' },
        span({ class: 'digits', style: 'font-size:72px;line-height:0.9' }, r.total),
        span({ class: 'muted', style: 'font-size:17px;font-weight:500' }, 'burpees'),
      ),
      span({ style: 'font-size:14px;color:var(--ink-2)' }, vsAvg),
    ),
    div({ class: 'tiles' },
      div(span({ class: 'small muted' }, 'Goal'), b(goalTile)),
      div(span({ class: 'small muted' }, 'Workouts'), b(r.workouts)),
      div(span({ class: 'small muted' }, 'Streak'), b(`${r.streak} ${r.streak === 1 ? 'week' : 'weeks'}`)),
    ),
    r.highlight
      ? div({ class: 'record' }, div({ class: 'stack', style: 'gap:2px' }, span({ class: 'kicker' }, 'Highlight'), b(r.highlight)))
      : [],
    div({ class: 'stack', style: 'border-top:1px solid var(--line);padding-top:16px' },
      b({ style: 'font-size:17px' }, 'New week. Plan your sessions?'),
      div({ class: 'weekdays' }, order.map((d) => button({
        'aria-pressed': () => String(days.val.includes(d)), 'aria-label': new Date(2026, 9, 18 + d).toLocaleDateString([], { weekday: 'long' }),
        onclick: () => toggle(d),
      }, dayName(d)))),
      label({ class: 'field' }, 'When? (your cue)',
        input({ type: 'text', maxlength: 40, placeholder: 'e.g. After morning coffee', value: cue, oninput: (e) => { cue = e.target.value; } })),
      span({ class: 'small muted' }, 'Shown on Home on those days as “Today’s plan”.'),
    ),
    div({ class: 'grow' }),
    button({ class: 'btn block', onclick: () => finish(true) }, 'Start the week'),
    button({ class: 'btn plain block', onclick: () => finish(false) }, 'Skip'),
  );
}

// ------------------------------------------------------------------ Year in Burpees
export function YearRecap({ year }) {
  const r = yearRecap(store.data.sessions, store.data.periods, store.settings(), year);
  const monthName = (m) => new Date(year, m, 1).toLocaleDateString([], { month: 'long' });
  const max = Math.max(1, ...r.months);
  const stat = (labelText, value) => div(span({ class: 'small muted' }, labelText), b({ style: 'font-size:18px' }, value));

  return main({ class: 'screen white' },
    div({ class: 'topbar' }, button({ class: 'icon-btn', 'aria-label': 'Back', onclick: back }, icon('back')), span()),
    span({ class: 'eyebrow' }, 'Year in Burpees'),
    h1({ style: 'font-size:34px' }, `Your ${year}`),
    div({ class: 'row', style: 'align-items:baseline;gap:8px' },
      span({ class: 'digits', style: 'font-size:88px;line-height:0.9;color:var(--accent)' }, r.burpees),
      span({ class: 'muted', style: 'font-size:18px;font-weight:500' }, 'burpees'),
    ),
    div({ class: 'tiles' },
      stat('Workouts', r.workouts),
      stat('Time', hoursMinutes(r.minutes * 60)),
      stat('Active days', r.days),
    ),
    div({ class: 'card flat stack', style: 'gap:8px' },
      b('Burpees per month'),
      div({ class: 'months' }, r.months.map((n, m) => div({ class: 'month', title: `${monthName(m)}: ${n} burpees` },
        div({ class: 'month-bar', style: `height:${Math.max(n ? 3 : 0, (n / max) * 80).toFixed(1)}px` }),
        span(new Date(year, m, 1).toLocaleDateString([], { month: 'narrow' }))))),
    ),
    div({ class: 'tiles two' },
      stat('Best month', r.bestMonth != null ? `${monthName(r.bestMonth)} · ${r.months[r.bestMonth]}` : '–'),
      stat('Best week', r.bestWeek ? `${r.bestWeek} burpees` : '–'),
      stat('Favourite', r.favourite ? `${TYPES[r.favourite].name} · ${r.byType[r.favourite]}` : '–'),
      stat('Best streak', `${r.bestStreak} ${r.bestStreak === 1 ? 'week' : 'weeks'}`),
    ),
    span({ class: 'small muted', style: 'line-height:1.45' }, r.burpees
      ? `${r.activeWeeks} active ${r.activeWeeks === 1 ? 'week' : 'weeks'}, about ${Math.round(r.burpees / r.activeWeeks)} burpees in each. Here’s to next year.`
      : 'No workouts this year yet. Next year starts whenever you do.'),
  );
}
