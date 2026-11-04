'use strict';
/* Shared fragments + Home, History, Settings views. */
(() => {
  const U = window.UI, C = U.C, { TIERS, CATEGORIES } = C;
  const { esc, icon, emblem, chip, bar, ladder, ring, tierInfo, pctTxt, fmtDate, relDate, afterRender, mountChart, MONTHS } = U;
  const S = () => C.state;

  U.setupView = () => {
    const p = S().profile;
    return `<section class="welcome reveal">
      <div class="welcome-emblems">${[1, 3, 4, 6].map((t) => emblem(t, 58, 1)).join('')}</div>
      <h1 class="display">Chase<br><span class="grad">greatness.</span></h1>
      <p class="muted lead">Log your lifts and see exactly where you stand, ranked against <b>10.9 million real lifts</b> at your bodyweight. Free and private. Your data stays on this device.</p>
      <form id="setup-form" class="card form-grid">
        <label>Name <input name="name" value="${esc(p.name)}" placeholder="Optional" autocomplete="given-name"></label>
        <label>Units <select name="unit"><option value="kg" ${p.unit === 'kg' ? 'selected' : ''}>Kilograms</option><option value="lb" ${p.unit === 'lb' ? 'selected' : ''}>Pounds</option></select></label>
        <label>Sex <select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
        <label>Bodyweight <input name="bw" type="number" inputmode="decimal" step="0.1" min="20" required placeholder="e.g. 75"></label>
        <div class="span2 actions"><button class="btn primary lg" type="submit">Start tracking ${icon('arrowRight')}</button><button class="btn ghost" type="button" data-act="demo">Try with demo data</button></div>
      </form></section>`;
  };

  U.heatmap = (weeks = 26) => {
    const counts = {};
    for (const w of S().workouts) counts[w.date] = (counts[w.date] || 0) + 1;
    const end = C.weekStart(C.todayISO()), start = C.addDays(end, -7 * (weeks - 1));
    const cs = 13, gap = 3, pl = 20, pt = 16;
    let out = '', lastM = -1;
    ['M', '', 'W', '', 'F', '', ''].forEach((l, i) => { if (l) out += `<text x="0" y="${pt + i * (cs + gap) + 10}" class="axis">${l}</text>`; });
    for (let w = 0; w < weeks; w++) {
      const ws = C.addDays(start, w * 7), m = C.parseDate(ws).getMonth();
      if (m !== lastM) { out += `<text x="${pl + w * (cs + gap)}" y="10" class="axis">${MONTHS[m]}</text>`; lastM = m; }
      for (let d = 0; d < 7; d++) {
        const iso = C.addDays(ws, d);
        if (iso > C.todayISO()) continue;
        const c = counts[iso] || 0;
        out += `<rect x="${pl + w * (cs + gap)}" y="${pt + d * (cs + gap)}" width="${cs}" height="${cs}" rx="3.5" class="hm l${Math.min(c, 2)}"><title>${fmtDate(iso, true)}: ${c ? c + ' workout' + (c > 1 ? 's' : '') : 'rest'}</title></rect>`;
      }
    }
    return `<svg class="heatmap" viewBox="0 0 ${pl + weeks * (cs + gap)} ${pt + 7 * (cs + gap)}" role="img" aria-label="Training calendar">${out}</svg>`;
  };

  U.summarizeEntry = (en) => {
    const ex = C.exById(en.ex), sets = en.sets.filter((s) => s.r > 0);
    if (!sets.length) return '';
    const w = (s) => (ex.kind === 'bw' ? (s.w ? `+${C.wNum(s.w)}` : 'BW') : C.wNum(s.w));
    const same = sets.every((s) => s.w === sets[0].w && s.r === sets[0].r);
    const body = (same ? `${sets.length}×${sets[0].r} @ ${w(sets[0])}` : sets.map((s) => `${w(s)}×${s.r}`).join(', ')) + (ex.kind === 'db' ? ' each' : '');
    return `<span class="ex-pill"><b>${esc(ex.short || ex.name)}</b> ${body}</span>`;
  };
  U.workoutRow = (w) => `<a class="wo" href="#/log?id=${w.id}"><div class="wo-date">${relDate(w.date)}</div><div class="wo-body">${w.entries.map(U.summarizeEntry).join('')}</div></a>`;

  U.radarChart = (el, snap, color) => mountChart(el, {
    chart: { type: 'radar', height: 300 },
    series: [{ name: 'Percentile', data: CATEGORIES.map((c) => Math.round(snap.cats[c.id]?.rank.pct || 0)) }],
    labels: CATEGORIES.map((c) => c.name),
    xaxis: { labels: { style: { colors: CATEGORIES.map(() => '#c9cfdc'), fontSize: '12px', fontWeight: 700 } } },
    yaxis: { show: false, min: 0, max: 100, tickAmount: 4 },
    plotOptions: { radar: { size: 105, polygons: { strokeColors: 'rgba(255,255,255,.08)', connectorColors: 'rgba(255,255,255,.08)', fill: { colors: ['rgba(255,255,255,.015)', 'transparent'] } } } },
    colors: [color], fill: { opacity: 0.22 }, stroke: { width: 2.5 }, markers: { size: 4, strokeWidth: 0 },
    tooltip: { y: { formatter: (v) => `Stronger than ${v}%` } },
  });

  U.liftCard = (id, r) => {
    const ex = C.exById(id), t = tierInfo(r.tier);
    return `<button class="lift-card" data-act="ex-sheet" data-id="${id}" style="--c:${t.color}">${emblem(r.tier, 54, r.div)}
      <div class="lc-name">${esc(ex.short)}</div><div class="lc-rank" style="color:${t.color}">${esc(r.label)}</div>
      <div class="lc-val mono">${C.fmtMetric(ex, r.value)}</div>${bar(r.frac, t.color)}<div class="muted xs">Top ${pctTxt(100 - r.pct)}%</div></button>`;
  };

  /* ── Home ── */
  U.views.home = () => {
    if (!C.currentBW()) return U.setupView();
    const snap = C.snapshot(), o = snap.overall, t = tierInfo(o ? o.tier : -1);
    const hr = new Date().getHours();
    const greet = (hr < 5 ? 'Late night grind' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (S().profile.name ? `, ${esc(S().profile.name)}` : '');
    const goal = S().profile.weeklyGoal || 3, wk = C.sessionsThisWeek(), streak = C.weekStreak(), prs = C.prsSince(30).length;

    const hero = `<section class="hero card reveal" style="--c:${t.color};--c2:${t.c2}"><div class="hero-glow"></div>
      <div class="hero-emblem">${emblem(o ? o.tier : -1, 150, o?.div)}</div>
      <div class="hero-body"><div class="kicker">${greet}</div><h1 class="rank-name">${o ? esc(o.label) : 'Unranked'}</h1>
      ${o ? `<p class="hero-sub">Stronger than <b><span data-count="${Math.round(o.pct)}">${Math.round(o.pct)}</span>%</b> of lifters at your bodyweight</p>
        <div class="hero-meter">${ladder(o.pct)}<div class="meter-meta"><span>${o.next ? `<b>${(o.next.from - o.pct).toFixed(1)}</b> pts to <b style="color:${tierInfo(o.next.tier).color}">${esc(o.next.label)}</b>` : 'Top of the mountain'}</span><span class="mono">SR <b data-count="${o.rating}">${o.rating}</b></span></div></div>
        <p class="muted small">${esc(t.exp)} · based on ${o.coverage} of ${CATEGORIES.length} muscle groups${o.coverage < 4 ? ', so train more groups to firm it up' : ''}</p>`
      : `<p class="hero-sub">Log any of the 22 ranked exercises to get placed.</p><a class="btn primary" href="#/log">${icon('plus')} Log your first workout</a>`}</div></section>`;

    const stats = `<section class="stats reveal">
      <div class="stat goal">${ring(wk / goal, wk >= goal ? '#4ee6a0' : '#ff7a3d', 58, `${wk}/${goal}`)}<div><div class="stat-l">Weekly goal</div><div class="stat-s">${wk >= goal ? 'Smashed it' : `${goal - wk} to go`}</div></div></div>
      <div class="stat"><div class="stat-v"><span data-count="${streak}">${streak}</span>${icon('flame', 'fire')}</div><div class="stat-l">Week streak</div></div>
      <div class="stat"><div class="stat-v"><span data-count="${S().workouts.length}">${S().workouts.length}</span></div><div class="stat-l">Workouts</div></div>
      <div class="stat"><div class="stat-v"><span data-count="${prs}">${prs}</span>${icon('trophy', 'gold')}</div><div class="stat-l">PRs · 30 days</div></div></section>`;

    const tiles = CATEGORIES.map((c) => {
      const d = snap.cats[c.id];
      if (!d) return `<a class="cat-tile empty" href="#/ranks?cat=${c.id}">${emblem(-1, 38)}<div><b>${c.name}</b><span class="muted small">Not ranked yet</span></div></a>`;
      const tt = tierInfo(d.rank.tier);
      return `<a class="cat-tile" href="#/ranks?cat=${c.id}" style="--c:${tt.color}">${emblem(d.rank.tier, 38, d.rank.div)}<div><b>${c.name}</b><span class="small" style="color:${tt.color}">${esc(d.rank.label)}</span></div><span class="cat-pct mono">${pctTxt(d.rank.pct)}%</span></a>`;
    }).join('');
    const top = Object.entries(snap.exRanks).sort((a, b) => b[1].pct - a[1].pct).slice(0, 8);
    const recent = [...S().workouts].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 4);

    return `${hero}${stats}
      ${o ? `<section class="card reveal"><div class="sec-head"><h2>Muscle groups</h2><a class="link" href="#/ranks">All ranks ${icon('chevRight')}</a></div><div class="cat-grid">${tiles}</div></section>
      <section class="reveal"><div class="sec-head"><h2>Top lifts</h2><a class="link" href="#/ranks">See all ${icon('chevRight')}</a></div><div class="h-scroll">${top.map(([id, r]) => U.liftCard(id, r)).join('')}</div></section>` : ''}
      <section class="two-col">
        <div class="card reveal"><div class="sec-head"><h2>Consistency</h2><span class="muted small">Last 6 months</span></div>${U.heatmap()}</div>
        <div class="card reveal"><div class="sec-head"><h2>Recent</h2><a href="#/history" class="link">History ${icon('chevRight')}</a></div>${recent.length ? recent.map(U.workoutRow).join('') : '<p class="muted">Nothing logged yet.</p>'}</div></section>`;
  };

  /* ── History ── */
  U.views.history = () => {
    const ws = [...S().workouts].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
    if (!ws.length) return `<div class="page-head"><h1>History</h1></div><section class="card empty-log"><p class="muted">No workouts yet.</p><a class="btn primary" href="#/log">${icon('plus')} Log one</a></section>`;
    let lastM = '';
    return `<div class="page-head reveal"><h1>History</h1><span class="muted small">${ws.length} workouts</span></div>` + ws.map((w) => {
      const d = C.parseDate(w.date), m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, head = m !== lastM ? `<h3 class="month">${m}</h3>` : '';
      lastM = m;
      const sets = w.entries.reduce((n, e) => n + e.sets.length, 0);
      return `${head}<a class="card wo-card reveal" href="#/log?id=${w.id}"><div class="wo-card-head"><div class="wo-when"><b>${fmtDate(w.date, true)}</b><span class="muted small">${relDate(w.date)} · ${sets} sets</span></div><div class="wo-actions"><span class="wo-edit">${icon('edit')} Edit</span><button class="icon-btn" data-act="del-wo" data-id="${w.id}" aria-label="Delete workout from ${fmtDate(w.date, true)}">${icon('trash')}</button></div></div>
        <div class="wo-body">${w.entries.map(U.summarizeEntry).join('')}${w.notes ? `<div class="muted small note">“${esc(w.notes)}”</div>` : ''}</div></a>`;
    }).join('');
  };

  /* ── Settings ── */
  U.views.settings = () => {
    const p = S().profile;
    return `<div class="page-head reveal"><h1>Settings</h1></div>
      <section class="card reveal"><h2>Profile</h2><form id="profile-form" class="form-grid">
        <label>Name <input name="name" value="${esc(p.name)}" placeholder="Optional"></label>
        <label>Units <select name="unit"><option value="kg" ${p.unit === 'kg' ? 'selected' : ''}>Kilograms</option><option value="lb" ${p.unit === 'lb' ? 'selected' : ''}>Pounds</option></select></label>
        <label>Sex (for standards) <select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
        <label>Bodyweight (${C.unit()}) <input name="bw" type="number" inputmode="decimal" step="0.1" min="20" value="${C.currentBW() ? C.wNum(C.currentBW()) : ''}"></label>
        <label>Weekly goal <select name="goal">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${p.weeklyGoal === n ? 'selected' : ''}>${n} workouts / week</option>`).join('')}</select></label>
        <label>Rest timer <select name="rest">${[60, 90, 120, 150, 180, 240].map((n) => `<option value="${n}" ${(p.rest || 120) === n ? 'selected' : ''}>${n < 120 ? n + ' sec' : n / 60 + ' min'}</option>`).join('')}</select></label>
        <div class="span2 actions"><button class="btn primary" type="submit">Save profile</button></div></form></section>
      <section class="card reveal"><h2>Your data</h2>
        <p class="muted">Everything is stored on this device. Export a backup now and then, especially before clearing your browser or switching phones.</p>
        <div class="actions"><button class="btn primary" data-act="export">${icon('download')} Export backup</button>
          <label class="btn ghost">${icon('upload')} Import backup<input type="file" accept="application/json,.json" id="import-file" hidden></label>
          <button class="btn ghost" data-act="demo">Load demo data</button><button class="btn danger" data-act="reset">${icon('trash')} Erase everything</button></div>
        <p class="muted small">${S().workouts.length} workouts · ${S().bodyweights.length} weigh-ins · ${S().custom.length} custom exercises</p></section>
      ${S().custom.length ? `<section class="card reveal"><h2>Custom exercises</h2>${S().custom.map((c) => `<div class="pr-row"><span>${esc(c.name)} <span class="muted xs">${esc(C.catById(c.cat).name)}</span></span><span class="muted small">${C.history(c.id).length} sessions</span><button class="icon-btn" data-act="del-custom" data-id="${c.id}" aria-label="Delete">${icon('trash')}</button></div>`).join('')}</section>` : ''}
      <section class="card reveal"><h2>Install as an app</h2><p class="muted">iPhone: Safari → Share → <b>Add to Home Screen</b>. Android: Chrome menu → <b>Install app</b>. Works offline.</p></section>
      <p class="muted xs center">Standards: Strength Level community data · Icons: Lucide · Charts: ApexCharts · Motion: GSAP</p>`;
  };
})();
