# Chasing Greatness 🏋️

A personal strength tracker: log your lifts, earn ranks, and watch yourself get stronger.
It's free, it's private, and it works offline. No accounts and no subscription.

## Features

- **Ranks**: seven tiers (Rookie → Contender → Warrior → Champion → Elite → Legend → Mythic) for
  Bench, Squat, Deadlift, Overhead Press and Barbell Row. Each tier compares your estimated 1RM to
  your bodyweight. Your overall rank is the average across those lifts.
- **Rank calculator**: answers "if I lift 225, what am I?" for any lift, rep count and bodyweight.
- **Workout logging**: sets × reps × weight, a live est.-1RM/rank preview as you type, "last time" hints,
  custom exercises, and editing past workouts.
- **PRs and rank-ups**: automatic PR detection and a celebration screen when you rank up.
- **Progress**: est.-1RM charts with rank thresholds drawn in, a PR timeline, weekly volume, and a bodyweight log.
- **Insights**: streaks, stalls, neglected lifts, weak links, volume trends, and a projected date
  for your next rank based on your actual rate of progress.
- **Consistency heatmap** covering the last 6 months.
- **Installable**: add it to your home screen and it runs like a native app, offline included.
- **Your data stays yours**: it's stored in your browser's localStorage. Use Settings → Export backup to save a JSON file.

## Deploy to GitHub Pages

1. Merge this branch into `main`.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and pick **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` deploys on every push to `main`. Your site will be at
   `https://<your-username>.github.io/chasing-greatness/`.

## Run locally

It's plain HTML/CSS/JS with no build step:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Customize

- Tier names, colors and lift standards live in `js/data.js`.
- Add exercises to `EXERCISES` in the same file, or use "+ Add custom exercise" in the app.
- If you change cached files, bump `CACHE` in `sw.js` so installed copies pick up the update.

> Note: data lives per browser and per device. Export a backup before you clear site data or switch phones,
> then import it on the new device.
