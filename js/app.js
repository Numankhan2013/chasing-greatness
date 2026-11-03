'use strict';
(() => {
  const { TIERS, UNRANKED, EXERCISES } = window.CG_DATA;
  const KG_PER_LB = 0.45359237;
  const STORE_KEY = 'chasing-greatness.v1';
  const DAY = 86400000;

  /* ───────────────────────── helpers ───────────────────────── */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad = (n) => String(n).padStart(2, '0');
  const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => localISO(new Date());
  const parseDate = (iso) => new Date(iso + 'T00:00:00');
  const addDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return localISO(d); };
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);
  const weekStart = (iso) => { const d = parseDate(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return localISO(d); };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (iso, withYear) => { const d = parseDate(iso); return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? ', ' + d.getFullYear() : ''}`; };
  const relDate = (iso) => {
    const n = daysBetween(iso, todayISO());
    if (n === 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n > 1 && n < 7) return `${n} days ago`;
    return fmtDate(iso, parseDate(iso).getFullYear() !== new Date().getFullYear());
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ───────────────────────── state ───────────────────────── */
  const DEFAULT = {
    version: 1,
    profile: { name: '', sex: 'male', unit: 'lb', bodyweight: null },
    workouts: [],      // {id, date, notes, entries:[{ex, sets:[{w(kg), r}]}]}
    bodyweights: [],   // {date, kg}
    custom: [],        // {id, name}
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* storage blocked or corrupt — start fresh */ }
    return clone(DEFAULT);
  }
  function normalize(s) {
    const base = clone(DEFAULT);
    return {
      ...base, ...s,
      profile: { ...base.profile, ...(s.profile || {}) },
      workouts: Array.isArray(s.workouts) ? s.workouts : [],
      bodyweights: Array.isArray(s.bodyweights) ? s.bodyweights : [],
      custom: Array.isArray(s.custom) ? s.custom : [],
    };
  }
  let state = load();
  let storageOK = true;
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); storageOK = true; }
    catch (e) { if (storageOK) toast('Heads up: this browser is blocking storage, so data won\'t persist.'); storageOK = false; }
    invalidate();
  }

  /* ───────────────────────── units ───────────────────────── */
  const unit = () => state.profile.unit;
  const toDisp = (kg) => (unit() === 'lb' ? kg / KG_PER_LB : kg);
  const fromDisp = (v) => (unit() === 'lb' ? v * KG_PER_LB : v);
  const round = (x, d = 0) => { const p = 10 ** d; return Math.round(x * p) / p; };
  const wNum = (kg) => round(toDisp(kg), unit() === 'lb' ? 0 : 1);
  const fmtW = (kg) => `${wNum(kg).toLocaleString()} ${unit()}`;
  const plateUp = (kg) => { const step = unit() === 'lb' ? 5 : 2.5; return fromDisp(Math.ceil(toDisp(kg) / step) * step); };

  /* ───────────────────────── exercises ───────────────────────── */
  const allExercises = () => EXERCISES.concat(state.custom.map((c) => ({ ...c, group: 'Custom', custom: true })));
  const exById = (id) => allExercises().find((e) => e.id === id);
  const exName = (id) => exById(id)?.name ?? 'Unknown exercise';
  const RANKED = EXERCISES.filter((e) => e.ranked);

  /* ───────────────────────── strength math ───────────────────────── */
  // Epley estimate; beyond ~12 reps estimates get shaky, so we cap the rep count used.
  const e1rm = (w, r) => (!w || !r ? 0 : r === 1 ? w : w * (1 + Math.min(r, 15) / 30));

  function currentBW() {
    if (state.bodyweights.length) return [...state.bodyweights].sort((a, b) => a.date.localeCompare(b.date)).at(-1).kg;
    return state.profile.bodyweight;
  }
  function bwAt(date) {
    let best = null;
    for (const b of state.bodyweights) if (b.date <= date && (!best || b.date > best.date)) best = b;
    return best ? best.kg : currentBW();
  }

  function tierInfo(i) { return i < 0 ? UNRANKED : TIERS[i]; }

  function thresholds(exId, sex = state.profile.sex) {
    const ex = EXERCISES.find((e) => e.id === exId);
    if (!ex?.ranked) return null;
    return ex.std.map((r) => r * (sex === 'female' ? ex.f : 1));
  }

  function rankOf(exId, liftKg, bwKg, sex) {
    const t = thresholds(exId, sex);
    if (!t || !bwKg || !liftKg) return null;
    const ratio = liftKg / bwKg;
    let i = -1;
    while (i + 1 < t.length && ratio >= t[i + 1]) i++;
    let frac;
    if (i === -1) frac = ratio / t[0];
    else if (i === t.length - 1) frac = Math.min(0.999, (ratio - t[i]) / (t[i] - t[i - 1]));
    else frac = (ratio - t[i]) / (t[i + 1] - t[i]);
    const nextKg = i < t.length - 1 ? t[i + 1] * bwKg : null;
    return { tier: i, frac: clamp(frac, 0, 0.999), score: i + clamp(frac, 0, 0.999), ratio, nextKg, needKg: nextKg ? Math.max(0, nextKg - liftKg) : 0, tKg: t.map((r) => r * bwKg) };
  }

  /* Derived per-exercise history, memoised until the next save. */
  let memo = null;
  function invalidate() { memo = null; }
  function derived() {
    if (memo) return memo;
    const byEx = {};
    const sorted = [...state.workouts].sort((a, b) => a.date.localeCompare(b.date));
    for (const w of sorted) {
      for (const en of w.entries) {
        let best = 0, top = null, vol = 0, sets = 0;
        for (const s of en.sets) {
          if (!s.w && !s.r) continue;
          const est = e1rm(s.w, s.r);
          vol += (s.w || 0) * (s.r || 0); sets++;
          if (est > best) { best = est; top = s; }
        }
        if (!sets) continue;
        (byEx[en.ex] ||= []).push({ date: w.date, wid: w.id, best, top, vol, sets });
      }
    }
    // Merge same-day sessions and mark PRs.
    for (const id of Object.keys(byEx)) {
      const merged = [];
      for (const p of byEx[id]) {
        const last = merged.at(-1);
        if (last && last.date === p.date) {
          last.vol += p.vol; last.sets += p.sets;
          if (p.best > last.best) { last.best = p.best; last.top = p.top; }
        } else merged.push({ ...p });
      }
      let run = 0;
      for (const p of merged) { p.pr = p.best > run + 1e-9; if (p.pr) run = p.best; p.runBest = run; }
      byEx[id] = merged;
    }
    memo = { byEx, sorted };
    return memo;
  }
  const history = (exId) => derived().byEx[exId] || [];
  function bestOf(exId) {
    const h = history(exId);
    if (!h.length) return null;
    return h.reduce((a, b) => (b.best > a.best ? b : a));
  }
  function liftRank(exId, sex) {
    const b = bestOf(exId);
    if (!b) return null;
    const r = rankOf(exId, b.best, currentBW(), sex);
    return r ? { ...r, best: b } : null;
  }
  function overall() {
    const ranks = RANKED.map((e) => liftRank(e.id)).filter(Boolean);
    if (!ranks.length) return null;
    const score = ranks.reduce((s, r) => s + r.score, 0) / ranks.length;
    const tier = clamp(Math.floor(score), -1, TIERS.length - 1);
    return { score, tier, frac: score - tier, count: ranks.length };
  }

  /* ───────────────────────── icons + badges ───────────────────────── */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    fire: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    scale: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a6 6 0 0 1 8 0l-2 3h-4z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  let badgeSeq = 0;
  function badge(tier, size = 56) {
    const t = tierInfo(tier);
    const id = 'bg' + ++badgeSeq;
    const glyph = t.glyph;
    const fs = glyph.length >= 3 ? 15 : glyph.length === 2 ? 18 : 22;
    return `<svg class="badge" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${esc(t.name)} rank">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.color}"/><stop offset="1" stop-color="${t.color}" stop-opacity=".55"/></linearGradient></defs>
      <path d="M32 3l25 14v30L32 61 7 47V17z" fill="url(#${id})" stroke="${t.color}" stroke-width="1.5"/>
      <path d="M32 10l19 10.5v23L32 54 13 43.5v-23z" fill="rgba(10,12,18,.55)"/>
      ${tier >= 4 ? `<path d="M32 10l19 10.5v23L32 54 13 43.5v-23z" fill="none" stroke="${t.color}" stroke-opacity=".6" stroke-width="1"/>` : ''}
      <text x="32" y="${32 + fs * 0.36}" text-anchor="middle" font-family="var(--font-display)" font-weight="800" font-size="${fs}" fill="${t.color}">${glyph}</text>
    </svg>`;
  }
  const tierChip = (tier) => { const t = tierInfo(tier); return `<span class="chip" style="--c:${t.color}">${esc(t.name)}</span>`; };
  const bar = (frac, color) => `<div class="bar"><span style="width:${round(clamp(frac, 0, 1) * 100, 1)}%;--c:${color}"></span></div>`;

  /* ───────────────────────── charts ───────────────────────── */
  function lineChart(pts, { refs = [], h = 240, color = 'var(--accent)', fmt = (v) => v } = {}) {
    if (!pts.length) return `<div class="empty-chart">No data yet</div>`;
    const W = 640, H = h, pl = 46, pr = 14, pt = 14, pb = 28;
    let xs = pts.map((p) => p.x), ys = pts.map((p) => p.y).concat(refs.map((r) => r.y));
    let xmin = Math.min(...xs), xmax = Math.max(...xs);
    if (xmax === xmin) { xmin -= 3 * DAY; xmax += 3 * DAY; }
    let ymin = Math.min(...ys), ymax = Math.max(...ys);
    const span = ymax - ymin || ymax * 0.2 || 1;
    ymin -= span * 0.12; ymax += span * 0.12;
    const X = (x) => pl + ((x - xmin) / (xmax - xmin)) * (W - pl - pr);
    const Y = (y) => pt + (1 - (y - ymin) / (ymax - ymin)) * (H - pt - pb);
    const gid = 'lg' + ++badgeSeq;
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = ymin + ((ymax - ymin) * i) / 4;
      grid += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pl - 8}" y="${Y(v) + 4}" text-anchor="end" class="axis">${esc(fmt(v))}</text>`;
    }
    const xl = [xmin, (xmin + xmax) / 2, xmax].map((x, i) => {
      const iso = localISO(new Date(x));
      return `<text x="${X(x)}" y="${H - 8}" text-anchor="${['start', 'middle', 'end'][i]}" class="axis">${fmtDate(iso)}</text>`;
    }).join('');
    const refSvg = refs.map((r) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="${r.color}" stroke-dasharray="4 5" stroke-opacity=".75"/><text x="${W - pr - 4}" y="${Y(r.y) - 5}" text-anchor="end" class="ref" fill="${r.color}">${esc(r.label)}</text>`).join('');
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    const area = `${d}L${X(pts.at(-1).x).toFixed(1)},${H - pb}L${X(pts[0].x).toFixed(1)},${H - pb}Z`;
    const dots = pts.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.pr ? 4.5 : 3}" class="${p.pr ? 'dot pr' : 'dot'}"><title>${esc(p.label || '')}</title></circle>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${grid}${refSvg}<path d="${area}" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xl}
    </svg>`;
  }

  function barChart(items, { h = 180, fmt = (v) => v } = {}) {
    if (!items.length || items.every((i) => !i.v)) return `<div class="empty-chart">No data yet</div>`;
    const W = 640, H = h, pl = 46, pr = 10, pt = 10, pb = 26;
    const max = Math.max(...items.map((i) => i.v)) * 1.1 || 1;
    const bw = (W - pl - pr) / items.length;
    let out = '';
    for (let i = 0; i <= 3; i++) {
      const v = (max * i) / 3, y = pt + (1 - v / max) * (H - pt - pb);
      out += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="grid"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end" class="axis">${esc(fmt(v))}</text>`;
    }
    items.forEach((it, i) => {
      const bh = (it.v / max) * (H - pt - pb);
      const x = pl + i * bw + bw * 0.18;
      out += `<rect x="${x.toFixed(1)}" y="${(H - pb - bh).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}" rx="3" class="${i === items.length - 1 ? 'barr cur' : 'barr'}"><title>${esc(it.title)}</title></rect>`;
      if (i % Math.ceil(items.length / 6) === 0 || i === items.length - 1) out += `<text x="${(x + bw * 0.32).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis">${esc(it.label)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
  }

  function heatmap(weeks = 26) {
    const counts = {};
    for (const w of state.workouts) counts[w.date] = (counts[w.date] || 0) + 1;
    const end = weekStart(todayISO());
    const start = addDays(end, -7 * (weeks - 1));
    const cs = 13, gap = 3, pl = 22, pt = 16;
    let out = '';
    ['M', '', 'W', '', 'F', '', ''].forEach((l, i) => { if (l) out += `<text x="0" y="${pt + i * (cs + gap) + 10}" class="axis">${l}</text>`; });
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const ws = addDays(start, w * 7);
      const m = parseDate(ws).getMonth();
      if (m !== lastMonth) { out += `<text x="${pl + w * (cs + gap)}" y="10" class="axis">${MONTHS[m]}</text>`; lastMonth = m; }
      for (let d = 0; d < 7; d++) {
        const iso = addDays(ws, d);
        if (iso > todayISO()) continue;
        const c = counts[iso] || 0;
        out += `<rect x="${pl + w * (cs + gap)}" y="${pt + d * (cs + gap)}" width="${cs}" height="${cs}" rx="3" class="hm l${Math.min(c, 2)}"><title>${fmtDate(iso, true)}: ${c ? c + ' session' + (c > 1 ? 's' : '') : 'rest'}</title></rect>`;
      }
    }
    const W = pl + weeks * (cs + gap), H = pt + 7 * (cs + gap);
    return `<svg class="heatmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Training calendar">${out}</svg>`;
  }

  /* ───────────────────────── stats + insights ───────────────────────── */
  function weekStreak() {
    const weeks = new Set(state.workouts.map((w) => weekStart(w.date)));
    let wk = weekStart(todayISO());
    if (!weeks.has(wk)) wk = addDays(wk, -7); // current week still in play
    let n = 0;
    while (weeks.has(wk)) { n++; wk = addDays(wk, -7); }
    return n;
  }
  function prsSince(days) {
    const cutoff = addDays(todayISO(), -days);
    let n = 0;
    for (const id of Object.keys(derived().byEx)) {
      const h = history(id);
      h.forEach((p, i) => { if (p.pr && i > 0 && p.date >= cutoff) n++; });
    }
    return n;
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
    if (!den) return null;
    return { perDay: num / den, perMonth: (num / den) * 30, n };
  }
  function volumeByWeek(weeks = 12) {
    const end = weekStart(todayISO());
    const map = {};
    for (const w of state.workouts) {
      const k = weekStart(w.date);
      for (const en of w.entries) for (const s of en.sets) map[k] = (map[k] || 0) + (s.w || 0) * (s.r || 0);
    }
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) { const k = addDays(end, -7 * i); out.push({ k, v: map[k] || 0 }); }
    return out;
  }

  function insights() {
    const out = [];
    const today = todayISO();
    const ws = state.workouts;
    if (!ws.length) return [{ tone: 'info', icon: 'bolt', title: 'Insights unlock as you log', body: 'Log a few sessions and this page starts spotting trends, stalls, and your projected next rank-up.' }];

    const streak = weekStreak();
    if (streak >= 2) out.push({ tone: 'good', icon: 'fire', title: `${streak}-week streak`, body: `You've trained every week for ${streak} weeks straight. Consistency is the cheat code — keep the chain alive.` });

    const lastDate = [...ws].sort((a, b) => b.date.localeCompare(a.date))[0].date;
    const gap = daysBetween(lastDate, today);
    if (gap >= 5) out.push({ tone: 'warn', icon: 'calendar', title: `${gap} days since your last session`, body: 'Strength fades slower than you fear, but momentum fades fast. Even a short session today counts.' });

    // Projections + stalls per ranked lift.
    const projections = [];
    for (const ex of RANKED) {
      const r = liftRank(ex.id);
      if (!r) continue;
      const t = trend(ex.id);
      const h = history(ex.id);
      const lastPR = [...h].reverse().find((p) => p.pr);
      const sincePR = lastPR ? daysBetween(lastPR.date, today) : 0;
      const lastTrained = h.at(-1).date;
      if (daysBetween(lastTrained, today) >= 14) {
        out.push({ tone: 'warn', icon: 'warn', title: `${ex.short} is getting neglected`, body: `You haven't trained ${ex.name.toLowerCase()} in ${daysBetween(lastTrained, today)} days. Ranks are earned and kept.` });
      } else if (sincePR >= 28 && h.length >= 4) {
        out.push({ tone: 'warn', icon: 'target', title: `${ex.short} has stalled`, body: `No ${ex.short.toLowerCase()} PR in ${Math.round(sincePR / 7)} weeks. Try a deload week, a rep-range change (e.g. 5×5 → 4×8), or more food and sleep.` });
      }
      if (t && t.perMonth > 0.2 && r.nextKg) {
        const days = r.needKg / t.perDay;
        projections.push({ ex, r, t, days });
      } else if (t && t.perMonth < -0.5) {
        out.push({ tone: 'warn', icon: 'warn', title: `${ex.short} is trending down`, body: `Your estimated max is slipping about ${fmtW(-t.perMonth)}/month. Check recovery — sleep, food, and stress all show up here first.` });
      }
    }
    projections.sort((a, b) => a.days - b.days);
    for (const p of projections.slice(0, 3)) {
      const next = TIERS[p.r.tier + 1];
      const when = p.days < 7 ? 'within a week' : p.days < 60 ? `in about ${Math.round(p.days / 7)} weeks` : p.days < 730 ? `in about ${Math.round(p.days / 30)} months` : 'eventually — keep grinding';
      out.push({ tone: 'good', icon: 'up', title: `${p.ex.short}: ${next.name} ${when}`, body: `You're adding ~${fmtW(p.t.perMonth)}/month to your estimated max. ${fmtW(plateUp(p.r.nextKg))} unlocks <b style="color:${next.color}">${next.name}</b> — ${fmtW(p.r.needKg)} to go.` });
    }

    // Balance check.
    const ranked = RANKED.map((e) => ({ e, r: liftRank(e.id) })).filter((x) => x.r);
    if (ranked.length >= 3) {
      ranked.sort((a, b) => b.r.score - a.r.score);
      const top = ranked[0], low = ranked.at(-1);
      if (top.r.score - low.r.score >= 1.5) out.push({ tone: 'info', icon: 'target', title: `${low.e.short} is your weak link`, body: `Your ${top.e.short.toLowerCase()} is ${tierInfo(top.r.tier).name}-level but ${low.e.short.toLowerCase()} is ${tierInfo(low.r.tier).name}. Bringing it up is the fastest way to raise your overall rank.` });
      else out.push({ tone: 'good', icon: 'trophy', title: 'Well-balanced strength', body: `Your lifts are within ${round(top.r.score - low.r.score, 1)} tier${round(top.r.score - low.r.score, 1) === 1 ? '' : 's'} of each other. Balanced lifters get hurt less and progress longer.` });
    }

    // Volume trend: last 4 weeks vs the 4 before.
    const vol = volumeByWeek(8);
    const a = vol.slice(0, 4).reduce((s, x) => s + x.v, 0), b = vol.slice(4).reduce((s, x) => s + x.v, 0);
    if (a > 0 && b > 0) {
      const pct = ((b - a) / a) * 100;
      if (Math.abs(pct) >= 10) out.push({ tone: pct > 0 ? 'good' : 'info', icon: 'chart', title: `Volume ${pct > 0 ? 'up' : 'down'} ${Math.abs(round(pct))}%`, body: `You moved ${fmtW(b)} over the last 4 weeks vs ${fmtW(a)} the 4 weeks before.${pct < -25 ? ' Planned deload? Great. Unplanned? Worth a look.' : ''}` });
    }

    const prs = prsSince(30);
    if (prs) out.push({ tone: 'good', icon: 'trophy', title: `${prs} PR${prs > 1 ? 's' : ''} in the last 30 days`, body: 'Estimated-max PRs across all exercises. That\'s the sound of progress.' });

    // Bodyweight trend.
    const bws = [...state.bodyweights].sort((x, y) => x.date.localeCompare(y.date)).filter((x) => x.date >= addDays(today, -60));
    if (bws.length >= 3) {
      const diff = bws.at(-1).kg - bws[0].kg;
      if (Math.abs(toDisp(diff)) >= 1) out.push({ tone: 'info', icon: 'scale', title: `Bodyweight ${diff > 0 ? 'up' : 'down'} ${fmtW(Math.abs(diff))}`, body: `Over the last ${daysBetween(bws[0].date, bws.at(-1).date)} days. Ranks scale with bodyweight, so ${diff > 0 ? 'your lifts need to climb to keep pace' : 'every pound lost makes your current lifts count for more'}.` });
    }
    return out;
  }

  /* ───────────────────────── UI chrome ───────────────────────── */
  const NAV = [
    { r: 'home', label: 'Home', icon: 'home' },
    { r: 'log', label: 'Log', icon: 'plus' },
    { r: 'progress', label: 'Progress', icon: 'chart' },
    { r: 'insights', label: 'Insights', icon: 'bulb' },
    { r: 'calc', label: 'Rank Calc', icon: 'trophy' },
    { r: 'history', label: 'History', icon: 'clock', desk: true },
    { r: 'settings', label: 'Settings', icon: 'gear', desk: true },
  ];
  function renderNav(route) {
    $('#nav').innerHTML = NAV.map((n) => `<a href="#/${n.r}" class="${n.r === route ? 'on' : ''} ${n.desk ? 'desk' : ''}" ${n.r === route ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></a>`).join('');
    $('#mobile-actions').innerHTML = `<a href="#/history" aria-label="History" class="${route === 'history' ? 'on' : ''}">${icon('clock')}</a><a href="#/settings" aria-label="Settings" class="${route === 'settings' ? 'on' : ''}">${icon('gear')}</a>`;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.innerHTML = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function celebrate({ tier, title, sub }) {
    const t = tierInfo(tier);
    const el = $('#celebrate');
    const confetti = Array.from({ length: 40 }, (_, i) => `<i style="--x:${Math.random() * 100}%;--d:${(Math.random() * 0.8).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${i % 3 ? t.color : '#fff'}"></i>`).join('');
    el.innerHTML = `<div class="confetti">${confetti}</div><div class="cel-card" style="--c:${t.color}">
      <div class="cel-kicker">${esc(title)}</div>${badge(tier, 132)}<div class="cel-tier" style="color:${t.color}">${esc(t.name)}</div>
      <p>${sub}</p><button class="btn primary" data-act="close-cel">Let's go</button></div>`;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
  }

  /* ───────────────────────── views ───────────────────────── */
  const views = {};

  function setupCard() {
    const p = state.profile;
    return `<section class="card setup">
      <h2>Let's set you up</h2>
      <p class="muted">Ranks compare what you lift to what you weigh, so we need a couple of numbers. Everything stays in this browser — no account, no subscription, no tracking.</p>
      <form id="setup-form" class="grid-form">
        <label>Name <input name="name" value="${esc(p.name)}" placeholder="Optional" autocomplete="given-name"></label>
        <label>Units <select name="unit"><option value="lb" ${p.unit === 'lb' ? 'selected' : ''}>Pounds (lb)</option><option value="kg" ${p.unit === 'kg' ? 'selected' : ''}>Kilograms (kg)</option></select></label>
        <label>Sex (for standards) <select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
        <label>Bodyweight <input name="bw" type="number" inputmode="decimal" step="0.1" min="20" required placeholder="e.g. 180"></label>
        <div class="row-actions"><button class="btn primary" type="submit">Start tracking</button><button class="btn ghost" type="button" data-act="demo">Explore with demo data</button></div>
      </form>
    </section>`;
  }

  views.home = () => {
    if (!currentBW()) return setupCard();
    const o = overall();
    const name = state.profile.name ? `, ${esc(state.profile.name)}` : '';
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const thisWeek = state.workouts.filter((w) => weekStart(w.date) === weekStart(todayISO())).length;
    const ot = tierInfo(o ? o.tier : -1);
    const next = o && o.tier < TIERS.length - 1 ? TIERS[o.tier + 1] : null;

    const hero = `<section class="hero card" style="--c:${ot.color}">
      <div class="hero-badge">${badge(o ? o.tier : -1, 112)}</div>
      <div class="hero-body">
        <div class="kicker">${greet}${name}</div>
        <h1 style="color:${ot.color}">${o ? ot.name : 'Unranked'}</h1>
        <p class="muted">${o ? `${esc(ot.blurb)} Overall rank across ${o.count} of ${RANKED.length} ranked lifts.` : 'Log any of the big five lifts to earn your first rank.'}</p>
        ${o ? `<div class="hero-progress">${bar(o.frac, ot.color)}<div class="bar-meta"><span>Strength score <b>${round(o.score + 1, 2)}</b></span><span>${next ? `Next: <b style="color:${next.color}">${next.name}</b>` : 'Max rank'}</span></div></div>` : `<a class="btn primary" href="#/log">${icon('plus')} Log your first workout</a>`}
      </div>
    </section>`;

    const stats = `<section class="stats">
      <div class="stat"><div class="stat-v">${state.workouts.length}</div><div class="stat-l">Sessions</div></div>
      <div class="stat"><div class="stat-v">${thisWeek}</div><div class="stat-l">This week</div></div>
      <div class="stat"><div class="stat-v">${weekStreak()}${icon('fire', 'tiny')}</div><div class="stat-l">Week streak</div></div>
      <div class="stat"><div class="stat-v">${prsSince(30)}</div><div class="stat-l">PRs · 30d</div></div>
    </section>`;

    const lifts = RANKED.map((ex) => {
      const r = liftRank(ex.id);
      if (!r) return `<a class="lift card empty" href="#/log?ex=${ex.id}">${badge(-1, 52)}<div class="lift-body"><div class="lift-name">${ex.name}</div><div class="muted small">Not logged yet — tap to log</div></div></a>`;
      const t = tierInfo(r.tier), n = r.tier < TIERS.length - 1 ? TIERS[r.tier + 1] : null;
      return `<a class="lift card" href="#/progress?ex=${ex.id}" style="--c:${t.color}">
        ${badge(r.tier, 52)}
        <div class="lift-body">
          <div class="lift-top"><span class="lift-name">${ex.name}</span>${tierChip(r.tier)}</div>
          <div class="lift-nums"><b>${fmtW(r.best.best)}</b> <span class="muted">est. 1RM · ${round(r.ratio, 2)}× BW</span></div>
          ${bar(r.tier < 0 ? r.frac : r.frac, t.color)}
          <div class="muted small">${n ? `+${fmtW(plateUp(r.nextKg) - r.best.best)} to <span style="color:${n.color}">${n.name}</span>` : 'Top of the mountain.'}</div>
        </div></a>`;
    }).join('');

    const recent = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    return `${hero}${stats}
      <div class="section-head"><h2>Your ranks</h2><a href="#/calc" class="link">How ranks work</a></div>
      <section class="lifts">${lifts}</section>
      <div class="two-col">
        <section class="card"><div class="section-head"><h2>Consistency</h2><span class="muted small">Last 6 months</span></div>${heatmap()}</section>
        <section class="card"><div class="section-head"><h2>Recent</h2><a href="#/history" class="link">See all</a></div>
          ${recent.length ? recent.map(workoutRow).join('') : '<p class="muted">Nothing logged yet.</p>'}</section>
      </div>`;
  };

  function summarizeEntry(en) {
    const sets = en.sets.filter((s) => s.w || s.r);
    if (!sets.length) return '';
    const same = sets.every((s) => s.w === sets[0].w && s.r === sets[0].r);
    const body = same ? `${sets.length}×${sets[0].r} @ ${fmtW(sets[0].w)}` : sets.map((s) => `${wNum(s.w)}×${s.r}`).join(', ') + ` ${unit()}`;
    return `<span class="ex-pill"><b>${esc(exName(en.ex))}</b> ${body}</span>`;
  }
  function workoutRow(w) {
    return `<div class="wo"><div class="wo-date">${relDate(w.date)}</div><div class="wo-body">${w.entries.map(summarizeEntry).join('')}${w.notes ? `<div class="muted small note">“${esc(w.notes)}”</div>` : ''}</div></div>`;
  }

  /* ── Log ── */
  let draft = null;
  const blankEntry = (ex = 'bench') => ({ ex, sets: [{ w: '', r: '' }, { w: '', r: '' }, { w: '', r: '' }] });
  function newDraft(params) {
    if (params.id) {
      const w = state.workouts.find((x) => x.id === params.id);
      if (w) return { id: w.id, date: w.date, notes: w.notes || '', entries: w.entries.map((en) => ({ ex: en.ex, sets: en.sets.map((s) => ({ w: s.w ? String(wNum(s.w)) : '', r: s.r ? String(s.r) : '' })) })) };
    }
    return { id: null, date: todayISO(), notes: '', entries: [blankEntry(params.ex || 'bench')] };
  }
  function exOptions(sel) {
    const groups = {};
    for (const e of allExercises()) (groups[e.group] ||= []).push(e);
    return Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}${e.ranked ? ' ★' : ''}</option>`).join('')}</optgroup>`).join('') + `<option value="__new">+ Add custom exercise…</option>`;
  }
  function lastTime(exId) {
    const h = history(exId).filter((p) => !draft?.id || p.wid !== draft.id);
    const p = h.at(-1);
    if (!p) return '';
    const w = state.workouts.find((x) => x.id === p.wid);
    const en = w?.entries.find((e) => e.ex === exId);
    return en ? `Last time (${relDate(p.date).toLowerCase()}): ${summarizeEntry(en).replace(/<b>.*?<\/b>/, '').replace(/<[^>]+>/g, '').trim()}` : '';
  }
  function entryPreview(en) {
    let best = 0;
    for (const s of en.sets) { const w = parseFloat(s.w), r = parseInt(s.r, 10); if (w > 0 && r > 0) best = Math.max(best, e1rm(fromDisp(w), r)); }
    if (!best) return '';
    const prev = bestOf(en.ex);
    const isPR = !prev || best > prev.best + 1e-6 || (draft.id && prev.wid === draft.id);
    const r = rankOf(en.ex, best, bwAt(draft.date) || currentBW());
    return `<span>Est. 1RM <b>${fmtW(best)}</b></span>${r ? tierChip(r.tier) : ''}${isPR && prev && best > prev.best + 1e-6 ? '<span class="chip pr">PR!</span>' : ''}`;
  }
  function renderLogForm() {
    const d = draft;
    return `<form id="log-form" autocomplete="off">
      <div class="log-head card">
        <label>Date <input type="date" name="date" value="${d.date}" max="${todayISO()}" required></label>
        <label class="grow">Notes <input name="notes" value="${esc(d.notes)}" placeholder="How did it feel?"></label>
      </div>
      ${d.entries.map((en, ei) => `<section class="card entry" data-e="${ei}">
        <div class="entry-head">
          <select data-f="ex" aria-label="Exercise">${exOptions(en.ex)}</select>
          <button type="button" class="icon-btn" data-act="rm-entry" data-e="${ei}" aria-label="Remove exercise">${icon('x')}</button>
        </div>
        <div class="muted small last">${esc(lastTime(en.ex))}</div>
        <div class="sets">
          <div class="set-row head"><span>Set</span><span>Weight (${unit()})</span><span>Reps</span><span></span></div>
          ${en.sets.map((s, si) => `<div class="set-row" data-s="${si}">
            <span class="set-n">${si + 1}</span>
            <input type="number" inputmode="decimal" step="any" min="0" data-f="w" value="${esc(s.w)}" placeholder="0" aria-label="Weight set ${si + 1}">
            <input type="number" inputmode="numeric" step="1" min="0" data-f="r" value="${esc(s.r)}" placeholder="0" aria-label="Reps set ${si + 1}">
            <button type="button" class="icon-btn" data-act="rm-set" data-e="${ei}" data-s="${si}" aria-label="Remove set">${icon('x')}</button>
          </div>`).join('')}
        </div>
        <div class="entry-foot"><button type="button" class="btn ghost sm" data-act="add-set" data-e="${ei}">${icon('plus')} Add set</button><div class="preview" data-preview="${ei}">${entryPreview(en)}</div></div>
      </section>`).join('')}
      <button type="button" class="btn ghost wide" data-act="add-entry">${icon('plus')} Add exercise</button>
      <div class="save-bar"><button class="btn primary wide" type="submit">${d.id ? 'Save changes' : 'Finish workout'}</button>${d.id ? `<button type="button" class="btn ghost" data-act="cancel-edit">Cancel</button>` : ''}</div>
    </form>`;
  }
  views.log = (params) => {
    if (!currentBW()) return setupCard();
    if (!draft || (params.id && draft.id !== params.id) || (!params.id && draft.id) || (params.ex && !draft.id && draft.entries.length === 1 && !draft.entries[0].sets.some((s) => s.w || s.r))) draft = newDraft(params);
    return `<div class="section-head page-head"><h1>${draft.id ? 'Edit workout' : 'Log workout'}</h1><span class="muted small">★ = ranked lift</span></div>${renderLogForm()}`;
  };

  function saveDraft() {
    const entries = draft.entries.map((en) => ({
      ex: en.ex,
      sets: en.sets.map((s) => ({ w: fromDisp(parseFloat(s.w) || 0), r: parseInt(s.r, 10) || 0 })).filter((s) => s.r > 0),
    })).filter((en) => en.sets.length);
    if (!entries.length) { toast('Add at least one set with reps before saving.'); return; }

    const before = Object.fromEntries(RANKED.map((e) => [e.id, liftRank(e.id)]));
    const beforeBest = Object.fromEntries(entries.map((en) => [en.ex, bestOf(en.ex)?.best || 0]));
    const overallBefore = overall();

    if (draft.id) {
      const w = state.workouts.find((x) => x.id === draft.id);
      Object.assign(w, { date: draft.date, notes: draft.notes.trim(), entries });
    } else {
      state.workouts.push({ id: uid(), date: draft.date, notes: draft.notes.trim(), entries });
    }
    const wasEdit = !!draft.id;
    draft = null;
    save();

    // PRs + rank-ups (only celebrate on new workouts).
    const prs = entries.filter((en) => beforeBest[en.ex] && (bestOf(en.ex)?.best || 0) > beforeBest[en.ex] + 1e-6).map((en) => exById(en.ex)?.short || exName(en.ex));
    const ups = RANKED.map((e) => ({ e, b: before[e.id], a: liftRank(e.id) })).filter((x) => x.a && (!x.b || x.a.tier > x.b.tier));
    const overallAfter = overall();
    location.hash = '#/home';
    if (!wasEdit && overallAfter && (!overallBefore || overallAfter.tier > overallBefore.tier)) {
      celebrate({ tier: overallAfter.tier, title: overallBefore ? 'Overall rank up' : 'You are ranked', sub: overallBefore ? `From ${tierInfo(overallBefore.tier).name} to <b>${tierInfo(overallAfter.tier).name}</b>. ${esc(tierInfo(overallAfter.tier).blurb)}` : esc(tierInfo(overallAfter.tier).blurb) });
    } else if (!wasEdit && ups.length) {
      const u = ups.sort((a, b) => b.a.tier - a.a.tier)[0];
      celebrate({ tier: u.a.tier, title: `${u.e.name} rank up`, sub: `${fmtW(u.a.best.best)} estimated max — that's <b>${tierInfo(u.a.tier).name}</b> territory.` });
    } else if (!wasEdit && prs.length) {
      toast(`${icon('trophy')} New PR${prs.length > 1 ? 's' : ''}: ${esc(prs.join(', '))}`);
    } else toast(wasEdit ? 'Workout updated.' : 'Workout saved. Nice work.');
  }

  /* ── History ── */
  views.history = () => {
    const ws = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
    if (!ws.length) return `<div class="section-head page-head"><h1>History</h1></div><section class="card"><p class="muted">No workouts yet.</p><a class="btn primary" href="#/log">${icon('plus')} Log one</a></section>`;
    let lastMonth = '';
    return `<div class="section-head page-head"><h1>History</h1><span class="muted small">${ws.length} sessions</span></div>` + ws.map((w) => {
      const d = parseDate(w.date), m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      const head = m !== lastMonth ? `<h3 class="month">${m}</h3>` : '';
      lastMonth = m;
      return `${head}<section class="card wo-card"><div class="wo-card-head"><div><b>${fmtDate(w.date, true)}</b> <span class="muted small">· ${relDate(w.date)}</span></div>
        <div><a class="icon-btn" href="#/log?id=${w.id}" aria-label="Edit">${icon('edit')}</a><button class="icon-btn" data-act="del-wo" data-id="${w.id}" aria-label="Delete">${icon('trash')}</button></div></div>
        <div class="wo-body">${w.entries.map(summarizeEntry).join('')}${w.notes ? `<div class="muted small note">“${esc(w.notes)}”</div>` : ''}</div></section>`;
    }).join('');
  };

  /* ── Progress ── */
  views.progress = (params) => {
    const trained = allExercises().filter((e) => history(e.id).length);
    if (!trained.length) return `<div class="section-head page-head"><h1>Progress</h1></div><section class="card"><p class="muted">Charts appear once you've logged a lift.</p><a class="btn primary" href="#/log">${icon('plus')} Log a workout</a></section>${bodyweightCard()}`;
    const sel = params.ex && history(params.ex).length ? params.ex : trained[0].id;
    const ex = exById(sel);
    const h = history(sel);
    const best = bestOf(sel);
    const bw = currentBW();
    const r = ex.ranked ? rankOf(sel, best.best, bw) : null;
    let refs = [];
    if (r) {
      const lo = Math.min(...h.map((p) => p.best)), hi = best.best;
      refs = r.tKg.map((y, i) => ({ y, i })).filter(({ y, i }) => (y >= lo * 0.92 && y <= hi) || i === r.tier + 1 || i === r.tier).map(({ y, i }) => ({ y, label: TIERS[i].name, color: TIERS[i].color }));
    }
    const color = r ? tierInfo(r.tier).color : 'var(--accent)';
    const pts = h.map((p) => ({ x: parseDate(p.date).getTime(), y: p.best, pr: p.pr, label: `${fmtDate(p.date, true)} — est. ${fmtW(p.best)} (top set ${wNum(p.top.w)}×${p.top.r})${p.pr ? ' · PR' : ''}` }));
    const first = h[0], t = trend(sel);
    const gain = best.best - first.best;
    const prList = h.filter((p) => p.pr).slice(-6).reverse();
    const vol = volumeByWeek(12);

    return `<div class="section-head page-head"><h1>Progress</h1></div>
      <div class="chips-scroll">${trained.map((e) => `<a href="#/progress?ex=${e.id}" class="pill ${e.id === sel ? 'on' : ''}">${esc(e.short || e.name)}</a>`).join('')}</div>
      <section class="card">
        <div class="section-head"><div><h2>${esc(ex.name)}</h2><div class="muted small">Estimated 1-rep max per session${r ? ' · dashed lines are rank thresholds at your bodyweight' : ''}</div></div>${r ? tierChip(r.tier) : ''}</div>
        ${lineChart(pts, { refs, color, fmt: (v) => wNum(v) })}
        <div class="mini-stats">
          <div><span class="muted small">Best</span><b>${fmtW(best.best)}</b></div>
          <div><span class="muted small">Since start</span><b class="${gain >= 0 ? 'pos' : 'neg'}">${gain >= 0 ? '+' : '−'}${fmtW(Math.abs(gain))}</b></div>
          <div><span class="muted small">Trend</span><b>${t ? `${t.perMonth >= 0 ? '+' : '−'}${fmtW(Math.abs(t.perMonth))}/mo` : '—'}</b></div>
          <div><span class="muted small">Sessions</span><b>${h.length}</b></div>
        </div>
      </section>
      <div class="two-col">
        <section class="card"><h2>PR timeline</h2>${prList.map((p) => `<div class="pr-row"><span>${icon('trophy', 'tiny gold')} ${fmtDate(p.date, true)}</span><span>${wNum(p.top.w)}×${p.top.r}</span><b>${fmtW(p.best)}</b></div>`).join('')}</section>
        <section class="card"><h2>Weekly volume</h2><div class="muted small">All exercises · weight × reps</div>${barChart(vol.map((v) => ({ v: toDisp(v.v), label: fmtDate(v.k), title: `Week of ${fmtDate(v.k)}: ${fmtW(v.v)}` })), { fmt: (v) => (v >= 1000 ? round(v / 1000, 1) + 'k' : round(v)) })}</section>
      </div>
      ${bodyweightCard()}`;
  };
  function bodyweightCard() {
    const bws = [...state.bodyweights].sort((a, b) => a.date.localeCompare(b.date));
    const pts = bws.map((b) => ({ x: parseDate(b.date).getTime(), y: b.kg, label: `${fmtDate(b.date, true)} — ${fmtW(b.kg)}` }));
    return `<section class="card"><div class="section-head"><div><h2>Bodyweight</h2><div class="muted small">Your ranks use your latest weigh-in</div></div>${currentBW() ? `<b>${fmtW(currentBW())}</b>` : ''}</div>
      ${bws.length > 1 ? lineChart(pts, { h: 180, color: '#7aa2ff', fmt: (v) => wNum(v) }) : ''}
      <form id="bw-form" class="inline-form"><input type="date" name="date" value="${todayISO()}" max="${todayISO()}" required><input type="number" name="bw" inputmode="decimal" step="0.1" min="20" placeholder="Weight (${unit()})" required><button class="btn primary sm">Log weigh-in</button></form></section>`;
  }

  /* ── Insights ── */
  views.insights = () => {
    const list = insights();
    return `<div class="section-head page-head"><h1>Insights</h1><span class="muted small">Updated live from your log</span></div>
      <section class="insights">${list.map((i) => `<article class="card insight ${i.tone}"><div class="ins-ic">${icon(i.icon)}</div><div><h3>${esc(i.title)}</h3><p>${i.body}</p></div></article>`).join('')}</section>`;
  };

  /* ── Rank calculator ── */
  let calc = null;
  views.calc = () => {
    if (!calc) calc = { ex: 'bench', w: unit() === 'lb' ? '225' : '100', r: '1', bw: currentBW() ? String(wNum(currentBW())) : (unit() === 'lb' ? '180' : '82'), sex: state.profile.sex };
    return `<div class="section-head page-head"><h1>Rank calculator</h1></div>
      <p class="muted lead">“If I lift 225, what am I?” — plug in any lift and bodyweight. Ranks are based on your estimated one-rep max relative to bodyweight, so a 225 bench means something very different at 150 vs 250.</p>
      <div class="two-col calc">
        <section class="card"><form id="calc-form" class="grid-form">
          <label>Lift <select name="ex">${RANKED.map((e) => `<option value="${e.id}" ${e.id === calc.ex ? 'selected' : ''}>${e.name}</option>`).join('')}</select></label>
          <label>Sex <select name="sex"><option value="male" ${calc.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${calc.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
          <label>Weight lifted (${unit()}) <input name="w" type="number" inputmode="decimal" step="any" min="0" value="${esc(calc.w)}"></label>
          <label>Reps <input name="r" type="number" inputmode="numeric" step="1" min="1" max="30" value="${esc(calc.r)}"></label>
          <label class="span2">Bodyweight (${unit()}) <input name="bw" type="number" inputmode="decimal" step="any" min="20" value="${esc(calc.bw)}"></label>
        </form></section>
        <section class="card calc-result" id="calc-result">${calcResult()}</section>
      </div>
      <section class="card"><h2>How ranks work</h2>
        <p class="muted">Each ranked lift has seven tiers. Your tier is set by your <b>estimated one-rep max</b> (Epley formula: weight × (1 + reps ÷ 30)) divided by your bodyweight. Your <b>overall rank</b> is the average of your ranked lifts, so a balanced lifter climbs fastest. Female standards are scaled to account for typical differences in upper/lower-body strength.</p>
        <div class="tier-ladder">${TIERS.map((t, i) => `<div class="tier-step">${badge(i, 44)}<div><b style="color:${t.color}">${t.name}</b><div class="muted small">${esc(t.blurb)}</div></div></div>`).join('')}</div>
        <div class="table-wrap"><table class="std"><thead><tr><th>Lift (× bodyweight)</th>${TIERS.map((t) => `<th style="color:${t.color}">${t.name}</th>`).join('')}</tr></thead>
          <tbody>${RANKED.map((e) => `<tr><td>${e.name}</td>${thresholds(e.id).map((x) => `<td>${round(x, 2)}×</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      </section>`;
  };
  function calcResult() {
    const w = parseFloat(calc.w), r = parseInt(calc.r, 10) || 1, bw = parseFloat(calc.bw);
    if (!(w > 0) || !(bw > 0)) return '<p class="muted">Enter a weight and bodyweight.</p>';
    const est = e1rm(fromDisp(w), r), bwKg = fromDisp(bw);
    const res = rankOf(calc.ex, est, bwKg, calc.sex);
    const t = tierInfo(res.tier), n = res.tier < TIERS.length - 1 ? TIERS[res.tier + 1] : null;
    const ex = exById(calc.ex);
    return `<div class="calc-top" style="--c:${t.color}">${badge(res.tier, 96)}<div><div class="kicker">${wNum(fromDisp(w))} ${unit()} × ${r} ${esc(ex.short.toLowerCase())} @ ${wNum(bwKg)} ${unit()}</div><h2 style="color:${t.color}">${t.name}</h2>
      <div class="muted">${r > 1 ? `≈ ${fmtW(est)} one-rep max · ` : ''}${round(res.ratio, 2)}× bodyweight</div></div></div>
      ${bar(res.frac, t.color)}
      <p class="muted small">${n ? `${fmtW(plateUp(res.nextKg))} (1RM) reaches <b style="color:${n.color}">${n.name}</b>.` : 'That is the top tier. Absolute unit.'}</p>
      <table class="mini-table"><tbody>${res.tKg.map((kg, i) => `<tr class="${i === res.tier ? 'cur' : ''}"><td>${badge(i, 22)} <span style="color:${TIERS[i].color}">${TIERS[i].name}</span></td><td>${fmtW(plateUp(kg))}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ── Settings ── */
  views.settings = () => {
    const p = state.profile;
    return `<div class="section-head page-head"><h1>Settings</h1></div>
      <section class="card"><h2>Profile</h2><form id="profile-form" class="grid-form">
        <label>Name <input name="name" value="${esc(p.name)}" placeholder="Optional"></label>
        <label>Units <select name="unit"><option value="lb" ${p.unit === 'lb' ? 'selected' : ''}>Pounds (lb)</option><option value="kg" ${p.unit === 'kg' ? 'selected' : ''}>Kilograms (kg)</option></select></label>
        <label>Sex (for standards) <select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
        <label>Current bodyweight <input name="bw" type="number" inputmode="decimal" step="0.1" min="20" value="${currentBW() ? wNum(currentBW()) : ''}" placeholder="${unit()}"></label>
        <div class="row-actions"><button class="btn primary" type="submit">Save profile</button></div>
      </form></section>
      <section class="card"><h2>Your data</h2>
        <p class="muted">Everything lives in this browser's local storage — nothing is sent anywhere. Export a backup now and then, especially before clearing your browser or switching phones.</p>
        <div class="row-actions">
          <button class="btn primary" data-act="export">Export backup</button>
          <label class="btn ghost file-btn">Import backup<input type="file" accept="application/json,.json" id="import-file" hidden></label>
          <button class="btn ghost" data-act="demo">Load demo data</button>
          <button class="btn danger" data-act="reset">Erase everything</button>
        </div>
        <p class="muted small">${state.workouts.length} workouts · ${state.bodyweights.length} weigh-ins · ${state.custom.length} custom exercises</p>
      </section>
      ${state.custom.length ? `<section class="card"><h2>Custom exercises</h2>${state.custom.map((c) => `<div class="pr-row"><span>${esc(c.name)}</span><span class="muted small">${history(c.id).length} sessions</span><button class="icon-btn" data-act="del-custom" data-id="${c.id}" aria-label="Delete">${icon('trash')}</button></div>`).join('')}</section>` : ''}
      <section class="card"><h2>Install it like an app</h2><p class="muted">On iPhone: open in Safari → Share → <b>Add to Home Screen</b>. On Android/Chrome: menu → <b>Install app</b>. It works offline once installed.</p></section>`;
  };

  /* ───────────────────────── demo data ───────────────────────── */
  function demoData() {
    const lbs = (x) => x * KG_PER_LB;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const plan = { bench: [185, 228], squat: [245, 300], deadlift: [295, 370], ohp: [110, 135], row: [150, 185], pullup: [10, 45], rdl: [185, 245], curl: [65, 85] };
    const days = 16 * 7;
    const start = addDays(todayISO(), -days);
    const workouts = [], bodyweights = [];
    let k = 0;
    for (let i = 0; i <= days; i++) {
      const iso = addDays(start, i);
      const dow = parseDate(iso).getDay();
      if (i % 7 === 0) bodyweights.push({ date: iso, kg: lbs(176 + (i / days) * 6 + rnd(-1, 1)) });
      if (![1, 3, 5].includes(dow) || Math.random() < 0.08) continue;
      const day = k++ % 2 === 0 ? ['squat', 'bench', 'row', 'curl'] : ['deadlift', 'ohp', 'pullup', 'rdl'];
      const prog = i / days;
      const entries = day.map((ex) => {
        const [a, b] = plan[ex];
        const est = a + (b - a) * Math.pow(prog, 0.85) + rnd(-4, 3);
        const reps = ex === 'deadlift' ? 3 : ['curl', 'pullup', 'rdl'].includes(ex) ? 8 : 5;
        const w = Math.round(est / (1 + reps / 30) / 5) * 5;
        return { ex, sets: [{ w: lbs(w), r: reps }, { w: lbs(w), r: reps }, { w: lbs(w), r: reps - (Math.random() < 0.3 ? 1 : 0) }] };
      });
      workouts.push({ id: uid(), date: iso, notes: Math.random() < 0.1 ? ['Felt strong', 'Bad sleep, still got it done', 'Easy day'][Math.floor(rnd(0, 3))] : '', entries });
    }
    return { workouts, bodyweights };
  }

  /* ───────────────────────── routing ───────────────────────── */
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    const route = views[path] ? path : 'home';
    return { route, params };
  }
  function render() {
    const { route, params } = parseRoute();
    renderNav(route);
    const main = $('#view');
    main.innerHTML = views[route](params);
    main.dataset.route = route;
    document.title = route === 'home' ? 'Chasing Greatness' : `${NAV.find((n) => n.r === route)?.label} · Chasing Greatness`;
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ───────────────────────── events ───────────────────────── */
  function applyProfile(fd, fromSetup) {
    const bw = parseFloat(fd.get('bw'));
    state.profile.name = (fd.get('name') || '').trim();
    state.profile.sex = fd.get('sex');
    state.profile.unit = fd.get('unit');
    if (bw > 0) {
      const kg = fromDisp(bw);
      state.profile.bodyweight = kg;
      const today = todayISO();
      const existing = state.bodyweights.find((b) => b.date === today);
      if (existing) existing.kg = kg;
      else if (fromSetup || !currentBW() || Math.abs(kg - currentBW()) > 0.01) state.bodyweights.push({ date: today, kg });
    }
    calc = null;
    save();
  }

  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.id === 'setup-form' || f.id === 'profile-form') {
      e.preventDefault();
      applyProfile(new FormData(f), f.id === 'setup-form');
      toast(f.id === 'setup-form' ? 'You\'re set. Time to lift.' : 'Profile saved.');
      render();
    } else if (f.id === 'log-form') {
      e.preventDefault();
      saveDraft();
    } else if (f.id === 'bw-form') {
      e.preventDefault();
      const fd = new FormData(f);
      const kg = fromDisp(parseFloat(fd.get('bw')));
      const date = fd.get('date');
      if (!(kg > 0)) return;
      const ex = state.bodyweights.find((b) => b.date === date);
      if (ex) ex.kg = kg; else state.bodyweights.push({ date, kg });
      state.profile.bodyweight = currentBW();
      save();
      toast('Weigh-in logged.');
      render();
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.closest('#log-form') && draft) {
      if (el.name === 'date') draft.date = el.value;
      else if (el.name === 'notes') draft.notes = el.value;
      else {
        const ei = +el.closest('[data-e]')?.dataset.e, si = el.closest('[data-s]')?.dataset.s;
        if (si != null && (el.dataset.f === 'w' || el.dataset.f === 'r')) {
          draft.entries[ei].sets[+si][el.dataset.f] = el.value;
          $(`[data-preview="${ei}"]`).innerHTML = entryPreview(draft.entries[ei]);
        }
      }
    }
    if (el.closest('#calc-form')) {
      calc[el.name] = el.value;
      $('#calc-result').innerHTML = calcResult();
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.f === 'ex' && draft) {
      const ei = +el.closest('[data-e]').dataset.e;
      if (el.value === '__new') {
        const name = (prompt('Name your exercise (e.g. "Cable Fly")') || '').trim();
        if (name) {
          const found = allExercises().find((x) => x.name.toLowerCase() === name.toLowerCase());
          const id = found ? found.id : 'c_' + uid();
          if (!found) { state.custom.push({ id, name }); save(); }
          draft.entries[ei].ex = id;
        }
      } else draft.entries[ei].ex = el.value;
      $('#view').innerHTML = views.log(draft.id ? { id: draft.id } : {});
    }
    if (el.closest('#calc-form') && el.tagName === 'SELECT') { calc[el.name] = el.value; $('#calc-result').innerHTML = calcResult(); }
    if (el.id === 'import-file' && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = normalize(JSON.parse(reader.result));
          if (!confirm(`Import ${data.workouts.length} workouts? This replaces what's currently stored here.`)) return;
          state = data; save(); toast('Backup restored.'); render();
        } catch (err) { toast('That file doesn\'t look like a Chasing Greatness backup.'); }
      };
      reader.readAsText(el.files[0]);
      el.value = '';
    }
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const rerenderLog = () => { $('#view').innerHTML = views.log(draft?.id ? { id: draft.id } : {}); };
    switch (act) {
      case 'add-set': {
        const en = draft.entries[+b.dataset.e];
        const last = en.sets.at(-1) || { w: '', r: '' };
        en.sets.push({ ...last });
        rerenderLog();
        break;
      }
      case 'rm-set': {
        const en = draft.entries[+b.dataset.e];
        en.sets.splice(+b.dataset.s, 1);
        if (!en.sets.length) en.sets.push({ w: '', r: '' });
        rerenderLog();
        break;
      }
      case 'add-entry': {
        const used = new Set(draft.entries.map((x) => x.ex));
        const nextEx = RANKED.find((x) => !used.has(x.id))?.id || 'bench';
        draft.entries.push(blankEntry(nextEx));
        rerenderLog();
        $$('.entry').at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'rm-entry':
        draft.entries.splice(+b.dataset.e, 1);
        if (!draft.entries.length) draft.entries.push(blankEntry());
        rerenderLog();
        break;
      case 'cancel-edit':
        draft = null; location.hash = '#/history'; break;
      case 'del-wo':
        if (confirm('Delete this workout? This can\'t be undone.')) {
          state.workouts = state.workouts.filter((w) => w.id !== b.dataset.id);
          save(); render(); toast('Workout deleted.');
        }
        break;
      case 'del-custom':
        if (history(b.dataset.id).length && !confirm('This exercise has logged sessions. Delete it and its sets?')) break;
        state.custom = state.custom.filter((c) => c.id !== b.dataset.id);
        state.workouts.forEach((w) => { w.entries = w.entries.filter((en) => en.ex !== b.dataset.id); });
        state.workouts = state.workouts.filter((w) => w.entries.length);
        save(); render();
        break;
      case 'export': {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `chasing-greatness-backup-${todayISO()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('Backup downloaded.');
        break;
      }
      case 'demo':
        if (state.workouts.length && !confirm('Replace your current workouts with demo data?')) break;
        {
          const d = demoData();
          state.workouts = d.workouts; state.bodyweights = d.bodyweights;
          state.profile.bodyweight = currentBW();
          if (!state.profile.name) state.profile.name = '';
          draft = null; calc = null;
          save(); location.hash = '#/home'; render();
          toast('Demo data loaded — erase it anytime in Settings.');
        }
        break;
      case 'reset':
        if (confirm('Erase all workouts, weigh-ins and settings from this browser? Export a backup first if you want one.')) {
          state = clone(DEFAULT); draft = null; calc = null; save(); location.hash = '#/home'; render();
        }
        break;
      case 'close-cel': {
        const el = $('#celebrate');
        el.classList.remove('show');
        setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 250);
        break;
      }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#celebrate').hidden) $('[data-act="close-cel"]')?.click(); });

  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
