import { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import {
  Play, Pause, SkipForward, X, Volume2, VolumeX, Shuffle,
  ChevronLeft, RotateCcw, Check, Download, Upload, Clock, ChevronRight,
  Pencil, Trash2, Plus, Target, TrendingUp, TrendingDown, Info
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

function generateWarmUps() {
  const count = 5 + Math.floor(Math.random() * 3);
  const shortVals = [5, 10, 15, 20];
  const longVals = [25, 30, 35, 40, 45, 50, 55];
  const result = [0];
  for (let i = 0; i < count - 1; i++) {
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
function computeNextRehearsal(history, opts = {}) {
  const { forceShakeUp = false } = opts;

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

  // Otherwise, a graduated increment by rating + magnitude
  let increment;
  if (last.rating === 1) {
    // Great: moderate bump
    if (lastSecs < 300) increment = 30;
    else if (lastSecs < 600) increment = 60;
    else if (lastSecs < 1200) increment = 120;
    else if (lastSecs < 1800) increment = 180;
    else increment = 300;
  } else if (last.rating === 2) {
    // Good: small bump
    if (lastSecs < 300) increment = 15;
    else if (lastSecs < 600) increment = 30;
    else if (lastSecs < 1200) increment = 60;
    else if (lastSecs < 1800) increment = 90;
    else increment = 120;
  } else {
    // Unrated (seed data): conservative default
    if (lastSecs < 600) increment = 30;
    else if (lastSecs < 1200) increment = 60;
    else increment = 120;
  }

  const ratingLabel = last.rating === 1 ? 'Great' : last.rating === 2 ? 'Good' : null;
  const reason = ratingLabel
    ? `Small step up after ${ratingLabel}.`
    : 'Small step up.';

  return { seconds: lastSecs + increment, reason, kind: 'step-up' };
}

/* ---- Goal heuristics (uses only acceptable sessions for trend) ---- */
function computeGoalProgress(history, goalSeconds) {
  if (!history || history.length === 0) {
    return { current: 0, percent: 0, estimate: null, trend: 'no-data' };
  }
  const sorted = [...history].sort((a, b) => a.number - b.number);
  const current = sorted[sorted.length - 1].rehearsalSeconds;
  const percent = Math.min(100, Math.round((current / goalSeconds) * 100));

  if (current >= goalSeconds) {
    return { current, percent: 100, estimate: 0, trend: 'reached' };
  }

  // Filter to sessions that count as real progress
  const progressSessions = sorted.filter(s => isAcceptable(s.rating));
  if (progressSessions.length < 3) {
    return { current, percent, estimate: null, trend: 'no-data' };
  }

  // Compound (exponential) growth model. The trainer's chart shows that growth
  // rate accelerates with current length — a linear "seconds-per-session" model
  // dramatically overestimates the remaining sessions at lower lengths because
  // it ignores that each future session adds a percentage, not a fixed amount.
  const window = progressSessions.slice(-5);
  const first = window[0].rehearsalSeconds;
  const last  = window[window.length - 1].rehearsalSeconds;
  const steps = window.length - 1;

  if (last <= first) {
    return { current, percent, estimate: null, trend: 'flat' };
  }

  const growthRate = Math.pow(last / first, 1 / steps); // r per session
  const remaining  = Math.ceil(Math.log(goalSeconds / current) / Math.log(growthRate));
  return { current, percent, estimate: remaining, trend: 'increasing', growthRate };
}

function estimateText({ trend, estimate, growthRate }) {
  if (trend === 'no-data') return 'A few more rated sessions and an estimate will appear.';
  if (trend === 'reached') return 'Goal reached. Set a higher one if you like.';
  if (trend === 'flat') return 'Recent sessions haven\'t increased — try a small bump next time.';
  if (trend === 'increasing') {
    const pct = growthRate ? Math.round((growthRate - 1) * 100) : null;
    const rateNote = pct ? ` (~${pct}% growth per session)` : '';
    if (estimate === 1) return `About 1 more session at recent pace${rateNote}.`;
    return `About ${estimate} more sessions at recent pace${rateNote}.`;
  }
  return '';
}

/* ---- storage (localStorage) ---- */
function storageGet(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.error('storage.set failed', key, e); }
}
function storageDelete(key) {
  try { localStorage.removeItem(key); } catch {}
}

/* ---- alarm ---- */
function playAlarm() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const tone = (freq, start, dur, vol = 0.22) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.start(now + start); osc.stop(now + start + dur + 0.05);
    };
    tone(784, 0.00, 0.55);
    tone(988, 0.16, 0.55);
    tone(1175, 0.32, 0.85);
  } catch (e) { console.error('alarm failed', e); }
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
      <div className="w-10 h-10 flex items-center justify-start">{left}</div>
      <div className="serif text-sm tracking-wide" style={{ color: 'var(--ink-muted)' }}>{title}</div>
      <div className="w-10 h-10 flex items-center justify-end">{right}</div>
    </div>
  );
}

/* =====================================================================
   HOME
   ===================================================================== */
function Home({ nextNumber, lastRehearsal, goalSeconds, goalProgress,
                onStart, onHistory, onShowOnboarding, soundEnabled, toggleSound,
                resumable, onResume, onDiscardActive }) {
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
          <button onClick={toggleSound} className="btn-ghost p-2" aria-label="Toggle sound">
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        }
      />
      <div className="flex-1 flex flex-col justify-center px-6 pb-12">
        <div className="mb-1 text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>Up next</div>
        <div className="serif text-7xl leading-none mb-2" style={{ fontWeight: 500 }}>
          Session <span style={{ color: 'var(--clay)' }}>{nextNumber}</span>
        </div>
        <div className="serif italic text-lg mb-8" style={{ color: 'var(--ink-soft)' }}>
          {lastRehearsal
            ? <>Last rehearsal was <span className="tabular mono not-italic text-base">{formatTime(lastRehearsal)}</span>.</>
            : <>Let's begin.</>}
        </div>

        {/* Goal progress */}
        <div className="mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs tracking-widest uppercase flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
              <Target size={11} /> Goal {formatTimeLong(goalSeconds)}
            </div>
            <div className="serif tabular text-sm" style={{ color: 'var(--ink-soft)' }}>
              {goalProgress.percent}%
            </div>
          </div>
          <div className="progress-track mb-3">
            <div className="progress-fill" style={{ width: `${goalProgress.percent}%` }} />
          </div>
          <div className="serif italic text-sm" style={{ color: 'var(--ink-soft)' }}>
            {estimateText(goalProgress)}
          </div>
        </div>

        {resumable && (
          <div className="card p-4 mb-6" style={{ borderColor: 'var(--amber)', background: '#FDF6EA' }}>
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

        <button onClick={onStart} className="btn-primary w-full py-5 rounded-full text-lg mb-3">Start session</button>
        <button onClick={onHistory} className="btn-ghost py-3 text-sm">View history →</button>
      </div>
      <div className="px-6 pb-8 text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
        Tip: set auto-lock to "Never" in iOS Settings before a session so the screen stays on.
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
  const removeWarmUp = (idx) => setWarmUps(w => w.filter((_, i) => i !== idx));
  const addWarmUp = () => setWarmUps(w => [...w, 0]);

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
            <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
              Warm-ups ({warmUps.length})
            </div>
            <button onClick={() => setWarmUps(generateWarmUps())} className="btn-ghost text-xs flex items-center gap-1.5 py-1">
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
function SessionView({ session, soundEnabled, toggleSound, onUpdate, onAbort, onComplete, askConfirm }) {
  const [now, setNow] = useState(Date.now());
  useWakeLock(session.phaseState === 'running');

  const phase = session.phases[session.currentPhaseIndex];
  const isLast = session.currentPhaseIndex >= session.phases.length - 1;
  const nextPhase = !isLast ? session.phases[session.currentPhaseIndex + 1] : null;

  useEffect(() => {
    if (session.phaseState !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [session.phaseState]);

  useEffect(() => {
    if (session.phaseState !== 'running') return;
    if (now >= session.phaseEndTime) {
      if (soundEnabled) playAlarm();
      onUpdate({ ...session, phaseState: 'complete', phaseEndTime: null });
    }
  }, [now, session, soundEnabled, onUpdate]);

  let remaining;
  if (session.phaseState === 'waiting') remaining = phase.durationSeconds;
  else if (session.phaseState === 'running') remaining = Math.max(0, (session.phaseEndTime - now) / 1000);
  else if (session.phaseState === 'paused') remaining = session.pausedRemaining;
  else remaining = 0;

  const startTimer = () => {
    const dur = session.phaseState === 'paused' ? session.pausedRemaining : phase.durationSeconds;
    if (dur <= 0) {
      if (soundEnabled) playAlarm();
      onUpdate({ ...session, phaseState: 'complete', phaseEndTime: null, pausedRemaining: null });
      return;
    }
    onUpdate({ ...session, phaseState: 'running',
               phaseEndTime: Date.now() + dur * 1000, pausedRemaining: null });
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
function EditSession({ session, onBack, onSave, onDelete, askConfirm }) {
  const [num, setNum] = useState(String(session.number));
  const [date, setDate] = useState(session.date || '');
  const [goalStr, setGoalStr] = useState(formatTime(session.rehearsalSeconds));
  const [warmUps, setWarmUps] = useState([...session.warmUps]);
  const [notes, setNotes] = useState(session.notes || '');
  const [rating, setRating] = useState(session.rating ?? null);
  const [editingIdx, setEditingIdx] = useState(null);

  const goalSeconds = parseMMSS(goalStr);
  const numValue = parseInt(num, 10);
  const valid = !isNaN(numValue) && numValue > 0 && goalSeconds !== null && goalSeconds > 0;

  const changeWarmUp = (idx, newValue) => {
    const v = Math.max(0, Math.min(600, parseInt(newValue, 10) || 0));
    setWarmUps(w => w.map((x, i) => (i === idx ? v : x)));
  };
  const removeWarmUp = (idx) => setWarmUps(w => w.filter((_, i) => i !== idx));
  const addWarmUp = () => setWarmUps(w => [...w, 0]);

  const handleSave = () => {
    if (!valid) return;
    onSave({
      number: numValue, date: date || null,
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
        title={`EDIT SESSION ${session.number}`}
        left={<button onClick={onBack} className="btn-ghost p-2"><ChevronLeft size={22} /></button>}
      />
      <div className="flex-1 min-h-0 px-6 pb-24 overflow-y-auto">
        <div className="mb-6">
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--ink-muted)' }}>Session number</div>
          <input
            type="number" inputMode="numeric" value={num}
            onChange={e => setNum(e.target.value)}
            className="input-text serif tabular text-3xl py-2 px-4 rounded-xl w-full"
            style={{ fontWeight: 500 }}
          />
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

        <button
          onClick={handleDelete}
          className="btn-destructive w-full py-3 rounded-full text-sm flex items-center justify-center gap-2 mt-8"
        >
          <Trash2 size={16} /> Delete this session
        </button>
      </div>

      <div className="px-6 pb-6 pt-4" style={{ background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <button disabled={!valid} onClick={handleSave} className="btn-primary w-full py-4 rounded-full text-base">
          Save changes
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
  const [draftStr, setDraftStr] = useState(formatTimeLong(goalSeconds));

  const startEdit = () => {
    setDraftStr(formatTimeLong(goalSeconds));
    setEditing(true);
  };
  const save = async () => {
    const parsed = parseMMSS(draftStr);
    if (parsed === null || parsed <= 0) {
      await askConfirm({
        title: 'Invalid goal',
        message: 'Use mm:ss or h:mm:ss format (e.g. 1:00:00 for one hour, 30:00 for thirty minutes).',
        confirmLabel: 'OK', cancelLabel: ' ',
      });
      return;
    }
    onChange(parsed);
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
          <input
            type="text" inputMode="numeric" value={draftStr}
            onChange={e => setDraftStr(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            autoFocus placeholder="1:00:00"
            className="input-text serif tabular text-2xl py-1 px-2 rounded-lg w-full"
            style={{ fontWeight: 500 }}
          />
        ) : (
          <div className="serif tabular text-2xl" style={{ fontWeight: 500 }}>
            {formatTimeLong(goalSeconds)}
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-1">
          <button onClick={cancel} className="btn-ghost p-2"><X size={18} /></button>
          <button onClick={save} className="btn-ghost p-2" style={{ color: 'var(--clay)' }}><Check size={18} /></button>
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
  { id: 'all', label: 'All time',         take: Infinity },
  { id: '30',  label: 'Past 30 sessions', take: 30 },
  { id: '7',   label: 'Past 7 sessions',  take: 7 },
];

function HistoryView({ history, goalSeconds, onChangeGoal, askConfirm,
                       onBack, onEdit, onExport, onImport }) {
  const fileInputRef = useRef(null);
  const [chartRange, setChartRange] = useState('all');

  const sorted = [...history].sort((a, b) => b.number - a.number);

  // Chart axis is session number. Slice the tail of the series for the
  // bounded ranges so the most recent sessions are always shown.
  const ascending = [...history].sort((a, b) => a.number - b.number);
  const take = CHART_RANGES.find(r => r.id === chartRange)?.take ?? Infinity;
  const sliced = take === Infinity ? ascending : ascending.slice(-take);
  const chartData = sliced.map(s => ({
    session: s.number,
    minutes: Math.round((s.rehearsalSeconds / 60) * 10) / 10,
    rating: s.rating ?? null,
  }));

  const goalMinutes = goalSeconds / 60;
  const dataMax = chartData.length ? Math.max(...chartData.map(d => d.minutes)) : 0;
  const yMax = Math.max(goalMinutes, dataMax) * 1.1 + 1;

  const formatXTick = (n) => `#${n}`;
  const formatTooltipLabel = (n) => `Session #${n}`;

  const renderDot = (props) => {
    const { cx, cy, payload, index } = props;
    const color = ratingColor(payload.rating) || '#B8563A';
    return <circle key={index} cx={cx} cy={cy} r={3.5} fill={color} stroke="none" />;
  };

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title="HISTORY"
        left={<button onClick={onBack} className="btn-ghost p-2"><ChevronLeft size={22} /></button>}
      />
      <div className="flex-1 min-h-0 px-5 pb-6 overflow-y-auto scrollbar-thin">

        <GoalCard goalSeconds={goalSeconds} onChange={onChangeGoal} askConfirm={askConfirm} />

        {history.length > 0 && (
          <div className="card p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-muted)' }}>
                Rehearsal progression
              </div>
            </div>
            <div className="flex items-center gap-1 mb-3 p-1 rounded-full" style={{ background: 'var(--bg-warm)' }}>
              {CHART_RANGES.map(t => {
                const active = chartRange === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setChartRange(t.id)}
                    className="flex-1 text-xs px-2 py-1.5 rounded-full transition-all"
                    style={{
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
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#D9CEB8" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="session"
                    tick={{ fontSize: 10, fill: '#8B7B6C' }}
                    axisLine={{ stroke: '#D9CEB8' }}
                    tickLine={false}
                    tickFormatter={formatXTick}
                    minTickGap={chartRange === '7' ? 0 : 16}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#8B7B6C' }} axisLine={false} tickLine={false} unit="m" domain={[0, yMax]} />
                  <Tooltip
                    contentStyle={{ background: '#FBF7EF', border: '1px solid #D9CEB8', borderRadius: 8, fontSize: 12, fontFamily: 'IBM Plex Sans' }}
                    formatter={(v, name, item) => {
                      const r = item?.payload?.rating;
                      const rLabel = r ? ` (${ratingMeta(r)?.label})` : '';
                      return [`${v} min${rLabel}`, 'Rehearsal'];
                    }}
                    labelFormatter={formatTooltipLabel}
                  />
                  <ReferenceLine
                    y={goalMinutes}
                    stroke="#7A8F6F"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Goal ${formatTimeLong(goalSeconds)}`,
                      position: 'insideTopRight',
                      fill: '#7A8F6F',
                      fontSize: 10,
                      fontFamily: 'IBM Plex Sans',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="minutes"
                    stroke="#B8563A"
                    strokeWidth={1.5}
                    dot={renderDot}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Color legend */}
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
            </div>
          </div>
        )}

        <div className="text-xs tracking-widest uppercase mb-2 px-1" style={{ color: 'var(--ink-muted)' }}>
          {history.length} sessions
        </div>
        <div className="space-y-2">
          {sorted.map((s, idx) => {
            const originalIdx = history.findIndex(h => h === s);
            const rc = ratingColor(s.rating);
            return (
              <div
                key={`${s.number}-${idx}`}
                className="card p-4 flex items-center"
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
                    <div className="text-xs italic mt-1" style={{ color: 'var(--ink-soft)' }}>
                      "{s.notes}"
                    </div>
                  )}
                </div>
                <div className="serif tabular text-xl pr-2" style={{ color: 'var(--clay)' }}>
                  {formatTime(s.rehearsalSeconds)}
                </div>
                <button onClick={() => onEdit(s, originalIdx)} className="btn-ghost p-2" aria-label="Edit session">
                  <Pencil size={16} />
                </button>
              </div>
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
   ONBOARDING
   ===================================================================== */
function Onboarding({ onClose }) {
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
        "Your goal is how long you ultimately want your dog to be okay alone — an hour is a good starting target. The chart on the History screen shows how you're tracking. Tap the i in the top corner of the home screen anytime to revisit this guide.",
    },
  ];

  if (!isStandalone) {
    screens.push({
      key: 'install',
      title: 'Make it feel like an app.',
      body: isIOS
        ? "In Safari, tap the Share button at the bottom of the screen, then choose Add to Home Screen. You'll get a real app icon and a full-screen experience."
        : "Tap your browser's menu, then choose Install app or Add to Home Screen. You'll get a real app icon and a full-screen experience.",
    });
  }

  const isLast = step === screens.length - 1;
  const screen = screens[step];
  const next = () => (isLast ? onClose() : setStep(step + 1));

  return (
    <div className="fade-up flex flex-col flex-1 min-h-0">
      <TopBar
        title=""
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
        </div>
      </div>
      <div className="px-6 pt-4">
        <button onClick={next} className="btn-primary w-full py-3.5 rounded-xl">
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [goalSeconds, setGoalSeconds] = useState(DEFAULT_GOAL_SECONDS);
  const [loaded, setLoaded] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

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
    let hist = storageGet('history');
    if (!hist || !Array.isArray(hist) || hist.length === 0) {
      hist = SEED_HISTORY;
      storageSet('history', hist);
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
      if (typeof settings.soundEnabled === 'boolean') setSoundEnabled(settings.soundEnabled);
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
    storageSet('settings', { soundEnabled, goalSeconds });
  }, [soundEnabled, goalSeconds, loaded]);

  const nextNumber = history ? (history.length ? Math.max(...history.map(s => s.number)) + 1 : 1) : 1;
  const lastRehearsal = history && history.length
    ? [...history].sort((a, b) => b.number - a.number)[0].rehearsalSeconds
    : null;
  const goalProgress = computeGoalProgress(history || [], goalSeconds);
  const autoSuggestion = computeNextRehearsal(history || []);
  // Always have a shake-up fallback available if the auto-suggestion isn't already one
  const shakeUpSuggestion = autoSuggestion.kind === 'shake-up'
    ? null
    : computeNextRehearsal(history || [], { forceShakeUp: true });

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
    const today = new Date().toISOString().slice(0, 10);
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
    storageSet('history', newHistory);
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
      storageSet('history', imported);
      if (importedGoal && importedGoal > 0) setGoalSeconds(importedGoal);
    } catch (e) {
      askConfirm({
        title: 'Import failed', message: e.message,
        confirmLabel: 'OK', cancelLabel: ' ',
      });
    }
  };

  const handleEditFromHistory = (session, index) => {
    setEditTarget({ session, originalNumber: session.number, index });
    setView('edit');
  };

  const handleSaveEdit = (updated) => {
    const newHistory = [...history];
    newHistory[editTarget.index] = {
      number: updated.number,
      date: updated.date,
      rehearsalSeconds: updated.rehearsalSeconds,
      warmUps: updated.warmUps,
      notes: updated.notes,
      rating: updated.rating ?? null,
    };
    newHistory.sort((a, b) => a.number - b.number);
    setHistory(newHistory);
    storageSet('history', newHistory);
    setEditTarget(null);
    setView('history');
  };

  const handleDeleteEdit = () => {
    const newHistory = history.filter((_, i) => i !== editTarget.index);
    setHistory(newHistory);
    storageSet('history', newHistory);
    setEditTarget(null);
    setView('history');
  };

  const handleChangeGoal = (newGoalSeconds) => {
    setGoalSeconds(newGoalSeconds);
  };

  return (
    <div className="app-root">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="serif italic text-xl" style={{ color: 'var(--ink-muted)' }}>Loading…</div>
          </div>
        ) : view === 'onboarding' ? (
          <Onboarding onClose={dismissOnboarding} />
        ) : view === 'home' ? (
          <Home
            nextNumber={nextNumber}
            lastRehearsal={lastRehearsal}
            goalSeconds={goalSeconds}
            goalProgress={goalProgress}
            onStart={handleStartSetup}
            onHistory={() => setView('history')}
            onShowOnboarding={showOnboarding}
            soundEnabled={soundEnabled}
            toggleSound={() => setSoundEnabled(s => !s)}
            resumable={activeSession}
            onResume={handleResume}
            onDiscardActive={handleDiscardActive}
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
            soundEnabled={soundEnabled}
            toggleSound={() => setSoundEnabled(s => !s)}
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
        ) : view === 'history' ? (
          <HistoryView
            history={history}
            goalSeconds={goalSeconds}
            onChangeGoal={handleChangeGoal}
            askConfirm={askConfirm}
            onBack={() => setView('home')}
            onEdit={handleEditFromHistory}
            onExport={handleExport}
            onImport={handleImport}
          />
        ) : view === 'edit' && editTarget ? (
          <EditSession
            session={editTarget.session}
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
