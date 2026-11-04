'use strict';
/* Data + strength engine: storage, units, 1RM estimation, percentile ranks, stats.
 * No DOM code in here — app.js handles the UI. */
window.CG = (() => {
  const { TIERS, CATEGORIES, EXERCISES } = window.CG_DATA;
  const STD = window.CG_STANDARDS;
  const KG_PER_LB = 0.45359237;
  const DAY = 86400000;
  const STORE_KEY = 'chasing-greatness.v1';
  const PCTS = [5, 20, 50, 80, 95];
  const ROMAN = ['', 'I', 'II', 'III'];

  /* ── dates ── */
  const pad = (n) => String(n).padStart(2, '0');
  const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => localISO(new Date());
  const parseDate = (iso) => new Date(iso + 'T00:00:00');
  const addDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return localISO(d); };
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);
  const weekStart = (iso) => { const d = parseDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localISO(d); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ── state ── */
  const DEFAULT = {
    version: 2,
    profile: { name: '', sex: 'male', unit: 'lb', bodyweight: null, weeklyGoal: 3, trainingMonths: null },
    lifts: {},        // strength profile: {exId: {w (kg), r, date}} — "what I can lift now", NOT workouts
    workouts: [],     // {id, date, notes, updatedAt, entries:[{ex, sets:[{w (kg), r}]}]}
    bodyweights: [],  // {date, kg}
    custom: [],       // {id, name, cat, kind}
    deleted: [],      // tombstones {id, at} — keeps future cloud sync honest about deletions
  };
  function normalize(s) {
    const base = clone(DEFAULT);
    const out = {
      ...base, ...s, version: 2,
      profile: { ...base.profile, ...(s.profile || {}) },
      workouts: Array.isArray(s.workouts) ? s.workouts : [],
      bodyweights: Array.isArray(s.bodyweights) ? s.bodyweights : [],
      custom: (Array.isArray(s.custom) ? s.custom : []).map((c) => ({ cat: 'other', kind: 'load', ...c })),
      deleted: Array.isArray(s.deleted) ? s.deleted : [],
      lifts: s.lifts && typeof s.lifts === 'object' && !Array.isArray(s.lifts) ? s.lifts : {},
    };
    for (const w of out.workouts) w.updatedAt ||= Date.parse(w.date) || Date.now();
    return out;
  }
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { /* fall through */ }
    return clone(DEFAULT);
  }
  const api = { state: load(), storageOK: true };
  function save(opts = {}) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(api.state)); api.storageOK = true; } catch (e) { api.storageOK = false; }
    memo = null;
    if (!opts.silent && window.CG_CLOUD) window.CG_CLOUD.onSave();
    return api.storageOK;
  }
  // Workouts that disappear in a replace (erase, import, demo) get tombstones so cloud sync deletes them too.
  function tombstoneMissing(oldState, next) {
    const keep = new Set(next.workouts.map((w) => w.id));
    const known = new Set(next.deleted.map((t) => t.id));
    const now = Date.now();
    for (const w of oldState.workouts) if (!keep.has(w.id) && !known.has(w.id)) next.deleted.push({ id: w.id, at: now });
    return next;
  }
  function replaceState(s, opts = {}) {
    const next = normalize(s);
    api.state = opts.silent ? next : tombstoneMissing(api.state, next);
    save(opts);
  }

  /* ── units ── */
  const unit = () => api.state.profile.unit;
  const toDisp = (kg) => (unit() === 'lb' ? kg / KG_PER_LB : kg);
  const fromDisp = (v) => (unit() === 'lb' ? v * KG_PER_LB : v);
  const round = (x, d = 0) => { const p = 10 ** d; return Math.round(x * p) / p; };
  const wNum = (kg) => round(toDisp(kg), unit() === 'lb' ? 0 : 1);
  const fmtW = (kg) => `${wNum(kg).toLocaleString()} ${unit()}`;
  const plateUp = (kg) => { const step = unit() === 'lb' ? 5 : 2.5; return fromDisp(Math.ceil(toDisp(kg) / step - 1e-9) * step); };

  /* ── exercises ── */
  const allExercises = () => EXERCISES.concat(api.state.custom.map((c) => ({ short: c.name, ...c, custom: true })));
  const exById = (id) => allExercises().find((e) => e.id === id) || { id, name: 'Unknown exercise', short: '?', cat: 'other', kind: 'load' };
  const catById = (id) => CATEGORIES.find((c) => c.id === id) || { id: 'other', name: 'Other', weight: 0 };
  const isRanked = (id) => !!exById(id).std;

  /* ── bodyweight ── */
  function currentBW() {
    const b = api.state.bodyweights;
    if (b.length) return b.reduce((a, x) => (x.date > a.date ? x : a)).kg;
    return api.state.profile.bodyweight;
  }
  function bwAt(date) {
    let best = null;
    for (const b of api.state.bodyweights) if (b.date <= date && (!best || b.date > best.date)) best = b;
    if (best) return best.kg;
    // Before the first weigh-in: use the earliest one we have, else the profile value.
    const first = api.state.bodyweights.reduce((a, x) => (!a || x.date < a.date ? x : a), null);
    return first ? first.kg : currentBW();
  }

  /* ── strength math ──
   * Epley 1RM, but reps above 10 count as 10: high-rep sets measure endurance and wildly
   * inflate estimated maxes (Epley at 15 reps says +50%). */
  const e1rm = (w, r) => (!(w > 0) || !(r > 0) ? 0 : r === 1 ? w : w * (1 + Math.min(r, 10) / 30));
  // Bodyweight lifts: convert (bodyweight + added load) × reps into equivalent bodyweight reps.
  function eqReps(addKg, reps, bwKg) {
    if (!(reps > 0)) return 0;
    const bw = bwKg || 75, load = bw + (addKg || 0);
    if (load <= 0) return 0;
    return Math.max(0, 30 * ((load * (1 + Math.min(reps, 40) / 30)) / bw - 1));
  }
  function setMetric(ex, s, bwKg) { return ex.kind === 'bw' ? eqReps(s.w, s.r, bwKg) : e1rm(s.w, s.r); }
  function fmtMetric(ex, v) { return ex.kind === 'bw' ? `${round(v, v < 10 ? 1 : 0)} reps` : fmtW(v); }

  /* ── percentiles ── */
  function anchors(stdKey, sex, bwKg) {
    const rows = STD[stdKey][sex === 'female' ? 'F' : 'M'];
    const bw = clamp(bwKg || 75, rows[0][0], rows.at(-1)[0]);
    let i = 0;
    while (i < rows.length - 2 && bw > rows[i + 1][0]) i++;
    const [a, b] = [rows[i], rows[i + 1]];
    const t = (bw - a[0]) / (b[0] - a[0]);
    const out = [1, 2, 3, 4, 5].map((k) => a[k] + (b[k] - a[k]) * t);
    for (let k = 1; k < 5; k++) out[k] = Math.max(out[k], out[k - 1] + 0.5); // keep strictly increasing
    return out;
  }
  function toPct(v, a) {
    if (!(v > 0)) return 0;
    if (v <= a[0]) return a[0] > 0 ? (5 * v) / a[0] : 5;
    for (let i = 0; i < 4; i++) if (v <= a[i + 1]) return PCTS[i] + ((PCTS[i + 1] - PCTS[i]) * (v - a[i])) / (a[i + 1] - a[i]);
    return 95 + 4.9 * (1 - Math.exp(-(v - a[4]) / (a[4] - a[3])));
  }
  function fromPct(p, a) {
    if (p <= 5) return (a[0] * p) / 5;
    for (let i = 0; i < 4; i++) if (p <= PCTS[i + 1]) return a[i] + ((a[i + 1] - a[i]) * (p - PCTS[i])) / (PCTS[i + 1] - PCTS[i]);
    const x = -Math.log(1 - (Math.min(p, 99.8) - 95) / 4.9);
    return a[4] + x * (a[4] - a[3]);
  }

  /* ── tiers & divisions ── */
  const STEPS = [];
  TIERS.forEach((t, i) => {
    const to = TIERS[i + 1]?.from;
    if (to == null) { STEPS.push({ tier: i, div: 0, from: t.from }); return; }
    for (let d = 0; d < 3; d++) STEPS.push({ tier: i, div: 3 - d, from: t.from + ((to - t.from) * d) / 3 });
  });
  const stepLabel = (s) => TIERS[s.tier].name + (s.div ? ' ' + ROMAN[s.div] : '');
  function rankFromPct(p) {
    let k = 0;
    while (k + 1 < STEPS.length && p >= STEPS[k + 1].from - 1e-9) k++;
    const s = STEPS[k], n = STEPS[k + 1] || null;
    const t = TIERS[s.tier], tn = TIERS[s.tier + 1];
    return {
      pct: p, rating: Math.round(p * 10), tier: s.tier, div: s.div, step: k, label: stepLabel(s),
      frac: n ? clamp((p - s.from) / (n.from - s.from), 0, 1) : clamp((p - 97) / 2.8, 0, 1),
      tierFrac: tn ? clamp((p - t.from) / (tn.from - t.from), 0, 1) : clamp((p - 97) / 2.8, 0, 1),
      next: n ? { ...n, label: stepLabel(n) } : null,
      nextTier: tn ? s.tier + 1 : null,
    };
  }
  function rankOf(exId, value, bwKg = currentBW(), sex = api.state.profile.sex) {
    const ex = exById(exId);
    if (!ex.std || !(value > 0)) return null;
    const a = anchors(ex.std, sex, bwKg);
    const r = rankFromPct(toPct(value, a));
    r.value = value;
    r.anchors = a;
    r.nextValue = r.next ? fromPct(r.next.from, a) : null;
    r.need = r.nextValue ? Math.max(0, r.nextValue - value) : 0;
    r.nextTierValue = r.nextTier != null ? fromPct(TIERS[r.nextTier].from, a) : null;
    r.tierValues = TIERS.map((t) => fromPct(t.from, a));
    return r;
  }

  /* ── derived history (memoised until next save) ── */
  let memo = null;
  function derived() {
    if (memo) return memo;
    const byEx = {}, repPRs = {};
    const sorted = [...api.state.workouts].sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt);
    for (const w of sorted) {
      const bw = bwAt(w.date);
      for (const en of w.entries) {
        const ex = exById(en.ex);
        let best = 0, top = null, vol = 0, sets = 0;
        for (const s of en.sets) {
          if (!(s.r > 0)) continue;
          const m = setMetric(ex, s, bw);
          vol += (ex.kind === 'bw' ? bw + (s.w || 0) : s.w || 0) * s.r * (ex.kind === 'db' ? 2 : 1);
          sets++;
          if (m > best) { best = m; top = s; }
          if (ex.kind !== 'bw' && s.w > 0 && s.r <= 12) {
            const rp = (repPRs[en.ex] ||= {});
            if (!rp[s.r] || s.w > rp[s.r].w) rp[s.r] = { w: s.w, date: w.date };
          }
        }
        if (!sets) continue;
        (byEx[en.ex] ||= []).push({ date: w.date, wid: w.id, best, top, vol, sets, bw });
      }
    }
    for (const id of Object.keys(byEx)) {
      const merged = [];
      for (const p of byEx[id]) {
        const last = merged.at(-1);
        if (last && last.date === p.date) {
          last.vol += p.vol; last.sets += p.sets;
          if (p.best > last.best) Object.assign(last, { best: p.best, top: p.top, wid: p.wid });
        } else merged.push({ ...p });
      }
      let run = 0;
      merged.forEach((p, i) => { p.pr = p.best > run + 1e-9; p.firstEver = i === 0; if (p.pr) run = p.best; p.runBest = run; });
      byEx[id] = merged;
    }
    memo = { byEx, repPRs, sorted };
    return memo;
  }
  const history = (exId) => derived().byEx[exId] || [];
  const bestOf = (exId) => history(exId).reduce((a, b) => (!a || b.best > a.best ? b : a), null);
  const trainedExercises = () => allExercises().filter((e) => history(e.id).length);

  /* Profile lift → same shape as a history point, so the UI can treat both alike. */
  function profilePoint(exId, date = todayISO()) {
    const l = api.state.lifts[exId];
    if (!l || !(l.r > 0) || l.date > date) return null;
    const ex = exById(exId);
    if (ex.kind !== 'bw' && !(l.w > 0)) return null;
    const best = setMetric(ex, l, date === todayISO() ? currentBW() : bwAt(date));
    return best > 0 ? { date: l.date, best, top: { w: l.w, r: l.r }, profile: true } : null;
  }
  /* Best known performance: the higher of logged workouts and the strength profile. */
  function bestKnown(exId) {
    const h = bestOf(exId), p = profilePoint(exId);
    if (!h) return p;
    if (!p) return h;
    return p.best > h.best ? p : h;
  }
  function liftRank(exId) {
    const b = bestKnown(exId);
    if (!b) return null;
    const r = rankOf(exId, b.best);
    return r ? { ...r, best: b } : null;
  }

  /* Snapshot of every rank as of a date (defaults to now). Category = your best ranked exercise
   * in that muscle group; overall = weighted mean of the groups you've trained. */
  function snapshot(date = todayISO()) {
    const bw = date === todayISO() ? currentBW() : bwAt(date);
    const exRanks = {};
    for (const ex of EXERCISES) {
      if (!ex.std) continue;
      let best = 0;
      for (const p of history(ex.id)) if (p.date <= date && p.best > best) best = p.best;
      const pp = profilePoint(ex.id, date);
      if (pp && pp.best > best) best = pp.best;
      if (best > 0) exRanks[ex.id] = rankOf(ex.id, best, bw);
    }
    const cats = {};
    for (const c of CATEGORIES) {
      const list = EXERCISES.filter((e) => e.cat === c.id && exRanks[e.id]).map((e) => ({ ex: e, r: exRanks[e.id] }));
      if (!list.length) continue;
      list.sort((a, b) => b.r.pct - a.r.pct);
      cats[c.id] = { cat: c, top: list[0], list, rank: rankFromPct(list[0].r.pct) };
    }
    const present = Object.values(cats);
    let overall = null;
    if (present.length) {
      const wsum = present.reduce((s, c) => s + c.cat.weight, 0);
      const pct = present.reduce((s, c) => s + c.rank.pct * c.cat.weight, 0) / wsum;
      overall = { ...rankFromPct(pct), coverage: present.length };
    }
    return { exRanks, cats, overall, bw };
  }

  /* ── stats ── */
  function weekStreak() {
    const weeks = new Set(api.state.workouts.map((w) => weekStart(w.date)));
    let wk = weekStart(todayISO());
    if (!weeks.has(wk)) wk = addDays(wk, -7);
    let n = 0;
    while (weeks.has(wk)) { n++; wk = addDays(wk, -7); }
    return n;
  }
  function sessionsThisWeek() { const ws = weekStart(todayISO()); return api.state.workouts.filter((w) => weekStart(w.date) === ws).length; }
  function prsSince(days) {
    const cutoff = addDays(todayISO(), -days), out = [];
    for (const id of Object.keys(derived().byEx)) for (const p of history(id)) if (p.pr && !p.firstEver && p.date >= cutoff) out.push({ ex: exById(id), p });
    return out.sort((a, b) => b.p.date.localeCompare(a.p.date));
  }
  function trend(exId, windowDays = 120) {
    const cutoff = addDays(todayISO(), -windowDays);
    const pts = history(exId).filter((p) => p.date >= cutoff);
    if (pts.length < 3) return null;
    const x0 = parseDate(pts[0].date).getTime();
    const xs = pts.map((p) => (parseDate(p.date) - x0) / DAY), ys = pts.map((p) => p.best);
    if (xs.at(-1) < 14) return null;
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    return den ? { perDay: num / den, perMonth: (num / den) * 30, n } : null;
  }
  function volumeByWeek(weeks = 12) {
    const end = weekStart(todayISO()), map = {};
    for (const w of api.state.workouts) {
      const k = weekStart(w.date), bw = bwAt(w.date);
      for (const en of w.entries) {
        const ex = exById(en.ex);
        for (const s of en.sets) if (s.r > 0) map[k] = (map[k] || 0) + (ex.kind === 'bw' ? bw + (s.w || 0) : s.w || 0) * s.r * (ex.kind === 'db' ? 2 : 1);
      }
    }
    return Array.from({ length: weeks }, (_, i) => { const k = addDays(end, -7 * (weeks - 1 - i)); return { k, v: map[k] || 0 }; });
  }
  function setsByCategory(days = 7) {
    const cutoff = addDays(todayISO(), -(days - 1)), out = {};
    for (const w of api.state.workouts) if (w.date >= cutoff) for (const en of w.entries) {
      const c = exById(en.ex).cat;
      out[c] = (out[c] || 0) + en.sets.filter((s) => s.r > 0).length;
    }
    return out;
  }
  function rankTimeline(maxWeeks = 26) {
    const ws = api.state.workouts;
    if (!ws.length) return [];
    const first = ws.reduce((a, w) => (w.date < a ? w.date : a), ws[0].date);
    const end = todayISO();
    const weeks = Math.min(maxWeeks, Math.ceil(daysBetween(first, end) / 7) + 1);
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = i === 0 ? end : addDays(end, -7 * i);
      if (d < first) continue;
      const s = snapshot(d);
      if (s.overall) out.push({ date: d, pct: s.overall.pct, label: s.overall.label, tier: s.overall.tier });
    }
    return out;
  }

  Object.assign(api, {
    TIERS, CATEGORIES, EXERCISES, STEPS, ROMAN, KG_PER_LB, DAY,
    pad, localISO, todayISO, parseDate, addDays, daysBetween, weekStart, clamp, uid, clone, round,
    save, replaceState, tombstoneMissing, normalize, DEFAULT,
    unit, toDisp, fromDisp, wNum, fmtW, plateUp,
    allExercises, exById, catById, isRanked,
    currentBW, bwAt, e1rm, eqReps, setMetric, fmtMetric,
    anchors, toPct, fromPct, rankFromPct, rankOf, stepLabel,
    derived, history, bestOf, bestKnown, profilePoint, trainedExercises, liftRank, snapshot,
    weekStreak, sessionsThisWeek, prsSince, trend, volumeByWeek, setsByCategory, rankTimeline,
  });
  return api;
})();
