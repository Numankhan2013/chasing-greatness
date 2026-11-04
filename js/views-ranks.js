'use strict';
/* Ranks page, exercise rank sheet, what-if calculator, methodology. */
(() => {
  const U = window.UI, C = U.C, { TIERS, CATEGORIES } = C;
  const { esc, icon, emblem, chip, bar, ladder, tierInfo, pctTxt, fmtDate } = U;
  const S = () => C.state;

  function exRow(e, r) {
    const t = tierInfo(r.tier);
    return `<button class="ex-row" data-act="ex-sheet" data-id="${e.id}" style="--c:${t.color}">${emblem(r.tier, 40, r.div)}
      <div class="ex-row-main"><div class="ex-row-top"><b>${esc(e.name)}</b><span class="mono small">${C.fmtMetric(e, r.value)}</span></div>${bar(r.frac, t.color)}
      <div class="ex-row-top small"><span style="color:${t.color}">${esc(r.label)}</span><span class="muted">${r.next ? `+${C.fmtMetric(e, r.need)} → ${esc(r.next.label)}` : 'Maxed'}</span></div></div></button>`;
  }

  U.tierTable = (ex, res) => `<div class="tier-table">${TIERS.map((t, i) => {
    const v = res.tierValues[i], reached = res.tier >= i;
    const val = i === 0 ? 'Start' : ex.kind === 'bw' ? `${Math.ceil(v)} reps` : C.fmtW(C.plateUp(v));
    return `<div class="tt-row ${res.tier === i ? 'cur' : ''} ${reached ? 'done' : ''}" style="--c:${t.color}">${emblem(i, 26)}<span class="tt-name">${t.name}</span><span class="muted xs">Top ${100 - t.from}%</span><span class="mono tt-val">${val}</span>${reached ? icon('check', 'tt-check') : '<span class="tt-check"></span>'}</div>`;
  }).join('')}</div>`;

  const calcWLabel = () => { const ex = C.exById(U.st.calc.ex); return ex.kind === 'bw' ? `Added weight (${C.unit()})` : ex.kind === 'db' ? `One dumbbell (${C.unit()})` : `Weight (${C.unit()})`; };
  U.calcWLabel = calcWLabel;
  U.calcResult = () => {
    const calc = U.st.calc, ex = C.exById(calc.ex);
    const w = parseFloat(calc.w) || 0, r = parseInt(calc.r, 10) || 0, bw = parseFloat(calc.bw);
    if (!(bw > 0) || !(r > 0) || (ex.kind !== 'bw' && !(w > 0))) return '<p class="muted">Enter a weight, reps and bodyweight.</p>';
    const bwKg = C.fromDisp(bw);
    const v = ex.kind === 'bw' ? C.eqReps(C.fromDisp(w), r, bwKg) : C.e1rm(C.fromDisp(w), r);
    const res = C.rankOf(ex.id, v, bwKg, calc.sex);
    if (!res) return '';
    const t = tierInfo(res.tier);
    return `<div class="calc-out" style="--c:${t.color}">${emblem(res.tier, 92, res.div)}<div><div class="rank-name sm" style="color:${t.color}">${esc(res.label)}</div>
      <div>Stronger than <b>${pctTxt(res.pct)}%</b> of ${calc.sex === 'female' ? 'women' : 'men'} who lift, at ${C.wNum(bwKg)} ${C.unit()}</div>
      <div class="muted small">${ex.kind === 'bw' ? `≈ ${C.round(v, 1)} bodyweight reps` : r > 1 ? `≈ ${C.fmtW(v)} estimated 1RM` : '1-rep max'} · ${esc(t.exp)}</div></div></div>${U.tierTable(ex, res)}`;
  };

  function methodology() {
    return `<section class="card reveal method"><h2>${icon('info')} How ranks work</h2>
      <p>Every set gets an <b>estimated one-rep max</b> (Epley: weight × (1 + reps ÷ 30)). Reps above 10 count as 10, because high-rep sets measure endurance and inflate the estimate. Pull-ups, chin-ups and dips use bodyweight reps, and added weight converts into extra reps.</p>
      <p>That estimate is compared against <b>Strength Level's standards</b>, built from about 10.9 million real logged lifts (2015–2026), <b>at your exact bodyweight and sex</b>. You get a percentile, "stronger than X% of lifters", and that decides your tier:</p>
      <div class="tier-grid">${TIERS.map((t, i) => `<div class="tg" style="--c:${t.color}">${emblem(i, 40, i < 6 ? 1 : 0)}<div><b style="color:${t.color}">${t.name}</b><div class="xs muted">${i < 6 ? `${t.from}–${TIERS[i + 1].from}th pct` : '97th+ pct'} · ${esc(t.exp)}</div></div></div>`).join('')}</div>
      <p>Each tier has three divisions (III → II → I). A <b>muscle group</b> ranks by your best exercise in it. <b>Overall</b> is the average of your groups (arms count half), so balanced lifters climb fastest.</p>
      <p class="muted small">The comparison is against people who log lifts online, who are already more committed than the general population. "Average" here is genuinely good. Liftoff works the same way at its core: it scores each set's Epley 1RM on a 1–1000 scale, using bodyweight and sex curves fitted to its own users' 546M logged sets. But it doesn't publish those curves, and it counts reps up to 30, which inflates high-rep sets.</p></section>`;
  }

  U.views.ranks = (params) => {
    if (!C.currentBW()) return U.setupView();
    const snap = C.snapshot(), o = snap.overall, filter = params.cat || 'all';
    const sections = CATEGORIES.filter((c) => filter === 'all' || c.id === filter).map((c) => {
      const d = snap.cats[c.id], exs = C.allExercises().filter((e) => e.cat === c.id);
      const ranked = exs.filter((e) => snap.exRanks[e.id]).sort((a, b) => snap.exRanks[b.id].pct - snap.exRanks[a.id].pct);
      const rest = exs.filter((e) => !snap.exRanks[e.id]);
      return `<section class="card reveal rank-sec">
        <div class="sec-head"><div class="sec-title">${emblem(d ? d.rank.tier : -1, 34, d?.rank.div)}<div><h2>${c.name}</h2><span class="muted small">${d ? `${esc(d.rank.label)} · best: ${esc(d.top.ex.short)}` : (c.long ? esc(c.long) + ' · ' : '') + 'No ranked lifts yet'}</span></div></div>${d ? `<span class="mono pct-big" style="color:${tierInfo(d.rank.tier).color}">${pctTxt(d.rank.pct)}<small>%</small></span>` : ''}</div>
        ${ranked.map((e) => exRow(e, snap.exRanks[e.id])).join('')}
        ${rest.length ? `<details class="untested" ${ranked.length ? '' : 'open'}><summary>${ranked.length ? `${rest.length} more exercise${rest.length > 1 ? 's' : ''}` : 'Exercises'} ${icon('chevDown')}</summary>${rest.map((e) => `<a class="ex-row dim" href="#/log?ex=${e.id}">${e.std ? emblem(-1, 34) : `<span class="ex-ic">${icon('dumbbell')}</span>`}<div class="ex-row-main"><b>${esc(e.name)}</b><span class="muted small">${e.std ? 'Log it to get ranked' : 'Tracked · no public standard'}</span></div>${icon('plus', 'muted')}</a>`).join('')}</details>` : ''}</section>`;
    }).join('');
    if (!U.st.calc) U.st.calc = { ex: 'bench', w: C.unit() === 'lb' ? '225' : '100', r: '1', bw: String(C.wNum(C.currentBW())), sex: S().profile.sex };
    const calc = U.st.calc;
    return `<div class="page-head reveal"><h1>Ranks</h1><span class="muted small">vs 10.9M real lifts at your bodyweight</span></div>
      ${o ? `<section class="card reveal overall-strip" style="--c:${tierInfo(o.tier).color}">${emblem(o.tier, 70, o.div)}<div class="grow"><div class="kicker">Overall</div><div class="rank-name sm" style="color:${tierInfo(o.tier).color}">${esc(o.label)}</div>${ladder(o.pct)}<div class="meter-meta"><span>Stronger than <b>${pctTxt(o.pct)}%</b></span><span class="mono">SR ${o.rating}</span></div></div></section>` : ''}
      <div class="chips-scroll reveal">${[{ id: 'all', name: 'All' }, ...CATEGORIES].map((c) => `<a href="#/ranks${c.id === 'all' ? '' : '?cat=' + c.id}" class="pill ${filter === c.id ? 'on' : ''}">${c.name}</a>`).join('')}</div>
      ${sections}
      <section class="card reveal" id="calc"><div class="sec-head"><div><h2>${icon('calc')} What-if calculator</h2><span class="muted small">"If I lift 225, what am I?"</span></div></div>
        <form id="calc-form" class="form-grid calc-form">
          <label class="span2">Exercise <select name="ex">${C.EXERCISES.filter((e) => e.std).map((e) => `<option value="${e.id}" ${e.id === calc.ex ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
          <label><span id="calc-wlabel">${calcWLabel()}</span><input name="w" type="number" inputmode="decimal" step="any" value="${esc(calc.w)}"></label>
          <label>Reps <input name="r" type="number" inputmode="numeric" min="1" max="40" value="${esc(calc.r)}"></label>
          <label>Bodyweight (${C.unit()}) <input name="bw" type="number" inputmode="decimal" step="any" min="20" value="${esc(calc.bw)}"></label>
          <label>Sex <select name="sex"><option value="male" ${calc.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${calc.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
        </form><div id="calc-result">${U.calcResult()}</div></section>
      ${methodology()}`;
  };

  U.exSheet = (id) => {
    const ex = C.exById(id), r = C.liftRank(id);
    if (!r) return;
    const t = tierInfo(r.tier), h = C.history(id), b = r.best;
    U.openSheet(`<div class="sheet-emblem">${emblem(r.tier, 120, r.div)}</div>
      <div class="center"><div class="kicker">${esc(C.catById(ex.cat).name)}</div><h2 class="sheet-title">${esc(ex.name)}</h2><div class="rank-name sm" style="color:${t.color}">${esc(r.label)}</div>
      <p>Stronger than <b>${pctTxt(r.pct)}%</b> of lifters at your bodyweight</p></div>${ladder(r.pct)}
      <div class="mini-stats"><div><span class="muted xs">Best</span><b class="mono">${C.fmtMetric(ex, r.value)}</b></div><div><span class="muted xs">Top set</span><b class="mono">${ex.kind === 'bw' ? (b.top.w ? '+' + C.wNum(b.top.w) : 'BW') : C.wNum(b.top.w)}×${b.top.r}${ex.kind === 'db' ? ' <small class="muted">each</small>' : ''}</b></div><div><span class="muted xs">Set on</span><b>${fmtDate(b.date)}</b></div><div><span class="muted xs">Sessions</span><b class="mono">${h.length}</b></div></div>
      ${r.next ? `<div class="next-callout" style="--c:${tierInfo(r.next.tier).color}">${icon('target')}<span><b>${ex.kind === 'bw' ? `${C.round(r.need, 1)} more reps` : '+' + C.fmtW(r.need)}</b> to reach <b>${esc(r.next.label)}</b>${ex.kind !== 'bw' ? ` (a ${C.fmtW(C.plateUp(r.nextValue))} max)` : ''}</span></div>` : ''}
      <h3 class="sub">Tier ladder at ${C.fmtW(C.currentBW())}</h3>${U.tierTable(ex, r)}
      <div class="actions"><a class="btn primary" href="#/progress?ex=${id}">${icon('chart')} Progress</a><a class="btn ghost" href="#/log?ex=${id}">${icon('plus')} Log it</a></div>`);
  };
})();
