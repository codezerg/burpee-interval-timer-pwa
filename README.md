# burpee-interval-timer-pwa

Personal installable web app (PWA): burpee interval timer with beeps, weekly goals, history and recovery weeks. Plain HTML/JS, no server.

## What it is

A phone app for doing burpees at a steady pace and getting better over time. Inspired by the Busy Dad Program, but built around short custom workouts:

- **Workout:** a burpee type, a number of burpees and the seconds per burpee. For example, "40 Standard burpees, every 15 s" takes 10:00.
- **The app beeps** at the start of every burpee, so you keep the pace.
- **Progress** comes from slowly adding burpees or lowering the seconds per burpee.
- **Weekly goal:** in burpees, minutes or both. The app also tracks history per burpee type (Standard, 6-count, Navy SEAL, Other), a weekly streak, records and badges.
- **Pause or stop** at any time. What you did is saved, and you can catch up the rest later.
- **Recovery weeks:** you start one any time you like, and the app reminds you after 4 training weeks.

## Status

| Step | State |
| --- | --- |
| Proposal and design | Done (2026-10-21) |
| Phase 1: workouts, timer, beeps, saving sessions | Done (2026-10-21) |
| Phase 2: weekly goal, history, records | – |
| Phase 3: PWA install (manifest, offline, icons), export/import | – |
| Phase 4: motivation features and recovery weeks | – |
| Phase 5: Monday review, levels, monthly challenge | – |

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
  index.html        App shell
  styles.css        All styles (light theme, tokens from the mockups)
  js/main.js        Screens, navigation, run loop, wake lock
  js/engine.js      Workout timing (pure logic, unit-tested)
  js/audio.js       Beeps via Web Audio, scheduled ahead on the audio clock
  js/store.js       Workouts, sessions, settings in localStorage
  js/views.js       Screen templates
  js/types.js       Burpee types and how-to text
tests/              node:test unit tests
docs/
  proposal.txt      Full spec: features, screens, technical notes, plan, decisions
  mockups/          Static HTML mockups of every screen. Open index.html in a browser.
  design-canvas/    Source files of the mockups (Claude design-canvas format, needs its viewer)
```

## How it will work

- **Tech:** plain HTML, CSS and JavaScript, with no frameworks and no build step.
- **Beeps:** made with the Web Audio API, with no sound files. Screen kept on with the Wake Lock API.
- **Data:** stored only on the phone, in the browser's local storage. Use Export/Import for backups.
- **Install:** open the site on the phone and choose "Add to Home Screen" (iPhone: Safari > Share; Android: Chrome > Install app).
- **Hosting:** GitHub Pages (any static HTTPS host works, e.g. Netlify or a container running nginx or Caddy).
- **iPhone note:** the Ring/Silent switch mutes web-app beeps, so keep it on Ring during workouts.

## License

MIT, see [LICENSE](LICENSE).
