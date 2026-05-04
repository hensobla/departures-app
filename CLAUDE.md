# Departures App — context for future Claude sessions

A Vite + React PWA that helps owners walk their dog through separation
anxiety with graduated departure rehearsals. Deployed to GitHub Pages at
<https://hensobla.github.io/departures-app/>.

The app lives almost entirely in **one file** (`src/App.jsx`, ~3,600 lines).
Don't try to "modernize" by splitting it up unless asked — the user has
deliberately kept it monolithic so it's easy to scroll/grep through and
keeps the merge surface small. New components are appended; never extract
into separate files preemptively.

---

## Stack

- **Vite 6** + **React 18** (StrictMode on)
- **Tailwind 3.4** for utility classes
- **Recharts 2** for the line chart on Home + History
- **lucide-react** for icons
- **Plain `localStorage`** for all persistence (no backend, no cloud sync)
- **Service worker** at `public/sw.js` (network-first for HTML, cache-first
  for hashed assets). Registered only in production builds; in dev,
  `src/main.jsx` proactively unregisters any leftover SW from prior preview
  sessions to keep HMR working.

## Deploy

- GitHub Action at `.github/workflows/deploy.yml` builds on every push to
  `main` and deploys to GitHub Pages.
- Workflow is `npm ci && npm run build && upload-pages-artifact`.
- Vite `base` is `/departures-app/`.
- Confirm deploys with `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.

## Local dev

- `npm run dev` — Vite dev server (defaults to port 5179 via `.claude/launch.json` for the Claude Preview MCP).
- Don't use `npm run preview` casually. It builds + serves the SW, and that SW persists on `localhost:5179` after you stop the preview, then breaks the dev server's HMR. If this happens, run the SW-unregister snippet (in `main.jsx`'s dev branch) or clear site data from DevTools.

---

## File layout

```
src/
  App.jsx          ← everything: components, helpers, routing
  main.jsx         ← React mount + SW registration (prod-only)
  index.css        ← Tailwind layers + CSS custom properties (themes)
  tips.numbers     ← SOURCE OF TRUTH for the in-session tips library
  tips.csv         ← derived from tips.numbers; what the app reads
public/
  sw.js            ← service worker
  manifest.webmanifest
  icon-*.png
scripts/
  tips-export.sh   ← exports tips.numbers → tips.csv via Numbers.app
index.html         ← <meta theme-color> + pre-React paint bg
```

`departure-timer.jsx` at repo root is an old standalone artifact — **ignore**.

### The tips spreadsheet workflow

`src/tips.numbers` is the source of truth for the rotating session tips.
The user edits it directly in Numbers (two columns: `category`, `text`).
Vite imports `src/tips.csv` via `?raw` at build time, so the .csv has to
be regenerated whenever the .numbers file changes.

`scripts/tips-export.sh` handles this. It runs automatically as the
`predev` and `prebuild` npm hooks, and is a no-op when the .csv is already
newer than the .numbers (so the dev cycle isn't slowed down). On non-macOS
(CI) it skips silently and the build uses the committed .csv as-is.

Manual invocation: `npm run tips:export`. Briefly drives Numbers.app via
`osascript`. Both files must be committed — tips.numbers as the source,
tips.csv so CI builds without needing Numbers.

---

## App.jsx structural map

Search for these comment headers (`/* === SECTION === */`) to jump:

| Section | Roughly | What's there |
|---|---|---|
| Top of file | 1–110 | Imports (incl. `tipsCsv` raw), `SEED_HISTORY`, `DEFAULT_GOAL_SECONDS = 3600`, **`NOTIFICATIONS_FEATURE_ENABLED = false`**, in-session tips library (`parseTipsCsv`, `TIPS`, `shuffledTips`) |
| TEST PROFILES | ~110–205 | `generateLotsOfData()` (logistic curve), `TEST_PROFILES` array (Lots / Demo / Empty) |
| Misc helpers | ~205–355 | Formatters (`formatTime`, `formatTimeLong`, `parseMMSS`, `formatDate`, `ymdLocal`), `buildSessionDaySet`, warm-up generation (`warmUpPools`, `pickWarmUpValue`, `generateWarmUps`), `buildPhases`, `phaseCue`, `roundDuration` |
| Algorithm | ~355–650 | `demonstratedPeak`, `stepUpIncrement`, `computeNextRehearsal`, `simulateProjection`, `peakAcceptableSeconds`, `estimateSessionsToGoal`, `computeGoalProgress`, `estimateText` |
| Storage | ~650–700 | `storageGet/Set/Delete`, `storageSetWithBackup` (history.backup) |
| Notifications | ~700–760 | `notificationsSupported`, `requestNotificationPermission`, `fireSystemNotification`, `firePhaseEndAlert` |
| Audio + alarm | ~750–960 | `playAlarm`, `buildChimeWav`, `buildKeepaliveWav`, `useAudioKeepalive` (iOS-PWA-stays-alive trick), `useWakeLock` |
| Calendar bits | ~960–1310 | `RatingSelector`, `ConfirmDialog`, `TopBar`, `CheckDot`, `LastSevenDaysStrip`, `CalendarView` (full-month + swipe + Today) |
| `<Home>` | ~1325–1515 | Home screen. Handles `verify-peak` kind tile + reason copy. **Keep it terse — every change here goes through review.** |
| `<Setup>` | ~1516–1750 | Pre-session screen. Includes the **verify-best dialog cards** (two cards: "Try your best again" / "Step back") that fire when last session is Fair/Bad below DP. Picking step-back marks the prior session as a regression on Begin. |
| `<SessionView>` | ~1750–1985 | Active session timer/phases. Includes session-tip rotation (advances per phase, shuffled per session), `useAudioKeepalive`, `useWakeLock` |
| `<Summary>` | ~1985–2050 | Post-session rating + notes screen |
| `<EditSession>` | ~2050–2195 | Edit existing session record. Preserves the optional `interpretedAs` field through saves. |
| `GoalCard` | ~2194–2300 | Hours+minutes editor. **Parameterized** with `label` and `icon` props (defaults to "Rehearsal goal" + Target icon); used by History, Settings, and onboarding (twice on first run) |
| `ProgressionChart` | ~2328–2685 | Recharts line chart, used by Home (compact) and History (full). Has tab range selector + dot-reveal animation. Knows about the `verify-peak` kind label. |
| `<HistoryView>` | ~2688–2790 | Sessions list + chart + Add session button + Export/Import |
| `<SettingsView>` | ~2820–3055 | Notifications (gated), Appearance (System/Light/Dark), Growth Intensity, Developer tools link |
| `<AlgorithmInspector>` + `<ScratchRow>` | ~3060–3310 | Settings → Developer tools → Algorithm. Read-only inspector with state, next, projection, scratch-history editor, per-row regression toggle. Never touches localStorage. |
| `<TestProfilesView>` | ~3312–3415 | Developer-tools landing page. Adds entry button to `<AlgorithmInspector>`. |
| `<Onboarding>` | ~3415–3600 | 4–5 step intro. Goal step shows **dual cards on first run** (Current best + Rehearsal goal); single card when re-opened via i icon. |
| `<App>` (root) | ~3600–end | View routing (incl. `view === 'inspector'`), all top-level state, persistence effects, `handle*` callbacks. `dismissOnboarding` accepts `initialBestSeconds` and seeds session #1 on first run. `handleBeginSession` mutates last session for regression marking when verify-best chooses Step back. |

When adding new state, the convention is: state lives in `<App>`, wires down via props. Sub-components own only ephemeral UI state (which tab, hover, etc.).

---

## Theming

Two palettes via CSS custom properties on `:root` in `src/index.css`. Three modes:

- `themeMode === 'system'` — no `data-theme` attribute on `<html>`, `prefers-color-scheme` decides
- `themeMode === 'light'` — `<html data-theme="light">`, forces light
- `themeMode === 'dark'` — `<html data-theme="dark">`, forces dark

**Always use `var(--name)` for colors in App.jsx.** All hardcoded hex have been removed (including in Recharts SVG attributes — `stroke="var(--clay)"` is supported). The rating-tag tint uses `color-mix(in srgb, ${rc} 13%, transparent)` since `rc` is itself a `var()` reference.

Vars in scope: `--bg`, `--bg-warm`, `--surface`, `--ink`, `--ink-soft`, `--ink-muted`, `--line`, `--clay`, `--clay-deep`, `--sage`, `--amber`, `--gold`, `--brick`, `--bg-amber-tint`, `--on-clay`, `--check-bg`.

`--check-bg` is a separately-themed sage that's deepened in dark mode so the cream check icon retains contrast on the completed-day dots.

---

## Data shape

Everything stored as JSON in `localStorage`. Keys:

- `history` — array of session records (see below)
- `history.backup` — copy of `history` from before the most recent write (insurance against bad updates)
- `active` — currently-running session (phases, current index, end time) so a refresh resumes the timer
- `settings` — `{ notificationsEnabled, volume, growthIntensity, goalSeconds, themeMode, chartAnimSpeed }` (only the raw user pref; the runtime `notificationsEnabled` is gated through the feature flag)
- `hasInitialized` — `true` after the first ever load. Prevents re-seeding `SEED_HISTORY` over an existing user's data if their history ever goes missing
- `goalReachedDismissedFor` — number; the `goalSeconds` value at which the user dismissed the "you reached your goal" tile. Re-arms when goalSeconds changes
- `onboardingDismissed` — boolean

**Session record:**
```ts
{
  number: number,        // monotonically assigned at creation, immutable in editor
  date: 'YYYY-MM-DD',    // local date (NOT toISOString — see "Pitfalls")
  warmUps: number[],     // each entry is seconds-outside-the-door
  rehearsalSeconds: number,
  notes: string,
  rating: 1 | 2 | 3 | 4 | null,         // 1=Great, 2=Good, 3=Fair, 4=Bad, null=unrated
  interpretedAs?: 'regression',          // optional: explicit user signal that drops DP
}
```

`isAcceptable(rating)` returns true for `null | 1 | 2`. `progressSessions` and `peakAcceptableSeconds` filter on this — Bad-rated sessions are intentionally excluded from the peak so a rough day doesn't drag down the goal-progress bar.

`interpretedAs: 'regression'` is set by the verify-best dialog when the user picks "Step back" — it's the only way `demonstratedPeak()` lowers DP. Reversible by editing the session record (the field is preserved through `EditSession` saves).

---

## Algorithm core

The dog's **demonstrated best (DP)** is the longest session he's rated Great or Good. `demonstratedPeak(sorted)` walks history forward, raising DP on each Great/Good and dropping it only when a session has `interpretedAs: 'regression'` set. Without that explicit marking, Fair/Bad ratings don't touch DP. (User-facing copy says "best" / "best session"; `demonstratedPeak` stays as the internal name for code clarity.)

`computeNextRehearsal(history, opts)` returns `{ seconds, reason, kind, alternative?, currentPeak? }`. Kinds:

- `'fresh'` — first session ever, suggests 5min
- `'verify-peak'` — last rated Fair/Bad strictly *below* DP, not yet marked as regression. Default `seconds` is DP itself ("try your best again"). The `alternative` field carries a recalibrate path: `{ seconds, reason, kind: 'step-back' | 'repeat', newPeak }`. The Setup screen surfaces both as cards.
- `'step-back'` — last rated Bad and not below DP (or DP=0). 60% of last duration, floored at 60s.
- `'repeat'` — last rated Fair and not below DP. Same duration.
- `'shake-up'` — auto-fired when last 3 sessions are all acceptable AND increasing. ~65% of recent average. Manual via `forceShakeUp: true`.
- `'step-up'` — happy path. **Basis is `max(lastSecs, peakSecs)`** (Flavor A) — a casual short success doesn't reset progression, the dog has already demonstrated longer. Increments via `stepUpIncrement(basis, rating)`; past 40 min and 60 min they grow more aggressive. Sub-5min always uses 30s increments regardless of rating (smaller would round to zero after growth-intensity scaling).

**Regression-marking flow.** When a Fair/Bad lands below DP, the next time the user opens Setup they see the verify-best dialog: "Try your best again" (default — DP unchanged) or "Step back" (recalibrate). Picking Step back sets `interpretedAs: 'regression'` on the prior session at Begin time. `demonstratedPeak()` then drops DP to the highest Great/Good *strictly shorter than* the regressed session, or 0 if none exists. Reversible by editing the session record.

**Bad above DP, Fair above DP, success below DP** all leave DP unchanged. The only way DP drops is the explicit regression marking.

**Onboarding seeds DP on first run.** When a user completes onboarding with no prior history, the dual-card goal step asks for a "Current best." On close, `dismissOnboarding(initialBestSeconds)` writes a synthetic session #1 with rating 1 and that duration, giving the algorithm a starting DP to build from.

`growthIntensity` (Settings → Growth Intensity, slow/typical/fast) multiplies the increment by 0.5 / 1.0 / 1.5.

`simulateProjection(history, goalSeconds, maxSteps, opts)` repeatedly applies `computeNextRehearsal` (treating projected sessions as rated 1) to build a forward dashed line for the chart. Home tile shows the next 5; History "Next 10" tab shows 10. Each row carries `kind` and `reason` so the chart and inspector can label them.

**Warm-up sizing.** `warmUpPools(rehearsalSeconds)` returns size-aware `{ shortVals, longVals }`. Sub-5min stays under 30s. >40min stretches up to 2min, with `generateWarmUps` ensuring a guaranteed mix of sub-1min and 1+min values rather than going homogeneous by chance. 5–40min uses the original 0–55s range.

---

## Important active conventions / flags

### `NOTIFICATIONS_FEATURE_ENABLED = false` (top of App.jsx)
The notifications experience (system notifications, audio keepalive, volume controls, the test buttons) all live in the codebase but are gated off until polished. Specifically gated:
- The Notifications card in Settings (hidden)
- The volume toggle icon in the SessionView TopBar (hidden)
- The runtime `notificationsEnabled` (forced `false` via `FLAG && raw`)
- `useAudioKeepalive` only runs when notifications are on
- `firePhaseEndAlert` short-circuits when not enabled

The persisted user pref (`notificationsEnabledRaw`) is preserved so flipping the flag back to `true` restores everyone's previous choice. To re-enable, flip the constant; nothing else needs changing.

### Branch workflow
The user prefers small focused branches when experimenting (`test-profiles`, `chart-animation`, etc.) and merges back when satisfied. The workflow:
1. `git checkout -b feature-name`
2. Iterate; commit on the branch only
3. Test in dev preview (Claude Preview MCP at port 5179)
4. When approved: `git checkout main && git merge --no-ff feature-name && git push origin main`
5. Deploy goes live, watch with `gh run watch`
6. `git branch -d feature-name`

Some changes go straight to main when they're small and obviously correct.

### Testing on iPhone (the user's primary surface)
- Most testing happens on the deployed PWA installed to home screen.
- After a deploy, force-close the PWA (swipe up in app switcher) and reopen so the SW fetches the new HTML.
- For stubborn caches, delete the home-screen icon and re-add via Safari → Share → Add to Home Screen.

### iOS PWA notification limitations (when re-enabling)
- Notifications API only available in installed PWA (iOS 16.4+), not Safari.
- iOS suspends backgrounded PWA JS within ~10–30s. The `useAudioKeepalive` hook plays a near-silent looped WAV to keep the JS alive (extended-background-audio privilege). Trade-off: pauses other audio apps while a session runs.
- True "fire on time while phone is locked" requires server-side push; we don't have a backend.
- `firePhaseEndAlert` checks document visibility AND whether the doc was hidden at any point during the running phase, so the catch-up case (user comes back to the app, JS resumes, detects the past phase end) still fires a notification.

---

## Pitfalls we've hit (don't re-introduce)

1. **`new Date().toISOString().slice(0,10)` for storing session dates.** This shifts west-of-UTC users' evening sessions to "tomorrow" and breaks the calendar's "today" matching. Always use `ymdLocal(new Date())`.
2. **Service worker on `localhost:5179` from a prior `npm run preview`.** Caches dev modules, breaks HMR. The dev branch in `src/main.jsx` actively unregisters leftover SWs.
3. **Auto-seeding history when the array is empty.** Used to overwrite real user data if `localStorage.history` ever returned null/empty. Now gated on the `hasInitialized` flag.
4. **Hardcoded hex colors.** Block dark mode. Always `var(--name)`.
5. **Recharts dot fade-in by mounting/unmounting via masked data.** Looked snappy but didn't have a "from" state for the CSS transition. Current approach: full data always rendered, dots use `<g style={...}>` with opacity/transform that flips based on `revealedCount` for smooth fades.
6. **Setting state inside a regular `useEffect` for the chart animation reset.** First paint shows dots at opacity:1 (previous animation's end state) before the reset takes effect — animation runs backwards. Use `useLayoutEffect` for the pre-paint reset.
7. **`min-w-10` not in default Tailwind.** Tailwind 3.4+ ships it; verified in `tailwind.config.js`.
8. **Dialog "Dismiss" actions that don't snapshot the right state.** The goal-reached dismissal is keyed on `goalSeconds` at dismiss time, so changing the goal naturally re-arms the tile.

---

## Most-recent state (as of 2026-05-04)

- All branches merged. `main` is at `b1407ba`.
- **Algorithm reworked to the demonstrated-best (DP) model.** Step-up basis = `max(lastSecs, peakSecs)`. Verify-best dialog on Setup when Fair/Bad lands below DP. The only way DP drops is an explicit `interpretedAs: 'regression'` marking — see Algorithm core above.
- **Onboarding's goal step shows dual cards on first run** (Current best + Rehearsal goal). Picking a Current best seeds session #1 as a Great-rated baseline so the algorithm has a starting DP. Re-opening the guide via the i icon (post-history) shows the original single-goal step.
- **Algorithm inspector dev tool** at Settings → Developer tools → Algorithm: state (DP, last), next session, next 10 projected with reasons, scratch-history editor with per-row "mark as regression" toggle. Read-only — never touches localStorage.
- **Session tips:** rotating italic prompt at the bottom of `<SessionView>`, advances per phase, shuffled per session. Library is `src/tips.numbers` (source of truth, edited in Numbers); `src/tips.csv` is the derived form Vite imports as `?raw`. `predev`/`prebuild` scripts auto-export via Numbers.app on macOS; CI builds from the committed CSV. See File layout.
- Warm-up pools sized to the rehearsal: <5min stays <30s, >40min stretches to 2min with guaranteed mix of <1min and 1+min values.
- Step-up increment for Good <5min is 30s (was 15s) — smaller values quantize to zero after growth-intensity scaling.
- Notifications feature OFF. Volume toggle hidden in session view.
- Dark mode shipped. Settings → Appearance lets users force light/dark or follow system.
- Test profiles + chart-animation speed picker + algorithm inspector all live in Settings → Developer tools (warning banner above).
- Home Sessions chart: dots fade-in + slide-up reveal animation. Default speed `'fast'` (500 ms total). Trend line renders statically.
- Goal-reached recommendation tile appears on Home when peak acceptable session ≥ goalSeconds and user hasn't dismissed for that goal value.
- Last 7 days strip on Home (day abbreviations + green check dots, no date numbers).
- Full-month CalendarView with horizontal swipe + Today button.
- "Sessions" tile on Home, with View history pill in top-right.

---

## Common commands

```bash
# Dev server (auto-port 5179 when via Claude Preview)
npm run dev

# Production build
npm run build

# Deploy by pushing to main (CI does the rest)
git push origin main
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status

# Test profile branch
git checkout -b feature-name
# ...iterate, commit...
git checkout main
git merge --no-ff feature-name
git push origin main
git branch -d feature-name
```

---

## When in doubt

- **Color**: use a `var(--name)` from index.css.
- **State**: lift to `<App>` if more than one component needs it.
- **Storage**: use `storageSetWithBackup` for `history`; plain `storageSet` for everything else. Never write empty/default state on read failure — fall through to an empty UI and let Import recover.
- **New view**: add a `view === 'name'` branch in `<App>`'s ternary chain near the bottom of App.jsx.
- **New setting**: add to `useState` in `<App>`, add a load branch in the settings useEffect, add to the persistence object, thread to `<SettingsView>` via props.
- **Notifications-adjacent work**: the feature is currently flagged OFF. If you touch it, leave the flag at `false` and gate any new UI on it.

