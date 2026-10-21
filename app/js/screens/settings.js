// Settings: weekly goal, install, workout sound/countdown, catch-up, data.

import van from 'vanjs-core';
import * as store from '../store.js';
import * as audio from '../audio.js';
import * as backup from '../backup.js';
import { resetTo } from '../router.js';
import { Nav, Seg, Stepper, toast } from '../components.js';

const { b, button, div, h1, input, main, span } = van.tags;

const s = () => store.settings();
const set = (patch) => store.updateSettings(patch);
const strong = (text) => span({ style: 'font-weight:600' }, text);
const groupLabel = (text) => span({ class: 'group-label' }, text);
const note = (...children) => span({ class: 'small muted', style: 'padding:0 4px;line-height:1.4' }, ...children);

function GoalGroup() {
  return div({ class: 'group' },
    div({ class: 'stack' },
      strong('Count by'),
      Seg([['burpees', 'Burpees'], ['minutes', 'Minutes'], ['both', 'Both']], () => s().goalType, (v) => set({ goalType: v })),
      () => div({ class: 'view' }, s().goalType === 'both'
        ? span({ class: 'small muted' }, 'The week counts when you reach both targets.') : []),
    ),
    () => (s().goalType !== 'minutes'
      ? div({ class: 'between' }, strong('Burpees per week'), Stepper({
        value: () => s().goalBurpees, step: 10, min: 10, label: 'burpees per week',
        onStep: (d) => set({ goalBurpees: Math.max(10, s().goalBurpees + d) }),
      }))
      : div({ class: 'view' })),
    () => (s().goalType !== 'burpees'
      ? div({ class: 'between' }, strong('Minutes per week'), Stepper({
        value: () => s().goalMinutes, step: 5, min: 5, label: 'minutes per week',
        onStep: (d) => set({ goalMinutes: Math.max(5, s().goalMinutes + d) }),
      }))
      : div({ class: 'view' })),
    div({ class: 'stack' },
      strong('Week starts on'),
      Seg([[1, 'Monday'], [0, 'Sunday']], () => s().weekStartsOn, (v) => set({ weekStartsOn: v })),
    ),
  );
}

function InstallBlock() {
  const state = backup.installState.val;
  if (state === 'installed') {
    return div({ class: 'between' }, strong('Installed on this phone'), span({ class: 'pill good' }, '✓ Ready offline'));
  }
  if (state === 'prompt') {
    return div({ class: 'between' }, strong('Install as an app'),
      button({ class: 'btn small', style: 'height:40px', onclick: backup.promptInstall }, 'Install'));
  }
  const how = state === 'ios'
    ? ['In Safari, tap the Share button ', b('↑'), ', then ', b('Add to Home Screen'), '.']
    : ['In Chrome, open the menu ', b('⋮'), ', then ', b('Add to Home screen'), ' or ', b('Install app'), '.'];
  return div({ class: 'stack', style: 'gap:4px' }, strong('Install as an app'),
    span({ class: 'small muted', style: 'line-height:1.45' }, ...how, ' It then opens full screen and works offline.'));
}

async function exportBackup() {
  const how = await backup.exportBackup();
  if (how !== 'cancelled') toast(how === 'shared' ? 'Backup ready' : 'Backup downloaded');
}

async function importBackup() {
  let data;
  try {
    data = await backup.pickBackup();
  } catch (err) {
    alert(err.message);
    return;
  }
  if (!data) return;
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'unknown date';
  const msg = `Replace everything on this phone with this backup?\n\nBackup from ${when}: `
    + `${data.workouts.length} workouts, ${data.sessions.length} sessions.`;
  if (!confirm(msg)) return;
  store.importData(data);
  audio.setVolume(s().volume);
  resetTo('home');
  toast('Backup restored');
}

function resetData() {
  if (!confirm('Delete all workouts and history on this phone? This cannot be undone.')) return;
  store.resetAll();
  audio.setVolume(s().volume);
  resetTo('home');
  toast('All data reset');
}

export function Settings() {
  const lastBackup = () => (s().lastBackupAt
    ? new Date(s().lastBackupAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : 'never');
  const testBeep = () => { audio.unlock(); audio.play('beep'); };

  return div({ class: 'view' },
    main({ class: 'screen with-nav' },
      h1('Settings'),

      groupLabel('Weekly goal'),
      GoalGroup(),

      groupLabel('App'),
      div({ class: 'group' }, () => InstallBlock()),

      groupLabel('During workout'),
      div({ class: 'group' },
        div({ class: 'stack' },
          strong('Get-ready countdown'),
          Seg([[0, 'Off'], [3, '3 s'], [5, '5 s'], [10, '10 s']], () => s().countdown, (v) => set({ countdown: v })),
        ),
        div({ class: 'stack' },
          div({ class: 'between' },
            strong('Beep volume'),
            button({ class: 'btn small ghost', style: 'height:36px;font-size:13px', onclick: testBeep }, 'Test beep'),
          ),
          input({
            type: 'range', min: 0.1, max: 1, step: 0.05, value: s().volume, 'aria-label': 'Beep volume',
            oninput: (e) => { const v = Number(e.target.value); audio.setVolume(v); set({ volume: v }); },
            onchange: testBeep,
          }),
        ),
        div({ class: 'between' },
          strong('Keep screen on'),
          button({
            class: 'switch', role: 'switch', 'aria-label': 'Keep screen on',
            'aria-checked': () => String(s().keepAwake), onclick: () => set({ keepAwake: !s().keepAwake }),
          }),
        ),
      ),
      note('iPhone: if you hear no beeps, check the Ring/Silent switch and the volume buttons. Switching to another app pauses the workout.'),

      groupLabel('Catch-up'),
      div({ class: 'group' },
        div({ class: 'stack' },
          strong('Offer catch-up'),
          Seg([['endOfDay', 'Until end of day'], ['untilDone', 'Until done']], () => s().catchUpUntil, (v) => set({ catchUpUntil: v })),
        ),
      ),

      groupLabel('Data'),
      div({ class: 'group' },
        button({ class: 'text-btn between', style: 'padding:14px 16px', onclick: exportBackup },
          span('Export backup'), span({ class: 'small muted', style: 'font-weight:400' }, () => `Last: ${lastBackup()}`)),
        button({ class: 'text-btn', style: 'text-align:left;padding:14px 16px', onclick: importBackup }, 'Import backup'),
        button({ class: 'text-btn', style: 'text-align:left;color:var(--danger);padding:14px 16px', onclick: resetData }, 'Reset all data'),
      ),
      note('Your data is stored only on this phone. Export a backup now and then and keep the file somewhere safe (Files, Drive, email).'),
      span({ class: 'small muted', style: 'text-align:center;padding-top:8px' },
        () => `Burpee Timer · version ${(backup.version.val || 'dev').slice(0, 7)}`),
    ),
    Nav(),
  );
}
