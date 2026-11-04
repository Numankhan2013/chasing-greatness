'use strict';
/* One screen per lift: rank, what's next, progress chart, records, tier ladder, and actions.
 * Replaces the old split between the Ranks detail sheet and the Progress page. */
(() => {
  const U = window.UI, C = U.C;
  const { esc, icon, emblem, ladder, tierInfo, pctTxt, fmtDate } = U;
  const S = () => C.state;

  U.views.lift = (params) => {
    if (!C.currentBW()) return U.setupView();
    const ex = C.exById(params.ex);
    if (!params.ex || ex.name === 'Unknown exercise') return U.views.lifts({});
    const r = C.liftRank(ex.id), h = C.history(ex.id), inProfile = !!S().lifts[ex.id];
    const t = tierInfo(r ? r.tier : -1), cat = C.catById(ex.cat);
    const b = r?.best;
    const topSet = b ? `${ex.kind === 'bw' ? (b.top.w ? '+' + C.wNum(b.top.w) : 'BW') : C.wNum(b.top.w)}×${b.top.r}${ex.kind === 'db' ? ' each' : ''}` : '';

    const head = `<a class="back-link reveal" href="#/lifts${ex.cat ? '?cat=' + ex.cat : ''}">${icon('chevRight', 'flip')} Lifts</a>
      <section class="card reveal lift-hero" style="--c:${t.color}">
        <div class="lift-hero-top">${emblem(r ? r.tier : -1, 84, r?.div)}<div class="grow"><div class="kicker">${esc(cat.name)}</div><h1 class="lift-title">${esc(ex.name)}</h1>
          ${r ? `<div class="rank-name sm">${esc(r.label)}</div>` : `<div class="muted">${ex.std ? 'Not ranked yet' : 'Tracked only, no ranking standard'}</div>`}</div></div>
        ${r ? `${ladder(r.pct)}<p class="small">Stronger than <b>${pctTxt(r.pct)}%</b> of lifters at your bodyweight · best ${C.fmtMetric(ex, r.value)} (${topSet}, ${b.profile ? 'from your profile' : fmtDate(b.date)})</p>` : ''}
        ${r && r.next ? `<div class="next-callout" style="--c:${tierInfo(r.next.tier).color}">${icon('target')}<span><b>${ex.kind === 'bw' ? `${C.round(r.need, 1)} more reps` : '+' + C.fmtW(r.need)}</b> to reach <b>${esc(r.next.label)}</b></span></div>` : ''}
        <div class="lift-actions">
          ${ex.std ? `<button class="btn primary" data-act="lift-sheet" data-id="${ex.id}">${icon(inProfile ? 'edit' : 'plus')} ${inProfile ? 'Update in profile' : 'Add to profile'}</button>` : ''}
          <a class="btn" href="#/log?ex=${ex.id}">${icon('note')} Log workout</a>
        </div>
      </section>`;
    const prog = h.length ? U.progressBlock(ex.id) : '';
    const ladderCard = r ? `<section class="card reveal"><div class="sec-head"><div><h2>Tier ladder</h2><span class="muted small">What each tier takes at ${C.fmtW(C.currentBW())}</span></div></div>${U.tierTable(ex, r)}</section>` : '';
    const empty = !r && !h.length && ex.std ? `<section class="card reveal empty-log"><div class="empty-ic">${icon('trophy')}</div><h2>Get ranked on ${esc(ex.short || ex.name)}</h2><p class="muted">Add a set you can do to your profile, or log it in a workout.</p><button class="btn primary" data-act="lift-sheet" data-id="${ex.id}">${icon('plus')} Add to profile</button></section>` : '';
    return head + empty + prog + ladderCard;
  };
})();
