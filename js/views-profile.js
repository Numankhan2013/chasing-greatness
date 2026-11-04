'use strict';
/* Strength profile: "what can I lift right now?" + a full analysis of where you stand.
 * Profile lifts are NOT workouts: they never touch history, streaks or volume. */
(() => {
  const U = window.UI, C = U.C, { TIERS, CATEGORIES } = C;
  const { esc, icon, emblem, chip, bar, ladder, tierInfo, pctTxt, fmtDate } = U;
  const S = () => C.state;
  const CORE = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pullup'];
  U.EXPERIENCE = [[3, 'Under 6 months'], [9, '6–12 months'], [18, '1–2 years'], [42, '2–5 years'], [72, '5+ years']];
  const expectedTier = (m) => (m < 6 ? 0 : m < 12 ? 1 : m < 24 ? 2 : m < 60 ? 3 : 4);
  const expLabel = (m) => (U.EXPERIENCE.find(([v]) => v === m) || [0, ''])[1];

  /* ── builder ── */
  function liftRow(ex) {
    const l = S().lifts[ex.id], u = C.unit();
    const w = l ? (ex.kind === 'bw' ? (l.w ? String(C.wNum(l.w)) : '0') : String(C.wNum(l.w))) : '';
    const hint = ex.kind === 'db' ? `one dumbbell, ${u}` : ex.kind === 'bw' ? `extra ${u} (0 = bodyweight)` : '';
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
    const more = CATEGORIES.map((c) => {
      const list = C.EXERCISES.filter((e) => e.std && e.cat === c.id && !CORE.includes(e.id));
      return list.length ? `<div class="pl-group">${c.name}</div>${list.map(liftRow).join('')}` : '';
    }).join('');
    const filledMore = Object.keys(S().lifts).some((id) => !CORE.includes(id));
    return `<div class="page-head reveal"><div><h1>${setup ? 'Where do you stand?' : 'Edit your lifts'}</h1>
        <p class="muted">Enter a recent set you're confident in, at any reps. This is just your starting point. <b>It isn't logged as a workout.</b></p></div></div>
      <form id="lifts-form" class="reveal">
        <section class="card"><label>How long have you been lifting?
          <select name="months"><option value="">Choose…</option>${U.EXPERIENCE.map(([v, l]) => `<option value="${v}" ${p.trainingMonths === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></section>
        <section class="card"><div class="sec-head"><h2>The big ones</h2><span class="muted xs">Skip any you don't do</span></div>
          <div class="pl-head muted xs"><span>Exercise</span><span>Weight (${C.unit()})</span><span></span><span>Reps</span><span></span></div>
          ${C.EXERCISES.filter((e) => CORE.includes(e.id)).map(liftRow).join('')}</section>
        <details class="card pl-more" ${filledMore ? 'open' : ''}><summary><h2>More exercises</h2>${icon('chevDown')}</summary>
          <p class="muted small">Incline, dumbbells, machines, arms… Each one you add sharpens your muscle-group ranks.</p>${more}</details>
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
    S().lifts = lifts;
    C.save();
  };

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
    if (missing.length) add('info', 'layers', 'Complete your picture', `No lift yet for ${missing.map((c) => c.name.toLowerCase()).join(', ')}. <a class="link" href="#/profile?edit=1">Add one</a> for a full analysis.`);

    const groups = CATEGORIES.map((c) => {
      const d = snap.cats[c.id];
      if (!d) return `<a class="grp-row dim" href="#/profile?edit=1">${emblem(-1, 34)}<div class="grow"><b>${c.name}</b><span class="muted xs">Add a lift</span></div>${icon('plus', 'muted')}</a>`;
      const tt = tierInfo(d.rank.tier);
      return `<div class="grp-row">${emblem(d.rank.tier, 34, d.rank.div)}<div class="grow"><div class="ex-row-top"><b>${c.name}</b><span class="mono small">${pctTxt(d.rank.pct)}%</span></div>${bar(d.rank.pct / 100, tt.color)}<span class="xs"><span style="color:${tt.color}">${esc(d.rank.label)}</span> <span class="muted">· ${esc(d.top.ex.short)}</span></span></div></div>`;
    }).join('');
    const lifts = Object.entries(snap.exRanks).sort((a, b) => b[1].pct - a[1].pct).map(([id, r]) => {
      const ex = C.exById(id), b = C.bestKnown(id);
      const set = `${ex.kind === 'bw' ? (b.top.w ? '+' + C.wNum(b.top.w) : 'BW') : C.wNum(b.top.w)}×${b.top.r}${ex.kind === 'db' ? ' each' : ''}`;
      return `<button class="pl-sum" data-act="ex-sheet" data-id="${id}">${emblem(r.tier, 30, r.div)}<span class="grow"><b>${esc(ex.name)}</b><span class="muted xs">${set} · ${b.profile ? 'from profile' : 'logged ' + fmtDate(b.date)}</span></span>${chip(r.tier, r.label)}</button>`;
    }).join('');
    const bw = C.currentBW();
    return `<div class="page-head reveal"><h1>Profile</h1><a class="btn sm" href="#/profile?edit=1">${icon('edit')} Edit lifts</a></div>
      <section class="card reveal profile-hero" style="--c:${t.color}">${emblem(o.tier, 96, o.div)}<div class="grow">
        <div class="kicker">${esc(p.name || 'You')} · ${C.fmtW(bw)} · ${p.sex === 'female' ? 'Female' : 'Male'}${p.trainingMonths != null ? ' · ' + esc(expLabel(p.trainingMonths)) : ''}</div>
        <div class="rank-name sm">${esc(o.label)}</div><p>Stronger than <b>${pctTxt(o.pct)}%</b> of lifters at your bodyweight.</p>${ladder(o.pct)}</div></section>
      <section class="card reveal"><div class="sec-head"><h2>By muscle group</h2></div>${groups}</section>
      <h2 class="sec-label reveal">Analysis</h2><div class="insights">${cards.join('')}</div>
      <section class="card reveal"><div class="sec-head"><h2>Your best lifts</h2><span class="muted xs">Profile or logged, whichever is higher</span></div>${lifts}</section>`;
  }

  U.views.profile = (params) => {
    if (!C.currentBW()) return U.setupView();
    const hasAny = Object.keys(S().lifts).length || S().workouts.length;
    return params.edit || params.setup || !hasAny ? builder(!!params.setup || !hasAny) : analysis();
  };
})();
