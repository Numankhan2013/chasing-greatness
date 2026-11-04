'use strict';
/* Shared fragments + Home, History, Settings views. */
(() => {
  const U = window.UI, C = U.C, { TIERS, CATEGORIES } = C;
  const { esc, icon, emblem, chip, bar, ladder, ring, tierInfo, pctTxt, fmtDate, relDate, afterRender, mountChart, MONTHS } = U;
  const S = () => C.state;

  /* iOS-style segmented control built from radio buttons (works with FormData, no JS needed). */
  U.segmented = (name, opts, cur) => `<span class="seg" role="radiogroup">${opts.map(([v, l]) => `<label class="seg-opt"><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</span>`;

  U.setupView = () => {
    const p = S().profile, u = p.unit || 'kg';
    const first = esc(p.name || (window.CG_CLOUD?.user?.name || '').split(' ')[0]);
    return `<section class="welcome reveal">
      <div class="kicker">Step 1 of 2</div>
      <h1>Let's set you up${first ? ', ' + first : ''}</h1>
      <p class="muted lead">A few basics so we can compare you fairly. Next, one key lift per muscle group.</p>
      <form id="setup-form" class="setup-list">
        <section class="card list">
          <label class="set-row-i"><span class="grow">Name</span><input name="name" value="${first}" placeholder="Optional" autocomplete="given-name"></label>
          <div class="set-row-i"><span class="grow">Units</span>${U.segmented('unit', [['kg', 'kg'], ['lb', 'lb']], u)}</div>
          <div class="set-row-i"><span class="grow"><span>Sex</span><span class="muted xs">Picks the right strength standards</span></span>${U.segmented('sex', [['male', 'Male'], ['female', 'Female']], p.sex || 'male')}</div>
          <label class="set-row-i"><span class="grow"><span>Bodyweight</span><span class="muted xs">Ranks are relative to this</span></span><span class="with-unit"><input name="bw" type="number" inputmode="decimal" step="0.1" min="20" required placeholder="${u === 'lb' ? '165' : '75'}"><span class="muted" id="setup-unit">${u}</span></span></label>
          <label class="set-row-i"><span class="grow">Lifting for</span><select name="months"><option value="">Choose…</option>${U.EXPERIENCE.map(([v, l]) => `<option value="${v}" ${p.trainingMonths === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </section>
        <button class="btn primary lg wide" type="submit">Continue ${icon('arrowRight')}</button>
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
    xaxis: { labels: { style: { colors: CATEGORIES.map(() => (U.light() ? '#3f3f46' : '#d4d4d8')), fontSize: '12px', fontWeight: 600 } } },
    yaxis: { show: false, min: 0, max: 100, tickAmount: 4 },
    plotOptions: { radar: { size: 105, polygons: { strokeColors: U.light() ? '#e4e4e7' : '#27272a', connectorColors: U.light() ? '#e4e4e7' : '#27272a', fill: { colors: ['transparent'] } } } },
    colors: [color], fill: { opacity: 0.22 }, stroke: { width: 2.5 }, markers: { size: 4, strokeWidth: 0 },
    tooltip: { y: { formatter: (v) => `Stronger than ${v}%` } },
  });

  U.liftCard = (id, r) => {
    const ex = C.exById(id), t = tierInfo(r.tier);
    return `<a class="lift-card" href="#/lift?ex=${id}" style="--c:${t.color}">${emblem(r.tier, 54, r.div)}
      <div class="lc-name">${esc(ex.short)}</div><div class="lc-rank" style="color:${t.color}">${esc(r.label)}</div>
      <div class="lc-val mono">${C.fmtMetric(ex, r.value)}</div>${bar(r.frac, t.color)}<div class="muted xs">Top ${pctTxt(100 - r.pct)}%</div></a>`;
  };

  /* ── Home ── */
  U.views.home = () => {
    if (!C.currentBW()) return U.setupView();
    const snap = C.snapshot(), o = snap.overall, t = tierInfo(o ? o.tier : -1);
    const hr = new Date().getHours();
    const greet = (hr < 5 ? 'Late night grind' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (S().profile.name ? `, ${esc(S().profile.name)}` : '');
    const goal = S().profile.weeklyGoal || 3, wk = C.sessionsThisWeek(), streak = C.weekStreak(), prs = C.prsSince(30).length;

    // The focus card is always dark, so it uses the tier's bright metal colour in both themes.
    const hero = `<section class="hero card reveal" style="--c:${t.metal};--c2:${t.c2}"><div class="hero-glow"></div>
      <div class="hero-emblem">${emblem(o ? o.tier : -1, 150, o?.div)}</div>
      <div class="hero-body"><div class="kicker">${greet}</div><h1 class="rank-name">${o ? esc(o.label) : 'Unranked'}</h1>
      ${o ? `<p class="hero-sub">Stronger than <b><span data-count="${Math.round(o.pct)}">${Math.round(o.pct)}</span>%</b> of lifters at your bodyweight</p>
        <div class="hero-meter">${ladder(o.pct, true)}<div class="meter-meta"><span>${o.next ? `<b>${(o.next.from - o.pct).toFixed(1)}</b> pts to <b style="color:${tierInfo(o.next.tier).metal}">${esc(o.next.label)}</b>` : 'Top of the mountain'}</span><span class="mono">SR <b data-count="${o.rating}">${o.rating}</b></span></div></div>
        <p class="muted small">${esc(t.exp)} · based on ${o.coverage} of ${CATEGORIES.length} muscle groups</p>
        <div class="actions hero-actions"><button class="btn primary lg" data-act="plus">Log or add a lift ${icon('arrowRight')}</button></div>`
      : `<p class="hero-sub">Tell us what you can lift right now and see where you stand. Takes a minute, no workout needed.</p><div class="actions hero-actions"><a class="btn primary" href="#/profile?edit=1">${icon('sparkle')} Build my strength profile</a><a class="btn" href="#/log">${icon('plus')} Log a workout</a></div>`}</div></section>`;

    const stats = `<section class="stats reveal">
      <div class="stat goal">${ring(wk / goal, wk >= goal ? 'var(--good)' : 'var(--brand)', 58, `${wk}/${goal}`)}<div><div class="stat-l">Weekly goal</div><div class="stat-s">${wk >= goal ? 'Smashed it' : `${goal - wk} to go`}</div></div></div>
      <div class="stat"><div class="stat-v"><span data-count="${streak}">${streak}</span>${icon('flame', 'fire')}</div><div class="stat-l">Week streak</div></div>
      <div class="stat"><div class="stat-v"><span data-count="${S().workouts.length}">${S().workouts.length}</span></div><div class="stat-l">Workouts</div></div>
      <div class="stat"><div class="stat-v"><span data-count="${prs}">${prs}</span>${icon('trophy', 'gold')}</div><div class="stat-l">PRs · 30 days</div></div></section>`;

    const tiles = CATEGORIES.map((c) => {
      const d = snap.cats[c.id];
      if (!d) return `<a class="cat-tile empty" href="#/lifts?cat=${c.id}">${emblem(-1, 38)}<div><b>${c.name}</b><span class="muted small">Not ranked yet</span></div></a>`;
      const tt = tierInfo(d.rank.tier);
      return `<a class="cat-tile" href="#/lifts?cat=${c.id}" style="--c:${tt.color}">${emblem(d.rank.tier, 38, d.rank.div)}<div><b>${c.name}</b><span class="small" style="color:${tt.color}">${esc(d.rank.label)}</span></div><span class="cat-pct mono">${pctTxt(d.rank.pct)}%</span></a>`;
    }).join('');
    const top = Object.entries(snap.exRanks).sort((a, b) => b[1].pct - a[1].pct).slice(0, 8);
    const recent = [...S().workouts].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 4);

    return `${hero}${stats}
      ${o ? `<section class="card reveal"><div class="sec-head"><h2>Muscle groups</h2><a class="link" href="#/lifts">All ranks ${icon('chevRight')}</a></div><div class="cat-grid">${tiles}</div></section>
      <section class="reveal"><div class="sec-head"><h2>Top lifts</h2><a class="link" href="#/lifts">See all ${icon('chevRight')}</a></div><div class="h-scroll">${top.map(([id, r]) => U.liftCard(id, r)).join('')}</div></section>` : ''}
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

  /* ── Sign-in landing (first thing a new visitor sees) ── */
  const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  U.landingView = () => {
    const cl = window.CG_CLOUD;
    return `<section class="landing">
      <div class="landing-emblems">${[1, 3, 4, 7].map((t) => emblem(t, 54, 1)).join('')}</div>
      <h1 class="display">Chase<br><span class="grad">greatness.</span></h1>
      <p class="lead muted">See exactly where your strength stands, ranked against <b>10.9 million real lifts</b> at your bodyweight. Then watch yourself climb.</p>
      <ul class="landing-points"><li>${icon('trophy')} Honest ranks for 22 exercises</li><li>${icon('chart')} Progress, projections and insights</li><li>${icon('cloud')} Synced across all your devices</li></ul>
      <button class="btn google lg wide" data-act="cloud-signin">${GOOGLE_G} Continue with Google</button>
      ${cl && cl.status === 'error' ? `<p class="small" style="color:var(--bad)">${esc(cl.error)}</p>` : ''}
      <p class="muted xs center">Only you can see your data. <button class="text-btn" data-act="guest">Use without an account</button></p>
    </section>`;
  };
  U.splashView = (msg) => `<section class="splash">${emblem(3, 72, 1)}<p class="muted">${esc(msg)}</p></section>`;

  /* ── Account card ── */
  U.cloudCard = () => {
    const cl = window.CG_CLOUD;
    if (!cl || cl.status === 'unconfigured') return '';
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
    const label = { syncing: 'Syncing…', synced: `Synced ${cl.lastSync ? ago(cl.lastSync) : ''}`, offline: 'Offline. Will sync when you reconnect.', error: `Sync problem: ${esc(cl.error || 'try again')}` }[cl.status] || '';
    if (!cl.user) return `<section class="card reveal account" id="cloud-card"><div class="acct-row"><span class="avatar">${icon('user')}</span><div class="grow"><b>Not signed in</b><span class="muted small">Sign in to back up and sync your data</span></div></div>
      <button class="btn google wide" data-act="cloud-signin">${GOOGLE_G} Continue with Google</button></section>`;
    const u = cl.user;
    return `<section class="card reveal account" id="cloud-card"><div class="acct-row">${u.photo ? `<img class="avatar" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${icon('user')}</span>`}
      <div class="grow"><b>${esc(u.name || 'Signed in')}</b><span class="muted small">${esc(u.email)}</span></div></div>
      <div class="acct-sync"><span class="sync-dot ${esc(cl.status)}"></span><span class="muted small grow" id="cloud-status">${label}</span><button class="text-btn" data-act="cloud-sync">Sync now</button></div></section>`;
  };

  /* ── Settings: iOS-style list, every change saves instantly ── */
  const row = (label, control, sub = '') => `<label class="set-row-i"><span class="grow"><span>${label}</span>${sub ? `<span class="muted xs">${sub}</span>` : ''}</span>${control}<span class="saved-tick" aria-hidden="true">${icon('check')}</span></label>`;
  const sel = (name, opts, cur) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  /* Me: who you are, your strength profile, your activity, and settings, in one grouped list. */
  U.views.me = () => {
    if (!C.currentBW()) return U.setupView();
    const p = S().profile, cl = window.CG_CLOUD, o = C.snapshot().overall, t = tierInfo(o ? o.tier : -1);
    const u = cl && cl.user;
    const nav = (href, ic, label, value = '', act = '') => `<${act ? 'button' : 'a'} class="set-row-i link-row" ${act ? `data-act="${act}"` : `href="${href}"`}><span class="row-ic">${icon(ic)}</span><span class="grow">${label}</span>${value ? `<span class="muted row-val">${value}</span>` : ''}${icon('chevRight', 'muted')}</${act ? 'button' : 'a'}>`;
    return `<div class="page-head reveal"><h1>Me</h1></div>
      <a class="card reveal me-hero" href="#/profile" style="--c:${t.color}">
        ${u && u.photo ? `<img class="avatar" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${icon('user')}</span>`}
        <div class="grow"><b>${esc(p.name || (u && u.name) || 'You')}</b><span class="muted small">${o ? `<span style="color:${t.color}">${esc(o.label)}</span> · stronger than ${pctTxt(o.pct)}%` : 'Not ranked yet'}</span></div>
        ${emblem(o ? o.tier : -1, 44, o?.div)}</a>
      <h3 class="group-label reveal">Strength profile</h3>
      <section class="card list reveal">
        ${nav('#/profile', 'sparkle', 'Your analysis')}
        ${nav('#/profile?edit=1', 'dumbbell', 'Key lifts', `${Object.keys(S().lifts).length} added`)}
        ${nav('', 'plus', 'Add a lift', '', 'lift-picker')}
      </section>
      <h3 class="group-label reveal">Activity</h3>
      <section class="card list reveal">
        ${nav('#/history', 'history', 'Workout history', `${S().workouts.length}`)}
        ${nav('#/bodyweight', 'scale', 'Bodyweight', C.currentBW() ? C.fmtW(C.currentBW()) : '')}
      </section>
      ${U.cloudCard()}
      <form id="profile-form" class="settings-form" autocomplete="off">
        <h3 class="group-label reveal">About you</h3>
        <section class="card list reveal">
          ${row('Name', `<input name="name" value="${esc(p.name)}" placeholder="Your name">`)}
          ${row('Bodyweight', `<span class="with-unit"><input name="bw" type="number" inputmode="decimal" step="0.1" min="20" value="${C.currentBW() ? C.wNum(C.currentBW()) : ''}"><span class="muted">${C.unit()}</span></span>`, 'Ranks are relative to this')}
          ${row('Sex', sel('sex', [['male', 'Male'], ['female', 'Female']], p.sex), 'Picks the right strength standards')}
          ${row('Lifting for', sel('months', [['', 'Choose…'], ...U.EXPERIENCE], p.trainingMonths ?? ''))}
          <div class="set-row-i"><span class="grow">Units</span>${U.segmented('unit', [['kg', 'kg'], ['lb', 'lb']], p.unit)}<span class="saved-tick" aria-hidden="true">${icon('check')}</span></div>
        </section>
        <h3 class="group-label reveal">Training</h3>
        <section class="card list reveal">
          ${row('Weekly goal', sel('goal', [2, 3, 4, 5, 6].map((n) => [n, `${n} workouts`]), p.weeklyGoal))}
          ${row('Rest timer', sel('rest', [60, 90, 120, 150, 180, 240].map((n) => [n, n < 120 ? `${n} sec` : `${n / 60} min`]), p.rest || 120), 'Only in live workouts')}
        </section>
      </form>
      ${S().custom.length ? `<h3 class="group-label reveal">Custom exercises</h3><section class="card list reveal">${S().custom.map((c) => `<div class="set-row-i"><span class="grow"><span>${esc(c.name)}</span><span class="muted xs">Custom · ${esc(C.catById(c.cat).name)} · ${C.history(c.id).length} sessions</span></span><button class="icon-btn" data-act="del-custom" data-id="${c.id}" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button></div>`).join('')}</section>` : ''}
      <section class="card list reveal">
        ${cl && cl.user ? `<button class="set-row-i btn-row" data-act="cloud-signout">Sign out</button>` : ''}
        <button class="set-row-i btn-row danger-row" data-act="reset">Erase all my data</button>
      </section>
      <p class="muted xs center">Standards: Strength Level community data · Icons: Lucide · Charts: ApexCharts · Motion: GSAP</p>`;
  };
  U.views.settings = U.views.me;

  U.views.bodyweight = () => `<a class="back-link reveal" href="#/me">${icon('chevRight', 'flip')} Me</a><div class="page-head reveal"><h1>Bodyweight</h1></div>${U.bodyweightCard()}`;
})();
