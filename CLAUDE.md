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
public/
  sw.js            ← service worker
  manifest.webmanifest
  icon-*.png
index.html         ← <meta theme-color> + pre-React paint bg
```

`departure-timer.jsx` at repo root is an old standalone artifact — **ignore**.

---

## App.jsx structural map

Search for these comment headers (`/* === SECTION === */`) to jump:

| Section | Roughly | What's there |
|---|---|---|
| Top of file | 1–60 | Imports, `SEED_HISTORY` (the demo/onboarding dataset), `DEFAULT_GOAL_SECONDS = 3600`, **`NOTIFICATIONS_FEATURE_ENABLED = false`** flag |
| TEST PROFILES | ~60–160 | `generateLotsOfData()` (logistic curve), `TEST_PROFILES` array (Lots / Demo / Empty) |
| Misc helpers | ~160–400 | `formatTime`, `formatTimeLong`, `parseMMSS`, `ymdLocal`, `buildSessionDaySet`, `generateWarmUps`, `buildPhases`, `phaseCue`, rating utils |
| Algorithm | ~400–500 | `computeNextRehearsal`, `simulateProjection`, `estimateSessionsToGoal`, `peakAcceptableSeconds`, `computeGoalProgress` |
| Storage | ~500–600 | `storageGet/Set/Delete`, `storageSetWithBackup` (history.backup) |
| Notifications | ~600–760 | `notificationsSupported`, `requestNotificationPermission`, `fireSystemNotification`, `firePhaseEndAlert` (chime + system notif) |
| Audio + alarm | ~760–900 | `playAlarm`, `buildChimeWav`, `buildKeepaliveWav`, `useAudioKeepalive` (the iOS-PWA-stays-alive trick), `useWakeLock` |
| Calendar bits | ~900–1100 | `DAY_ABBREVS_*`, `CheckDot`, `LastSevenDaysStrip`, `CalendarView` (full-month + swipe + Today button) |
| `<Home>` | ~1100–1400 | The home screen. **Keep it terse — every change here goes through review.** |
| `<Setup>` | ~1400–1600 | Pre-session screen (warm-up count picker, rehearsal duration, notes) |
| `<SessionView>` | ~1600–1900 | Active session timer/phases. Includes `useAudioKeepalive`, `useWakeLock` integration |
| `<Summary>` | ~1900–2050 | Post-session rating + notes screen |
| `<EditSession>` | ~2050–2300 | Edit existing session record (number is read-only) |
| `GoalCard` | ~2300–2400 | Hours+minutes goal editor (used in History + onboarding) |
| `ProgressionChart` | ~2400–2600 | Recharts line chart used by Home (compact) and History (full). Has tab range selector + the dot-reveal animation when `animationSpeed` prop is set |
| `<HistoryView>` | ~2600–2800 | Sessions list + chart + Add session button + Export/Import |
| `<SettingsView>` | ~2800–3050 | Notifications card (gated on `NOTIFICATIONS_FEATURE_ENABLED`), Appearance (System/Light/Dark), Growth Intensity, Developer tools link |
| `<TestProfilesView>` | ~3050–3150 | Settings → Developer tools sub-page. Warning banner, preset history loader, chart animation speed picker |
| `<Onboarding>` | ~3150–3450 | 4–5 step intro flow with embedded GoalCard on the goal step |
| `<App>` (root) | ~3450–end | View routing, all top-level state, persistence effects, all the `handle*` callbacks |

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
  rating: 1 | 2 | 3 | 4 | null,  // 1=Great, 2=Good, 3=Fair, 4=Bad, null=unrated
}
```

`isAcceptable(rating)` returns true for `null | 1 | 2`. `progressSessions` and `peakAcceptableSeconds` filter on this — Bad-rated sessions are intentionally excluded from the peak so a rough day doesn't drag down the goal-progress bar.

---

## Algorithm core (`computeNextRehearsal`)

Given history + opts, returns `{ seconds, reason, kind }`. Kinds:
- `'fresh'` — first session ever, suggests 5min
- `'step-back'` — last rated 4 (Bad). Suggests 60% of last duration
- `'repeat'` — last rated 3 (Fair). Same duration
- `'step-up'` — happy path. Increments scale with magnitude (table in code). **Past 40 min the increments grow more aggressive** (recent change)
- `'shake-up'` — auto-fired when last 3 sessions are all acceptable AND increasing. Suggests ~65% of recent average. Manual via `forceShakeUp: true`

**Pre-shake-up peak recovery:** if the last session looks like a shake-up (shorter than the previous acceptable session), the next step-up's basis is the pre-shake-up peak rather than the shake-up duration. Bounded so a Bad-rated session blocks recovery from anything before it.

`growthIntensity` (Settings → Growth Intensity, slow/typical/fast) multiplies the increment by 0.5 / 1.0 / 1.5.

`simulateProjection(history, goalSeconds, maxSteps, opts)` repeatedly applies `computeNextRehearsal` to build a forward dashed line for the chart. The Home tile shows the next 5 projected; the History "Next 10" tab shows 10.

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

- All branches merged. `main` is at `65cdcc6`.
- Notifications feature OFF. Volume toggle hidden in session view.
- Dark mode shipped. Settings → Appearance lets users force light/dark or follow system.
- Test profiles + chart-animation speed picker live in Settings → Developer tools (warning banner above).
- Home Sessions chart: dots fade-in + slide-up reveal animation. Default speed `'fast'` (500 ms total). Trend line renders statically; line-animation experiments were tried and scrapped.
- Step-up algorithm has tiers past 40 min and 60 min (bigger jumps once dog handles longer sessions reliably).
- Goal-reached recommendation tile appears on Home when peak acceptable session ≥ goalSeconds and user hasn't dismissed for that goal value.
- Last 7 days strip on Home (day abbreviations + green check dots, no date numbers).
- Full-month CalendarView with horizontal swipe to change month + Today button.
- "Sessions" tile (formerly "Trajectory") on Home, with View history pill in top-right.

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

