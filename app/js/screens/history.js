// History: stacked bar chart by burpee type, totals, records, activity list.

import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import * as store from '../store.js';
import * as stats from '../stats.js';
import * as plan from '../plan.js';
import { bests, badges, paceProgress, trends } from '../motivation.js';
import { TYPES, TYPE_ORDER, STACK_ORDER, workoutTitle } from '../types.js';
import { duration, hoursMinutes, pace, dayLabel } from '../format.js';
import { icon, badge, Nav, Seg, toast } from '../components.js';

const { b, button, div, h1, h2, main, section, span } = van.tags;
const { svg, path, circle, text: svgText, title: svgTitle } = van.tags('http://www.w3.org/2000/svg');

// Kept across visits to the tab.
const ui = vanX.reactive({ range: 'weeks', filter: null, sel: null, limit: 20 });

const RANGES = [['week', 'This week'], ['weeks', '8 weeks'], ['all', '12 months']];
const CHART_H = 160;
const typeLabel = (t) => TYPES[t].name;

function niceMax(v) {
  if (v <= 10) return 10;
  const step = 10 ** Math.floor(Math.log10(v)) / 2;
  return Math.ceil(v / step) * step;
}

const breakdown = (sum) =>
  STACK_ORDER.filter((t) => sum.byType[t] > 0).map((t) => `${typeLabel(t)} ${sum.byType[t]}`).join(' · ');

// Bars per day (this week), week (8 weeks) or month (12 months).
function series(list, s, now) {
  if (ui.range === 'week') {
    const start = stats.weekStart(now, s.weekStartsOn);
    const rows = stats.dailySeries(list, start);
    return {
      rows, from: start, unit: 'day',
      label: (d) => new Date(d.start).toLocaleDateString([], { weekday: 'narrow' }),
      title: (d) => new Date(d.start).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }),
    };
  }
  if (ui.range === 'all') {
    const rows = stats.monthlySeries(list, { count: 12, now });
    return {
      rows, from: rows[0].start, unit: 'month',
      label: (m) => new Date(m.start).toLocaleDateString([], { month: 'narrow' }),
      title: (m) => new Date(m.start).toLocaleDateString([], { month: 'long', year: 'numeric' }),
    };
  }
  const rows = stats.weeklySeries(list, { count: 8, now, startDay: s.weekStartsOn });
  return {
    rows, from: rows[0].start, unit: 'week',
    label: (w, i) => (i === rows.length - 1 ? 'Now' : new Date(w.start).toLocaleDateString([], { day: 'numeric', month: 'numeric' })),
    title: (w) => `Week of ${new Date(w.start).toLocaleDateString([], { day: 'numeric', month: 'short' })}`,
  };
}

function Chart(ser, total, all, s, now) {
  const { rows } = ser;
  // Goal line only where it means something: weekly bars, burpee goal, all types.
  const goalLine = ui.range === 'weeks' && s.goalType !== 'minutes' && !ui.filter ? s.goalBurpees : null;
  const top = niceMax(Math.max(goalLine || 0, ...rows.map((x) => x.sum.burpees)) * (goalLine ? 1.1 : 1));
  const h = (v) => (v / top) * CHART_H;
  // Default selection: today in the week view, the current week/month otherwise.
  const current = rows.findIndex((x) => now >= x.start && now < x.end);
  const selected = ui.sel != null && ui.sel < rows.length ? ui.sel : (current >= 0 ? current : rows.length - 1);
  const cur = rows[selected];
  const cols = `grid-template-columns:repeat(${rows.length}, minmax(0, 1fr))`;

  let meta = '';
  if (ui.filter) meta = `${typeLabel(ui.filter)} only`;
  else if (ui.range === 'weeks') {
    const hits = rows.filter((w) => plan.weekGoal(all, w.start, store.data.periods, s, now).goal.hit).length;
    meta = `Goal hit ${hits} of 8 weeks`;
  }
  // Recovery and break weeks get a marker above their bar (weekly view only).
  const kinds = rows.map((x) => (ui.range === 'weeks' ? plan.weekKind(x.start, store.data.periods, now).kind : 'normal'));

  return section({ class: 'card', 'aria-label': 'Burpees chart' },
    div({ class: 'between', style: 'align-items:baseline' },
      h2({ style: 'font-size:15px' }, `Burpees per ${ser.unit}`),
      span({ class: 'small muted' }, meta),
    ),
    div({ class: 'chart', style: `height:${CHART_H + 12}px` },
      goalLine ? div({ class: 'goal-line', style: `bottom:${h(goalLine).toFixed(1)}px` }, span(`Goal ${goalLine}`)) : [],
      div({ class: 'bars', style: `height:${CHART_H}px;${cols}` }, rows.map((x, i) => button({
        class: `bar${kinds[i] === 'break' ? ' break-week' : ''}`, 'aria-pressed': String(i === selected),
        'aria-label': `${ser.title(x)}: ${x.sum.burpees} burpees${kinds[i] === 'normal' ? '' : ` (${kinds[i]} week)`}`,
        onclick: () => { ui.sel = i; },
      },
        kinds[i] === 'recovery' || kinds[i] === 'break'
          ? span({ class: `bar-mark ${kinds[i]}`, style: `bottom:${(h(x.sum.burpees) + 6).toFixed(1)}px` }, icon(kinds[i] === 'recovery' ? 'moon' : 'pauseSmall'))
          : [],
        div({ class: 'stack-bar' }, STACK_ORDER.filter((t) => x.sum.byType[t] > 0).map((t) =>
          div({ style: `height:${Math.max(2, h(x.sum.byType[t])).toFixed(1)}px;background:${TYPES[t].bar}` })))))),
    ),
    div({ class: 'bar-labels', style: cols },
      rows.map((x, i) => span({ class: i === selected ? 'on' : '' }, ser.label(x, i)))),
    div({ class: 'bar-detail' },
      b(`${ser.title(cur)}: ${cur.sum.burpees} burpees`,
        kinds[selected] === 'recovery' ? ' · recovery week' : kinds[selected] === 'break' ? ' · on a break' : ''),
      span({ class: 'muted' }, cur.sum.burpees ? `${breakdown(cur.sum)} · ${stats.minutes(cur.sum)} min` : 'No workouts'),
    ),
    div({ class: 'legend' }, STACK_ORDER.filter((t) => (ui.filter ? t === ui.filter : true)).map((t) =>
      span({ class: 'legend-item' }, span({ class: 'swatch', style: `background:${TYPES[t].bar}` }), typeLabel(t), b(total.byType[t])))),
    kinds.some((k) => k === 'recovery' || k === 'break')
      ? div({ class: 'marks-legend' },
        kinds.includes('recovery') ? span({ style: 'color:var(--good)' }, icon('moon'), 'Recovery week') : [],
        kinds.includes('break') ? span(icon('pauseSmall'), 'On a break') : [])
      : [],
  );
}

function Records(all, s, now) {
  const rows = TYPE_ORDER
    .filter((t) => !ui.filter || t === ui.filter)
    .map((t) => [t, bests(all, t, s.weekStartsOn)])
    .filter(([, r]) => r.count);
  if (!rows.length) return [];
  const streak = plan.streakInfo(all, store.data.periods, s, now);
  const hits = streak.weeks.filter((w) => w.status === 'hit').length;
  return section({ class: 'card', 'aria-label': 'Records' },
    div({ class: 'between', style: 'align-items:baseline' },
      h2({ style: 'font-size:15px' }, 'Records'),
      span({ class: 'small muted' }, 'all time'),
    ),
    div({ class: 'rec-table' },
      div({ class: 'rec-row rec-head' }, span(), span('Most'), span('No pause'), span('Fastest'), span('Week')),
      rows.map(([t, r]) => div({ class: 'rec-row' },
        span({ class: 'rec-name' }, span({ class: 'swatch', style: `background:${TYPES[t].bar}` }), typeLabel(t)),
        span(r.most), span(r.noPause || '–'), span(r.fastest != null ? pace(r.fastest) : '–'), span(r.bestWeek))),
    ),
    span({ class: 'small muted' }, 'Best streak ', b({ style: 'color:var(--ink)' }, `${streak.best} ${streak.best === 1 ? 'week' : 'weeks'}`),
      ` · goal hit in ${hits} of ${streak.weeks.length} ${streak.weeks.length === 1 ? 'week' : 'weeks'}. Fastest counts full workouts only.`),
  );
}

// Best pace per week for one type over the last 8 weeks. Faster (fewer seconds) plots higher.
function PaceChart(points) {
  const W = 320, H = 72, PAD = 14;
  const vals = points.filter((v) => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const x = (i) => PAD + (i * (W - 2 * PAD)) / (points.length - 1);
  const y = (v) => (hi === lo ? H / 2 : PAD + ((v - lo) / (hi - lo)) * (H - 2 * PAD));
  let d = '';
  let pen = false;
  points.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  });
  const firstI = points.findIndex((v) => v != null);
  const lastI = points.length - 1 - [...points].reverse().findIndex((v) => v != null);
  const ends = firstI === lastI ? [firstI] : [firstI, lastI];
  return svg({
    viewBox: `0 0 ${W} ${H + 14}`, width: '100%', role: 'img',
    'aria-label': `Best pace per week, from ${points[firstI]} s to ${points[lastI]} s`,
  },
    path({ d, fill: 'none', stroke: '#F28C00', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    points.map((v, i) => (v == null ? [] : circle({ cx: x(i), cy: y(v), r: 4, fill: '#F28C00', stroke: '#FFFFFF', 'stroke-width': 2 },
      svgTitle(`${v} s`)))),
    ends.map((i) => svgText({
      x: x(i), y: Math.min(H + 12, y(points[i]) + 18), 'text-anchor': i === firstI ? 'start' : 'end',
      'font-size': 11, 'font-weight': 700, fill: '#3F4148',
    }, `${points[i]} s`)),
  );
}

// Text and color for a "last 4 weeks vs before" tile. Down is neutral, never red.
function trendText(t) {
  if (t.pct == null) return t.now ? ['New', 'var(--good)'] : ['–', 'var(--muted)'];
  if (Math.abs(t.pct) < 5) return ['→ steady', 'var(--ink-2)'];
  return t.pct > 0 ? [`↑ ${t.pct}% vs before`, 'var(--good)'] : [`↓ ${-t.pct}% vs before`, 'var(--ink-2)'];
}

function PaceCard(all, s, now) {
  const fullCount = (t) => all.filter((x) => x.type === t && !x.catchUpOf && x.done >= x.target).length;
  const type = ui.filter && ui.filter !== 'other'
    ? ui.filter
    : ['standard', 'sixcount', 'seal'].sort((x, y) => fullCount(y) - fullCount(x))[0];
  const prog = paceProgress(all, type, { now, startDay: s.weekStartsOn });
  const tr = trends(ui.filter ? all.filter((x) => x.type === ui.filter) : all, now);
  const tile = (label, t) => {
    const [txt, color] = trendText(t);
    return div(span({ class: 'small muted' }, label), b({ style: `font-size:15px;color:${color}` }, txt));
  };
  return section({ class: 'card stack', style: 'gap:12px', 'aria-label': 'Pace progress' },
    div({ class: 'between', style: 'align-items:baseline' },
      h2({ style: 'font-size:15px' }, `Pace progress · ${typeLabel(type)}`),
      prog ? span({ class: 'small muted' }, `since ${new Date(prog.since).toLocaleDateString([], { day: 'numeric', month: 'short' })}`) : [],
    ),
    prog
      ? [
        div({ class: 'row', style: 'align-items:baseline;gap:10px' },
          span({ class: 'digits muted', style: 'font-size:34px' }, pace(prog.from)),
          span({ class: 'muted', style: 'font-size:20px' }, '→'),
          span({ class: 'digits', style: 'font-size:34px' }, pace(prog.to)),
          prog.pctFaster > 0 ? span({ class: 'pill good', style: 'margin-left:auto;font-size:13px;padding:4px 10px' }, `${prog.pctFaster}% faster`) : [],
        ),
        prog.points.filter((v) => v != null).length >= 2 ? PaceChart(prog.points) : [],
        span({ class: 'small muted' }, 'Best pace each week, last 8 weeks. Higher is faster.'),
      ]
      : span({ class: 'small muted' }, `Finish two full ${typeLabel(type)} workouts to see your pace progress.`),
    div({ class: 'trend-tiles' }, tile('Burpees, last 4 wks', tr.burpees), tile('Workouts, last 4 wks', tr.workouts)),
  );
}

// Medal colors per badge category: [background, text].
const MEDAL = {
  burpees: ['#F28C00', '#1B1B1F'], workouts: ['#1B1B1F', '#FFFFFF'], streak: ['#C2410C', '#FFFFFF'],
  standard: ['#F28C00', '#1B1B1F'], sixcount: ['#14968A', '#FFFFFF'], seal: ['#2F5BB7', '#FFFFFF'],
};

function Badges(all, s, now) {
  const best = plan.streakInfo(all, store.data.periods, s, now).best;
  const list = badges(all, best);
  const earned = list.reduce((n, c) => n + c.earnedCount, 0);
  return section({ class: 'card stack', style: 'gap:14px', 'aria-label': 'Badges' },
    div({ class: 'between', style: 'align-items:baseline' },
      h2({ style: 'font-size:15px' }, 'Badges'),
      span({ class: 'small muted' }, `${earned} earned`),
    ),
    div({ class: 'badges' }, list.map((c) => {
      const [bg, fg] = MEDAL[c.id];
      return div({ class: 'badge-item' },
        c.earned != null
          ? div({ class: 'medal', style: `background:${bg};color:${fg}` }, c.text(c.earned))
          : div({ class: 'medal next' }, c.text(c.next)),
        span(c.label),
        span({ class: 'muted' }, c.next != null ? `${c.value} / ${c.text(c.next)}` : 'all earned'),
      );
    })),
    span({ class: 'small muted' }, 'Badges can never be lost.'),
  );
}

function deleteSession(x) {
  const linked = store.catchUpsOf(x.id).length;
  const what = `${x.done} ${x.type === 'other' ? (x.typeName || 'Other') : typeLabel(x.type)} burpees`;
  const also = linked ? ` Its ${linked} catch-up ${linked === 1 ? 'session is' : 'sessions are'} deleted too.` : '';
  if (!confirm(`Delete this session (${what})?${also}`)) return;
  store.deleteSession(x.id);
  toast('Session deleted');
}

function Activity(x, now) {
  const partial = x.done < x.target;
  return div({ class: 'activity' },
    badge(x.type, true),
    div({ class: 'grow stack', style: 'gap:2px;min-width:0' },
      span({ class: 'small muted' }, dayLabel(x.startedAt, now)),
      span({ style: 'font-weight:600' }, workoutTitle({ type: x.type, typeName: x.typeName }, x.target)),
      span({ class: 'small muted' }, `${duration(x.activeSec || 0)} · every ${pace(x.pace)}`),
    ),
    div({ class: 'stack', style: 'align-items:flex-end;gap:4px' },
      span({ class: 'digits', style: 'font-size:22px' }, partial ? `${x.done} / ${x.target}` : x.done),
      x.catchUpOf ? span({ class: 'pill good' }, 'Catch-up') : partial ? span({ class: 'pill partial' }, 'Partial') : [],
    ),
    button({ class: 'icon-btn del', 'aria-label': 'Delete this session', onclick: () => deleteSession(x) }, icon('trash')),
  );
}

// Everything below the filters re-renders when the data or the view options change.
function Body() {
  const now = Date.now();
  const s = store.settings();
  const all = store.sessions();
  if (!all.length) {
    return div({ class: 'empty' }, 'No workouts yet.', van.tags.br(), 'Finish or stop a workout and it shows up here.');
  }
  const list = ui.filter ? all.filter((x) => x.type === ui.filter) : all;
  const ser = series(list, s, now);
  const period = list.filter((x) => x.startedAt >= ser.from);
  const total = stats.summarize(period);

  return div({ class: 'view' },
    Chart(ser, total, all, s, now),
    section({ class: 'stats card', style: 'background:var(--card)', 'aria-label': 'Totals' },
      div(span({ class: 'label' }, 'Burpees'), span({ class: 'digits' }, total.burpees)),
      div(span({ class: 'label' }, 'Time'), span({ class: 'digits' }, hoursMinutes(total.seconds))),
      div(span({ class: 'label' }, 'Workouts'), span({ class: 'digits' }, total.workouts)),
    ),
    Records(all, s, now),
    PaceCard(all, s, now),
    Badges(all, s, now),
    h2({ style: 'padding-top:4px' }, 'Activity'),
    div({ class: 'stack' }, period.length
      ? period.slice(0, ui.limit).map((x) => Activity(x, now))
      : div({ class: 'small muted' }, 'No workouts in this period.')),
    period.length > ui.limit
      ? button({ class: 'btn ghost block small', onclick: () => { ui.limit += 20; } }, `Show more (${period.length - ui.limit})`)
      : [],
  );
}

export function History() {
  const chip = (t, text) => button({
    'aria-pressed': () => String(ui.filter === t),
    onclick: () => { ui.filter = t; ui.limit = 20; },
  }, text);
  return div({ class: 'view' },
    main({ class: 'screen with-nav' },
      h1('History'),
      Seg(RANGES, () => ui.range, (v) => { ui.range = v; ui.sel = null; ui.limit = 20; }),
      div({ class: 'chips scroll-x' }, chip(null, 'All'), TYPE_ORDER.map((t) => chip(t, typeLabel(t)))),
      () => Body(),
    ),
    Nav(),
  );
}
