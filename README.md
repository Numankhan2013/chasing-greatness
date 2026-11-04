# Chasing Greatness 🏋️

A personal strength tracker: log lifts, earn honest ranks, watch yourself climb.
It's free and private, works offline, and lives on Firebase Hosting with optional Google sign-in to sync across devices.

## How ranks work

- Every set gets an **estimated 1RM** computed the way the standards were built: Brzycki below 8 reps, a blend
  from 8–10, Epley above 10 (reps capped at 20), so the comparison is like-for-like.
  Pull-ups, chin-ups and dips use bodyweight reps, and added weight converts into extra reps.
- That estimate is compared with **Strength Level's standards** (about 10.9M real logged lifts, 2015–2026)
  **at your bodyweight and sex**, which gives a percentile: "stronger than X% of lifters".
- Percentile → tier: Rookie (0–20) · Bronze (20–33) · Silver (33–47) · Gold (47–60) · Diamond (60–80) ·
  Elite (80–90) · Legend (90–97) · Mythic (97+). Each tier has three divisions, III → II → I.
- **42 ranked exercises** across 6 muscle groups (searchable by common aliases, e.g. "hamstring curl", "stiff leg deadlift"). A group ranks by your best exercise in it. Overall is the
  average of your groups (arms count half).

## Features

- Exercise-first logging. The date defaults to today and lives in a small chip for backdating. Last time's
  numbers show as hints, and ✓ completes a set and starts the rest timer. Drafts survive closing the app.
- Ranks page with per-exercise tier ladders (exact kg needed at your bodyweight) and a what-if calculator.
- Insights: rank over time, projected rank-ups, strength radar, weekly sets per muscle, imbalances, stalls, PRs.
- Progress charts with tier lines, rep records, weekly volume, and a bodyweight log.
- Installable PWA that works offline. Backups export and import as JSON.

Built with: Clash Display + Satoshi (Fontshare), Geist Mono, Lucide icons, ApexCharts, GSAP, canvas-confetti.

## Code map

| File | What |
|---|---|
| `js/standards.js` | Strength standards by bodyweight (generated) |
| `js/data.js` | Tiers, muscle groups, exercise catalogue |
| `js/engine.js` | Storage, 1RM math, percentiles, ranks, stats |
| `js/ui-core.js` | Emblems, charts, sheets, rest timer, animations |
| `js/views-*.js` | Pages (main, ranks, log, progress/insights) |
| `js/cloud.js` | Google sign-in + Firestore sync |
| `js/firebase-config.js` | Public Firebase web config |
| `js/app.js` | Routing + events |

## Cloud sync (Firebase)

- Sign in with Google in **Settings → Cloud sync**. Workouts, weigh-ins, profile and custom exercises back up to
  Firestore under `users/{uid}`, and only you can read them (`firestore.rules`).
- The device copy stays primary, so the app still works offline. Changes push a moment after you save, and the
  app pulls and merges on sign-in, when it comes back to the foreground, and when it reconnects. The newest edit wins.
  Deletions sync through tombstones.
- Everything runs on Firebase's free Spark plan.

## Deploy

**Firebase:** every push to the default branch runs `.github/workflows/firebase.yml`, which deploys Hosting and the
Firestore rules to the `chasing-greatness` project. Auth uses keyless Workload Identity Federation.
Live at https://chasing-greatness.web.app

**GitHub Pages (legacy):**

Settings → Pages → Source: **GitHub Actions**. Every push to the default branch deploys automatically.
To deploy by hand, go to Actions → *Deploy to GitHub Pages* → Run workflow.

## Run locally

```sh
python3 -m http.server 8000   # open http://localhost:8000
```
