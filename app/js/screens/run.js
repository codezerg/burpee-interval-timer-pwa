// Countdown, running and paused screens.
// The run screen only rebuilds when the phase changes; the clock texts and
// rings are bound to runUi.status, which the run loop refreshes every frame.

import van from 'vanjs-core';
import { clock, duration, pace } from '../format.js';
import { go } from '../router.js';
import { runUi, pauseRun, resumeRun, stopRun, cancelRun, skipCountdown, toggleMute } from '../run.js';
import { icon } from '../components.js';

const { b, button, div, h2, main, span } = van.tags;
const { svg, circle } = van.tags('http://www.w3.org/2000/svg');

const BIG_C = 2 * Math.PI * 118;
const SMALL_C = 2 * Math.PI * 58;

const st = () => runUi.status.val;

function Countdown() {
  return main({ class: 'screen white' },
    div({ class: 'countdown' },
      span({ class: 'eyebrow' }, 'Get ready'),
      h2({ style: 'font-size:20px' }, runUi.spec.title),
      span({ class: 'big' }, () => String(Math.max(1, st().countdownLeft))),
    ),
    div({ class: 'stack' },
      button({ class: 'btn block', onclick: skipCountdown }, 'Start now'),
      button({ class: 'btn plain block', onclick: cancelRun }, 'Cancel'),
    ),
  );
}

function Running(paused) {
  const run = runUi.run;
  const secLeft = () => Math.max(0, Math.ceil(st().burpeeLeft - 1e-6));
  const label = (text, value) => div(span({ class: 'label' }, text), span({ class: 'digits' }, value));

  return main({ class: `screen white run${paused ? ' is-paused' : ''}` },
    div({ class: 'run-top' },
      label('Elapsed', () => clock(Math.floor(st().elapsed))),
      label('Burpee', () => `${st().burpee} / ${run.count}`),
      label('Pace', pace(run.pace)),
    ),

    div({ class: 'run-mid' },
      paused
        ? span({ class: 'paused-pill' }, icon('pauseSmall'), ' PAUSED · ',
          // st() subscribes to the frame updates so the pause time keeps counting.
          span(() => (st(), duration(run.clock() - run.pauseStartedAt))))
        : button({ class: 'chip', onclick: () => go('howto', { type: runUi.spec.type }) }, runUi.spec.title, ' ', icon('info')),

      div({ class: 'ring ring-big' },
        svg({ viewBox: '0 0 260 260', 'aria-hidden': 'true' },
          circle({ cx: 130, cy: 130, r: 118, fill: 'none', stroke: '#F0F0F2', 'stroke-width': 14 }),
          circle({
            class: 'bar', cx: 130, cy: 130, r: 118, fill: 'none', stroke: '#1B1B1F', 'stroke-width': 14,
            'stroke-linecap': 'round', 'stroke-dasharray': BIG_C.toFixed(1), transform: 'rotate(-90 130 130)',
            'stroke-dashoffset': () => (BIG_C * (1 - st().progress)).toFixed(1),
          }),
        ),
        div({ class: 'center' },
          span({ class: 'eyebrow', style: 'font-weight:600' }, 'Total time left'),
          span({ class: 'digits' }, () => clock(Math.ceil(st().totalLeft - 1e-6))),
          span({ class: 'small muted' }, `of ${duration(run.total)}${paused ? ' · frozen' : ''}`),
        ),
      ),

      div({ class: 'row', style: 'gap:16px' },
        div({ class: 'ring ring-small' },
          svg({ viewBox: '0 0 132 132', 'aria-hidden': 'true' },
            circle({ cx: 66, cy: 66, r: 58, fill: paused ? '#FFFFFF' : '#FFF8EE', stroke: paused ? '#E8E8EC' : '#FBE3C2', 'stroke-width': 10 }),
            // Fills up from empty at each beep to full at the next one.
            circle({
              class: 'bar', cx: 66, cy: 66, r: 58, fill: 'none', stroke: '#F28C00', 'stroke-width': 10,
              'stroke-linecap': 'round', 'stroke-dasharray': SMALL_C.toFixed(1), transform: 'rotate(-90 66 66)',
              'stroke-dashoffset': () => (SMALL_C * (st().burpeeLeft / run.pace)).toFixed(1),
            }),
          ),
          div({ class: 'center' },
            span({ class: 'digits' }, () => String(secLeft())),
            span({ class: 'small', style: `font-weight:600;color:${paused ? 'var(--muted)' : '#6B4A1F'}` }, 'sec'),
          ),
        ),
        div({ class: 'stack', style: 'gap:2px;max-width:170px' },
          paused
            ? [
              span({ class: 'eyebrow', style: 'font-weight:600' }, 'Take a breath'),
              span({ style: 'font-size:17px;font-weight:700' }, () => `${run.done()} done · ${run.count - run.done()} to go`),
              span({ class: 'small muted' }, 'Pause time isn’t counted.'),
            ]
            : [
              span({ class: 'eyebrow', style: 'font-weight:600' }, 'This burpee'),
              span({ style: 'font-size:17px;font-weight:700' }, () => (st().burpee >= run.count
                ? `Last one · done in ${secLeft()} s` : `Next beep in ${secLeft()} s`)),
              span({ class: 'small muted' }, 'Rest until the beep'),
            ],
        ),
      ),
    ),

    div({ class: 'run-bottom' },
      div(
        button({
          class: 'icon-btn', 'aria-pressed': () => String(runUi.muted.val),
          'aria-label': () => (runUi.muted.val ? 'Unmute beeps' : 'Mute beeps'), onclick: toggleMute,
        }, () => icon(runUi.muted.val ? 'muted' : 'sound')),
        () => (runUi.muted.val ? 'Muted' : 'Sound'),
      ),
      paused
        ? div(button({ class: 'main-btn', 'aria-label': 'Resume', onclick: resumeRun }, icon('playBig')), b({ style: 'color:var(--ink)' }, 'Resume'))
        : div(button({ class: 'main-btn', 'aria-label': 'Pause', onclick: pauseRun }, icon('pause')), 'Pause'),
      div(
        button({ class: 'icon-btn', 'aria-label': 'Stop and save what I did', onclick: stopRun }, icon('stop')),
        paused ? 'Stop & save' : 'Stop',
      ),
    ),
  );
}

export function RunScreen() {
  return div({ class: 'view' }, () => {
    const phase = runUi.phase.val;
    return phase === 'countdown' ? Countdown() : Running(phase === 'paused');
  });
}
