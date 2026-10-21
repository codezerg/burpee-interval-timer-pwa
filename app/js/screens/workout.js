// Workout detail, the new/edit workout editor, and the burpee how-to page.

import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import * as store from '../store.js';
import { TYPES, TYPE_ORDER, workoutTitle } from '../types.js';
import { duration, pace, dayLabel } from '../format.js';
import { go, back, resetTo, pop } from '../router.js';
import { startRun } from '../run.js';
import { icon, badge, Stepper, toast } from '../components.js';
import { specFromWorkout } from './home.js';

const { a, b, button, div, h1, h2, input, label, li, main, ol, p, span } = van.tags;

// ------------------------------------------------------------------ detail
function RecentRow(s) {
  const caught = store.catchUpsOf(s.id).reduce((n, c) => n + c.done, 0);
  const total = s.done + caught;
  const sub = caught
    ? `${s.done} + ${caught} catch-up · every ${pace(s.pace)}`
    : `${duration(s.activeSec)} · every ${pace(s.pace)}`;
  return div({ class: 'list-item' },
    div({ class: 'stack', style: 'gap:3px' },
      span({ class: 'small muted' }, dayLabel(s.startedAt)),
      span({ class: 'small' }, sub),
    ),
    div({ class: 'stack', style: 'align-items:flex-end;gap:4px' },
      span({ class: 'digits', style: 'font-size:24px' }, `${total} / ${s.target}`),
      total < s.target ? span({ class: 'pill partial' }, 'Partial') : [],
    ),
  );
}

export function Detail({ id }) {
  const w = store.getWorkout(id);
  if (!w) {
    queueMicrotask(() => resetTo('home'));
    return div({ class: 'view' });
  }
  return main({ class: 'screen white' },
    div({ class: 'topbar' },
      button({ class: 'icon-btn', 'aria-label': 'Back', onclick: back }, icon('back')),
      button({ class: 'text-btn accent', onclick: () => go('editor', { id }) }, 'Edit'),
    ),
    div({ class: 'stack', style: 'gap:8px' },
      () => badge(w.type),
      h1(() => workoutTitle(w)),
      div(button({ class: 'chip', onclick: () => go('howto', { type: w.type }) }, 'How to do it ', icon('info'))),
    ),
    div({ class: 'stats' },
      div(span({ class: 'label' }, 'Burpees'), span({ class: 'digits' }, () => w.count)),
      div(span({ class: 'label' }, 'Pace'), span({ class: 'digits' }, () => pace(w.pace))),
      div(span({ class: 'label' }, 'Duration'), span({ class: 'digits' }, () => duration(w.count * w.pace))),
    ),
    () => {
      const all = store.sessionsFor(id);
      return div({ class: 'view' },
        div({ class: 'between' },
          h2('Recent'),
          span({ class: 'small muted' }, `Done ${all.length} ${all.length === 1 ? 'time' : 'times'}`),
        ),
        div(all.length
          ? all.slice(0, 8).map(RecentRow)
          : div({ class: 'small muted' }, 'Not done yet. Your first one starts below.')),
      );
    },
    div({ class: 'grow' }),
    button({ class: 'btn block', onclick: () => startRun(specFromWorkout(w)) }, icon('play'), ' START'),
  );
}

// ------------------------------------------------------------------ editor
const clampPace = (x) => Math.min(60, Math.max(2, Math.round(x * 2) / 2));

export function Editor({ id, isNew }) {
  const source = isNew ? { type: 'standard', typeName: '', count: 20, pace: 15 } : store.getWorkout(id);
  if (!source) {
    queueMicrotask(() => resetTo('home'));
    return div({ class: 'view' });
  }
  // Edit a copy; nothing changes in the store until Save.
  const draft = vanX.reactive({ ...vanX.compact(source), typeName: source.typeName || '' });
  let paceTouched = !isNew;

  const pickType = (type) => {
    if (!paceTouched) draft.pace = TYPES[type].defaultPace;
    draft.type = type;
  };

  const save = () => {
    const w = vanX.compact(draft);
    if (w.type === 'other') w.typeName = w.typeName.trim() || 'Other';
    else delete w.typeName;
    store.saveWorkout(w);
    if (isNew) resetTo('home'); else pop();
    toast('Workout saved');
  };

  const remove = () => {
    if (!confirm(`Delete "${workoutTitle(draft)}"? Past sessions stay in your history.`)) return;
    store.deleteWorkout(id);
    resetTo('home');
    toast('Workout deleted');
  };

  // The name field is built once per "Other" selection and reads the draft
  // without subscribing, so typing doesn't rebuild it (and keep focus).
  const nameField = () => label({ class: 'field' }, 'Name of your variation',
    input({
      type: 'text', maxlength: 30, placeholder: 'e.g. No push-up',
      value: vanX.raw(draft).typeName,
      oninput: (e) => { draft.typeName = e.target.value; },
    }));

  return main({ class: 'screen white' },
    div({ class: 'topbar' },
      button({ class: 'text-btn', onclick: back }, 'Cancel'),
      span({ class: 'title' }, isNew ? 'New workout' : 'Edit workout'),
      button({ class: 'text-btn accent', onclick: save }, 'Save'),
    ),

    div({ class: 'card flat', style: 'background:var(--bg);border:none' },
      div({ class: 'stack', style: 'gap:4px' },
        span({ style: 'font-size:20px;font-weight:700' }, () => workoutTitle(draft)),
        span({ class: 'small muted' }, () => `Every ${pace(draft.pace)} · total ${duration(draft.count * draft.pace)}`),
      ),
    ),

    div({ class: 'stack' },
      span({ class: 'eyebrow' }, 'Burpee type'),
      div({ class: 'types' }, TYPE_ORDER.map((t) => button({
        class: 'type-btn', 'aria-pressed': () => String(draft.type === t), onclick: () => pickType(t),
      }, span({ class: 'dot', style: `background:${TYPES[t].color}` }), TYPES[t].name))),
      () => (draft.type === 'other'
        ? nameField()
        : div({ class: 'howto' },
          `${TYPES[draft.type].summary} ${TYPES[draft.type].pace}`,
          div({ style: 'margin-top:6px' }, a({
            href: '#', onclick: (e) => { e.preventDefault(); go('howto', { type: draft.type }); },
          }, 'Full how-to ›')))),
    ),

    div({ class: 'stack' },
      div({ class: 'between' },
        span({ class: 'eyebrow' }, 'Burpees'),
        Stepper({ value: () => draft.count, onStep: (d) => { draft.count = Math.min(500, Math.max(1, draft.count + d)); }, min: 1, max: 500, label: 'burpees' }),
      ),
      div({ class: 'chips' }, [10, 20, 30, 40].map((n) => button({
        'aria-pressed': () => String(draft.count === n), onclick: () => { draft.count = n; },
      }, n))),
    ),

    div({ class: 'between' },
      div({ class: 'stack', style: 'gap:2px' },
        span({ class: 'eyebrow' }, 'Seconds per burpee'),
        span({ class: 'small muted' }, 'Beginner 15 s · fit 4–5 s'),
      ),
      Stepper({
        value: () => draft.pace, step: 0.5, min: 2, max: 60, label: 'seconds per burpee',
        onStep: (d) => { draft.pace = clampPace(draft.pace + d); paceTouched = true; },
      }),
    ),

    div({ class: 'between card flat' },
      span({ style: 'font-weight:600' }, 'Total time'),
      span({ class: 'digits', style: 'font-size:30px' }, () => duration(draft.count * draft.pace)),
    ),

    isNew ? [] : button({ class: 'btn danger', onclick: remove }, 'Delete workout'),
  );
}

// ------------------------------------------------------------------ how-to
export function HowTo({ type }) {
  const t = TYPES[type];
  const extra = [
    t.pace && p({ style: 'margin:0' }, b('Pace. '), t.pace),
    t.easier && p({ style: 'margin:0' }, b('Easier. '), t.easier),
    t.mistakes && p({ style: 'margin:0' }, b('Common mistakes. '), t.mistakes),
  ].filter(Boolean);
  return main({ class: 'screen white' },
    div({ class: 'topbar' }, button({ class: 'icon-btn', 'aria-label': 'Back', onclick: back }, icon('back')), span()),
    div({ class: 'stack', style: 'gap:6px' },
      span({ class: 'eyebrow', style: `color:${t.ink}` }, 'How to do it'),
      h1(`${t.name} burpee`),
      span({ class: 'muted' }, t.summary),
    ),
    t.steps.length
      ? ol({ class: 'steps' }, t.steps.map((s) => li(s)))
      : p({ class: 'muted' }, 'Your own variation. Do it the same way every time so your progress compares fairly.'),
    extra.length ? div({ class: 'howto stack', style: 'gap:8px' }, extra) : [],
  );
}
