# Timer sounds: research notes and design

Why the app sounds the way it does (implemented in `app/js/audio.js` and the cue
scheduling in `app/js/engine.js`). Researched 2026-10-21 after earlier attempts
(square-wave beeps, bells/glass, a drum kit) felt "old", "bubbly" or "too much".

## The design

One voice family. Cues are told apart by **pitch** and **number of pulses**, not
by different instruments.

| Cue | Pitch | Pulses | Envelope (attack / hold / decay) | Peak |
|---|---|---|---|---|
| Countdown tick (−3, −2, −1 s) | 587 Hz (low) | 1 per second | 3 / 20 / 60 ms | 0.25 |
| First burpee ("GO") | 880 Hz | 1 long | 4 / 250 / 200 ms | 0.35 |
| Each burpee | 880 Hz | 1 short | 4 / 60 / 90 ms | 0.35 |
| Last burpee | 880 Hz | 2, 130 ms apart | 4 / 40 / 90 ms | 0.35 |
| Finish | 880 Hz ×3, then 1175 Hz | 3 short (160 ms apart), gap, 1 long | 4/40/60, then 5/300/500 ms | 0.35 |
| Pre-warning (optional, off) | 587 Hz | ticks 2 s and 1 s before each beep, only at ≥ 8 s pace | 3 / 15 / 50 ms | 0.13 |

Styles (Settings → Sound):
- **Beep** (default): sawtooth → lowpass 3500 Hz (Q 0.7), plus a 6 ms noise click
  (bandpass 3 kHz). At 880 Hz this keeps 4 harmonics in 300–4000 Hz.
- **Clave**: a short woodblock "tock" (sine 1800 Hz + 2700 Hz, 1 ms attack,
  ~45 ms decay, a noise transient). The boxing clapper idea, one hit only.
- **Soft**: triangle → lowpass 2500 Hz. Gentler, less audible over music.

Master bus: volume → DynamicsCompressor (−12 dB, knee 6, ratio 8, 2 ms / 100 ms) → make-up gain.

## Why

- **Conventions.** Beep tests use one beep per shuttle and a triple beep for a level
  change ([ScienceForSport](https://www.scienceforsport.com/multistage-fitness-beep-test/));
  Garmin plays low beeps before an interval and a higher tone at the start
  ([Garmin forum](https://forums.garmin.com/sports-fitness/cycling/f/edge-1030-plus/279260/workout-interval-tones));
  interval apps end with a triple beep ([intervaltimer.com](https://www.intervaltimer.com/videos/countdown-timers)).
  Boxing uses a different-sounding 10-second warning; a warning that sounds like
  the main cue gets mistaken for it, so the pre-warning is lower and quieter.
- **Audible on a phone on the floor.** Medical alarm guidance (IEC 60601-1-8) asks
  for a 150–1000 Hz fundamental with ≥ 4 harmonics in 300–4000 Hz
  ([PUI Audio](https://puiaudio.com/news/whats-changing-about-requirements-for-audio-components-in-a-medical-setting));
  phone speakers are loudest around 1–3.5 kHz and fall off below ~1 kHz
  ([Audiokinetic](https://www.audiokinetic.com/en/blog/loudness-and-frequency-response-on-popular-smart-phones)).
  Nothing relies on sound below ~500 Hz.
- **Not annoying over 100 repeats.** Annoyance rises with pitch, pulse rate and
  repetition ([Marshall et al.](https://iro.uiowa.edu/esploro/outputs/conferenceProceeding/Annoyance-and-Urgency-of-Auditory-Alerts/9984622747002771);
  [Patterson 1982](https://www.pdn.cam.ac.uk/system/files/documents/AuditoryWarningSystems_CAA82017.pdf)),
  so the repeating cue is one short, mid-pitch pulse.
- **What made earlier versions feel wrong.** Pitch glides read as "bubbles";
  inharmonic partials and long tails read as "bells/glass"; an unfiltered square
  wave reads as "old"; several instruments read as "too much".
- **Crisp but not startling.** A 3–5 ms attack gives a clear onset to time a
  movement to without a hard click
  ([Patterson 1990](https://www.pdn.cam.ac.uk/system/files/documents/AuditoryWarningsAtWork_RSoc1990.pdf),
  [Suied 2008](https://www.mcgill.ca/mpcl/files/mpcl/suied_2008_jepappl.pdf)).

## iPhone

`navigator.audioSession.type = 'playback'` (Safari 16.4+) plays beeps even on
Silent, but may pause other audio. Settings → "Let music keep playing" switches
to `'ambient'`, which mixes with music but obeys the Silent switch
([WebKit 251532](https://bugs.webkit.org/show_bug.cgi?id=251532)). Not yet verified
on a real device with music playing.
