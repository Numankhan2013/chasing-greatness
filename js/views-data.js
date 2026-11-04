'use strict';
/* Progress + Insights views. */
(() => {
  const U = window.UI, C = U.C, { TIERS, CATEGORIES } = C;
  const { esc, icon, emblem, chip, bar, tierInfo, pctTxt, fmtDate, afterRender, mountChart } = U;
  const S = () => C.state;
  const dtAxis = { type: 'datetime', labels: { datetimeUTC: false }, axisBorder: { show: false }, axisTicks: { show: false } };
  const tierLabel = (t, offsetY = 0) => ({ text: t.name.toUpperCase(), position: 'left', textAnchor: 'start', offsetX: 6, offsetY, borderWidth: 0, style: { background: 'transparent', color: t.color, fontSize: '10px', fontWeight: 700 } });

  function bodyweightCard() {
    const bws = [...S().bodyweights].sort((a, b) => a.date.localeCompare(b.date));
    if (bws.length > 1) afterRender(() => mountChart('#bw-chart', {
      chart: { type: 'area', height: 190 }, series: [{ name: 'Bodyweight', data: bws.map((b) => ({ x: C.parseDate(b.date).getTime(), y: C.wNum(b.kg) })) }],
      xaxis: dtAxis, yaxis: { tickAmount: 3, labels: { formatter: (v) => C.round(v, 1) } }, stroke: { curve: 'smooth', width: 2.5 }, colors: ['#7aa2ff'],
      fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0 } }, markers: { size: 0, hover: { size: 5 } },
      tooltip: { x: { format: 'MMM d, yyyy' }, y: { formatter: (v) => `${v} ${C.unit()}` } },
    }));
    return `<section class="card reveal"><div class="sec-head"><div><h2>Bodyweight</h2><span class="muted small">Ranks use your latest weigh-in</span></div><b class="mono">${C.currentBW() ? C.fmtW(C.currentBW()) : ''}</b></div>
      ${bws.length > 1 ? '<div id="bw-chart"></div>' : ''}
      <form id="bw-form" class="inline-form"><input type="number" name="bw" inputmode="decimal" step="0.1" min="20" placeholder="Weight (${C.unit()})" aria-label="Today's bodyweight in ${C.unit()}" required><button class="btn primary sm">${icon('scale')} Log weigh-in</button></form></section>`;
  }

  U.views.progress = (params) => {
    if (!C.currentBW()) return U.setupView();
    const trained = C.trainedExercises();
    if (!trained.length) return `<div class="page-head"><h1>Progress</h1></div><section class="card empty-log"><div class="empty-ic">${icon('chart')}</div><p class="muted">Charts appear once you've logged a lift.</p><a class="btn primary" href="#/log">${icon('plus')} Log a workout</a></section>${bodyweightCard()}`;
    const sel = params.ex && C.history(params.ex).length ? params.ex : (trained.find((e) => e.std) || trained[0]).id;
    const ex = C.exById(sel), h = C.history(sel), best = C.bestOf(sel), r = C.rankOf(sel, best.best);
    const color = r ? tierInfo(r.tier).color : '#ff7a3d', tr = C.trend(sel), gain = best.best - h[0].best;
    const disp = (v) => (ex.kind === 'bw' ? C.round(v, 1) : C.wNum(v));
    const reps = C.derived().repPRs[sel] || {};
    afterRender(() => {
      const ys = h.map((p) => disp(p.best));
      let lo = Math.min(...ys), hi = Math.max(...ys);
      const refs = [];
      if (r) TIERS.forEach((t, i) => { const v = disp(r.tierValues[i]); if (i > 0 && (i === r.tier || i === r.tier + 1 || (v >= lo && v <= hi))) refs.push({ v, t }); });
      refs.forEach((x) => { lo = Math.min(lo, x.v); hi = Math.max(hi, x.v); });
      const pad = (hi - lo) * 0.12 || hi * 0.1 || 1;
      mountChart('#ex-chart', {
        chart: { type: h.length < 2 ? 'scatter' : 'area', height: 280 },
        series: [{ name: ex.kind === 'bw' ? 'Equivalent reps' : 'Estimated 1RM', data: h.map((p) => ({ x: C.parseDate(p.date).getTime(), y: disp(p.best) })) }],
        // One session: centre the dot in a two-week window instead of a squashed axis with a spike.
        xaxis: { ...dtAxis, labels: { datetimeUTC: false, format: 'MMM d' }, ...(h.length < 2 ? { min: C.parseDate(h[0].date).getTime() - 7 * C.DAY, max: C.parseDate(h[0].date).getTime() + 7 * C.DAY } : {}) }, yaxis: { min: Math.max(0, lo - pad), max: hi + pad, tickAmount: 4, labels: { formatter: (v) => Math.round(v) } },
        stroke: { curve: 'smooth', width: 3 }, colors: [color],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0, stops: [0, 100] } },
        markers: { size: 3, strokeWidth: 0, hover: { size: 6 }, discrete: h.map((p, i) => (p.pr ? { seriesIndex: 0, dataPointIndex: i, fillColor: '#ffd25e', strokeColor: '#fff', size: 5 } : null)).filter(Boolean) },
        annotations: { yaxis: refs.map(({ v, t }) => ({ y: v, borderColor: t.color, strokeDashArray: 5, opacity: 0.7, label: tierLabel(t) })) },
        tooltip: { x: { format: 'MMM d, yyyy' }, y: { formatter: (v) => (ex.kind === 'bw' ? `${v} reps` : `${v} ${C.unit()}`) } },
      });
      const vol = C.volumeByWeek(12);
      mountChart('#vol-chart', {
        chart: { type: 'bar', height: 200 }, series: [{ name: 'Volume', data: vol.map((v) => Math.round(C.toDisp(v.v))) }],
        xaxis: { categories: vol.map((v) => fmtDate(v.k)), labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { formatter: (v) => (v >= 1000 ? `${C.round(v / 1000, 1)}k` : Math.round(v)) } },
        plotOptions: { bar: { borderRadius: 5, columnWidth: '58%' } }, colors: ['#ff7a3d'],
        fill: { type: 'gradient', gradient: { type: 'vertical', gradientToColors: ['#ffb547'], opacityFrom: 1, opacityTo: 0.85 } },
        tooltip: { y: { formatter: (v) => `${v.toLocaleString()} ${C.unit()}` } },
      });
    });
    const topSet = (p) => `${ex.kind === 'bw' ? (p.top.w ? '+' + C.wNum(p.top.w) : 'BW') : C.wNum(p.top.w)}×${p.top.r}`;
    return `<div class="page-head reveal"><h1>Progress</h1></div>
      <div class="chips-scroll reveal">${trained.map((e) => `<a href="#/progress?ex=${e.id}" class="pill ${e.id === sel ? 'on' : ''}">${esc(e.short || e.name)}</a>`).join('')}</div>
      <section class="card reveal"><div class="sec-head"><div class="sec-title">${r ? emblem(r.tier, 40, r.div) : ''}<div><h2>${esc(ex.name)}</h2><span class="muted small">${ex.kind === 'bw' ? 'Equivalent bodyweight reps' : 'Estimated 1-rep max'} per session${r ? ' · dashed lines = tiers' : ''}</span></div></div>${r ? chip(r.tier, r.label) : ''}</div>
        <div id="ex-chart" class="chart-box"></div>
        <div class="mini-stats"><div><span class="muted xs">Best</span><b class="mono">${C.fmtMetric(ex, best.best)}</b></div><div><span class="muted xs">Since start</span><b class="mono ${gain >= 0 ? 'pos' : 'neg'}">${gain >= 0 ? '+' : '−'}${C.fmtMetric(ex, Math.abs(gain))}</b></div><div><span class="muted xs">Trend</span><b class="mono">${tr ? `${tr.perMonth >= 0 ? '+' : '−'}${C.fmtMetric(ex, Math.abs(tr.perMonth))}/mo` : '—'}</b></div><div><span class="muted xs">Sessions</span><b class="mono">${h.length}</b></div></div></section>
      <section class="two-col">
        ${ex.kind !== 'bw' && Object.keys(reps).length ? `<div class="card reveal"><h2>Rep records</h2><p class="muted small">Heaviest weight for each rep count.</p><div class="rep-grid">${[1, 2, 3, 5, 8, 10, 12].map((n) => `<div class="rep-cell ${reps[n] ? '' : 'dim'}"><span class="xs muted">${n} rep${n > 1 ? 's' : ''}</span><b class="mono">${reps[n] ? C.wNum(reps[n].w) : '—'}</b>${reps[n] ? `<span class="xs muted">${fmtDate(reps[n].date)}</span>` : ''}</div>`).join('')}</div></div>` : ''}
        <div class="card reveal"><h2>PR timeline</h2>${h.filter((p) => p.pr).slice(-6).reverse().map((p) => `<div class="pr-row"><span>${icon('trophy', 'gold')} ${fmtDate(p.date, true)}</span><span class="muted mono">${topSet(p)}</span><b class="mono">${C.fmtMetric(ex, p.best)}</b></div>`).join('')}</div></section>
      <section class="card reveal"><div class="sec-head"><div><h2>Weekly volume</h2><span class="muted small">All exercises · weight × reps</span></div></div><div id="vol-chart"></div></section>
      ${bodyweightCard()}`;
  };

  /* ── Insights ── */
  U.views.insights = () => {
    if (!C.currentBW()) return U.setupView();
    const ws = S().workouts;
    if (!ws.length) return `<div class="page-head"><h1>Insights</h1></div><section class="card empty-log"><div class="empty-ic">${icon('bulb')}</div><h2>Insights unlock as you log</h2><p class="muted">After a few sessions you'll see your strength profile, weak links, weekly sets per muscle, stalls, and when you'll hit your next rank.</p><a class="btn primary" href="#/log">${icon('plus')} Log a workout</a></section>`;
    const snap = C.snapshot(), o = snap.overall, today = C.todayISO(), cards = [];
    const add = (tone, ic, title, body) => cards.push(`<article class="insight ${tone} reveal"><div class="ins-ic">${icon(ic)}</div><div><h3>${title}</h3><p>${body}</p></div></article>`);

    const streak = C.weekStreak();
    const perWeek = Array.from({ length: 8 }, (_, i) => { const wk = C.addDays(C.weekStart(today), -7 * (i + 1)); return ws.filter((w) => C.weekStart(w.date) === wk).length; });
    const avg = perWeek.reduce((a, b) => a + b, 0) / 8;
    const gap = C.daysBetween(ws.reduce((a, w) => (w.date > a ? w.date : a), ws[0].date), today);
    if (gap >= 5) add('warn', 'calendar', `${gap} days since your last workout`, 'Strength fades slower than you think, but momentum fades fast. A short session today keeps the chain alive.');
    if (streak >= 2) add('good', 'flame', `${streak}-week streak`, `You've trained every week for ${streak} straight weeks${avg ? `, averaging ${C.round(avg, 1)} sessions a week over the last 8` : ''}. Consistency beats intensity.`);

    const pc = (id) => snap.cats[id]?.rank.pct;
    const pairs = [
      ['Push vs pull', ['chest', 'shoulders'], ['back'], 'pushing (chest + shoulders)', 'pulling (back)', 'Shoulder health depends on this balance. Add rows or pull-ups.', 'Your back is out-pulling your pressing. Easy win: more bench and overhead work.'],
      ['Upper vs lower', ['chest', 'shoulders', 'back'], ['legs', 'hinge'], 'upper body', 'lower body', 'The classic skipped-leg-day pattern. Squats and deadlifts move your overall rank fastest.', 'Your legs are carrying your rank, and your upper body has the most room to grow.'],
      ['Quads vs posterior', ['legs'], ['hinge'], 'quads (legs)', 'posterior chain', 'Bring up hinges (RDLs, hip thrusts) to protect knees and lower back.', 'Strong posterior chain. More squats will round it out.'],
    ];
    for (const [title, A, B, an, bn, aHigh, bHigh] of pairs) {
      const a = A.map(pc).filter((x) => x != null), b = B.map(pc).filter((x) => x != null);
      if (!a.length || !b.length) continue;
      const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
      if (Math.abs(ma - mb) >= 18) add('info', 'scaleBal', `${title} imbalance`, `Your ${ma > mb ? an : bn} is at the ${Math.round(Math.max(ma, mb))}th percentile, but your ${ma > mb ? bn : an} is at the ${Math.round(Math.min(ma, mb))}th. ${ma > mb ? aHigh : bHigh}`);
    }
    const catList = Object.values(snap.cats).sort((a, b) => b.rank.pct - a.rank.pct);
    if (catList.length >= 3) add('good', 'medal', `Strongest: ${catList[0].cat.name}`, `${esc(catList[0].top.ex.name)} puts your ${catList[0].cat.name.toLowerCase()} at <b style="color:${tierInfo(catList[0].rank.tier).color}">${esc(catList[0].rank.label)}</b>. Your weakest group is ${catList.at(-1).cat.name.toLowerCase()} (${esc(catList.at(-1).rank.label)}), and raising it is the fastest way up overall.`);
    const missing = CATEGORIES.filter((c) => !snap.cats[c.id]);
    if (missing.length && o) add('info', 'layers', `${missing.length} muscle group${missing.length > 1 ? 's' : ''} unranked`, `Your overall rank doesn't include ${missing.map((c) => c.name.toLowerCase()).join(', ')} yet. <a class="link" href="#/profile">Add a lift to your profile</a> or log one in a workout to get the full picture.`);

    const proj = [];
    for (const [id, r] of Object.entries(snap.exRanks)) {
      const ex = C.exById(id), h = C.history(id), tr = C.trend(id);
      if (!h.length) continue; // ranked from the strength profile only: no workout history to analyse
      const lastPR = [...h].reverse().find((p) => p.pr), sincePR = lastPR ? C.daysBetween(lastPR.date, today) : 0, idle = C.daysBetween(h.at(-1).date, today);
      if (idle >= 21 && h.length >= 3) add('warn', 'warn', `${esc(ex.short)} is getting neglected`, `Last trained ${idle} days ago. Ranks are earned and kept, so work it back in.`);
      else if (sincePR >= 28 && h.length >= 5) add('warn', 'target', `${esc(ex.short)} has stalled`, `No PR in ${Math.round(sincePR / 7)} weeks. Try a deload week, a new rep range (5×5 → 4×8), or check sleep and food.`);
      if (tr && tr.perDay > 0 && r.next) proj.push({ ex, r, tr, days: r.need / tr.perDay });
      else if (tr && tr.perMonth < 0 && Math.abs(tr.perMonth) > r.value * 0.01) add('warn', 'down', `${esc(ex.short)} trending down`, `Estimated max is slipping about ${C.fmtMetric(ex, -tr.perMonth)}/month. Recovery (sleep, food, stress) shows up here first.`);
    }
    proj.sort((a, b) => a.days - b.days);

    const prs = C.prsSince(30);
    if (prs.length) add('good', 'trophy', `${prs.length} PR${prs.length > 1 ? 's' : ''} in 30 days`, prs.slice(0, 4).map((p) => `${esc(p.ex.short)} ${C.fmtMetric(p.ex, p.p.best)}`).join(' · ') + (prs.length > 4 ? ' …' : ''));
    const vol = C.volumeByWeek(8), va = vol.slice(0, 4).reduce((s, x) => s + x.v, 0), vb = vol.slice(4).reduce((s, x) => s + x.v, 0);
    if (va > 0 && vb > 0 && Math.abs((vb - va) / va) >= 0.1) { const p = ((vb - va) / va) * 100; add(p > 0 ? 'good' : 'info', 'bars', `Volume ${p > 0 ? 'up' : 'down'} ${Math.abs(Math.round(p))}%`, `${C.fmtW(vb)} moved in the last 4 weeks vs ${C.fmtW(va)} the 4 before.${p < -25 ? ' Planned deload? Great. Unplanned? Worth a look.' : ''}`); }
    const bws = [...S().bodyweights].filter((b) => b.date >= C.addDays(today, -60)).sort((a, b) => a.date.localeCompare(b.date));
    if (bws.length >= 2 && Math.abs(C.toDisp(bws.at(-1).kg - bws[0].kg)) >= 1) { const diff = bws.at(-1).kg - bws[0].kg; add('info', 'scale', `Bodyweight ${diff > 0 ? 'up' : 'down'} ${C.fmtW(Math.abs(diff))}`, `Over ${C.daysBetween(bws[0].date, bws.at(-1).date)} days. Standards scale with bodyweight, so ${diff > 0 ? 'you need slightly bigger numbers for the same rank' : 'your current lifts now count for a little more'}.`); }

    const setsWk = C.setsByCategory(7);
    const setBars = CATEGORIES.map((c) => {
      const n = setsWk[c.id] || 0, target = c.id === 'arms' ? 6 : 10;
      const tone = n === 0 ? 'zero' : n < target ? 'low' : n > 22 ? 'high' : 'ok';
      return `<div class="sb-row"><span class="sb-name">${c.name}</span><div class="sb-track"><span class="sb-band" style="left:${(target / 25) * 100}%;width:${((20 - target) / 25) * 100}%"></span><span class="sb-fill ${tone}" style="width:${Math.min(100, (n / 25) * 100)}%"></span></div><b class="mono sb-n">${n}</b></div>`;
    }).join('');
    const under = CATEGORIES.filter((c) => (setsWk[c.id] || 0) < (c.id === 'arms' ? 6 : 10) && snap.cats[c.id]);

    const tl = C.rankTimeline(26);
    if (tl.length >= 2) afterRender(() => {
      const lo = Math.max(0, Math.min(...tl.map((x) => x.pct)) - 8), hi = Math.min(100, Math.max(...tl.map((x) => x.pct)) + 8);
      mountChart('#tl-chart', {
        chart: { type: 'area', height: 260 }, series: [{ name: 'Overall percentile', data: tl.map((x) => ({ x: C.parseDate(x.date).getTime(), y: C.round(x.pct, 1) })) }],
        xaxis: dtAxis, yaxis: { min: lo, max: hi, tickAmount: 4, labels: { formatter: (v) => `${Math.round(v)}%` } },
        stroke: { curve: 'smooth', width: 3 }, colors: [tierInfo(o.tier).color],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0 } }, markers: { size: 0, hover: { size: 5 } },
        annotations: { yaxis: TIERS.map((t, i) => ({ y: t.from, y2: TIERS[i + 1]?.from ?? 100, fillColor: t.color, opacity: 0.06, borderColor: 'transparent', label: tierLabel(t, 14) })).filter((a) => a.y2 > lo && a.y < hi) },
        tooltip: { x: { format: 'MMM d, yyyy' }, y: { formatter: (v, { dataPointIndex }) => `${tl[dataPointIndex].label} · ${v}%` } },
      });
    });
    if (o) afterRender(() => U.radarChart('#radar2', snap, tierInfo(o.tier).color));
    const f = tl[0], l = tl.at(-1);

    return `<div class="page-head reveal"><h1>Insights</h1><span class="muted small">Live from your log</span></div>
      ${tl.length >= 2 ? `<section class="card reveal"><div class="sec-head"><div><h2>Your climb</h2><span class="muted small">Overall rank over time</span></div>${l.pct >= f.pct ? `<span class="chip" style="--c:#4ee6a0">${icon('up')} +${C.round(l.pct - f.pct, 1)} pts</span>` : ''}</div><div id="tl-chart"></div>
        <p class="muted small">${f.label === l.label ? `Holding ${esc(l.label)} since ${fmtDate(f.date)}.` : `${esc(f.label)} on ${fmtDate(f.date)} → <b style="color:${tierInfo(l.tier).color}">${esc(l.label)}</b> today.`}</p></section>` : ''}
      ${proj.length ? `<section class="card reveal"><div class="sec-head"><div><h2>Next rank-ups</h2><span class="muted small">Projected from your last 4 months</span></div></div>${proj.slice(0, 5).map((p) => {
        const nt = tierInfo(p.r.next.tier), when = p.days < 7 ? 'this week' : p.days < 11 ? "~1 week" : p.days < 60 ? `~${Math.round(p.days / 7)} weeks` : p.days < 540 ? `~${Math.round(p.days / 30)} months` : 'long grind';
        return `<div class="proj-row">${emblem(p.r.tier, 34, p.r.div)}<div class="grow"><b>${esc(p.ex.short)}</b> <span class="muted xs">${C.fmtMetric(p.ex, p.r.value)} → ${C.fmtMetric(p.ex, p.r.nextValue)} · +${C.fmtMetric(p.ex, p.tr.perMonth)}/mo</span>${bar(p.r.frac, tierInfo(p.r.tier).color)}</div><div class="proj-when"><span style="color:${nt.color}">${esc(p.r.next.label)}</span><b>${when}</b></div></div>`;
      }).join('')}</section>` : ''}
      <section class="two-col">
        ${o ? `<div class="card reveal"><div class="sec-head"><h2>Strength profile</h2>${chip(o.tier, o.label)}</div><div id="radar2" class="radar"></div></div>` : ''}
        <div class="card reveal"><div class="sec-head"><div><h2>This week's sets</h2><span class="muted small">Last 7 days · band = 10–20 hard sets, the research-backed range for growth</span></div></div>
          <div class="sb">${setBars}</div><p class="muted small">${under.length ? `Under target: ${under.map((c) => c.name.toLowerCase()).join(', ')}.` : 'Every trained group is in the zone. Textbook.'}</p></div></section>
      <div class="insights">${cards.join('')}</div>`;
  };
})();
