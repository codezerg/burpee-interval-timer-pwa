# burpee-interval-timer-pwa

Personal installable web app (PWA): burpee interval timer with beeps, weekly goals, history and recovery weeks. Plain HTML/JS, no server.

## What it is

A phone app for doing burpees at a steady pace and getting better over time. Inspired by the Busy Dad Program, but built around short custom workouts:

- **Workout:** a burpee type, a number of burpees and the seconds per burpee. For example, "40 Standard burpees, every 15 s" takes 10:00.
- **The app beeps** at the start of every burpee, so you keep the pace.
- **Progress** comes from slowly adding burpees or lowering the seconds per burpee.
- **Weekly goal:** in burpees, minutes or both. The app also tracks history per burpee type (Standard, 6-count, Navy SEAL, Other), a weekly streak, records and badges.
- **Pause or stop** at any time. What you did is saved, and you can catch up the rest later.
- **Levels and challenges:** a level ladder per burpee type (pass a test without pausing), a monthly challenge, a Monday review with session planning, and a Year in Burpees recap in December.
- **Sounds:** one simple, researched cue set (low countdown ticks, one beep per burpee, a long first beep, a double last beep, a finish signal) in three styles: Beep, Clave, Soft. See [docs/sounds.md](docs/sounds.md).
- **Motivation:** a weekly streak with shields, new-record banners, "How did it feel?" with small make-it-harder suggestions (max ~10% a week), badges and pace progress.
- **Recovery weeks:** you start one any time you like, and the app reminds you after 4 training weeks.

## Status

| Step | State |
| --- | --- |
| Proposal and design | Done (2026-10-21) |
| Phase 1: workouts, timer, beeps, saving sessions | Done (2026-10-21) |
| Phase 2: weekly goal, history, records | Done (2026-10-21) |
| Phase 3: PWA install (manifest, offline, icons), export/import | Done (2026-10-21) |
| Phase 4: motivation features and recovery weeks | Done (2026-10-21) |
| Phase 5: Monday review, levels, monthly challenge | Done (2026-10-21) |

## Live

- App: https://codezerg.github.io/burpee-interval-timer-pwa/
- Mockups: https://codezerg.github.io/burpee-interval-timer-pwa/mockups/

Deployed by GitHub Actions (`.github/workflows/pages.yml`) on every push to `main`: runs the tests, then publishes `app/` (and `docs/mockups/` under `/mockups`).

## Run it locally

No install, no build. Serve the `app/` folder with any static web server:

```
npm start                                   # = python -m http.server 8080 --directory app
```

Then open http://localhost:8080. Use the browser's phone view (DevTools device toolbar) for a phone-sized layout.

Tests for the timer engine (Node 20+):

```
npm test
```

## Repo layout

```
app/
  index.html        App shell + import map for VanJS/VanX
  styles.css        All styles (light theme, tokens from the mockups)
  js/app.js         Entry: mounts screens per route, Back handling, update check
  js/router.js      Screen stack and phone Back button
  js/run.js         Runs a workout: engine, animation loop, wake lock, run state
  js/components.js  Icons, nav bar, stepper, segmented control, toast
  js/screens/       One file per screen group (home, workout, run, history, settings)
  js/engine.js      Workout timing (pure logic, unit-tested)
  js/audio.js       Beeps via Web Audio, scheduled ahead on the audio clock
  js/store.js       Workouts, sessions, settings: one VanX reactive object, saved to localStorage
  js/types.js       Burpee types, how-to text, colors
  js/stats.js       Weeks, goal progress, history series (pure, unit-tested)
  js/plan.js        Recovery weeks, breaks, restart ramps, streak + shields (pure, unit-tested)
  js/motivation.js  Records, make-it-harder suggestions, badges, pace progress (pure, unit-tested)
  js/levels.js      Level ladders per burpee type and the pass rule (pure, unit-tested)
  js/review.js      Monday review, monthly challenge, Year in Burpees (pure, unit-tested)
  js/backup.js      Backup export/import, install button, new-version check
  sw.js             Service worker: offline + always-fresh updates
  vendor/           VanJS 1.6.1 + VanX 0.6.3, copied unmodified (see vendor/README.md)
  manifest.webmanifest, icons/   Install metadata and icons
  version.json      "dev" locally; the deploy writes the commit id here
tests/              node:test unit tests
tools/make_icons.py Regenerates app/icons (Pillow)
docs/
  proposal.txt      Full spec: features, screens, technical notes, plan, decisions
  sounds.md         Why the timer sounds the way it does (research + exact settings)
  mockups/          Static HTML mockups of every screen. Open index.html in a browser.
  design-canvas/    Source files of the mockups (Claude design-canvas format, needs its viewer)
```

## How it works

- **Tech:** plain HTML, CSS and JavaScript with [VanJS](https://vanjs.org) + VanX (about 3 KB together, copied into `app/vendor/`). No build step.
- **UI model:** each navigation builds the screen once with `van.tags`; the parts written as `() => ...` update by themselves when the data they read changes. All data lives in one `vanX.reactive` object in `store.js`, and a single `van.derive` saves it after every change.
- **Beeps:** made with the Web Audio API, with no sound files. Screen kept on with the Wake Lock API.
- **Data:** stored only on the phone, in the browser's local storage. Use Export/Import for backups.
- **Install:** open the site on the phone and choose "Add to Home Screen" (iPhone: Safari > Share; Android: Chrome > Install app, or the Install button in Settings).
- **Offline and updates:** the service worker always fetches the newest files when online and falls back to the saved copy offline. When the app comes back on screen and a new deploy is out, it reloads itself (never during a workout).
- **Hosting:** GitHub Pages (any static HTTPS host works, e.g. Netlify or a container running nginx or Caddy).
- **iPhone note:** the Ring/Silent switch mutes web-app beeps, so keep it on Ring during workouts.

## License

MIT, see [LICENSE](LICENSE).
