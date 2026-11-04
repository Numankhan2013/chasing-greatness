'use strict';
/* Strength profile: "what can I lift right now?" + a full analysis of where you stand.
 * Profile lifts are NOT workouts: they never touch history, streaks or volume. */
(() => {
  const U = window.UI, C = U.C, { TIERS, CATEGORIES } = C;
  const { esc, icon, emblem, chip, bar, ladder, tierInfo, pctTxt, fmtDate } = U;
  const S = () => C.state;
  // One common lift per muscle group, so a new profile covers all six groups from day one.
  const CORE = ['bench', 'ohp', 'pullup', 'squat', 'deadlift', 'curl'];
  U.EXPERIENCE = [[3, 'Under 6 months'], [9, '6–12 months'], [18, '1–2 years'], [42, '2–5 years'], [72, '5+ years']];
  // Typical tier by training age (Strength Level: novice ≈ 6 months, intermediate ≈ 2 years, advanced 5+).
  const expectedTier = (m) => (m < 6 ? 0 : m < 12 ? 1 : m < 24 ? 2 : m < 60 ? 3 : 5);
  const expLabel = (m) => (U.EXPERIENCE.find(([v]) => v === m) || [0, ''])[1];

  /* ── builder ── */
  function liftRow(ex) {
    const l = S().lifts[ex.id], u = C.unit();
    const w = l ? (ex.kind === 'bw' ? (l.w ? String(C.wNum(l.w)) : '0') : String(C.wNum(l.w))) : '';
    const grp = C.catById(ex.cat).name;
    const hint = ex.kind === 'db' ? `${grp} · weight of one dumbbell` : ex.kind === 'bw' ? `${grp} · extra ${u} (0 = bodyweight)` : grp;
    return `<div class="pl-row" data-ex="${ex.id}">
      <div class="pl-name"><b>${esc(ex.name)}</b>${hint ? `<span class="muted xs">${hint}</span>` : ''}</div>
      <input type="number" inputmode="decimal" step="any" data-pf="w" value="${esc(w)}" placeholder="${ex.kind === 'bw' ? '0' : u}" aria-label="${esc(ex.name)} weight${hint ? ' (' + hint + ')' : ''}">
      <span class="pl-x muted">×</span>
      <input type="number" inputmode="numeric" min="1" step="1" data-pf="r" value="${l ? l.r : ''}" placeholder="reps" aria-label="${esc(ex.name)} reps">
      <span class="pl-rank" data-lp="${ex.id}">${U.liftPreview(ex.id, w, l ? l.r : '')}</span></div>`;
  }
  U.liftPreview = (exId, w, r) => {
    const ex = C.exById(exId), wv = parseFloat(w) || 0, rv = parseInt(r, 10) || 0;
    if (!(rv > 0) || (ex.kind !== 'bw' && !(wv > 0))) return '';
    const res = C.rankOf(exId, C.setMetric(ex, { w: C.fromDisp(wv), r: rv }, C.currentBW()));
    return res ? chip(res.tier, res.label) : '';
  };

  function builder(setup) {
    const p = S().profile;
    const extra = Object.keys(S().lifts).filter((id) => !CORE.includes(id) && C.exById(id).std).map((id) => C.exById(id));
    return `<div class="page-head reveal"><div>${setup ? '<div class="kicker">Step 2 of 2</div>' : ''}<h1>${setup ? 'Where do you stand?' : 'Edit your lifts'}</h1>
        <p class="muted">One key lift for each muscle group gives a solid read on your strength. Enter a recent set you're confident in, at any reps. Skip any you don't do. <b>Nothing here is logged as a workout.</b></p></div></div>
      <form id="lifts-form" class="reveal">
        <section class="card"><label>How long have you been lifting?
          <select name="months"><option value="">Choose…</option>${U.EXPERIENCE.map(([v, l]) => `<option value="${v}" ${p.trainingMonths === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></section>
        <section class="card"><div class="sec-head"><h2>Key lifts</h2><span class="muted xs">Fill in what you can</span></div>
          <div class="pl-head muted xs"><span>Exercise</span><span>Weight (${C.unit()})</span><span></span><span>Reps</span><span></span></div>
          ${CORE.map((id) => liftRow(C.exById(id))).join('')}</section>
        ${extra.length ? `<section class="card"><div class="sec-head"><h2>Other lifts</h2><span class="muted xs">Added earlier</span></div>${extra.map(liftRow).join('')}</section>` : ''}
        <p class="muted small pl-note">${icon('sparkle')} Every exercise you log later (incline, dumbbells, machines, arms…) sharpens your rank automatically. The more you log, the more accurate it gets.</p>
        <div class="finish-bar"><button class="btn primary lg wide" type="submit">${icon('sparkle')} ${setup ? 'See where I stand' : 'Save & update analysis'}</button></div>
        ${setup ? '<a class="btn wide" href="#/home">Skip for now</a>' : '<a class="btn wide" href="#/profile">Cancel</a>'}
      </form>`;
  }
  U.saveLifts = (form) => {
    const fd = new FormData(form), lifts = {}, today = C.todayISO();
    S().profile.trainingMonths = fd.get('months') ? +fd.get('months') : S().profile.trainingMonths;
    for (const row of form.querySelectorAll('.pl-row')) {
      const id = row.dataset.ex, ex = C.exById(id);
      const w = parseFloat(row.querySelector('[data-pf=w]').value) || 0, r = parseInt(row.querySelector('[data-pf=r]').value, 10) || 0;
      if (!(r > 0) || (ex.kind !== 'bw' && !(w > 0))) continue;
      const kg = C.fromDisp(w), old = S().lifts[id];
      lifts[id] = old && Math.abs(old.w - kg) < 0.01 && old.r === r ? old : { w: kg, r, date: today };
    }
    for (const [id, l] of Object.entries(S().lifts)) if (!form.querySelector(`.pl-row[data-ex="${id}"]`)) lifts[id] = l;  // keep lifts not shown here
    S().lifts = lifts;
    C.save();
  };

  function fineTune(snap) {
    // Suggest exercises for empty groups first, then the weakest group, skipping ones already known.
    const order = [...CATEGORIES.filter((c) => !snap.cats[c.id]), ...Object.values(snap.cats).sort((a, b) => a.rank.pct - b.rank.pct).map((d) => d.cat)];
    const sugg = [];
    for (const c of order) for (const e of C.EXERCISES) if (e.std && e.cat === c.id && !snap.exRanks[e.id] && sugg.length < 6 && !sugg.includes(e)) { sugg.push(e); break; }
    return `<section class="card reveal fine-tune"><div class="sec-head"><div><h2>${icon('sparkle')} Fine-tune your rank</h2><span class="muted small">Add more lifts you can do. Each one sharpens your muscle-group and overall rank.</span></div></div>
      <div class="ft-chips">${sugg.map((e) => `<button class="ft-chip" data-act="lift-sheet" data-id="${e.id}">${icon('plus')}<span><b>${esc(e.short || e.name)}</b><span class="muted xs">${esc(C.catById(e.cat).name)}</span></span></button>`).join('')}</div>
      <button class="btn wide" data-act="lift-picker">Choose any exercise ${icon('chevRight')}</button></section>`;
  }

  /* ── analysis ── */
  function analysis() {
    const p = S().profile, snap = C.snapshot(), o = snap.overall;
    if (!o) return `<div class="page-head"><h1>Profile</h1></div><section class="card empty-log"><div class="empty-ic">${icon('user')}</div><h2>No lifts yet</h2><p class="muted">Add what you can lift now to see where you stand.</p><a class="btn primary" href="#/profile?edit=1">Build my profile</a></section>`;
    const t = tierInfo(o.tier), cards = [];
    const add = (tone, ic, title, body) => cards.push(`<article class="insight ${tone} reveal"><div class="ins-ic">${icon(ic)}</div><div><h3>${title}</h3><p>${body}</p></div></article>`);

    if (p.trainingMonths != null) {
      const exp = expectedTier(p.trainingMonths), diff = o.tier - exp;
      if (diff > 0) add('good', 'up', 'Ahead of the curve', `Most people at ${expLabel(p.trainingMonths).toLowerCase()} of training are ${TIERS[exp].name}. You're already <b style="color:${t.color}">${esc(o.label)}</b>. Whatever you're doing, keep doing it.`);
      else if (diff === 0) add('good', 'checkCircle', 'Right on track', `${TIERS[exp].name} is typical for ${expLabel(p.trainingMonths).toLowerCase()} of training, and that's where you are. Consistent progress from here moves you up.`);
      else add('info', 'target', 'Room to grow, fast', `Lifters with ${expLabel(p.trainingMonths).toLowerCase()} of training are usually ${TIERS[exp].name}. You're ${esc(o.label)}, so the gap is very closable with a structured program and progressive overload.`);
    }
    const cats = Object.values(snap.cats).sort((a, b) => b.rank.pct - a.rank.pct);
    if (cats.length >= 2) {
      const top = cats[0], low = cats.at(-1);
      add('good', 'medal', `Strongest: ${top.cat.name}`, `${esc(top.top.ex.name)} puts you ahead of ${pctTxt(top.rank.pct)}% of lifters (<b style="color:${tierInfo(top.rank.tier).color}">${esc(top.rank.label)}</b>).`);
      const sugg = C.EXERCISES.filter((e) => e.std && e.cat === low.cat.id).slice(0, 3).map((e) => e.name).join(', ');
      add('warn', 'target', `Focus next: ${low.cat.name}`, `Your weakest group (${esc(low.rank.label)}, ${pctTxt(low.rank.pct)}th percentile). Raising it lifts your overall rank fastest. Good options: ${esc(sugg)}.`);
    }
    const pc = (id) => snap.cats[id]?.rank.pct, avg = (ids) => { const v = ids.map(pc).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const push = avg(['chest', 'shoulders']), pull = avg(['back']), up = avg(['chest', 'shoulders', 'back']), low2 = avg(['legs', 'hinge']);
    if (push != null && pull != null && Math.abs(push - pull) >= 18) add('info', 'scaleBal', 'Push / pull imbalance', `Pushing is at the ${Math.round(push)}th percentile, pulling at the ${Math.round(pull)}th. ${push > pull ? 'More rows and pull-ups will balance your shoulders.' : 'More pressing will even it out.'}`);
    if (up != null && low2 != null && Math.abs(up - low2) >= 18) add('info', 'scaleBal', 'Upper / lower imbalance', `Upper body at the ${Math.round(up)}th percentile vs lower body at the ${Math.round(low2)}th. ${up > low2 ? 'Prioritise squats and deadlifts.' : 'Your legs are carrying you, so bring the upper body along.'}`);
    const near = Object.entries(snap.exRanks).filter(([, r]) => r.next).map(([id, r]) => ({ ex: C.exById(id), r })).sort((a, b) => a.r.need / a.r.value - b.r.need / b.r.value)[0];
    if (near) add('good', 'zap', 'Closest rank-up', `${esc(near.ex.name)}: ${near.ex.kind === 'bw' ? `${C.round(near.r.need, 1)} more reps` : `+${C.fmtW(near.r.need)}`} on your max gets you <b style="color:${tierInfo(near.r.next.tier).color}">${esc(near.r.next.label)}</b>.`);
    const missing = CATEGORIES.filter((c) => !snap.cats[c.id]);
    if (missing.length) add('info', 'layers', 'Complete your picture', `No data yet for ${missing.map((c) => c.name.toLowerCase()).join(', ')}. <button class="text-btn" data-act="lift-picker">Add a lift</button> and your analysis fills in instantly.`);

    const groups = CATEGORIES.map((c) => {
      const d = snap.cats[c.id];
      if (!d) { const pick = CORE.find((id) => C.exById(id).cat === c.id) || C.EXERCISES.find((e) => e.std && e.cat === c.id).id; return `<button class="grp-row dim" data-act="lift-sheet" data-id="${pick}">${emblem(-1, 34)}<div class="grow"><b>${c.name}</b><span class="muted xs">Add a lift to rank this group</span></div><span class="add-pill">${icon('plus')} Add</span></button>`; }
      const tt = tierInfo(d.rank.tier);
      return `<div class="grp-row">${emblem(d.rank.tier, 34, d.rank.div)}<div class="grow"><div class="ex-row-top"><b>${c.name}</b><span class="mono small">${pctTxt(d.rank.pct)}%</span></div>${bar(d.rank.pct / 100, tt.color)}<span class="xs"><span style="color:${tt.color}">${esc(d.rank.label)}</span> <span class="muted">· ${esc(d.top.ex.short)}</span></span></div></div>`;
    }).join('');
    const lifts = Object.entries(snap.exRanks).sort((a, b) => b[1].pct - a[1].pct).map(([id, r]) => {
      const ex = C.exById(id), b = C.bestKnown(id);
      const set = `${ex.kind === 'bw' ? (b.top.w ? '+' + C.wNum(b.top.w) : 'BW') : C.wNum(b.top.w)}×${b.top.r}${ex.kind === 'db' ? ' each' : ''}`;
      return `<a class="pl-sum" href="#/lift?ex=${id}">${emblem(r.tier, 30, r.div)}<span class="grow"><b>${esc(ex.name)}</b><span class="muted xs">${set} · ${b.profile ? 'from profile' : 'logged ' + fmtDate(b.date)}</span></span>${chip(r.tier, r.label)}</a>`;
    }).join('');
    const bw = C.currentBW();
    return `<div class="page-head reveal"><h1>Profile</h1><a class="btn sm" href="#/profile?edit=1">${icon('edit')} Edit lifts</a></div>
      <section class="card reveal profile-hero" style="--c:${t.color}">${emblem(o.tier, 96, o.div)}<div class="grow">
        <div class="kicker">${esc(p.name || 'You')} · ${C.fmtW(bw)} · ${p.sex === 'female' ? 'Female' : 'Male'}${p.trainingMonths != null ? ' · ' + esc(expLabel(p.trainingMonths)) : ''}</div>
        <div class="rank-name sm">${esc(o.label)}</div><p>Stronger than <b>${pctTxt(o.pct)}%</b> of lifters at your bodyweight.</p>${ladder(o.pct)}</div></section>
      <section class="card reveal"><div class="sec-head"><h2>By muscle group</h2></div>${groups}</section>
      ${fineTune(snap)}
      <h2 class="sec-label reveal">Analysis</h2><div class="insights">${cards.join('')}</div>
      <section class="card reveal"><div class="sec-head"><div><h2>Your best lifts</h2><span class="muted xs">Profile or logged, whichever is higher</span></div></div>${lifts}</section>`;
  }

  /* ── Add / update one lift in the profile (from Ranks, exercise sheets, or the fine-tune card) ── */
  U.liftSheet = (exId) => {
    const ex = C.exById(exId), l = S().lifts[exId], u = C.unit();
    const w = l ? (ex.kind === 'bw' ? (l.w ? String(C.wNum(l.w)) : '0') : String(C.wNum(l.w))) : (ex.kind === 'bw' ? '0' : '');
    const label = ex.kind === 'db' ? `One dumbbell (${u})` : ex.kind === 'bw' ? `Extra weight (${u})` : `Weight (${u})`;
    const hint = ex.kind === 'db' ? `Holding 25 ${u} in each hand? Enter 25.` : ex.kind === 'bw' ? 'Your bodyweight counts automatically. Enter 0 for bodyweight only.' : 'A recent set you\'re confident in, at any reps.';
    const lr = C.liftRank(exId);
    U.openSheet(`<form id="lift-sheet-form" data-ex="${exId}" class="lift-sheet">
      <div class="ls-head">${emblem(lr ? lr.tier : -1, 52, lr?.div)}<div><div class="kicker">${esc(C.catById(ex.cat).name)}</div><h2 class="sheet-title">${esc(ex.name)}</h2></div></div>
      <p class="muted small">${l ? 'Update' : 'Add'} what you can do. It goes into your <b>strength profile</b>, not your workout history, and sharpens your ${esc(C.catById(ex.cat).name.toLowerCase())} and overall rank.</p>
      <div class="ls-inputs">
        <label>${label}<input type="number" inputmode="decimal" step="any" name="w" value="${esc(w)}" placeholder="${ex.kind === 'bw' ? '0' : u}"></label>
        <span class="ls-x">×</span>
        <label>Reps<input type="number" inputmode="numeric" min="1" step="1" name="r" value="${l ? l.r : ''}" placeholder="reps"></label>
      </div>
      <p class="muted xs">${hint}</p>
      <div class="ls-preview" id="ls-preview">${U.liftPreview(exId, w, l ? l.r : '') || '<span class="muted small">Enter weight and reps to see your rank</span>'}</div>
      <button class="btn primary lg wide" type="submit">${icon('check')} ${l ? 'Update profile' : 'Add to my profile'}</button>
      <div class="ls-alt">${l ? `<button type="button" class="text-btn danger-text" data-act="remove-lift" data-id="${exId}">Remove from profile</button>` : ''}<a class="text-btn" href="#/log?ex=${exId}">Log as a workout instead</a></div>
    </form>`);
  };
  U.saveLiftSheet = (form) => {
    const id = form.dataset.ex, ex = C.exById(id), fd = new FormData(form);
    const w = parseFloat(fd.get('w')) || 0, r = parseInt(fd.get('r'), 10) || 0;
    if (!(r > 0) || (ex.kind !== 'bw' && !(w > 0))) { U.toast('Enter a weight and reps.'); return false; }
    const before = C.snapshot();
    S().lifts[id] = { w: C.fromDisp(w), r, date: C.todayISO() };
    C.save();
    const after = C.snapshot(), lr = C.liftRank(id);
    const up = after.overall && before.overall && after.overall.step > before.overall.step;
    U.toast(up ? `${icon('up')} Overall rank up: ${esc(after.overall.label)}!` : `${esc(ex.short || ex.name)}: ${esc(lr ? lr.label : 'saved')}. Profile updated.`);
    if (up) U.celebrateFX(tierInfo(after.overall.tier).color);
    return true;
  };
  /* Pick any ranked exercise to add to the profile. */
  U.liftPicker = () => {
    const groups = CATEGORIES.map((c) => {
      const list = C.EXERCISES.filter((e) => e.std && e.cat === c.id);
      return `<div class="pick-group">${c.name}</div>${list.map((e) => { const lr = C.liftRank(e.id); return `<button class="pick-row" data-act="lift-sheet" data-id="${e.id}">${emblem(lr ? lr.tier : -1, 30, lr?.div)}<span class="pick-name"><b>${esc(e.name)}</b><span class="muted xs">${lr ? esc(lr.label) : 'Not ranked yet'}</span></span>${icon(S().lifts[e.id] ? 'edit' : 'plus', 'muted')}</button>`; }).join('')}`;
    }).join('');
    U.openSheet(`<div class="picker"><h2 class="sheet-title">Add a lift to your profile</h2><p class="muted small">Every lift you add sharpens your rank.</p><div class="pick-list">${groups}</div></div>`, 'tall');
  };

  U.views.profile = (params) => {
    if (!C.currentBW()) return U.setupView();
    const hasAny = Object.keys(S().lifts).length || S().workouts.length;
    return params.edit || params.setup || !hasAny ? builder(!!params.setup || !hasAny) : analysis();
  };
})();
