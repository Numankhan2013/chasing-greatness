'use strict';
/* Profile-based insights as visuals instead of text cards. Two layouts share these pieces:
 *   'spread'  – each insight sits next to what it explains (default)
 *   'compact' – one "At a glance" card with tight rows
 */
(() => {
  const U = window.UI, C = U.C, { TIERS, CATEGORIES } = C;
  const { esc, icon, emblem, tierInfo, pctTxt } = U;
  const S = () => C.state;

  /* Everything the widgets need, computed once. */
  U.insightData = (snap) => {
    const d = { snap };
    const cats = Object.values(snap.cats).sort((a, b) => b.rank.pct - a.rank.pct);
    if (cats.length >= 2) { d.strongest = cats[0]; d.weakest = cats.at(-1); }
    const pc = (id) => snap.cats[id]?.rank.pct;
    const avg = (ids) => { const v = ids.map(pc).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    d.balances = [
      ['Push', ['chest', 'shoulders'], 'Pull', ['back'], 'Add rows or pull-ups.', 'More bench and overhead work.'],
      ['Upper', ['chest', 'shoulders', 'back'], 'Lower', ['legs', 'hinge'], 'Prioritise squats and deadlifts.', 'Bring your upper body along.'],
      ['Quads', ['legs'], 'Hips', ['hinge'], 'Add RDLs or hip thrusts.', 'More squats will round it out.'],
    ].map(([ln, l, rn, r, fixL, fixR]) => ({ ln, rn, l: avg(l), r: avg(r), fixL, fixR })).filter((b) => b.l != null && b.r != null);
    const months = S().profile.trainingMonths;
    if (snap.overall && months != null) {
      const expT = months < 6 ? 0 : months < 12 ? 1 : months < 24 ? 2 : months < 60 ? 3 : 5;
      d.exp = { expT, you: snap.overall, label: (U.EXPERIENCE.find(([v]) => v === months) || [0, ''])[1], diff: snap.overall.tier - expT };
    }
    const near = Object.entries(snap.exRanks).filter(([, r]) => r.next).map(([id, r]) => ({ ex: C.exById(id), r })).sort((a, b) => a.r.need / a.r.value - b.r.need / b.r.value)[0];
    if (near) d.near = near;
    d.missing = CATEGORIES.filter((c) => !snap.cats[c.id]);
    return d;
  };

  /* ── pieces ── */
  const tile = (kicker, d, tone) => {
    const t = tierInfo(d.rank.tier);
    return `<a class="gl-tile ${tone}" href="#/lifts?cat=${d.cat.id}">${emblem(d.rank.tier, 34, d.rank.div)}<span><span class="xs muted">${kicker}</span><b>${esc(d.cat.name)}</b><span class="xs" style="color:${t.color}">${esc(d.rank.label)} · ${pctTxt(d.rank.pct)}%</span></span></a>`;
  };
  U.glStrengths = (d) => (d.strongest ? `<div class="gl-tiles">${tile('Strongest', d.strongest, 'up')}${tile('Weakest · focus here', d.weakest, 'down')}</div>` : '');

  /* Tug-of-war bar: the fill grows from the centre toward the stronger side. */
  U.glBalance = (d) => d.balances.map((b) => {
    const diff = b.l - b.r, off = Math.abs(diff) >= 18, w = Math.min(50, Math.abs(diff));
    const verdict = off ? `${diff > 0 ? b.rn : b.ln} lags by ${Math.round(Math.abs(diff))} pts · ${diff > 0 ? b.fixL : b.fixR}` : 'Balanced';
    return `<div class="bal ${off ? 'off' : 'even'}">
      <div class="bal-top"><span><b>${b.ln}</b> <span class="mono">${Math.round(b.l)}</span></span><span><span class="mono">${Math.round(b.r)}</span> <b>${b.rn}</b></span></div>
      <div class="bal-track"><i class="bal-mid"></i><span class="bal-fill" style="${diff >= 0 ? `right:50%;` : `left:50%;`}width:${w}%"></span></div>
      <div class="xs ${off ? 'bal-warn' : 'muted'}">${esc(verdict)}</div></div>`;
  }).join('');

  U.glExperience = (d) => {
    if (!d.exp) return '';
    const e = d.exp, et = tierInfo(e.expT), yt = tierInfo(e.you.tier);
    const verdict = e.diff > 0 ? ['Ahead of the curve', 'good'] : e.diff === 0 ? ['Right on track', 'good'] : ['Room to grow', 'info'];
    return `<div class="gl-exp"><div class="gl-exp-side muted">${emblem(e.expT, 30)}<span class="xs">Typical at ${esc(e.label.toLowerCase())}</span><b style="color:${et.color}">${et.name}</b></div>
      <span class="gl-arrow">${icon('arrowRight')}</span>
      <div class="gl-exp-side">${emblem(e.you.tier, 38, e.you.div)}<span class="xs muted">You</span><b style="color:${yt.color}">${esc(e.you.label)}</b></div>
      <span class="chip gl-verdict" style="--c:var(--${verdict[1]})">${verdict[0]}</span></div>`;
  };

  U.glNext = (d) => {
    if (!d.near) return '';
    const { ex, r } = d.near, nt = tierInfo(r.next.tier), t = tierInfo(r.tier);
    return `<a class="gl-next" href="#/lift?ex=${ex.id}">${emblem(r.tier, 30, r.div)}
      <div class="grow"><div class="gl-next-top"><b>${esc(ex.name)}</b><span class="mono">${ex.kind === 'bw' ? `+${C.round(r.need, 1)} reps` : '+' + C.fmtW(r.need)}</span></div>
      <div class="bar"><span style="width:${(r.frac * 100).toFixed(1)}%;--c:${t.color}"></span></div>
      <div class="xs muted">${esc(r.label)} → <span style="color:${nt.color}">${esc(r.next.label)}</span></div></div>${emblem(r.next.tier, 30, r.next.div)}</a>`;
  };

  U.glMissing = (d) => (d.missing.length ? `<div class="gl-missing"><span class="xs muted">Not ranked yet:</span>${d.missing.map((c) => {
    const pick = C.EXERCISES.find((e) => e.std && e.cat === c.id && ['bench', 'ohp', 'pullup', 'squat', 'deadlift', 'curl'].includes(e.id)) || C.EXERCISES.find((e) => e.std && e.cat === c.id);
    return `<button class="pill" data-act="lift-sheet" data-id="${pick.id}">${icon('plus')} ${esc(c.name)}</button>`;
  }).join('')}</div>` : '');

  /* ── layout A: spread (each insight next to what it explains) ── */
  U.insightsSpread = (d, radarCard) => `
    ${radarCard(`${U.glStrengths(d)}${U.glMissing(d)}`)}
    ${d.balances.length ? `<section class="card reveal"><div class="sec-head"><div><h2>Balance</h2><span class="muted small">Percentile on each side · 18+ points apart is worth fixing</span></div></div><div class="bal-list">${U.glBalance(d)}</div></section>` : ''}
    ${d.exp || d.near ? `<section class="two-col">
      ${d.exp ? `<div class="card reveal"><div class="sec-head"><h2>Vs your experience</h2></div>${U.glExperience(d)}</div>` : ''}
      ${d.near ? `<div class="card reveal"><div class="sec-head"><div><h2>Closest rank-up</h2><span class="muted small">Smallest jump to your next division</span></div></div>${U.glNext(d)}</div>` : ''}</section>` : ''}`;

  /* ── layout B: compact (one 'at a glance' card) ── */
  U.insightsCompact = (d, radarCard) => `
    ${radarCard('')}
    <section class="card reveal glance"><div class="sec-head"><h2>At a glance</h2></div>
      ${d.strongest ? `<div class="gl-row"><span class="gl-label">Groups</span>${U.glStrengths(d)}</div>` : ''}
      ${d.exp ? `<div class="gl-row"><span class="gl-label">Experience</span>${U.glExperience(d)}</div>` : ''}
      ${d.near ? `<div class="gl-row"><span class="gl-label">Next up</span>${U.glNext(d)}</div>` : ''}
      ${d.balances.length ? `<div class="gl-row"><span class="gl-label">Balance</span><div class="bal-list">${U.glBalance(d)}</div></div>` : ''}
      ${d.missing.length ? `<div class="gl-row"><span class="gl-label">Missing</span>${U.glMissing(d)}</div>` : ''}
    </section>`;
})();
