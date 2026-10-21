// Workout timing engine. Pure logic: no DOM, no Web Audio.
//
// Timeline in seconds: t < 0 is the get-ready countdown, burpee i (0-based)
// starts at t = i * pace, the workout ends at t = count * pace.
//
// `clock()` returns seconds from a monotonic source (the AudioContext clock in
// the app, so beeps and screen share one time base). `sounds` receives the
// whole remaining beep schedule on every start/resume and is cancelled on pause,
// so beeps stay on time even if the page's timers get throttled.

export const COUNTDOWN_TICKS = 3; // short ticks on the last 3 s of the countdown
const EPS = 1e-6; // float tolerance for timeline boundaries

export class WorkoutRun {
  constructor({ count, pace, countdown = 5, clock, sounds }) {
    this.count = count;
    this.pace = pace;
    this.total = count * pace;
    this.countdown = Math.max(0, countdown);
    this.clock = clock;
    this.sounds = sounds || { schedule() {}, cancel() {} };
    this.state = 'idle'; // idle | countdown | running | paused | finished | stopped
    this.anchorT = 0;
    this.anchorClock = 0;
    this.pausedSec = 0;
    this.pauses = 0;
    this.pauseStartedAt = null;
  }

  t() {
    if (this.state === 'countdown' || this.state === 'running') {
      return this.anchorT + (this.clock() - this.anchorClock);
    }
    return this.anchorT;
  }

  start() {
    // A tiny lead-in even without a countdown so the first beep is scheduled ahead.
    this.anchorT = -Math.max(this.countdown, 0.05);
    this.anchorClock = this.clock();
    this.state = 'countdown';
    this.#schedule();
  }

  skipCountdown() {
    if (this.state !== 'countdown') return;
    this.anchorT = -0.05;
    this.anchorClock = this.clock();
    this.#schedule();
  }

  pause() {
    if (this.state !== 'countdown' && this.state !== 'running') return;
    this.anchorT = this.t();
    this.state = 'paused';
    if (this.anchorT >= 0) this.pauses += 1; // pausing in the get-ready countdown doesn't count
    this.pauseStartedAt = this.clock();
    this.sounds.cancel();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.pausedSec += this.clock() - this.pauseStartedAt;
    this.pauseStartedAt = null;
    this.anchorClock = this.clock();
    this.state = this.anchorT < 0 ? 'countdown' : 'running';
    this.#schedule();
  }

  stop() {
    if (this.state === 'finished' || this.state === 'stopped') return;
    if (this.state === 'paused') {
      this.pausedSec += this.clock() - this.pauseStartedAt;
      this.pauseStartedAt = null;
    } else {
      this.anchorT = this.t();
    }
    this.state = 'stopped';
    this.sounds.cancel();
  }

  // Call regularly (animation frame). Moves countdown -> running -> finished.
  tick() {
    if (this.state !== 'countdown' && this.state !== 'running') return this.state;
    const t = this.t();
    if (t >= this.total - EPS) {
      this.anchorT = this.total;
      this.state = 'finished';
    } else if (t >= -EPS && this.state === 'countdown') {
      this.state = 'running';
    }
    return this.state;
  }

  // Burpees whose beep has sounded (the one in progress counts as done).
  done() {
    if (this.state === 'finished') return this.count;
    const t = this.t();
    if (t < -EPS) return 0;
    return Math.min(this.count, Math.floor(Math.max(0, t) / this.pace + EPS) + 1);
  }

  status() {
    const t = this.t();
    const elapsed = Math.min(Math.max(t, 0), this.total);
    const inCountdown = t < -EPS;
    const current = inCountdown ? 0 : this.done();
    const intoBurpee = inCountdown ? 0 : elapsed - (current - 1) * this.pace;
    return {
      state: this.state,
      t,
      elapsed,
      totalLeft: this.total - elapsed,
      countdownLeft: inCountdown ? Math.ceil(-t - EPS) : 0,
      burpee: current,
      burpeeLeft: inCountdown ? this.pace : Math.max(0, this.pace - intoBurpee),
      progress: this.total ? elapsed / this.total : 0,
      pausedSec: this.pausedSec + (this.pauseStartedAt != null ? this.clock() - this.pauseStartedAt : 0),
    };
  }

  #schedule() {
    this.sounds.cancel();
    const now = this.t();
    const events = [];
    for (let k = COUNTDOWN_TICKS; k >= 1; k--) {
      const at = -k;
      if (at > now && k <= this.countdown) events.push({ at, kind: 'tick' });
    }
    for (let i = 0; i < this.count; i++) {
      const at = i * this.pace;
      if (at > now) events.push({ at, kind: 'beep' });
    }
    if (this.total > now) events.push({ at: this.total, kind: 'finish' });
    this.sounds.schedule(events.map((e) => ({ delay: e.at - now, kind: e.kind })));
  }
}
