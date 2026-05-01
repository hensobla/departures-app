import { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import {
  Play, Pause, SkipForward, X, Volume2, VolumeX, Shuffle,
  ChevronLeft, RotateCcw, Check, Download, Upload, Clock, ChevronRight,
  Pencil, Trash2, Plus, Target, TrendingUp, TrendingDown, Info,
  DoorOpen, Heart, Share, MoreVertical, Settings as SettingsIcon,
  Bell, BellOff, Gauge, Calendar as CalendarIcon
} from 'lucide-react';

/* =====================================================================
   SEED DATA — 17 sessions (1-16 from spreadsheet 1/19–3/6, 17 from app)
   Ratings sourced from user's spreadsheet (column M).
   ===================================================================== */
const SEED_HISTORY = [
  { number: 1,  date: '2026-01-19', warmUps: [0, 35, 5, 25, 10, 40],         rehearsalSeconds: 240,  notes: '', rating: 1 },
  { number: 2,  date: '2026-01-20', warmUps: [15, 0, 25, 45, 30, 10, 5],     rehearsalSeconds: 270,  notes: '', rating: 1 },
  { number: 3,  date: '2026-01-21', warmUps: [10, 45, 0, 20, 35, 0],         rehearsalSeconds: 300,  notes: '', rating: 1 },
  { number: 4,  date: '2026-01-26', warmUps: [50, 0, 45, 5, 30, 10, 20],     rehearsalSeconds: 240,  notes: '', rating: 4 },
  { number: 5,  date: '2026-01-28', warmUps: [45, 25, 0, 15, 30, 5],         rehearsalSeconds: 330,  notes: '', rating: 1 },
  { number: 6,  date: '2026-01-28', warmUps: [15, 10, 30, 45, 5, 50, 10],    rehearsalSeconds: 360,  notes: '', rating: 1 },
  { number: 7,  date: '2026-01-29', warmUps: [45, 5, 25, 10, 15, 0],         rehearsalSeconds: 330,  notes: '', rating: 1 },
  { number: 8,  date: '2026-01-29', warmUps: [15, 10, 25, 45, 5, 45],        rehearsalSeconds: 390,  notes: '', rating: 1 },
  { number: 9,  date: '2026-01-30', warmUps: [40, 30, 5, 50, 25, 30, 10],    rehearsalSeconds: 330,  notes: '', rating: 3 },
  { number: 10, date: '2026-02-11', warmUps: [30, 5, 35, 15, 45, 20],        rehearsalSeconds: 420,  notes: '', rating: 4 },
  { number: 11, date: '2026-02-12', warmUps: [40, 30, 5, 50, 25, 30, 10],    rehearsalSeconds: 330,  notes: '', rating: 1 },
  { number: 12, date: '2026-02-13', warmUps: [40, 30, 5, 50],                rehearsalSeconds: 330,  notes: '', rating: 1 },
  { number: 13, date: '2026-02-26', warmUps: [5, 35, 15, 45, 20],            rehearsalSeconds: 420,  notes: '', rating: 1 },
  { number: 14, date: '2026-02-27', warmUps: [30, 5, 50, 25, 30, 10],        rehearsalSeconds: 300,  notes: '', rating: 1 },
  { number: 15, date: '2026-02-28', warmUps: [5, 35, 15, 45, 20],            rehearsalSeconds: 510,  notes: '', rating: 1 },
  { number: 16, date: '2026-03-06', warmUps: [5, 35, 15, 45, 20],            rehearsalSeconds: 510,  notes: '', rating: 1 },
  { number: 17, date: '2026-04-17', warmUps: [],                             rehearsalSeconds: 900,  notes: 'barking when he heard neighbors. used Furbo treat to get him to stop', rating: 2 },
];

const DEFAULT_GOAL_SECONDS = 3600; // 1 hour

// Allowed range for the warm-up count picker on the Setup screen.
const WARMUP_MIN = 5;
const WARMUP_MAX = 10;

/* Rating metadata — matches trainer's rating table exactly */
const RATINGS = [
  { num: 1, label: 'Great', desc: 'No barking',                              color: '#7A8F6F' }, // sage
  { num: 2, label: 'Good',  desc: 'Barked for less than 1/4 rehearsal time', color: '#C9A94A' }, // gold
  { num: 3, label: 'Fair',  desc: 'Barked for less than 1/2 rehearsal time', color: '#D88A3A' }, // amber
  { num: 4, label: 'Bad',   desc: 'Continuous barking',                      color: '#A63A2C' }, // brick red
];
const ratingMeta = (n) => RATINGS.find(r => r.num === n) || null;
const ratingColor = (n) => ratingMeta(n)?.color || null;
const isAcceptable = (rating) => rating === null || rating === undefined || rating === 1 || rating === 2;

/* =====================================================================
   HELPERS
   ===================================================================== */
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatTimeLong(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function parseMMSS(str) {
  const cleaned = String(str || '').trim();
  if (!cleaned) return null;
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(v => parseInt(v, 10));
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h * 3600 + m * 60 + s;
    }
    if (parts.length === 2) {
      const [m, s] = parts;
      return m * 60 + s;
    }
    return null;
  }
  const n = parseInt(cleaned, 10);
  if (isNaN(n)) return null;
  return n * 60;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Local-date YYYY-MM-DD (matches how history.date is stored, which is the
// browser's local day, not UTC). Using toISOString here would shift across
// midnight in any timezone west of UTC.
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Set of YYYY-MM-DD strings for any day with at least one session.
function buildSessionDaySet(history) {
  const set = new Set();
  if (!history) return set;
  for (const s of history) {
    if (s.date) set.add(s.date);
  }
  return set;
}

function generateWarmUps(count) {
  // Default to a small randomized count so the first session feels fresh
  // each time. Callers (e.g. Shuffle) pass an explicit count to preserve
  // the user's chosen length.
  const total = typeof count === 'number'
    ? Math.max(1, count)
    : 5 + Math.floor(Math.random() * 3);
  const shortVals = [5, 10, 15, 20];
  const longVals = [25, 30, 35, 40, 45, 50, 55];
  const result = [0];
  for (let i = 0; i < total - 1; i++) {
    const pool = Math.random() < 0.4 ? shortVals : longVals;
    result.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildPhases(warmUps, rehearsalSeconds) {
  const phases = [];
  warmUps.forEach((duration, i) => {
    phases.push({ type: 'warmup', idx: i + 1, total: warmUps.length,
                  durationSeconds: duration, label: `Warm-up ${i + 1} of ${warmUps.length}` });
    phases.push({ type: 'settle', durationSeconds: 60, label: 'Settle' });
  });
  phases.push({ type: 'rehearsal', durationSeconds: rehearsalSeconds, label: 'Rehearsal' });
  return phases;
}

function phaseCue(phase) {
  if (phase.type === 'warmup') {
    return phase.durationSeconds === 0
      ? 'Step outside, then come right back in'
      : 'Step outside';
  }
  if (phase.type === 'settle') return 'Back inside — be with your dog';
  if (phase.type === 'rehearsal') return 'Leave for the full rehearsal';
  return '';
}

/* Round a duration sensibly based on magnitude */
function roundDuration(seconds) {
  if (seconds < 300) return Math.round(seconds / 15) * 15;      // <5min: 15s steps
  if (seconds < 1200) return Math.round(seconds / 30) * 30;     // 5-20min: 30s steps
  return Math.round(seconds / 60) * 60;                          // 20min+: 1min steps
}

/* ---- Next-rehearsal suggestion ---- */
const GROWTH_MULTIPLIERS = { slow: 0.5, typical: 1.0, fast: 1.5 };

function computeNextRehearsal(history, opts = {}) {
  const { forceShakeUp = false, growthIntensity = 'typical' } = opts;
  const growthMult = GROWTH_MULTIPLIERS[growthIntensity] ?? 1.0;

  if (!history || history.length === 0) {
    return { seconds: 300, reason: 'Start with 5 minutes.', kind: 'fresh' };
  }
  const sorted = [...history].sort((a, b) => a.number - b.number);
  const last = sorted[sorted.length - 1];
  const lastSecs = last.rehearsalSeconds;

  // Manual shake-up takes priority
  if (forceShakeUp) {
    const recent = sorted.slice(-4);
    const avg = recent.reduce((sum, s) => sum + s.rehearsalSeconds, 0) / recent.length;
    return {
      seconds: Math.max(60, roundDuration(avg * 0.6)),
      reason: 'Shorter rehearsal to keep it unpredictable.',
      kind: 'shake-up',
    };
  }

  // Bad (rated 4): step back firmly
  if (last.rating === 4) {
    return {
      seconds: Math.max(60, roundDuration(lastSecs * 0.6)),
      reason: 'Step back after a rough session.',
      kind: 'step-back',
    };
  }
  // Fair (rated 3): repeat the same length until it goes better
  if (last.rating === 3) {
    return {
      seconds: lastSecs,
      reason: 'Repeat to build confidence before increasing.',
      kind: 'repeat',
    };
  }

  // Auto shake-up: if last 3 sessions all acceptable (1/2/unrated) AND all increasing,
  // throw in a shorter one for unpredictability.
  if (sorted.length >= 4) {
    const r3 = sorted.slice(-3);
    const allIncreasing =
      r3[1].rehearsalSeconds >= r3[0].rehearsalSeconds &&
      r3[2].rehearsalSeconds >= r3[1].rehearsalSeconds;
    const allAcceptable = r3.every(s => isAcceptable(s.rating));
    if (allIncreasing && allAcceptable) {
      const avg = r3.reduce((sum, s) => sum + s.rehearsalSeconds, 0) / 3;
      return {
        seconds: Math.max(60, roundDuration(avg * 0.65)),
        reason: 'Mix in a shorter one to keep it unpredictable.',
        kind: 'shake-up',
      };
    }
  }

  // Otherwise, a graduated increment by rating + magnitude.
  //
  // If the last session was a shake-up (shorter than what preceded it, and
  // that predecessor was acceptable — i.e. not a Bad-triggered step-back),
  // resume building from the *pre-shake-up peak* rather than the shake-up
  // duration itself. Otherwise each shake-up would erase the progress it was
  // meant to just playfully interrupt.
  //
  // The peak window is bounded two ways so we don't un-do a therapeutic
  // step-back: (a) it starts AFTER the most recent Bad rating, and (b) it
  // looks at the last 5 sessions max.
  let basis = lastSecs;
  let recoveredFromShakeUp = false;
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    const isPostShakeUp =
      isAcceptable(prev.rating) && lastSecs < prev.rehearsalSeconds;
    if (isPostShakeUp) {
      let lastBadIdx = -1;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].rating === 4) { lastBadIdx = i; break; }
      }
      const windowStart = Math.max(lastBadIdx + 1, sorted.length - 5);
      const windowPeak = sorted
        .slice(windowStart)
        .filter(s => isAcceptable(s.rating))
        .reduce((m, s) => Math.max(m, s.rehearsalSeconds), 0);
      if (windowPeak > basis) {
        basis = windowPeak;
        recoveredFromShakeUp = true;
      }
    }
  }

  let increment;
  if (last.rating === 1) {
    // Great: moderate bump
    if (basis < 300) increment = 30;
    else if (basis < 600) increment = 60;
    else if (basis < 1200) increment = 120;
    else if (basis < 1800) increment = 180;
    else increment = 300;
  } else if (last.rating === 2) {
    // Good: small bump
    if (basis < 300) increment = 15;
    else if (basis < 600) increment = 30;
    else if (basis < 1200) increment = 60;
    else if (basis < 1800) increment = 90;
    else increment = 120;
  } else {
    // Unrated (seed data): conservative default
    if (basis < 600) increment = 30;
    else if (basis < 1200) increment = 60;
    else increment = 120;
  }

  // Scale by growth intensity, then quantise to 15s so durations stay "clean".
  const scaled = Math.max(15, Math.round((increment * growthMult) / 15) * 15);

  const ratingLabel = last.rating === 1 ? 'Great' : last.rating === 2 ? 'Good' : null;
  let reason;
  if (recoveredFromShakeUp) {
    reason = ratingLabel
      ? `Back to pre-shake-up pace after ${ratingLabel}.`
      : 'Back to pre-shake-up pace.';
  } else {
    reason = ratingLabel ? `Small step up after ${ratingLabel}.` : 'Small step up.';
  }

  return { seconds: basis + scaled, reason, kind: 'step-up' };
}

/* ---- Goal heuristics ----
   Simulate forward using the real computeNextRehearsal() so the chart and
   estimate show what the algorithm actually recommends (including step-backs
   after Bad ratings, repeats after Fair, and periodic shake-ups) — not a
   generalised linear step-up. We assume "Great" (rating 1) for synthetic
   future sessions, which yields an optimistic-but-realistic trajectory.
*/
function simulateProjection(history, goalSeconds, maxSteps = Infinity, opts = {}) {
  const { growthIntensity = 'typical' } = opts;
  if (!history || history.length === 0) return [];
  const sorted = [...history].sort((a, b) => a.number - b.number);
  const current = sorted[sorted.length - 1].rehearsalSeconds;
  if (current >= goalSeconds) return [];

  const out = [];
  let simHistory = sorted;
  let lastNum = sorted[sorted.length - 1].number;
  const HARD_CAP = 500;

  while (out.length < maxSteps && out.length < HARD_CAP) {
    const last = simHistory[simHistory.length - 1];
    if (last.rehearsalSeconds >= goalSeconds) break;
    const next = computeNextRehearsal(simHistory, { growthIntensity });
    lastNum += 1;
    out.push({ number: lastNum, seconds: next.seconds, kind: next.kind });
    simHistory = [
      ...simHistory,
      {
        number: lastNum,
        rehearsalSeconds: next.seconds,
        rating: 1,
        warmUps: [],
        date: new Date().toISOString(),
      },
    ];
  }
  return out;
}

function estimateSessionsToGoal(history, goalSeconds, opts = {}) {
  if (!history || history.length === 0) return null;
  const sorted = [...history].sort((a, b) => a.number - b.number);
  const current = sorted[sorted.length - 1].rehearsalSeconds;
  if (current >= goalSeconds) return 0;
  const proj = simulateProjection(history, goalSeconds, Infinity, opts);
  if (!proj.length) return null;
  const last = proj[proj.length - 1];
  if (last.seconds < goalSeconds) return null; // capped out, unreachable
  return proj.length;
}

function computeGoalProgress(history, goalSeconds, opts = {}) {
  if (!history || history.length === 0) {
    return { current: 0, percent: 0, estimate: null, trend: 'no-data' };
  }
  const sorted = [...history].sort((a, b) => a.number - b.number);
  const current = sorted[sorted.length - 1].rehearsalSeconds;
  const percent = Math.min(100, Math.round((current / goalSeconds) * 100));

  if (current >= goalSeconds) {
    return { current, percent: 100, estimate: 0, trend: 'reached' };
  }

  const progressSessions = sorted.filter(s => isAcceptable(s.rating));
  if (progressSessions.length < 3) {
    return { current, percent, estimate: null, trend: 'no-data' };
  }

  const estimate = estimateSessionsToGoal(history, goalSeconds, opts);
  return { current, percent, estimate, trend: 'increasing' };
}

function estimateText({ trend, estimate }) {
  if (trend === 'no-data') return 'A few more rated sessions and an estimate will appear.';
  if (trend === 'reached') return 'Goal reached. Set a higher one if you like.';
  if (trend === 'increasing') {
    if (estimate === null) return '';
    if (estimate === 1) return 'About 1 more session to reach your goal.';
    return `About ${estimate} more sessions to reach your goal.`;
  }
  return '';
}

/* ---- storage (localStorage) ----
 * Reads are tolerant: corrupt JSON or missing keys return null.
 * Writes that fail (quota, security policy, etc.) dispatch a
 * 'app-storage-error' window event so the App can surface a toast — the
 * old behavior was to swallow the error, which let users keep working
 * thinking their state was saved when it wasn't.
 */
function storageGet(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('storage.set failed', key, e);
    try {
      window.dispatchEvent(new CustomEvent('app-storage-error', { detail: { key, error: String(e) } }));
    } catch {}
    return false;
  }
}
// Critical-data variant: copies the previous value to `${key}.backup` first,
// so a buggy update or a bad write can be rolled back from the prior known
// good value. Use for history; settings/active are non-critical and can use
// plain storageSet.
function storageSetWithBackup(key, value) {
  try {
    const prev = localStorage.getItem(key);
    if (prev != null) {
      // If this fails (quota), surface the error and abort — we don't want
      // to write the new value while losing the recovery target.
      localStorage.setItem(`${key}.backup`, prev);
    }
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('storage.setWithBackup failed', key, e);
    try {
      window.dispatchEvent(new CustomEvent('app-storage-error', { detail: { key, error: String(e) } }));
    } catch {}
    return false;
  }
}
function storageDelete(key) {
  try { localStorage.removeItem(key); } catch {}
}

/* ---- notifications ---- */
function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}
function getNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}
async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}
function fireSystemNotification(title, body) {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    new Notification(title, { body, icon: '/departures-app/icon-192.png' });
    return true;
  } catch (e) {
    console.error('notification failed', e);
    return false;
  }
}

// Unified alerting. Fires a system notification when the document is hidden
// now OR was hidden at any point during the just-ended phase (the iOS-PWA
// case where JS suspends in the background and only catches up to the
// phase end after the user reopens the app — at that point we still want a
// real notification, not just a chime they may already have missed). Plays
// the chime as well whenever the app is currently visible so the user gets
// an immediate audible cue too. Falls back to the chime if system
// notifications aren't available.
function firePhaseEndAlert({ notificationsEnabled, volume, title, body, wasHidden = false }) {
  if (!notificationsEnabled) return;
  const volMult = Math.max(0, Math.min(100, volume)) / 100;
  const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
  const shouldNotify = !isVisible || wasHidden;
  let notifFired = false;
  if (shouldNotify) {
    notifFired = fireSystemNotification(title, body);
  }
  // Chime when visible (so the user hears something immediately) or when the
  // notification couldn't fire (so they always get *some* signal).
  if (isVisible || !notifFired) {
    playAlarm(volMult);
  }
}

/* ---- alarm ----
 * Plays a 3-note chime through an HTMLAudioElement (not Web Audio).
 * Web Audio on iOS is always treated as "ambient" audio and is silenced by
 * the ringer/silent switch. An <audio> element fed by a generated WAV blob is
 * treated as media playback in an installed PWA on iOS, giving us a much
 * better chance of playing through silent mode.
 */
function playAlarm(volume = 1) {
  const v = Math.max(0, Math.min(1, volume));
  if (v === 0) return;
  try {
    const wav = buildChimeWav(v);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.src = url;
    const cleanup = () => { try { URL.revokeObjectURL(url); } catch {} };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch((e) => { console.error('audio play failed', e); cleanup(); });
    }
  } catch (e) { console.error('alarm failed', e); }
}

/* Build a 16-bit PCM mono WAV ArrayBuffer for the 3-note chime. */
function buildChimeWav(volume) {
  const sampleRate = 44100;
  const totalDur = 1.25; // seconds
  const n = Math.floor(sampleRate * totalDur);
  const bytesPerSample = 2;
  const headerSize = 44;
  const buf = new ArrayBuffer(headerSize + n * bytesPerSample);
  const view = new DataView(buf);

  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * bytesPerSample, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);     // fmt chunk size
  view.setUint16(20, 1, true);      // PCM
  view.setUint16(22, 1, true);      // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true);              // block align
  view.setUint16(34, 16, true);                          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, n * bytesPerSample, true);

  const tones = [
    { freq: 784,  start: 0.00, dur: 0.55 },
    { freq: 988,  start: 0.16, dur: 0.55 },
    { freq: 1175, start: 0.32, dur: 0.85 },
  ];
  const baseVol = 0.22;

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const tone of tones) {
      const lt = t - tone.start;
      if (lt < 0 || lt > tone.dur) continue;
      // 20ms linear attack, then exponential decay to ~0 over the rest.
      let env;
      if (lt < 0.02) {
        env = lt / 0.02;
      } else {
        const decayT = lt - 0.02;
        const decayDur = Math.max(0.001, tone.dur - 0.02);
        env = Math.pow(0.0001, decayT / decayDur);
      }
      sample += Math.sin(2 * Math.PI * tone.freq * t) * baseVol * env;
    }
    sample *= volume;
    if (sample > 1) sample = 1;
    else if (sample < -1) sample = -1;
    view.setInt16(headerSize + i * bytesPerSample, Math.round(sample * 0x7FFF), true);
  }

  return buf;
}

/* Build a long, near-silent looping WAV used to keep the JS engine alive on
 * iOS when the PWA is backgrounded. iOS suspends backgrounded PWAs almost
 * immediately, but apps that are actively playing audio get extended
 * background runtime. The signal is a 30 Hz sine at ~0.025% amplitude —
 * below speaker reproduction and human hearing thresholds, but non-zero so
 * iOS classifies the session as "playback" rather than "ambient". */
function buildKeepaliveWav() {
  const sampleRate = 22050;
  const dur = 30; // 30s loop — fewer loop boundaries = fewer chances of glitching
  const n = Math.floor(sampleRate * dur);
  const headerSize = 44;
  const buf = new ArrayBuffer(headerSize + n * 2);
  const view = new DataView(buf);

  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    const sample = Math.round(Math.sin(2 * Math.PI * 30 * i / sampleRate) * 8);
    view.setInt16(headerSize + i * 2, sample, true);
  }
  return buf;
}

/* Plays a near-silent looping audio clip while `active` is true, so iOS
 * keeps the PWA's JS alive in the background and our phase-end timers
 * can still fire while the user is in another app. */
function useAudioKeepalive(active) {
  const stateRef = useRef(null);

  // Lazy-init the audio element + blob URL on first activation.
  const ensureAudio = () => {
    if (stateRef.current) return stateRef.current;
    const buf = buildKeepaliveWav();
    const blob = new Blob([buf], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.src = url;
    audio.loop = true;
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.volume = 0.5;
    stateRef.current = { audio, url };
    return stateRef.current;
  };

  useEffect(() => {
    if (!active) return;
    const { audio } = ensureAudio();
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch((e) => console.warn('keepalive play failed:', e));
    }
    return () => {
      if (stateRef.current) {
        try { stateRef.current.audio.pause(); } catch {}
      }
    };
  }, [active]);

  // Free the blob URL on unmount. (The element itself can be GC'd.)
  useEffect(() => {
    return () => {
      if (stateRef.current) {
        try { stateRef.current.audio.pause(); } catch {}
        try { URL.revokeObjectURL(stateRef.current.url); } catch {}
        stateRef.current = null;
      }
    };
  }, []);
}

function useWakeLock(active) {
  const lockRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      if (!('wakeLock' in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) { lock.release().catch(() => {}); return; }
        lockRef.current = lock;
      } catch {}
    }
    function onVisible() {
      if (active && document.visibilityState === 'visible' && !lockRef.current) acquire();
    }
    if (active) {
      acquire();
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lockRef.current) {
        lockRef.current.release().catch(() => {});
        lockRef.current = null;
      }
    };
  }, [active]);
}

/* =====================================================================
   RATING SELECTOR
   ===================================================================== */
function RatingSelector({ value, onChange, allowNone = false }) {
  const selected = ratingMeta(value);
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map(r => {
          const isSelected = value === r.num;
          return (
            <button
              key={r.num}
              onClick={() => onChange(r.num)}
              className="rating-btn"
              style={{
                borderColor: isSelected ? r.color : 'var(--line)',
                background: isSelected ? r.color + '20' : 'var(--surface)',
                borderWidth: isSelected ? '2px' : '1.5px',
              }}
            >
              <div
                className="serif tabular"
                style={{ fontSize: 24, fontWeight: 500, color: r.color, lineHeight: 1 }}
              >
                {r.num}
              </div>
              <div className="text-xs mt-1" style={{ color: isSelected ? r.color : 'var(--ink-soft)', fontWeight: isSelected ? 500 : 400 }}>
                {r.label}
              </div>
            </button>
          );
        })}
      </div>
      <div
        className="serif italic text-sm mt-3 min-h-[20px]"
        style={{ color: selected ? selected.color : 'var(--ink-muted)' }}
      >
        {selected ? selected.desc : 'Tap to rate this rehearsal.'}
      </div>
      {allowNone && value !== null && value !== undefined && (
        <button
          onClick={() => onChange(null)}
          className="btn-ghost text-xs mt-1 underline"
        >
          Clear rating
        </button>
      )}
    </div>
  );
}

/* =====================================================================
   CONFIRM DIALOG
   ===================================================================== */
function ConfirmDialog({ dialog }) {
  if (!dialog) return null;
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(31, 25, 21, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={dialog.onCancel}
    >
      <div className="modal-card card p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="serif text-2xl mb-2" style={{ fontWeight: 500 }}>{dialog.title}</div>
        {dialog.message && (
          <div className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {dialog.message}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={dialog.onCancel} className="btn-secondary flex-1 py-3 rounded-full">
            {dialog.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={dialog.onConfirm}
            className={`flex-1 py-3 rounded-full ${dialog.destructive ? 'btn-destructive' : 'btn-primary'}`}
          >
            {dialog.confirmLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   TOP BAR
   ===================================================================== */
function TopBar({ left, right, title }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-2">
      {/* min-w-10 keeps the slots at 40px when they hold an icon button but
          lets them grow to fit a pill (e.g. CalendarView's Today button). */}
      <div className="min-w-10 h-10 flex items-center justify-start">{left}</div>
      <div className="serif text-sm tracking-wide" style={{ color: 'var(--ink-muted)' }}>{title}</div>
      <div className="min-w-10 h-10 flex items-center justify-end">{right}</div>
    </div>
  );
}

/* =====================================================================
   CALENDAR — last-7-days strip + full-month view
   ===================================================================== */
const DAY_ABBREVS_3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ABBREVS_1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CheckDot({ done, size = 16 }) {
  if (done) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: 999,
          background: 'var(--sage)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Check size={Math.round(size * 0.65)} strokeWidth={3} style={{ color: '#FBF7EF' }} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 999,
        border: '1px dashed var(--line)',
      }}
    />
  );
}

function LastSevenDaysStrip({ history, onOpenCalendar }) {
  const sessionDays = buildSessionDaySet(history);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = ymdLocal(today);

  // Oldest → today (left → right). Rightmost cell is always "today".
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }

  return (
    <button
      type="button"
      onClick={onOpenCalendar}
      className="card p-3 mb-4 w-full text-left transition-colors hover:border-[color:var(--ink-muted)]"
      aria-label="Open full calendar"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs tracking-widest uppercase flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
          <CalendarIcon size={11} />
          <span>Last 7 days</span>
        </div>
        {/* Visually a pill to match the Trajectory tile's View-history button.
            Rendered as a span (not a nested button) so the whole tile keeps a
            single click target. */}
        <span className="btn-secondary text-xs px-2.5 py-1 rounded-full" aria-hidden="true">
          View calendar →
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = ymdLocal(d);
          const completed = sessionDays.has(iso);
          const isToday = iso === todayIso;
          const labelColor = isToday ? 'var(--clay)' : 'var(--ink-muted)';
          return (
            <div key={iso} className="flex flex-col items-center gap-1.5 py-1">
              <div className="text-xs" style={{ color: labelColor, fontWeight: isToday ? 500 : 400 }}>
                {DAY_ABBREVS_3[d.getDay()]}
              </div>
              <CheckDot done={completed} size={20} />
            </div>
          );
        })}
      </div>
    </button>
  );
}

function CalendarView({ history, onBack }) {
  const sessionDays = buildSessionDaySet(history);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = ymdLocal(today);

  // `cursor` is the first-of-month for the month currently displayed.
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const cursorYear = cursor.getFullYear();
  const cursorMonth = cursor.getMonth();
  const monthName = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const firstDay = new Date(cursorYear, cursorMonth, 1);
  const lastDay = new Date(cursorYear, cursorMonth + 1, 0);
  const startWeekday = firstDay.getDay(); // 0 (Sun) .. 6 (Sat)
  const numDays = lastDay.getDate();

  // Build flat array of cells: leading nulls for previous-month padding,
  // then the days, then trailing nulls so the grid is a full multiple of 7.
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) cells.push(new Date(cursorYear, cursorMonth, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => setCursor(new Date(cursorYear, cursorMonth - 1, 1));
  const goNext = () => setCursor(new Date(cursorYear, cursorMonth + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  // Don't let the user page into the future further than the current month.
  const isCurrentOrFutureMonth =
    cursorYear > today.getFullYear() ||
    (cursorYear === today.getFullYear() && cursorMonth >= today.getMonth());
  const isCurrentMonth =
    cursorYear === today.getFullYear() && cursorMonth === today.getMonth();

  // Horizontal swipe to change month. Threshold + horizontal-dominance check
  // so vertical page scrolls and chevron taps both still work normally.
  const swipeStart = useRef(null);
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) { swipeStart.current = null; return; }
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const SWIPE_DISTANCE = 60;        // min horizontal travel
    const HORIZONTAL_DOMINANCE = 1.5; // |dx| must beat |dy| by this factor
    if (Math.abs(dx) < SWIPE_DISTANCE) return;
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) return;
    if (dx < 0) {
      // swipe left → next month
      if (!isCurrentOrFutureMonth) goNext();
    } else {
      // swipe right → previous month
      goPrev();
    }
  };

  // Count completed days in this month to show as a small footer stat.
  let monthCompletedCount = 0;
  for (let d = 1; d <= numDays; d++) {
    if (sessionDays.has(ymdLocal(new Date(cursorYear, cursorMonth, d)))) monthCompletedCount++;
  }

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title="CALENDAR"
        left={<button onClick={onBack} className="btn-ghost p-2" aria-label="Back"><ChevronLeft size={22} /></button>}
        right={
          !isCurrentMonth ? (
            <button
              onClick={goToday}
              className="btn-secondary text-xs px-2.5 py-1 rounded-full"
              aria-label="Jump to current month"
            >
              Today
            </button>
          ) : null
        }
      />
      <div className="flex-1 min-h-0 px-5 pb-6 overflow-y-auto scrollbar-thin">
        <div
          className="card p-4 mb-3"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          <div className="flex items-center justify-between mb-3">
            <button onClick={goPrev} className="btn-ghost p-2" aria-label="Previous month">
              <ChevronLeft size={20} />
            </button>
            <div className="serif text-lg" style={{ fontWeight: 500 }}>{monthName}</div>
            <button
              onClick={goNext}
              className="btn-ghost p-2"
              aria-label="Next month"
              disabled={isCurrentOrFutureMonth}
              style={{ opacity: isCurrentOrFutureMonth ? 0.3 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_ABBREVS_1.map((l, i) => (
              <div
                key={i}
                className="text-center text-xs tracking-wider uppercase py-1"
                style={{ color: 'var(--ink-muted)' }}
              >
                {l}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`pad-${i}`} />;
              const iso = ymdLocal(d);
              const completed = sessionDays.has(iso);
              const isToday = iso === todayIso;
              const isFuture = d.getTime() > today.getTime();
              return (
                <div
                  key={iso}
                  className="flex flex-col items-center gap-1 py-1.5 rounded-lg"
                  style={{
                    background: isToday ? 'rgba(184, 86, 58, 0.08)' : 'transparent',
                    border: isToday ? '1px solid var(--clay)' : '1px solid transparent',
                    opacity: isFuture && !isToday ? 0.45 : 1,
                  }}
                >
                  <div
                    className="serif tabular text-sm"
                    style={{
                      color: isToday ? 'var(--clay)' : 'var(--ink)',
                      fontWeight: isToday ? 500 : 400,
                    }}
                  >
                    {d.getDate()}
                  </div>
                  <CheckDot done={completed} size={14} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs px-2" style={{ color: 'var(--ink-muted)' }}>
          {monthCompletedCount} day{monthCompletedCount === 1 ? '' : 's'} with a session this month.
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   HOME
   ===================================================================== */
const HOME_KIND_META = {
  'step-up':   { Icon: TrendingUp,   label: 'step up',          color: 'var(--sage)' },
  'step-back': { Icon: TrendingDown, label: 'step back',        color: 'var(--amber)' },
  'shake-up':  { Icon: Shuffle,      label: 'shake-up',         color: 'var(--gold)' },
  'repeat':    { Icon: RotateCcw,    label: 'repeat',           color: 'var(--amber)' },
  'fresh':     { Icon: Play,         label: 'first session',    color: 'var(--ink-muted)' },
};

function Home({ nextRehearsalSeconds, nextNumber, suggestion, history, goalSeconds, goalProgress,
                onStart, onHistory, onShowOnboarding, onSettings, onCalendar, growthIntensity = 'typical',
                resumable, onResume, onDiscardActive }) {
  const hasHistory = history && history.length > 0;
  const projection = hasHistory ? simulateProjection(history, goalSeconds, 5, { growthIntensity }) : [];
  const kindMeta = HOME_KIND_META[suggestion?.kind] || HOME_KIND_META['step-up'];
  const KindIcon = kindMeta.Icon;

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title="DEPARTURE TRAINING"
        left={
          <button onClick={onShowOnboarding} className="btn-ghost p-2" aria-label="How this works">
            <Info size={20} />
          </button>
        }
        right={
          <button onClick={onSettings} className="btn-ghost p-2" aria-label="Settings">
            <SettingsIcon size={20} />
          </button>
        }
      />
      <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 overflow-y-auto scrollbar-thin">

        {/* Hero: session label · big time · kind subcaption */}
        <div className="mb-5">
          <div className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--ink-muted)' }}>
            Next rehearsal · Session {nextNumber}
          </div>
          <div
            className="serif text-7xl leading-none tabular"
            style={{ fontWeight: 500, color: 'var(--clay)' }}
          >
            {formatTimeLong(nextRehearsalSeconds)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
            <KindIcon size={12} style={{ color: kindMeta.color }} />
            <span className="uppercase tracking-wider" style={{ color: kindMeta.color, fontWeight: 500 }}>
              {kindMeta.label}
            </span>
            <span style={{ color: 'var(--ink-muted)' }}>·</span>
            <span className="serif italic">{suggestion?.reason}</span>
          </div>
        </div>

        {/* Trajectory card: chart + goal + estimate, anchored together. The
            chart area is reserved for the future scrub gesture, so the
            "View history" affordance is a discrete pill button in the
            top-right rather than a whole-card click. */}
        {hasHistory ? (
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
                Trajectory
              </div>
              <button
                type="button"
                onClick={onHistory}
                aria-label="View history"
                className="btn-secondary text-xs px-2.5 py-1 rounded-full"
              >
                View history →
              </button>
            </div>
            <ProgressionChart
              history={history}
              goalSeconds={goalSeconds}
              projection={projection}
              compact
              height={110}
              historyTake={3}
            />
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>
                <Target size={11} />
                <span className="tracking-widest uppercase">Goal {formatTimeLong(goalSeconds)}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="progress-track flex-1">
                  <div className="progress-fill" style={{ width: `${goalProgress.percent}%` }} />
                </div>
                <div className="serif tabular text-xs" style={{ color: 'var(--ink-soft)', minWidth: 32, textAlign: 'right' }}>
                  {goalProgress.percent}%
                </div>
              </div>
              <div className="serif italic text-sm" style={{ color: 'var(--ink-soft)' }}>
                {estimateText(goalProgress)}
              </div>
            </div>
          </div>
        ) : (
          /* No history yet: goal card stands alone */
          <div className="card p-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>
              <Target size={11} />
              <span className="tracking-widest uppercase">Goal {formatTimeLong(goalSeconds)}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="progress-track flex-1">
                <div className="progress-fill" style={{ width: `${goalProgress.percent}%` }} />
              </div>
              <div className="serif tabular text-xs" style={{ color: 'var(--ink-soft)', minWidth: 32, textAlign: 'right' }}>
                {goalProgress.percent}%
              </div>
            </div>
            <div className="serif italic text-sm" style={{ color: 'var(--ink-soft)' }}>
              {estimateText(goalProgress)}
            </div>
          </div>
        )}

        <LastSevenDaysStrip history={history} onOpenCalendar={onCalendar} />

        {resumable && (
          <div className="card p-4 mb-4" style={{ borderColor: 'var(--amber)', background: '#FDF6EA' }}>
            <div className="flex items-start gap-3">
              <Clock size={18} style={{ color: 'var(--amber)', marginTop: 2 }} />
              <div className="flex-1">
                <div className="text-sm font-medium mb-1">Session in progress</div>
                <div className="text-xs mb-3" style={{ color: 'var(--ink-soft)' }}>
                  Session #{resumable.number} · phase {resumable.currentPhaseIndex + 1} of {resumable.phases.length}
                </div>
                <div className="flex gap-2">
                  <button onClick={onResume} className="btn-primary px-4 py-2 rounded-full text-sm">Resume</button>
                  <button onClick={onDiscardActive} className="btn-secondary px-4 py-2 rounded-full text-sm">Discard</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Start button pinned to bottom via mt-auto */}
        <div className="mt-auto shrink-0 pb-6 pt-4">
          <button onClick={onStart} className="btn-primary w-full py-5 rounded-full text-lg">
            Start session
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   SETUP
   ===================================================================== */
function Setup({ nextNumber, suggestion, onBack, onStart, shakeUpSuggestion }) {
  const [goalStr, setGoalStr] = useState(formatTime(suggestion.seconds));
  const [currentSuggestion, setCurrentSuggestion] = useState(suggestion);
  const [warmUps, setWarmUps] = useState(() => generateWarmUps());
  const [notes, setNotes] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);

  const goalSeconds = parseMMSS(goalStr);
  const goalValid = goalSeconds !== null && goalSeconds > 0;

  const changeWarmUp = (idx, newValue) => {
    const v = Math.max(0, Math.min(600, parseInt(newValue, 10) || 0));
    setWarmUps(w => w.map((x, i) => (i === idx ? v : x)));
  };
  const removeWarmUp = (idx) => setWarmUps(w => (w.length <= WARMUP_MIN ? w : w.filter((_, i) => i !== idx)));
  const addWarmUp = () => setWarmUps(w => (w.length >= WARMUP_MAX ? w : [...w, 0]));

  // Resize the warm-up list to exactly `n`. Truncates from the tail when
  // shrinking; appends randomized values when growing.
  const setWarmUpCount = (n) => {
    const target = Math.max(WARMUP_MIN, Math.min(WARMUP_MAX, n));
    setWarmUps(prev => {
      if (prev.length === target) return prev;
      if (prev.length > target) return prev.slice(0, target);
      const shortVals = [5, 10, 15, 20];
      const longVals = [25, 30, 35, 40, 45, 50, 55];
      const next = [...prev];
      while (next.length < target) {
        const pool = Math.random() < 0.4 ? shortVals : longVals;
        next.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      return next;
    });
  };

  // Icon + accent color for suggestion kind
  const kindMeta = {
    'step-up':   { Icon: TrendingUp,   color: 'var(--sage)' },
    'step-back': { Icon: TrendingDown, color: 'var(--amber)' },
    'shake-up':  { Icon: Shuffle,      color: 'var(--gold)' },
    'repeat':    { Icon: RotateCcw,    color: 'var(--amber)' },
    'fresh':     { Icon: Play,         color: 'var(--ink-muted)' },
  }[currentSuggestion.kind] || { Icon: TrendingUp, color: 'var(--ink-muted)' };
  const { Icon: KindIcon, color: kindColor } = kindMeta;

  const applyShakeUp = () => {
    if (!shakeUpSuggestion) return;
    setGoalStr(formatTime(shakeUpSuggestion.seconds));
    setCurrentSuggestion(shakeUpSuggestion);
  };

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title={`SESSION ${nextNumber}`}
        left={<button onClick={onBack} className="btn-ghost p-2"><ChevronLeft size={22} /></button>}
      />
      <div className="flex-1 min-h-0 px-6 pb-24 overflow-y-auto">
        <div className="mb-8">
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--ink-muted)' }}>Rehearsal goal</div>
          <input
            type="text" inputMode="numeric" value={goalStr}
            onChange={e => setGoalStr(e.target.value)}
            placeholder="mm:ss"
            className="input-text serif tabular text-5xl py-3 px-4 rounded-xl w-full"
            style={{ fontWeight: 500 }}
          />
          <div className="flex items-start gap-1.5 mt-2">
            <KindIcon size={12} style={{ color: kindColor, marginTop: 3, flexShrink: 0 }} />
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              <span>Suggested <span className="tabular mono">{formatTime(currentSuggestion.seconds)}</span> — <span className="serif italic">{currentSuggestion.reason}</span></span>
            </div>
          </div>
          {currentSuggestion.kind !== 'shake-up' && shakeUpSuggestion && (
            <button
              onClick={applyShakeUp}
              className="btn-secondary mt-3 px-3 py-2 rounded-full text-xs flex items-center gap-1.5"
            >
              <Shuffle size={12} /> Try a shake-up ({formatTime(shakeUpSuggestion.seconds)})
            </button>
          )}
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs tracking-widest uppercase flex items-center gap-2" style={{ color: 'var(--ink-muted)' }}>
              <span>Warm-ups</span>
              <select
                value={Math.max(WARMUP_MIN, Math.min(WARMUP_MAX, warmUps.length))}
                onChange={e => setWarmUpCount(parseInt(e.target.value, 10))}
                className="input-text tabular text-xs tracking-normal py-1 pl-2 pr-1 rounded-md"
                aria-label="Number of warm-ups"
              >
                {Array.from({ length: WARMUP_MAX - WARMUP_MIN + 1 }, (_, i) => WARMUP_MIN + i).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button onClick={() => setWarmUps(generateWarmUps(warmUps.length))} className="btn-ghost text-xs flex items-center gap-1.5 py-1">
              <Shuffle size={14} /> Shuffle
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {warmUps.map((v, i) =>
              editingIdx === i ? (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="number" inputMode="numeric" value={v}
                    step={5} min={0} max={600} autoFocus
                    onChange={e => changeWarmUp(i, e.target.value)}
                    onBlur={() => setEditingIdx(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingIdx(null); }}
                    className="input-text tabular mono text-center w-20 py-2 rounded-full"
                  />
                  <button onClick={() => { removeWarmUp(i); setEditingIdx(null); }} className="btn-ghost p-1">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button key={i} onClick={() => setEditingIdx(i)} className="pill px-4 py-2 tabular text-sm">
                  {v}s
                </button>
              )
            )}
            <button onClick={addWarmUp} className="pill px-4 py-2 text-sm flex items-center gap-1" style={{ color: 'var(--ink-muted)' }}>
              <Plus size={14} /> add
            </button>
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>
            Tap to edit. Between each warm-up is a 1-minute settle with your dog.
          </div>
        </div>

        <div className="mb-8">
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--ink-muted)' }}>
            Notes <span className="lowercase tracking-normal" style={{ opacity: 0.6 }}>(optional)</span>
          </div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="How's he doing today?"
            className="input-text w-full p-3 rounded-xl text-sm resize-none"
          />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4" style={{ background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <button
          disabled={!goalValid || warmUps.length === 0}
          onClick={() => onStart({ number: nextNumber, warmUps, rehearsalSeconds: goalSeconds, notes })}
          className="btn-primary w-full py-4 rounded-full text-base"
        >
          Begin session
        </button>
      </div>
    </div>
  );
}

/* =====================================================================
   SESSION (running timer)
   ===================================================================== */
function SessionView({ session, soundEnabled, toggleSound, volume = 100, onUpdate, onAbort, onComplete, askConfirm }) {
  const [now, setNow] = useState(Date.now());
  useWakeLock(session.phaseState === 'running');
  // Keep JS alive while a phase is running so phase-end notifications can
  // still fire when the user has switched to another app on iOS. Gated on
  // soundEnabled (the master notifications toggle) so users who don't want
  // alerts don't pay the (small) battery cost.
  useAudioKeepalive(session.phaseState === 'running' && soundEnabled);

  const phase = session.phases[session.currentPhaseIndex];
  const isLast = session.currentPhaseIndex >= session.phases.length - 1;
  const nextPhase = !isLast ? session.phases[session.currentPhaseIndex + 1] : null;

  // Track whether the document was hidden at any point during the current
  // running segment, so that when JS resumes after an iOS background-suspend
  // we can still fire a real system notification rather than just a (now
  // delayed) chime. Reset whenever a new running segment begins.
  const phaseWasHiddenRef = useRef(false);
  useEffect(() => {
    if (session.phaseState === 'running') {
      phaseWasHiddenRef.current =
        typeof document !== 'undefined' && document.visibilityState === 'hidden';
    }
  }, [session.phaseState, session.currentPhaseIndex, session.phaseEndTime]);
  useEffect(() => {
    const handler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        phaseWasHiddenRef.current = true;
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const alertPhaseEnd = (completedPhase, upcomingPhase) => {
    const phaseName = completedPhase?.type === 'warmup' ? 'Warm-up'
      : completedPhase?.type === 'rehearsal' ? 'Rehearsal'
      : completedPhase?.type === 'settle' ? 'Settle'
      : 'Phase';
    const body = upcomingPhase
      ? `Next: ${upcomingPhase.type === 'warmup' ? 'warm-up' : upcomingPhase.type}.`
      : 'Session complete.';
    firePhaseEndAlert({
      notificationsEnabled: soundEnabled,
      volume,
      title: `${phaseName} complete`,
      body,
      wasHidden: phaseWasHiddenRef.current,
    });
  };

  useEffect(() => {
    if (session.phaseState !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [session.phaseState]);

  useEffect(() => {
    if (session.phaseState !== 'running') return;
    if (now >= session.phaseEndTime) {
      alertPhaseEnd(phase, nextPhase);
      onUpdate({ ...session, phaseState: 'complete', phaseEndTime: null });
    }
  }, [now, session, soundEnabled, onUpdate]);

  let remaining;
  if (session.phaseState === 'waiting') remaining = phase.durationSeconds;
  // Cap at the phase duration so a stale `now` (e.g. on the first render
  // after Start, before the setInterval has ticked) can't briefly display a
  // value larger than the phase length.
  else if (session.phaseState === 'running') remaining = Math.min(phase.durationSeconds, Math.max(0, (session.phaseEndTime - now) / 1000));
  else if (session.phaseState === 'paused') remaining = session.pausedRemaining;
  else remaining = 0;

  const startTimer = () => {
    const dur = session.phaseState === 'paused' ? session.pausedRemaining : phase.durationSeconds;
    if (dur <= 0) {
      alertPhaseEnd(phase, nextPhase);
      onUpdate({ ...session, phaseState: 'complete', phaseEndTime: null, pausedRemaining: null });
      return;
    }
    // Sync `now` to the same instant we set phaseEndTime against, so the
    // first render after this update shows exactly `dur` (no flash of a
    // slightly-larger number from a stale `now`).
    const t = Date.now();
    setNow(t);
    onUpdate({ ...session, phaseState: 'running',
               phaseEndTime: t + dur * 1000, pausedRemaining: null });
  };

  const pauseTimer = () => {
    const rem = Math.max(0, (session.phaseEndTime - Date.now()) / 1000);
    onUpdate({ ...session, phaseState: 'paused', phaseEndTime: null, pausedRemaining: rem });
  };

  const nextPhaseAction = () => {
    if (isLast) { onComplete(); return; }
    onUpdate({ ...session, currentPhaseIndex: session.currentPhaseIndex + 1,
               phaseState: 'waiting', phaseEndTime: null, pausedRemaining: null });
  };

  const skipPhase = async () => {
    const ok = await askConfirm({
      title: 'Skip this phase?',
      message: phase.type === 'rehearsal'
        ? 'The rehearsal will be marked incomplete.'
        : `${phase.label} will be skipped and counted as incomplete.`,
      confirmLabel: 'Skip', destructive: true,
    });
    if (!ok) return;
    if (isLast) {
      onComplete(true);
    } else {
      onUpdate({ ...session, currentPhaseIndex: session.currentPhaseIndex + 1,
                 phaseState: 'waiting', phaseEndTime: null, pausedRemaining: null });
    }
  };

  const abort = async () => {
    const ok = await askConfirm({
      title: 'Abort session?', message: 'This session will not be saved to history.',
      confirmLabel: 'Abort', destructive: true,
    });
    if (ok) onAbort();
  };

  const cueAccent = phase.type === 'rehearsal' ? 'var(--clay)'
                  : phase.type === 'settle' ? 'var(--sage)'
                  : 'var(--ink)';

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title={`SESSION ${session.number}`}
        left={<button onClick={abort} className="btn-ghost p-2"><X size={22} /></button>}
        right={<button onClick={toggleSound} className="btn-ghost p-2">{soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>}
      />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--ink-muted)' }}>
          {phase.label}
        </div>
        <div
          className={`serif italic text-2xl mb-8 ${session.phaseState === 'waiting' ? 'pulse' : ''}`}
          style={{ color: cueAccent, maxWidth: '280px', lineHeight: 1.3 }}
        >
          {session.phaseState === 'complete'
            ? (isLast ? 'Done — welcome back' : 'Time up — come on in')
            : phaseCue(phase)}
        </div>
        <div
          className="serif tabular mb-2"
          style={{
            fontSize: 'clamp(96px, 26vw, 176px)',
            fontWeight: 500, lineHeight: 0.95, letterSpacing: '-0.03em',
            color: session.phaseState === 'complete' ? 'var(--sage)' : 'var(--ink)',
          }}
        >
          {formatTime(remaining)}
        </div>
        <div className="text-xs tracking-widest uppercase mb-12" style={{ color: 'var(--ink-muted)' }}>
          {session.phaseState === 'running' ? 'Running' :
           session.phaseState === 'paused' ? 'Paused' :
           session.phaseState === 'complete' ? 'Complete' : 'Ready'}
        </div>
        <div className="w-full max-w-xs space-y-3">
          {session.phaseState === 'waiting' && (
            <button onClick={startTimer} className="btn-primary w-full py-4 rounded-full flex items-center justify-center gap-2">
              <Play size={18} fill="currentColor" /> Start {formatTime(phase.durationSeconds)} timer
            </button>
          )}
          {session.phaseState === 'running' && (
            <button onClick={pauseTimer} className="btn-secondary w-full py-4 rounded-full flex items-center justify-center gap-2">
              <Pause size={18} /> Pause
            </button>
          )}
          {session.phaseState === 'paused' && (
            <button onClick={startTimer} className="btn-primary w-full py-4 rounded-full flex items-center justify-center gap-2">
              <Play size={18} fill="currentColor" /> Resume
            </button>
          )}
          {session.phaseState === 'complete' && (
            <button onClick={nextPhaseAction} className="btn-primary w-full py-4 rounded-full flex items-center justify-center gap-2">
              {isLast ? <><Check size={18} /> Finish session</>
                      : <>Next: {nextPhase.label} <ChevronRight size={18} /></>}
            </button>
          )}
          {session.phaseState !== 'complete' && (
            <button onClick={skipPhase} className="btn-ghost w-full py-3 text-sm flex items-center justify-center gap-1.5">
              <SkipForward size={14} /> Skip this phase
            </button>
          )}
        </div>
      </div>
      <div className="px-6 pb-8 pt-4 flex items-center justify-center gap-1.5 flex-wrap">
        {session.phases.map((p, i) => (
          <div
            key={i}
            className={`dot ${i === session.currentPhaseIndex ? 'dot-current' : ''} ${i < session.currentPhaseIndex ? 'dot-done' : ''}`}
            style={p.type === 'rehearsal' ? { width: i === session.currentPhaseIndex ? 28 : 14, height: 10, borderRadius: 5 } : undefined}
            title={`${p.label} · ${formatTime(p.durationSeconds)}`}
          />
        ))}
      </div>
    </div>
  );
}

/* =====================================================================
   SUMMARY (rating required)
   ===================================================================== */
function Summary({ session, onSave, onDiscard }) {
  const [rating, setRating] = useState(null);
  const [notes, setNotes] = useState(session.notes || '');
  const completedWarmUps = session.completedPhases.filter(p => p.type === 'warmup' && p.completed).length;
  const rehearsalDone = session.completedPhases.find(p => p.type === 'rehearsal')?.completed ?? false;

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar title="SESSION COMPLETE" />
      <div className="flex-1 px-6 pb-6 flex flex-col">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mt-4 mb-4" style={{ background: 'var(--sage)', color: 'var(--surface)' }}>
          <Check size={26} strokeWidth={2.5} />
        </div>
        <div className="serif text-4xl text-center mb-1" style={{ fontWeight: 500 }}>Session {session.number}</div>
        <div className="serif italic text-center text-base mb-6" style={{ color: 'var(--ink-soft)' }}>Nice work.</div>

        <div className="card p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--ink-muted)' }}>Warm-ups</div>
              <div className="serif tabular text-2xl">{completedWarmUps}<span style={{ color: 'var(--ink-muted)', fontSize: '0.6em' }}> / {session.warmUps.length}</span></div>
            </div>
            <div>
              <div className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--ink-muted)' }}>Rehearsal</div>
              <div className="serif tabular text-2xl" style={{ color: rehearsalDone ? 'var(--ink)' : 'var(--ink-muted)' }}>
                {formatTime(session.rehearsalSeconds)}
              </div>
            </div>
          </div>
          {!rehearsalDone && <div className="text-xs mt-3" style={{ color: 'var(--amber)' }}>Rehearsal was not completed.</div>}
        </div>

        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--ink-muted)' }}>
            How did it go? <span className="lowercase tracking-normal" style={{ color: 'var(--clay)' }}>*</span>
          </div>
          <RatingSelector value={rating} onChange={setRating} />
        </div>

        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--ink-muted)' }}>Notes</div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="Anything to remember?"
            className="input-text w-full p-3 rounded-xl text-sm resize-none"
          />
        </div>

        <div className="flex-1" />
        <button
          onClick={() => onSave({ rating, notes })}
          disabled={!rating}
          className="btn-primary w-full py-4 rounded-full mb-2"
        >
          {rating ? 'Save to history' : 'Pick a rating to save'}
        </button>
        <button onClick={onDiscard} className="btn-ghost py-3 text-sm">Discard this session</button>
      </div>
    </div>
  );
}

/* =====================================================================
   EDIT SESSION
   ===================================================================== */
function EditSession({ session, isNew = false, onBack, onSave, onDelete, askConfirm }) {
  const [date, setDate] = useState(session.date || '');
  const [goalStr, setGoalStr] = useState(formatTime(session.rehearsalSeconds));
  const [warmUps, setWarmUps] = useState([...session.warmUps]);
  const [notes, setNotes] = useState(session.notes || '');
  const [rating, setRating] = useState(session.rating ?? null);
  const [editingIdx, setEditingIdx] = useState(null);

  const goalSeconds = parseMMSS(goalStr);
  const valid = goalSeconds !== null && goalSeconds > 0;

  const changeWarmUp = (idx, newValue) => {
    const v = Math.max(0, Math.min(600, parseInt(newValue, 10) || 0));
    setWarmUps(w => w.map((x, i) => (i === idx ? v : x)));
  };
  const removeWarmUp = (idx) => setWarmUps(w => w.filter((_, i) => i !== idx));
  const addWarmUp = () => setWarmUps(w => [...w, 0]);

  const handleSave = () => {
    if (!valid) return;
    onSave({
      number: session.number, date: date || null,
      rehearsalSeconds: goalSeconds, warmUps, notes, rating,
    });
  };

  const handleDelete = async () => {
    const ok = await askConfirm({
      title: `Delete session ${session.number}?`,
      message: 'This will permanently remove it from your history.',
      confirmLabel: 'Delete', destructive: true,
    });
    if (ok) onDelete();
  };

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title={`${isNew ? 'ADD' : 'EDIT'} SESSION ${session.number}`}
        left={<button onClick={onBack} className="btn-ghost p-2"><ChevronLeft size={22} /></button>}
      />
      <div className="flex-1 min-h-0 px-6 pb-24 overflow-y-auto">
        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--ink-muted)' }}>Session number</div>
          <div
            className="serif tabular text-3xl py-2 px-4 rounded-xl"
            style={{ fontWeight: 500, color: 'var(--ink-muted)', background: 'var(--bg-warm)', border: '1px solid var(--line)' }}
            aria-label={`Session number ${session.number}`}
          >
            {session.number}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--ink-muted)' }}>Date</div>
          <input
            type="date" value={date}
            onChange={e => setDate(e.target.value)}
            className="input-text py-3 px-4 rounded-xl w-full text-base"
          />
          {!date && <div className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>No date set</div>}
        </div>

        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--ink-muted)' }}>Rehearsal duration</div>
          <input
            type="text" inputMode="numeric" value={goalStr}
            onChange={e => setGoalStr(e.target.value)}
            placeholder="mm:ss"
            className="input-text serif tabular text-3xl py-2 px-4 rounded-xl w-full"
            style={{ fontWeight: 500 }}
          />
        </div>

        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--ink-muted)' }}>
            Warm-ups ({warmUps.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {warmUps.map((v, i) =>
              editingIdx === i ? (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="number" inputMode="numeric" value={v}
                    min={0} max={600} autoFocus
                    onChange={e => changeWarmUp(i, e.target.value)}
                    onBlur={() => setEditingIdx(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingIdx(null); }}
                    className="input-text tabular mono text-center w-20 py-2 rounded-full"
                  />
                  <button onClick={() => { removeWarmUp(i); setEditingIdx(null); }} className="btn-ghost p-1">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button key={i} onClick={() => setEditingIdx(i)} className="pill px-4 py-2 tabular text-sm">
                  {v}s
                </button>
              )
            )}
            <button onClick={addWarmUp} className="pill px-4 py-2 text-sm flex items-center gap-1" style={{ color: 'var(--ink-muted)' }}>
              <Plus size={14} /> add
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--ink-muted)' }}>Rating</div>
          <RatingSelector value={rating} onChange={setRating} allowNone={true} />
        </div>

        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--ink-muted)' }}>Notes</div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={3}
            className="input-text w-full p-3 rounded-xl text-sm resize-none"
          />
        </div>

        {!isNew && (
          <button
            onClick={handleDelete}
            className="btn-destructive w-full py-3 rounded-full text-sm flex items-center justify-center gap-2 mt-8"
          >
            <Trash2 size={16} /> Delete this session
          </button>
        )}
      </div>

      <div className="px-6 pb-6 pt-4" style={{ background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <button disabled={!valid} onClick={handleSave} className="btn-primary w-full py-4 rounded-full text-base">
          {isNew ? 'Add session' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/* =====================================================================
   GOAL CARD
   ===================================================================== */
function GoalCard({ goalSeconds, onChange, askConfirm }) {
  const [editing, setEditing] = useState(false);
  const initialH = Math.floor(goalSeconds / 3600);
  const initialM = Math.floor((goalSeconds % 3600) / 60);
  const [hDraft, setHDraft] = useState(String(initialH));
  const [mDraft, setMDraft] = useState(String(initialM));

  const startEdit = () => {
    const h = Math.floor(goalSeconds / 3600);
    const m = Math.floor((goalSeconds % 3600) / 60);
    setHDraft(String(h));
    setMDraft(String(m));
    setEditing(true);
  };
  const save = async () => {
    // Accept empty as 0 so users can edit freely without deleting the field first.
    const h = hDraft === '' ? 0 : parseInt(hDraft, 10);
    const m = mDraft === '' ? 0 : parseInt(mDraft, 10);
    const valid =
      Number.isFinite(h) && h >= 0 && h <= 23 &&
      Number.isFinite(m) && m >= 0 && m <= 59 &&
      (h > 0 || m > 0);
    if (!valid) {
      await askConfirm({
        title: 'Invalid goal',
        message: 'Enter a positive duration. Hours 0–23, minutes 0–59.',
        confirmLabel: 'OK', cancelLabel: ' ',
      });
      return;
    }
    onChange(h * 3600 + m * 60);
    setEditing(false);
  };
  const cancel = () => { setEditing(false); };

  return (
    <div className="card p-4 mb-3 flex items-center gap-3">
      <Target size={20} style={{ color: 'var(--clay)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--ink-muted)' }}>
          Rehearsal goal
        </div>
        {editing ? (
          <div className="flex items-baseline gap-1 flex-wrap">
            <input
              type="text" inputMode="numeric" value={hDraft}
              onChange={e => setHDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              autoFocus
              aria-label="Hours"
              className="input-text serif tabular text-2xl py-1 px-2 rounded-lg text-center"
              style={{ fontWeight: 500, width: '3.5rem' }}
            />
            <span className="serif text-base" style={{ color: 'var(--ink-muted)' }}>h</span>
            <input
              type="text" inputMode="numeric" value={mDraft}
              onChange={e => setMDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              aria-label="Minutes"
              className="input-text serif tabular text-2xl py-1 px-2 rounded-lg text-center ml-1"
              style={{ fontWeight: 500, width: '3.5rem' }}
            />
            <span className="serif text-base" style={{ color: 'var(--ink-muted)' }}>m</span>
          </div>
        ) : (
          <div className="serif tabular text-2xl" style={{ fontWeight: 500 }}>
            {formatTimeLong(goalSeconds)}
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <button
            onClick={cancel}
            className="btn-ghost rounded-full flex items-center justify-center"
            style={{ width: 40, height: 40, border: '1px solid var(--line)' }}
            aria-label="Cancel"
          >
            <X size={22} />
          </button>
          <button
            onClick={save}
            className="rounded-full flex items-center justify-center"
            style={{ width: 40, height: 40, background: 'var(--clay)', color: 'var(--surface)' }}
            aria-label="Save goal"
          >
            <Check size={22} />
          </button>
        </div>
      ) : (
        <button onClick={startEdit} className="btn-ghost p-2"><Pencil size={16} /></button>
      )}
    </div>
  );
}

/* =====================================================================
   HISTORY
   ===================================================================== */
const CHART_RANGES = [
  { id: 'all',    label: 'All time', take: Infinity, projectN: 0 },
  { id: '30',     label: 'Last 30',  take: 30,       projectN: 0 },
  { id: '7',      label: 'Last 7',   take: 7,        projectN: 0 },
  { id: 'next10', label: 'Next 10',  take: 3,        projectN: 10 },
];

const KIND_LABEL = {
  'step-up':   'step up',
  'step-back': 'step back',
  'shake-up':  'shake-up',
  'repeat':    'repeat',
  'fresh':     'start',
};

/**
 * Shared chart showing historical rehearsal durations and (optionally) a
 * dashed projection of upcoming sessions from simulateProjection().
 *
 * Props:
 *   history:       Array of session records.
 *   goalSeconds:   Number — goal reference line.
 *   projection:    Array of { number, seconds, kind } projected points (or []).
 *   compact:       If true, hides range selector + legend and uses smaller
 *                  padding. Home uses this.
 *   height:        Chart height in px.
 *   historyTake:   When compact, how many trailing history points to show.
 *   showTitle:     Whether to render the "Rehearsal progression" label.
 */
function ProgressionChart({
  history,
  goalSeconds,
  projection: projectionProp = [],
  compact = false,
  height = 200,
  historyTake = 3,
  showTitle = true,
  growthIntensity = 'typical',
}) {
  const [chartRange, setChartRange] = useState('all');

  const ascending = [...history].sort((a, b) => a.number - b.number);
  let sliced;
  let projection;
  if (compact) {
    sliced = ascending.slice(-historyTake);
    projection = projectionProp;
  } else {
    const range = CHART_RANGES.find(r => r.id === chartRange);
    const take = range?.take ?? Infinity;
    sliced = take === Infinity ? ascending : ascending.slice(-take);
    // For ranges that opt in to a forward projection (e.g. "Next 10"),
    // simulate the next N sessions inline using the same growth model the
    // Home tile uses. simulateProjection caps at the goal so projection
    // never overshoots.
    projection = range?.projectN
      ? simulateProjection(history, goalSeconds, range.projectN, { growthIntensity })
      : [];
  }

  const historyRows = sliced.map(s => ({
    session: s.number,
    minutes: Math.round((s.rehearsalSeconds / 60) * 10) / 10,
    rating: s.rating ?? null,
    projMinutes: null,
    kind: null,
  }));

  const projectionRows = projection.map(p => ({
    session: p.number,
    minutes: null,
    rating: null,
    projMinutes: Math.round((p.seconds / 60) * 10) / 10,
    kind: p.kind,
  }));

  // Bridge: duplicate last history point's value into projMinutes so the
  // dashed line visually connects from the real last session to the first
  // projected one. We flag it so the tooltip hides the duplicate entry.
  const chartData = [...historyRows, ...projectionRows];
  if (historyRows.length && projectionRows.length) {
    const bridgeIdx = historyRows.length - 1;
    chartData[bridgeIdx] = {
      ...chartData[bridgeIdx],
      projMinutes: chartData[bridgeIdx].minutes,
      _bridge: true,
    };
  }

  const goalMinutes = goalSeconds / 60;
  const allMinutes = [
    ...historyRows.map(d => d.minutes),
    ...projectionRows.map(d => d.projMinutes),
  ];
  const dataMax = allMinutes.length ? Math.max(...allMinutes) : 0;
  const yMax = Math.max(goalMinutes, dataMax) * 1.1 + 1;

  const renderHistoryDot = (props) => {
    const { cx, cy, payload, index } = props;
    if (payload?.minutes == null) return <g key={index} />;
    const color = ratingColor(payload.rating) || '#B8563A';
    return <circle key={index} cx={cx} cy={cy} r={compact ? 3 : 3.5} fill={color} stroke="none" />;
  };

  const renderProjDot = (props) => {
    const { cx, cy, payload, index } = props;
    if (payload?.projMinutes == null) return <g key={index} />;
    // Skip the bridge so we don't paint a hollow circle on top of the
    // history's rating-colored dot.
    if (payload._bridge) return <g key={index} />;
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={compact ? 3 : 3.5}
        fill="#FBF7EF"
        stroke="#B8563A"
        strokeOpacity={0.6}
        strokeWidth={1.5}
      />
    );
  };

  const tooltipContent = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const entries = payload.filter(p => p.value != null);
    if (!entries.length) return null;

    // Bridge: prefer the history entry over the duplicate projection entry.
    const bridge = entries[0]?.payload?._bridge;
    const filtered = bridge ? entries.filter(e => e.dataKey === 'minutes') : entries;
    const e = filtered[0] ?? entries[0];
    const p = e.payload;
    const isProj = e.dataKey === 'projMinutes';

    let detail;
    if (isProj) {
      const kindLabel = KIND_LABEL[p.kind];
      detail = kindLabel
        ? `${e.value} min · projected (${kindLabel})`
        : `${e.value} min · projected`;
    } else {
      const r = p.rating;
      const rLabel = r ? ` · ${ratingMeta(r)?.label}` : '';
      detail = `${e.value} min${rLabel}`;
    }

    return (
      <div
        style={{
          background: '#FBF7EF',
          border: '1px solid #D9CEB8',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 12,
          fontFamily: 'IBM Plex Sans',
        }}
      >
        <div style={{ color: '#8B7B6C', fontSize: 11, marginBottom: 2 }}>
          Session #{label}
        </div>
        <div style={{ color: isProj ? '#8B7B6C' : '#1F1915' }}>{detail}</div>
      </div>
    );
  };

  const lastHistorySession = historyRows.length
    ? historyRows[historyRows.length - 1].session
    : null;

  return (
    <div className={compact ? '' : 'card p-4 mb-5'}>
      {!compact && showTitle && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
            Rehearsal progression
          </div>
        </div>
      )}
      {!compact && (
        <div className="flex items-center gap-1 mb-3 p-1 rounded-full" style={{ background: 'var(--bg-warm)' }}>
          {CHART_RANGES.map(t => {
            const active = chartRange === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setChartRange(t.id)}
                className="flex-1 px-1.5 py-1.5 rounded-full transition-all whitespace-nowrap"
                style={{
                  // Fluid font size so all four tabs fit on narrow phones.
                  // Clamps to 10px at the smallest, 12px (text-xs) at normal widths.
                  fontSize: 'clamp(10px, 2.7vw, 12px)',
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-muted)',
                  fontWeight: active ? 500 : 400,
                  border: active ? '1px solid var(--line)' : '1px solid transparent',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height,
          // Allow vertical page scroll to pass through the chart, but let
          // Recharts capture horizontal touch movement for scrubbing.
          touchAction: 'pan-y',
        }}
      >
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={compact ? { top: 10, right: 10, left: 10, bottom: 4 } : { top: 8, right: 12, left: -24, bottom: 0 }}
          >
            <CartesianGrid stroke="#D9CEB8" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="session"
              hide={compact}
              tick={{ fontSize: 10, fill: '#8B7B6C' }}
              axisLine={{ stroke: '#D9CEB8' }}
              tickLine={false}
              tickFormatter={(n) => `#${n}`}
              minTickGap={chartRange === '7' ? 0 : 16}
              interval="preserveStartEnd"
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              hide={compact}
              width={compact ? 0 : undefined}
              tick={{ fontSize: 10, fill: '#8B7B6C' }}
              axisLine={false}
              tickLine={false}
              unit="m"
              domain={[0, yMax]}
            />
            {/* Custom cursor: clay-tinted vertical line so the scrub position
                reads clearly on the cream surface. Recharts' default is a
                generic gray that gets lost against the chart grid. */}
            <Tooltip
              content={tooltipContent}
              cursor={{ stroke: '#B8563A', strokeOpacity: 0.45, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <ReferenceLine
              y={goalMinutes}
              stroke="#7A8F6F"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={
                compact
                  ? undefined
                  : {
                      value: `Goal ${formatTimeLong(goalSeconds)}`,
                      position: 'insideTopRight',
                      fill: '#7A8F6F',
                      fontSize: 10,
                      fontFamily: 'IBM Plex Sans',
                    }
              }
            />
            {projectionRows.length > 0 && lastHistorySession != null && (
              <ReferenceLine
                x={lastHistorySession}
                stroke="#D9CEB8"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            )}
            {/* Projection first so history dots render on top at the bridge.
                Active-dot radii bumped on touch surfaces so the scrubbed
                point is easy to track when a finger covers part of the chart. */}
            <Line
              type="monotone"
              dataKey="projMinutes"
              stroke="#B8563A"
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={renderProjDot}
              activeDot={{ r: compact ? 7 : 7, fill: '#FBF7EF', stroke: '#B8563A', strokeWidth: 1.75 }}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke="#B8563A"
              strokeWidth={1.5}
              dot={renderHistoryDot}
              activeDot={{ r: compact ? 7 : 7, strokeWidth: 1.5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
          {RATINGS.map(r => (
            <div key={r.num} className="flex items-center gap-1.5">
              <div style={{ width: 8, height: 8, borderRadius: 999, background: r.color }} />
              <span>{r.num} {r.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: 999, background: '#B8563A' }} />
            <span>Unrated</span>
          </div>
          {projectionRows.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span style={{ width: 12, height: 0, borderTop: '1.5px dashed #B8563A', opacity: 0.6 }} />
              <span>Projected</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryView({ history, goalSeconds, growthIntensity = 'typical',
                       onChangeGoal, askConfirm,
                       onBack, onEdit, onAdd, onExport, onImport }) {
  const fileInputRef = useRef(null);
  const sorted = [...history].sort((a, b) => b.number - a.number);

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title="HISTORY"
        left={<button onClick={onBack} className="btn-ghost p-2"><ChevronLeft size={22} /></button>}
      />
      <div className="flex-1 min-h-0 px-5 pb-6 overflow-y-auto scrollbar-thin">

        <GoalCard goalSeconds={goalSeconds} onChange={onChangeGoal} askConfirm={askConfirm} />

        {history.length > 0 && (
          <ProgressionChart
            history={history}
            goalSeconds={goalSeconds}
            growthIntensity={growthIntensity}
          />
        )}

        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
            {history.length} sessions
          </div>
          <button
            onClick={onAdd}
            className="btn-ghost text-xs flex items-center gap-1 py-1 px-2 rounded-full"
            style={{ color: 'var(--clay)' }}
            aria-label="Add session"
          >
            <Plus size={14} /> Add session
          </button>
        </div>
        <div className="space-y-2">
          {sorted.map((s, idx) => {
            const originalIdx = history.findIndex(h => h === s);
            const rc = ratingColor(s.rating);
            return (
              <button
                key={`${s.number}-${idx}`}
                type="button"
                onClick={() => onEdit(s, originalIdx)}
                aria-label={`Edit session ${s.number}`}
                className="card p-4 flex items-center w-full text-left hover:border-[color:var(--ink-muted)] transition-colors"
                style={{ borderLeft: rc ? `4px solid ${rc}` : undefined }}
              >
                <div className="serif tabular text-3xl w-14" style={{ fontWeight: 500 }}>{s.number}</div>
                <div className="flex-1 min-w-0 px-2">
                  <div className="text-sm mb-0.5 flex items-center gap-2">
                    {formatDate(s.date)}
                    {s.rating && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: rc + '22', color: rc, fontWeight: 500 }}
                      >
                        {ratingMeta(s.rating).label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--ink-muted)' }}>
                    {s.warmUps.length} warm-ups · {s.warmUps.map(w => `${w}s`).join(', ')}
                  </div>
                  {s.notes && (
                    <div className="text-xs italic mt-1 truncate" style={{ color: 'var(--ink-soft)' }}>
                      "{s.notes}"
                    </div>
                  )}
                </div>
                <div className="serif tabular text-xl pr-2" style={{ color: 'var(--clay)' }}>
                  {formatTime(s.rehearsalSeconds)}
                </div>
                <span className="btn-ghost p-2" aria-hidden="true">
                  <Pencil size={16} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onExport} className="btn-secondary flex-1 py-3 rounded-full text-sm flex items-center justify-center gap-2">
            <Download size={16} /> Export JSON
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex-1 py-3 rounded-full text-sm flex items-center justify-center gap-2">
            <Upload size={16} /> Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file" accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
          />
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   SETTINGS
   ===================================================================== */
const GROWTH_OPTIONS = [
  {
    id: 'slow',
    emoji: '🐢',
    label: 'Slow',
    sub: 'Smaller steps, easier wins',
    desc: "Each step up adds about half as much time as typical. Good if your dog is still new to practice, or you want to feel extra-confident before each increase.",
  },
  {
    id: 'typical',
    emoji: '🚶',
    label: 'Typical',
    sub: 'Balanced pace',
    desc: "The default progression. Increments scale with your current duration — 30 s at short sessions, a few minutes once you're past 20 min.",
  },
  {
    id: 'fast',
    emoji: '🚀',
    label: 'Fast',
    sub: 'Bigger jumps between sessions',
    desc: "About 1.5× the typical increment. Use if your dog is consistently rating Great and progress feels slower than it should.",
  },
];

function SettingsView({
  volume, notificationsEnabled, growthIntensity, notifPermission,
  onVolumeChange, onNotificationsChange, onGrowthIntensityChange,
  onPreviewSound, onTestNotification, onBack,
}) {
  const disabled = !notificationsEnabled;

  // Permission hint only matters when notifications are on
  let permNote = null;
  if (notificationsEnabled) {
    if (notifPermission === 'denied') {
      permNote = "System notifications are blocked. To get alerts when the app isn't open, enable notifications for this site in your browser or iOS settings.";
    } else if (notifPermission === 'default') {
      permNote = "Grant notification permission to get system alerts when the app isn't in the foreground.";
    } else if (notifPermission === 'unsupported') {
      permNote = "This browser can't show system notifications. Chimes will still play when the app is open. (On iPhone, install this app to your home screen and open it there for system alerts.)";
    }
  }

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title="SETTINGS"
        left={<button onClick={onBack} className="btn-ghost p-2" aria-label="Back"><ChevronLeft size={22} /></button>}
      />
      <div className="flex-1 min-h-0 px-5 pb-6 overflow-y-auto scrollbar-thin">

        {/* Notifications + Audio (merged) */}
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            {notificationsEnabled ? <Bell size={16} style={{ color: 'var(--ink-muted)' }} /> : <BellOff size={16} style={{ color: 'var(--ink-muted)' }} />}
            <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
              Notifications
            </div>
          </div>

          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm" style={{ color: 'var(--ink)' }}>Phase-end alerts</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                Chime when the app is open; system notification when it isn't.
              </div>
            </div>
            <button
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={() => onNotificationsChange(!notificationsEnabled)}
              className="relative rounded-full transition-colors flex-shrink-0 ml-3"
              style={{
                width: 44,
                height: 24,
                background: notificationsEnabled ? 'var(--clay)' : 'var(--line)',
              }}
            >
              <span
                className="absolute top-0.5 bg-white rounded-full transition-transform"
                style={{
                  width: 20,
                  height: 20,
                  left: 2,
                  transform: notificationsEnabled ? 'translateX(20px)' : 'translateX(0)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }}
              />
            </button>
          </div>

          {permNote && (
            <div
              className="text-xs mt-3 px-3 py-2 rounded-lg"
              style={{
                background: 'var(--bg-warm)',
                color: 'var(--ink-soft)',
                border: '1px solid var(--line)',
              }}
            >
              {permNote}
            </div>
          )}

          {/* Divider */}
          <div className="my-4" style={{ borderTop: '1px solid var(--line)' }} />

          {/* Volume (coupled to master toggle) */}
          <div style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
            <div className="flex items-center gap-2 mb-2">
              {volume > 0 && !disabled ? <Volume2 size={14} style={{ color: 'var(--ink-muted)' }} /> : <VolumeX size={14} style={{ color: 'var(--ink-muted)' }} />}
              <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
                Volume
              </div>
              <div className="serif tabular text-xs ml-auto" style={{ color: 'var(--ink-soft)' }}>{volume}%</div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
              className="w-full"
              style={{ accentColor: 'var(--clay)' }}
              aria-label="Volume"
              disabled={disabled}
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              <button
                onClick={onPreviewSound}
                className="btn-ghost text-xs"
                style={{ color: 'var(--ink-soft)' }}
                disabled={disabled}
              >
                Play test tone
              </button>
              <button
                onClick={onTestNotification}
                className="btn-ghost text-xs"
                style={{ color: 'var(--ink-soft)' }}
                disabled={disabled}
              >
                Test notification
              </button>
            </div>
          </div>
        </div>

        {/* Growth Intensity */}
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Gauge size={16} style={{ color: 'var(--ink-muted)' }} />
            <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
              Growth intensity
            </div>
          </div>
          <div className="text-xs mb-3" style={{ color: 'var(--ink-muted)' }}>
            How aggressively the next-rehearsal algorithm increases duration after a good session.
          </div>
          <div className="space-y-2">
            {GROWTH_OPTIONS.map(opt => {
              const active = growthIntensity === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onGrowthIntensityChange(opt.id)}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{
                    background: active ? 'var(--bg-warm)' : 'transparent',
                    border: active ? '1.5px solid var(--clay)' : '1.5px solid var(--line)',
                  }}
                >
                  <div className="flex items-baseline justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.emoji}</span>
                      <div className="text-sm" style={{ color: 'var(--ink)', fontWeight: active ? 500 : 400 }}>
                        {opt.label}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: active ? 'var(--clay)' : 'var(--ink-muted)' }}>
                      {opt.sub}
                    </div>
                  </div>
                  <div className="text-xs leading-snug" style={{ color: 'var(--ink-soft)' }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

/* =====================================================================
   ONBOARDING
   ===================================================================== */
function Onboarding({ onClose, goalSeconds, onChangeGoal, askConfirm }) {
  const [step, setStep] = useState(0);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const screens = [
    {
      key: 'welcome',
      title: 'A calm goodbye, one rehearsal at a time.',
      body:
        "This app helps you guide your dog through separation anxiety with short, low-stress practice departures. You'll work in small steps, watch the wins add up, and end up with a dog who's okay being home alone.",
    },
    {
      key: 'flow',
      title: 'Step out, come back, breathe, repeat.',
      body:
        "A session is a short series of mini-departures. For each warm-up you actually step out the door for a few seconds, then come back and spend about a minute hanging out calmly with your dog. After the warm-ups comes one longer rehearsal — same idea, just a bigger goodbye. The app paces it; you focus on staying neutral.",
    },
    {
      key: 'rating',
      title: 'Be honest. The rating shapes what comes next.',
      body:
        "After each rehearsal, pick a rating based on how much your dog barked. Great or Good means you're ready to push a little further next time. Fair or Bad means today was too much — ease back, no guilt.",
      ratings: true,
    },
    {
      key: 'goal',
      title: 'Pick a duration to build toward.',
      body:
        "Your goal is how long you ultimately want your dog to be okay alone — an hour is a good starting target. You can change this any time from the History screen. Tap the i in the top corner of the home screen anytime to revisit this guide.",
    },
  ];

  if (!isStandalone) {
    screens.push({
      key: 'install',
      title: 'Make it feel like an app.',
      body: isIOS ? (
        <>In Safari, tap the Share <Share size={14} className="inline align-text-bottom mx-0.5" /> button at the bottom of the screen, then choose Add to Home Screen. You'll get a real app icon and a full-screen experience.</>
      ) : (
        <>Tap your browser's menu <MoreVertical size={14} className="inline align-text-bottom mx-0.5" />, then choose Install app or Add to Home Screen. You'll get a real app icon and a full-screen experience.</>
      ),
    });
  }

  const isLast = step === screens.length - 1;
  const isFirst = step === 0;
  const screen = screens[step];
  const next = () => (isLast ? onClose() : setStep(step + 1));
  const back = () => { if (!isFirst) setStep(step - 1); };

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title=""
        left={
          !isFirst ? (
            <button onClick={back} className="btn-ghost text-sm px-2 py-2" aria-label="Back">
              Back
            </button>
          ) : null
        }
        right={
          <button onClick={onClose} className="btn-ghost text-sm px-2 py-2" aria-label="Skip onboarding">
            Skip
          </button>
        }
      />
      <div className="flex-1 min-h-0 px-6 overflow-y-auto scrollbar-thin">
        <div className="card p-6 fade-up" key={screen.key}>
          <div className="serif text-3xl mb-4 leading-tight" style={{ fontWeight: 500 }}>
            {screen.title}
          </div>
          <div className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {screen.body}
          </div>
          {screen.ratings && (
            <div className="mt-5 flex flex-col gap-2.5">
              {RATINGS.map(r => (
                <div key={r.num} className="flex items-baseline gap-3 text-sm">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: r.color, transform: 'translateY(2px)' }}
                  />
                  <div className="serif" style={{ fontWeight: 500, minWidth: 50 }}>{r.label}</div>
                  <div style={{ color: 'var(--ink-muted)' }}>{r.desc}</div>
                </div>
              ))}
            </div>
          )}
          {screen.key === 'welcome' && (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <div className="serif tabular text-sm" style={{ color: 'var(--ink-muted)' }}>15s</div>
                <div className="flex-1">
                  <svg viewBox="0 0 160 50" className="w-full block" style={{ height: 50 }} preserveAspectRatio="none">
                    <path
                      d="M 3 42 C 60 42, 100 8, 157 8"
                      fill="none"
                      stroke="var(--clay)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
                <div className="serif tabular text-sm" style={{ color: 'var(--ink-muted)' }}>1h</div>
              </div>
              <div className="serif italic text-sm mt-2" style={{ color: 'var(--ink-soft)' }}>
                From a few seconds to a full hour.
              </div>
            </div>
          )}
          {screen.key === 'flow' && (
            <div className="mt-6">
              <div className="flex items-center gap-1">
                {[
                  { type: 'out', width: 28 },
                  { type: 'in', width: 36 },
                  { type: 'out', width: 28 },
                  { type: 'in', width: 36 },
                  { type: 'out', width: 28 },
                  { type: 'in', width: 36 },
                  { type: 'out', width: 28 },
                  { type: 'out', width: 80 },
                ].map((b, i) => (
                  <div key={i} style={{
                    height: 28,
                    width: b.width,
                    background: b.type === 'out' ? 'var(--clay)' : 'var(--bg-warm)',
                    borderLeft: b.type === 'in' ? '3px solid var(--sage)' : undefined,
                    borderRadius: 6,
                  }} />
                ))}
              </div>
              <div className="serif italic text-sm mt-3" style={{ color: 'var(--ink-soft)' }}>
                A few short goodbyes, then one longer one.
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center justify-center" style={{ width: 16, height: 16, background: 'var(--clay)', borderRadius: 4 }}>
                    <DoorOpen size={10} style={{ color: 'var(--surface)' }} />
                  </div>
                  <span>Step out</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center justify-center" style={{ width: 16, height: 16, background: 'var(--bg-warm)', borderLeft: '3px solid var(--sage)', borderRadius: 4 }}>
                    <Heart size={9} style={{ color: 'var(--sage)' }} />
                  </div>
                  <span>Stay calm with your dog.</span>
                </div>
              </div>
            </div>
          )}
          {screen.key === 'goal' && (
            <div className="mt-6">
              <GoalCard
                goalSeconds={goalSeconds}
                onChange={onChangeGoal}
                askConfirm={askConfirm}
              />
            </div>
          )}
        </div>
      </div>
      <div className="px-6 pt-4">
        <button onClick={next} className="btn-primary w-full py-4 rounded-full">
          {isLast ? 'Begin' : 'Next'}
        </button>
      </div>
      <div className="px-6 pb-8 pt-4 flex items-center justify-center gap-1.5">
        {screens.map((_, i) => (
          <div
            key={i}
            className={`dot ${i === step ? 'dot-current' : ''} ${i < step ? 'dot-done' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

/* =====================================================================
   APP
   ===================================================================== */
export default function App() {
  const [view, setView] = useState('home');
  const [history, setHistory] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [volume, setVolume] = useState(80);
  const [growthIntensity, setGrowthIntensity] = useState('typical');
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());
  const [goalSeconds, setGoalSeconds] = useState(DEFAULT_GOAL_SECONDS);
  const [loaded, setLoaded] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  // Surfaces storageSet failures (quota / security / private mode etc.).
  // Without this banner the user could keep working under the impression
  // their last change had persisted when in reality the write was dropped.
  const [storageError, setStorageError] = useState(null);
  useEffect(() => {
    const handler = (e) => setStorageError(e?.detail || { key: 'unknown' });
    window.addEventListener('app-storage-error', handler);
    return () => window.removeEventListener('app-storage-error', handler);
  }, []);

  const askConfirm = useCallback((opts) => {
    return new Promise(resolve => {
      setConfirmDialog({
        ...opts,
        onConfirm: () => { setConfirmDialog(null); resolve(true); },
        onCancel:  () => { setConfirmDialog(null); resolve(false); },
      });
    });
  }, []);

  useEffect(() => {
    // Seed-data policy:
    //   - Truly new device (no `hasInitialized` flag, no history) → seed.
    //   - Existing user upgrading (no flag, but real history present)
    //     → don't reseed; just set the flag so we never seed-overwrite.
    //   - Anyone who has seen the flag already → trust whatever's in
    //     storage, even if empty (means they've intentionally cleared
    //     history); never reseed under their feet.
    const hasInitialized = !!storageGet('hasInitialized');
    let hist = storageGet('history');
    if (!hasInitialized) {
      if (Array.isArray(hist) && hist.length > 0) {
        // Existing user — migrate. Keep their data.
        storageSet('hasInitialized', true);
      } else {
        // First run on this device.
        hist = SEED_HISTORY;
        storageSetWithBackup('history', hist);
        storageSet('hasInitialized', true);
      }
    } else if (!Array.isArray(hist)) {
      // Initialized before but `history` is missing/corrupt. Don't seed —
      // present an empty list and let the user recover via Import.
      hist = [];
    }
    setHistory(hist);

    const active = storageGet('active');
    if (active && active.phases) {
      if (active.phaseState === 'running' && active.phaseEndTime && Date.now() >= active.phaseEndTime) {
        active.phaseState = 'complete';
        active.phaseEndTime = null;
      }
      setActiveSession(active);
    }

    const settings = storageGet('settings');
    if (settings) {
      // Back-compat: old `soundEnabled` key maps to new `notificationsEnabled`
      if (typeof settings.notificationsEnabled === 'boolean') {
        setNotificationsEnabled(settings.notificationsEnabled);
      } else if (typeof settings.soundEnabled === 'boolean') {
        setNotificationsEnabled(settings.soundEnabled);
      }
      if (typeof settings.volume === 'number') {
        setVolume(Math.max(0, Math.min(100, Math.round(settings.volume))));
      }
      if (['slow', 'typical', 'fast'].includes(settings.growthIntensity)) {
        setGrowthIntensity(settings.growthIntensity);
      }
      if (typeof settings.goalSeconds === 'number' && settings.goalSeconds > 0) {
        setGoalSeconds(settings.goalSeconds);
      }
    }

    if (!storageGet('onboardingDismissed') && hist.length === 0) {
      setView('onboarding');
    }

    setLoaded(true);
  }, []);

  const dismissOnboarding = () => {
    storageSet('onboardingDismissed', true);
    setView('home');
  };
  const showOnboarding = () => setView('onboarding');

  useEffect(() => {
    if (!loaded) return;
    storageSet('settings', {
      notificationsEnabled,
      volume,
      growthIntensity,
      goalSeconds,
    });
  }, [notificationsEnabled, volume, growthIntensity, goalSeconds, loaded]);

  const nextNumber = history ? (history.length ? Math.max(...history.map(s => s.number)) + 1 : 1) : 1;
  const goalProgress = computeGoalProgress(history || [], goalSeconds, { growthIntensity });
  const autoSuggestion = computeNextRehearsal(history || [], { growthIntensity });
  // Always have a shake-up fallback available if the auto-suggestion isn't already one
  const shakeUpSuggestion = autoSuggestion.kind === 'shake-up'
    ? null
    : computeNextRehearsal(history || [], { forceShakeUp: true, growthIntensity });

  const handleNotificationsChange = async (enabled) => {
    setNotificationsEnabled(enabled);
    if (enabled && notificationsSupported() && Notification.permission === 'default') {
      const result = await requestNotificationPermission();
      setNotifPermission(result);
    } else {
      setNotifPermission(getNotificationPermission());
    }
  };

  const handleTestNotification = async () => {
    if (!notificationsSupported()) {
      alert("This browser can't show system notifications. On iPhone, install this app to your home screen and open it there.");
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await requestNotificationPermission();
      setNotifPermission(perm);
    }
    if (perm === 'granted') {
      fireSystemNotification('Test notification', 'This is what a phase-end alert looks like.');
    } else if (perm === 'denied') {
      alert('Notifications are blocked. Enable them for this site in your browser or iOS settings.');
    }
  };

  const handleStartSetup = () => setView('setup');

  const handleBeginSession = (draft) => {
    const phases = buildPhases(draft.warmUps, draft.rehearsalSeconds);
    const session = {
      number: draft.number,
      warmUps: draft.warmUps,
      rehearsalSeconds: draft.rehearsalSeconds,
      notes: draft.notes,
      phases,
      currentPhaseIndex: 0,
      phaseState: 'waiting',
      phaseEndTime: null,
      pausedRemaining: null,
      completedPhases: [],
      createdAt: Date.now(),
    };
    setActiveSession(session);
    storageSet('active', session);
    setView('session');
  };

  const handleSessionUpdate = (updated) => {
    const prev = activeSession;
    let next = updated;
    if (prev && prev.phaseState !== 'complete' && updated.phaseState === 'complete') {
      const phase = updated.phases[updated.currentPhaseIndex];
      next = {
        ...updated,
        completedPhases: [...updated.completedPhases, { type: phase.type, idx: phase.idx, completed: true }],
      };
    }
    setActiveSession(next);
    storageSet('active', next);
  };

  const handleAbort = () => {
    storageDelete('active');
    setActiveSession(null);
    setView('home');
  };

  const handleComplete = (skippedFinal = false) => {
    if (!skippedFinal) {
      const phase = activeSession.phases[activeSession.currentPhaseIndex];
      const alreadyLogged = activeSession.completedPhases.some(
        p => p.type === phase.type && p.idx === phase.idx && p.completed
      );
      if (!alreadyLogged) {
        const finalSession = {
          ...activeSession,
          completedPhases: [...activeSession.completedPhases, { type: phase.type, idx: phase.idx, completed: true }],
        };
        setActiveSession(finalSession);
      }
    }
    setView('summary');
  };

  const handleSaveToHistory = ({ rating, notes }) => {
    // Local YYYY-MM-DD — toISOString() would shift west-of-UTC users into
    // the next day during evenings, breaking the calendar "today" lookup.
    const today = ymdLocal(new Date());
    const record = {
      number: activeSession.number,
      date: today,
      warmUps: activeSession.warmUps,
      rehearsalSeconds: activeSession.rehearsalSeconds,
      notes,
      rating,
    };
    const newHistory = [...history, record];
    setHistory(newHistory);
    storageSetWithBackup('history', newHistory);
    storageDelete('active');
    setActiveSession(null);
    setView('home');
  };

  const handleDiscardSession = async () => {
    const ok = await askConfirm({
      title: 'Discard this session?',
      message: 'It will not be saved to history.',
      confirmLabel: 'Discard', destructive: true,
    });
    if (!ok) return;
    storageDelete('active');
    setActiveSession(null);
    setView('home');
  };

  const handleResume = () => setView('session');

  const handleDiscardActive = async () => {
    const ok = await askConfirm({
      title: 'Discard in-progress session?',
      message: 'The session will be deleted and not saved.',
      confirmLabel: 'Discard', destructive: true,
    });
    if (!ok) return;
    storageDelete('active');
    setActiveSession(null);
  };

  const handleExport = () => {
    const data = { version: 3, exportedAt: new Date().toISOString(), history, goalSeconds };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `departure-training-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const imported = Array.isArray(data) ? data : data.history;
      const importedGoal = !Array.isArray(data) && typeof data.goalSeconds === 'number' ? data.goalSeconds : null;
      if (!Array.isArray(imported)) throw new Error('Invalid file format');
      const valid = imported.every(s =>
        typeof s.number === 'number' &&
        Array.isArray(s.warmUps) &&
        typeof s.rehearsalSeconds === 'number'
      );
      if (!valid) throw new Error('Invalid session entries');
      const ok = await askConfirm({
        title: 'Replace history?',
        message: `Replace current history (${history.length} sessions) with imported (${imported.length})?`,
        confirmLabel: 'Replace', destructive: true,
      });
      if (!ok) return;
      setHistory(imported);
      storageSetWithBackup('history', imported);
      if (importedGoal && importedGoal > 0) setGoalSeconds(importedGoal);
    } catch (e) {
      askConfirm({
        title: 'Import failed', message: e.message,
        confirmLabel: 'OK', cancelLabel: ' ',
      });
    }
  };

  const handleEditFromHistory = (session, index) => {
    setEditTarget({ session, originalNumber: session.number, index, isNew: false });
    setView('edit');
  };

  const handleAddSessionFromHistory = () => {
    const blank = {
      number: nextNumber,
      date: ymdLocal(new Date()), // local YYYY-MM-DD; not UTC
      rehearsalSeconds: 60,
      warmUps: [],
      notes: '',
      rating: null,
    };
    setEditTarget({ session: blank, isNew: true });
    setView('edit');
  };

  const handleSaveEdit = (updated) => {
    const entry = {
      number: updated.number,
      date: updated.date,
      rehearsalSeconds: updated.rehearsalSeconds,
      warmUps: updated.warmUps,
      notes: updated.notes,
      rating: updated.rating ?? null,
    };
    let newHistory;
    if (editTarget.isNew) {
      newHistory = [...history, entry].sort((a, b) => a.number - b.number);
    } else {
      newHistory = [...history];
      newHistory[editTarget.index] = entry;
      newHistory.sort((a, b) => a.number - b.number);
    }
    setHistory(newHistory);
    storageSetWithBackup('history', newHistory);
    setEditTarget(null);
    setView('history');
  };

  const handleDeleteEdit = () => {
    const newHistory = history.filter((_, i) => i !== editTarget.index);
    setHistory(newHistory);
    storageSetWithBackup('history', newHistory);
    setEditTarget(null);
    setView('history');
  };

  const handleChangeGoal = (newGoalSeconds) => {
    setGoalSeconds(newGoalSeconds);
  };

  return (
    <div className="app-root">
      {storageError && (
        <div
          role="alert"
          className="px-5 py-2 text-xs flex items-center gap-2"
          style={{ background: 'var(--clay)', color: '#FBF7EF' }}
        >
          <span className="flex-1 leading-snug">
            Couldn't save to this device. Your last change may not persist — export your data from History to be safe.
          </span>
          <button
            onClick={() => setStorageError(null)}
            className="btn-ghost text-xs underline"
            style={{ color: '#FBF7EF' }}
            aria-label="Dismiss storage error"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="serif italic text-xl" style={{ color: 'var(--ink-muted)' }}>Loading…</div>
          </div>
        ) : view === 'onboarding' ? (
          <Onboarding
            onClose={dismissOnboarding}
            goalSeconds={goalSeconds}
            onChangeGoal={handleChangeGoal}
            askConfirm={askConfirm}
          />
        ) : view === 'home' ? (
          <Home
            nextRehearsalSeconds={autoSuggestion.seconds}
            nextNumber={nextNumber}
            suggestion={autoSuggestion}
            history={history}
            goalSeconds={goalSeconds}
            goalProgress={goalProgress}
            onStart={handleStartSetup}
            onHistory={() => setView('history')}
            onShowOnboarding={showOnboarding}
            onSettings={() => setView('settings')}
            onCalendar={() => setView('calendar')}
            growthIntensity={growthIntensity}
            resumable={activeSession}
            onResume={handleResume}
            onDiscardActive={handleDiscardActive}
          />
        ) : view === 'settings' ? (
          <SettingsView
            volume={volume}
            notificationsEnabled={notificationsEnabled}
            growthIntensity={growthIntensity}
            notifPermission={notifPermission}
            onVolumeChange={setVolume}
            onNotificationsChange={handleNotificationsChange}
            onGrowthIntensityChange={setGrowthIntensity}
            onPreviewSound={() => playAlarm(volume / 100)}
            onTestNotification={handleTestNotification}
            onBack={() => setView('home')}
          />
        ) : view === 'setup' ? (
          <Setup
            nextNumber={nextNumber}
            suggestion={autoSuggestion}
            shakeUpSuggestion={shakeUpSuggestion}
            onBack={() => setView('home')}
            onStart={handleBeginSession}
          />
        ) : view === 'session' && activeSession ? (
          <SessionView
            session={activeSession}
            soundEnabled={notificationsEnabled}
            toggleSound={() => setNotificationsEnabled(s => !s)}
            volume={volume}
            onUpdate={handleSessionUpdate}
            onAbort={handleAbort}
            onComplete={handleComplete}
            askConfirm={askConfirm}
          />
        ) : view === 'summary' && activeSession ? (
          <Summary
            session={activeSession}
            onSave={handleSaveToHistory}
            onDiscard={handleDiscardSession}
          />
        ) : view === 'calendar' ? (
          <CalendarView
            history={history}
            onBack={() => setView('home')}
          />
        ) : view === 'history' ? (
          <HistoryView
            history={history}
            goalSeconds={goalSeconds}
            growthIntensity={growthIntensity}
            onChangeGoal={handleChangeGoal}
            askConfirm={askConfirm}
            onBack={() => setView('home')}
            onEdit={handleEditFromHistory}
            onAdd={handleAddSessionFromHistory}
            onExport={handleExport}
            onImport={handleImport}
          />
        ) : view === 'edit' && editTarget ? (
          <EditSession
            session={editTarget.session}
            isNew={!!editTarget.isNew}
            onBack={() => { setEditTarget(null); setView('history'); }}
            onSave={handleSaveEdit}
            onDelete={handleDeleteEdit}
            askConfirm={askConfirm}
          />
        ) : null}
      </div>
      <ConfirmDialog dialog={confirmDialog} />
    </div>
  );
}
