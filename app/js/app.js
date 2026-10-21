// App entry: mounts the current screen, handles Back, update checks, startup.

import van from 'vanjs-core';
import * as store from './store.js';
import * as audio from './audio.js';
import * as backup from './backup.js';
import { route, top, pop, go, onBack } from './router.js';
import { isActive, runState, pauseRun, cancelRun } from './run.js';
import { toast } from './components.js';
import { Home } from './screens/home.js';
import { Detail, Editor, HowTo } from './screens/workout.js';
import { RunScreen } from './screens/run.js';
import { Summary } from './screens/summary.js';
import { History } from './screens/history.js';
import { Settings } from './screens/settings.js';
import { TakeBreak, WelcomeBack, lastSession } from './screens/rest.js';
import { Levels } from './screens/levels.js';
import { WeekReview, YearRecap } from './screens/recap.js';
import { weekStart } from './stats.js';

const SCREENS = {
  home: Home,
  detail: Detail,
  editor: Editor,
  howto: HowTo,
  run: RunScreen,
  summary: Summary,
  history: History,
  settings: Settings,
  break: TakeBreak,
  welcome: WelcomeBack,
  levels: Levels,
  review: WeekReview,
  year: YearRecap,
};

const app = document.getElementById('app');

// Each navigation builds the new screen once. Building happens outside of
// van's dependency tracking (in a microtask), so reading store data while
// building doesn't tie the whole screen to it; only the `() => ...` parts
// inside a screen update live.
function mount(r) {
  app.replaceChildren((SCREENS[r.name] || Home)(r.params));
}
van.derive(() => {
  const r = route.val;
  queueMicrotask(() => mount(r));
});

// Phone Back button / in-app back.
onBack(() => {
  const screen = top().name;
  if (screen === 'run') {
    const st = runState();
    if (st === 'countdown') cancelRun();
    else if (st === 'running') pauseRun();
    return; // paused: Resume or Stop & save
  }
  if (screen === 'summary') { toast('Save or discard first'); return; }
  pop();
});

// When the app comes back to the screen, check for a new deploy. Reload right
// away on a calm screen; otherwise wait until the next visit to Home.
let updateReady = false;
const CALM_SCREENS = ['home', 'history', 'levels', 'settings', 'detail', 'howto'];

async function checkForUpdate() {
  if (updateReady || !(await backup.updateAvailable())) return;
  updateReady = true;
  if (!isActive() && CALM_SCREENS.includes(top().name)) location.reload();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !isActive()) checkForUpdate();
});
van.derive(() => {
  if (route.val.name === 'home' && updateReady && !isActive()) location.reload();
});

// On opening the app (or coming back to it) on Home:
//  - back after a long gap without a break? offer a gentle restart, once per gap
//  - first open of a new week? show the Monday review of last week
const WELCOME_AFTER_DAYS = 8;
function onOpen() {
  if (isActive() || top().name !== 'home' || store.activeBreak()) return;
  const last = lastSession();
  if (!last) return;
  if (store.data.ui.welcomeSeenFor !== last.id && Date.now() - last.startedAt >= WELCOME_AFTER_DAYS * 864e5) {
    go('welcome');
    return;
  }
  const thisWeek = weekStart(Date.now(), store.settings().weekStartsOn);
  const hadEarlierWeek = store.data.sessions.some((s) => s.startedAt < thisWeek);
  if (hadEarlierWeek && store.data.ui.reviewedWeek !== thisWeek) go('review');
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) onOpen(); });

// Keep the sound engine in step with Settings (also after import/reset).
van.derive(() => {
  audio.setVolume(store.settings().volume);
  audio.setTheme(store.settings().soundTheme);
});
onOpen();
backup.registerServiceWorker();
backup.initVersion();
