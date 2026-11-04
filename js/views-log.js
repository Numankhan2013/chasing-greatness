'use strict';
/* Log flow: exercise-first, date defaults to today (tucked in a chip), persisted draft,
 * exercise picker sheet, ✓ = set done + rest timer, summary sheet with PRs & rank-ups. */
(() => {
  const U = window.UI, C = U.C, { CATEGORIES } = C;
  const { $, $$, esc, icon, emblem, chip, tierInfo, pctTxt, relDate, unitLabel, toast } = U;
  const S = () => C.state;
  const DRAFT_KEY = 'chasing-greatness.draft';
  const st = U.st;

  const blankSet = () => ({ w: '', r: '', done: false });
  const loadDraft = () => { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (d && Array.isArray(d.entries)) return d; } catch (e) { /* noop */ } return null; };
  U.persistDraft = () => { try { if (st.draft && !st.draft.id) localStorage.setItem(DRAFT_KEY, JSON.stringify(st.draft)); } catch (e) { /* noop */ } };
  U.clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* noop */ } };
  U.newDraft = () => ({ id: null, mode: null, date: C.todayISO(), dateTouched: false, notes: '', showNotes: false, entries: [] });
  U.blankSet = blankSet;
  const editDraft = (w) => ({ id: w.id, mode: 'past', date: w.date, dateTouched: true, notes: w.notes || '', showNotes: !!w.notes,
    entries: w.entries.map((en) => ({ ex: en.ex, sets: en.sets.map((s) => ({ w: s.w ? String(C.wNum(s.w)) : (C.exById(en.ex).kind === 'bw' ? '0' : ''), r: s.r ? String(s.r) : '', done: true })) })) });
  const sortedWorkouts = () => [...S().workouts].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);

  U.lastSession = (exId) => lastSession(exId);
  function lastSession(exId) {
    const p = C.history(exId).filter((x) => !st.draft?.id || x.wid !== st.draft.id).at(-1);
    if (!p) return null;
    const en = S().workouts.find((x) => x.id === p.wid)?.entries.find((e) => e.ex === exId);
    return en ? { date: p.date, en } : null;
  }
  U.addEntry = (exId) => {
    const last = lastSession(exId);
    st.draft.entries.push({ ex: exId, sets: Array.from({ length: last ? Math.min(Math.max(last.en.sets.length, 1), 6) : 3 }, blankSet) });
    U.persistDraft();
  };

  U.views.log = (params) => {
    if (!C.currentBW()) return U.setupView();
    if (params.id) {
      if (!st.draft || st.draft.id !== params.id) {
        const w = S().workouts.find((x) => x.id === params.id);
        if (!w) { location.hash = '#/history'; return ''; }
        if (st.draft && !st.draft.id) st.stash = st.draft;
        st.draft = editDraft(w);
      }
    } else {
      if (st.draft?.id) { st.draft = st.stash || loadDraft() || U.newDraft(); st.stash = null; }
      if (!st.draft) st.draft = loadDraft() || U.newDraft();
      if (!st.draft.dateTouched) st.draft.date = C.todayISO();
      if (params.ex && C.allExercises().some((e) => e.id === params.ex) && !st.draft.entries.some((e) => e.ex === params.ex)) { st.draft.mode ||= 'past'; U.addEntry(params.ex); }
      if (params.ex) history.replaceState(null, '', '#/log');
    }
    return U.renderLog();
  };

  const setCount = () => st.draft.entries.reduce((n, en) => n + en.sets.filter((s) => parseInt(s.r, 10) > 0).length, 0);
  U.finishMeta = () => { const n = setCount(), e = st.draft.entries.length; return `${e} exercise${e > 1 ? 's' : ''} · ${n} set${n === 1 ? '' : 's'}`; };

  const modeChooser = () => `<div class="page-head reveal"><h1>Log</h1></div>
    <button class="mode-card reveal" data-act="mode" data-mode="past"><span class="mode-ic">${icon('clipboard')}</span><span class="grow"><b>I finished a workout</b><span class="muted">Quick entry afterwards: exercises, weights and reps. No timers.</span></span>${icon('chevRight', 'muted')}</button>
    <button class="mode-card reveal" data-act="mode" data-mode="live"><span class="mode-ic live">${icon('play')}</span><span class="grow"><b>I'm working out now</b><span class="muted">Tick off sets as you go, with a rest timer.</span></span>${icon('chevRight', 'muted')}</button>
    <a class="mode-link reveal" href="#/profile?edit=1">${icon('user')}<span>Not a workout? <b>Update your strength profile</b> to see where you stand.</span>${icon('chevRight')}</a>`;

  U.renderLog = () => {
    const d = st.draft;
    if (!d.id && !d.mode && !d.entries.length) return modeChooser();
    const live = d.mode === 'live';
    const recent = [];
    for (const w of sortedWorkouts()) for (const en of w.entries) if (!recent.includes(en.ex) && !d.entries.some((x) => x.ex === en.ex)) recent.push(en.ex);
    const lastW = sortedWorkouts()[0];
    const today = C.todayISO(), yday = C.addDays(today, -1);
    const dateCtl = live ? `<span class="live-dot">Live · today</span>` : `
          <button class="date-chip ${d.date === today ? 'sel' : ''}" data-act="set-date" data-d="${today}">Today</button>
          <button class="date-chip ${d.date === yday ? 'sel' : ''}" data-act="set-date" data-d="${yday}">Yesterday</button>
          <label class="date-chip ${d.date !== today && d.date !== yday ? 'sel' : ''}">${icon('calendar')}<span>${d.date !== today && d.date !== yday ? relDate(d.date) : 'Other day'}</span><input type="date" id="log-date" value="${d.date}" max="${today}" aria-label="Pick workout date"></label>`;
    return `<div class="log-head reveal"><div><h1>${d.id ? 'Edit workout' : live ? 'Live workout' : 'Log a workout'}</h1>
        <div class="log-meta">${dateCtl}
          <button class="date-chip" data-act="toggle-notes">${icon('note')}<span>${d.notes ? 'Note added' : 'Note'}</span></button>
        </div></div>
        ${d.id ? '<button class="btn sm" data-act="cancel-edit">Cancel</button>' : '<button class="btn sm" data-act="discard">Discard</button>'}</div>
      ${d.showNotes ? `<input class="notes" id="log-notes" value="${esc(d.notes)}" placeholder="How did it feel? Sleep, energy, anything…">` : ''}
      ${d.entries.length ? '' : `<section class="empty-log card reveal"><div class="empty-ic">${icon('dumbbell')}</div><h2>${live ? 'What are we hitting today?' : 'What did you train?'}</h2>
        <p class="muted">${live ? 'Add your first exercise and tick off sets as you go.' : 'Add each exercise with the weight and reps you did.'}</p>
        <button class="btn primary lg" data-act="pick">${icon('plus')} Add exercise</button>
        ${recent.length ? `<div class="quick"><span class="muted xs">Recent</span><div class="quick-chips">${recent.slice(0, 8).map((id) => `<button class="pill" data-act="quick-add" data-id="${id}">${esc(C.exById(id).short)}</button>`).join('')}</div></div>` : ''}
        ${lastW ? `<button class="btn ghost sm" data-act="repeat-last">${icon('repeat')} Repeat last workout (${relDate(lastW.date).toLowerCase()})</button>` : ''}</section>`}
      <div id="entries">${d.entries.map(entryCard).join('')}</div>
      ${d.entries.length ? `<button class="btn ghost wide add-ex" data-act="pick">${icon('plus')} Add exercise</button>
        <div class="finish-bar"><button class="btn primary lg wide" data-act="finish">${icon('check')} ${d.id ? 'Save changes' : live ? 'Finish workout' : 'Save workout'}<span class="finish-meta">${U.finishMeta()}</span></button></div>` : ''}
      ${d.id ? `<button class="btn danger wide" data-act="del-wo" data-id="${d.id}">${icon('trash')} Delete this workout</button>` : ''}`;
  };

  function entryCard(en, ei) {
    const ex = C.exById(en.ex), last = lastSession(en.ex), lr = C.liftRank(en.ex), u = C.unit(), live = st.draft.mode === 'live';
    const col = ex.kind === 'db' ? `One DB (${u})` : ex.kind === 'bw' ? `Extra ${u}` : `Weight (${u})`;
    const howto = ex.kind === 'db' ? `<div class="howto">${icon('dumbbell')}<span>Enter the weight of <b>one dumbbell</b>. Holding 25 ${u} in each hand? Enter <b>25</b>.</span></div>`
      : ex.kind === 'bw' ? `<div class="howto">${icon('info')}<span>Your bodyweight counts automatically. Enter <b>0</b>, or only the <b>extra</b> weight (belt or vest).</span></div>` : '';
    return `<section class="card entry" data-e="${ei}">
      <div class="entry-head"><div class="entry-title">${ex.std ? emblem(lr ? lr.tier : -1, 34, lr?.div) : `<span class="ex-ic">${icon('dumbbell')}</span>`}<div><b>${esc(ex.name)}</b><span class="muted xs">${esc(C.catById(ex.cat).name)}${ex.std ? (lr ? ' · ' + esc(lr.label) : '') : ' · not ranked'}</span></div></div>
        <button class="icon-btn" data-act="rm-entry" data-e="${ei}" aria-label="Remove ${esc(ex.name)}" title="Remove exercise">${icon('trash')}</button></div>
      ${howto}
      ${last ? `<div class="last">${icon('history')} Last time, ${relDate(last.date).toLowerCase()}: ${U.summarizeEntry(last.en).replace(/<b>.*?<\/b>/, '').replace(/<[^>]+>/g, '').trim()}${ex.kind === 'bw' ? '' : ' ' + u}${live ? '' : `<button class="copy-btn" data-act="copy-last" data-e="${ei}">${icon('copy')} Same again</button>`}</div>` : ''}
      <div class="sets ${live ? 'live' : 'past'}"><div class="set-row head"><span>Set</span><span>${col}</span><span>Reps</span>${live ? '<span>Done</span>' : ''}</div>
        ${en.sets.map((s, si) => {
          const ls = last?.en.sets[si] || last?.en.sets.at(-1);
          const phW = ls ? (ex.kind === 'bw' && !ls.w ? '0' : String(C.wNum(ls.w))) : ex.kind === 'bw' ? '0' : '';
          return `<div class="set-row ${s.done ? 'done' : ''}" data-s="${si}">
            <span class="set-n">${si + 1}</span>
            <input type="number" inputmode="decimal" step="any" data-f="w" value="${esc(s.w)}" placeholder="${phW}" aria-label="${col}, set ${si + 1}">
            <input type="number" inputmode="numeric" step="1" min="0" data-f="r" value="${esc(s.r)}" placeholder="${ls ? ls.r : ''}" aria-label="Reps, set ${si + 1}">
            ${live ? `<button class="check" data-act="done-set" data-e="${ei}" data-s="${si}" aria-label="Mark set ${si + 1} done">${icon('check')}</button>` : ''}</div>`;
        }).join('')}</div>
      <div class="entry-foot"><div class="stepper"><button class="btn sm" data-act="rm-set" data-e="${ei}" aria-label="Remove last set" ${en.sets.length <= 1 ? 'disabled' : ''}>${icon('minus')}</button><span class="xs muted">Sets</span><button class="btn sm" data-act="add-set" data-e="${ei}" aria-label="Add a set">${icon('plus')}</button></div><div class="preview" data-preview="${ei}">${U.entryPreview(en)}</div></div>
      <div data-sanity="${ei}">${U.entrySanity(en, ei)}</div></section>`;
  }

  U.entryPreview = (en) => {
    const ex = C.exById(en.ex), bw = C.bwAt(st.draft.date) || C.currentBW();
    let best = 0;
    for (const s of en.sets) { const w = parseFloat(s.w) || 0, r = parseInt(s.r, 10); if (r > 0 && (w > 0 || ex.kind === 'bw')) best = Math.max(best, C.setMetric(ex, { w: C.fromDisp(w), r }, bw)); }
    if (!best) return '';
    const prev = C.bestKnown(en.ex), isPR = prev && best > prev.best + 1e-6 && (!st.draft.id || prev.wid !== st.draft.id);
    const r = C.rankOf(en.ex, best);
    return `<span class="muted">${ex.kind === 'bw' ? 'Equiv.' : 'Est. max'}</span> <b class="mono">${C.fmtMetric(ex, best)}</b>${r ? chip(r.tier, r.label) : ''}${isPR ? `<span class="chip pr">${icon('trophy')} PR</span>` : ''}`;
  };

  /* Catch likely typos: a top-3% result is rare, and for dumbbells it usually means both bells were added up. */
  U.entrySanity = (en, ei) => {
    const ex = C.exById(en.ex);
    if (!ex.std) return '';
    const bw = C.bwAt(st.draft.date) || C.currentBW();
    let best = 0;
    for (const s of en.sets) { const w = parseFloat(s.w) || 0, r = parseInt(s.r, 10); if (r > 0 && (w > 0 || ex.kind === 'bw')) best = Math.max(best, C.setMetric(ex, { w: C.fromDisp(w), r }, bw)); }
    const r = best ? C.rankOf(en.ex, best) : null;
    if (!r || r.pct < 97) return '';
    if (ex.kind === 'db') return `<div class="sanity">${icon('warn')}<span>That's top 3% of all lifters. <b>Did you add both dumbbells together?</b> Enter the weight of <b>one</b> dumbbell.</span><button class="btn sm" data-act="halve" data-e="${ei}">Use half</button></div>`;
    return `<div class="sanity">${icon('warn')}<span>That's top 3% of all lifters. Double-check the weight and reps.</span></div>`;
  };

  /* ── exercise picker ── */
  U.pickerSheet = () => {
    U.openSheet(`<div class="picker"><h2 class="sheet-title">Add exercise</h2>
      <div class="search">${icon('search')}<input id="pick-q" placeholder="Search exercises…" autocomplete="off"></div>
      <div class="chips-scroll" id="pick-cats">${[{ id: 'all', name: 'All' }, ...CATEGORIES, { id: 'other', name: 'Other' }].map((c) => `<button class="pill ${c.id === 'all' ? 'on' : ''}" data-act="pick-cat" data-id="${c.id}">${c.name}</button>`).join('')}</div>
      <div id="pick-list" class="pick-list" data-cat="all">${U.pickList('', 'all')}</div></div>`, 'tall');
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => $('#pick-q')?.focus(), 280);
  };
  U.pickList = (q, cat) => {
    const ql = q.trim().toLowerCase(), inDraft = new Set(st.draft.entries.map((e) => e.ex));
    const recentIds = [];
    for (const w of sortedWorkouts()) for (const en of w.entries) if (!recentIds.includes(en.ex)) recentIds.push(en.ex);
    const list = C.allExercises().filter((e) => (cat === 'all' || e.cat === cat) && (!ql || e.name.toLowerCase().includes(ql) || (e.short || '').toLowerCase().includes(ql)));
    const row = (e) => {
      const lr = C.liftRank(e.id);
      return `<button class="pick-row ${inDraft.has(e.id) ? 'added' : ''}" data-act="pick-ex" data-id="${e.id}">${e.std ? emblem(lr ? lr.tier : -1, 30, lr?.div) : `<span class="ex-ic sm">${icon('dumbbell')}</span>`}
        <span class="pick-name"><b>${esc(e.name)}</b><span class="muted xs">${esc(C.catById(e.cat).name)}${e.kind === 'db' ? ' · dumbbell (enter one)' : e.kind === 'bw' ? ' · bodyweight' : ''}${e.std ? (lr ? ` · ${esc(lr.label)}` : ' · ranked') : ' · unranked'}</span></span>
        ${inDraft.has(e.id) ? icon('check', 'ok') : icon('plus', 'muted')}</button>`;
    };
    let html = '';
    if (!ql && cat === 'all' && recentIds.length) html += '<div class="pick-group">Recent</div>' + recentIds.slice(0, 5).map((id) => row(C.exById(id))).join('');
    for (const g of [...CATEGORIES, { id: 'other', name: 'Other' }]) {
      const items = list.filter((e) => e.cat === g.id);
      if (items.length) html += `<div class="pick-group">${g.name}</div>` + items.map(row).join('');
    }
    if (ql && !C.allExercises().some((e) => e.name.toLowerCase() === ql)) {
      html += `<form class="create-ex card" id="create-ex"><b>Create “${esc(q.trim())}”</b>
        <div class="form-grid"><label>Muscle group <select name="cat">${[...CATEGORIES, { id: 'other', name: 'Other' }].map((c) => `<option value="${c.id}" ${cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>
        <label>Type <select name="kind"><option value="load">Barbell / machine</option><option value="db">Dumbbell</option><option value="bw">Bodyweight</option></select></label></div>
        <input type="hidden" name="name" value="${esc(q.trim())}"><button class="btn primary sm">${icon('plus')} Create & add</button>
        <span class="muted xs">Custom exercises are tracked and charted, but not ranked (no public standards).</span></form>`;
    }
    return html || '<p class="muted center">No matches.</p>';
  };

  /* ── finish + summary ── */
  U.finishWorkout = () => {
    const d = st.draft;
    const entries = d.entries.map((en) => {
      const ex = C.exById(en.ex);
      return { ex: en.ex, sets: en.sets.map((s) => ({ w: C.fromDisp(parseFloat(s.w) || 0), r: parseInt(s.r, 10) || 0 })).filter((s) => s.r > 0 && (s.w > 0 || ex.kind === 'bw' || !ex.std)) };
    }).filter((en) => en.sets.length);
    if (!entries.length) { toast('Enter weight and reps for at least one set.'); return; }
    const wasEdit = !!d.id, date = d.dateTouched ? d.date : C.todayISO();
    const before = C.snapshot();
    const beforeBest = Object.fromEntries(entries.map((en) => [en.ex, C.bestKnown(en.ex)?.best || 0]));
    if (wasEdit) Object.assign(S().workouts.find((x) => x.id === d.id), { date, notes: d.notes.trim(), entries, updatedAt: Date.now() });
    const newId = wasEdit ? d.id : C.uid();
    if (!wasEdit) S().workouts.push({ id: newId, date, notes: d.notes.trim(), entries, updatedAt: Date.now() });
    if (!C.save()) toast('Storage is blocked in this browser, so data won\'t persist.');
    U.stopRest();
    st.draft = wasEdit ? st.stash : null; st.stash = null;
    if (!wasEdit) U.clearDraft();
    const next = () => (wasEdit ? toast('Workout updated.') : summarySheet(date, entries, before, beforeBest, newId));
    if (location.hash === '#/home') { window.dispatchEvent(new HashChangeEvent('hashchange')); next(); }
    else { window.addEventListener('hashchange', () => setTimeout(next, 0), { once: true }); location.hash = '#/home'; }
  };

  function summarySheet(date, entries, before, beforeBest, wid) {
    const after = C.snapshot();
    const prs = entries.filter((en) => beforeBest[en.ex] > 0 && (C.bestKnown(en.ex)?.best || 0) > beforeBest[en.ex] + 1e-6).map((en) => ({ ex: C.exById(en.ex), v: C.bestKnown(en.ex).best, d: C.bestKnown(en.ex).best - beforeBest[en.ex] }));
    const ups = Object.entries(after.exRanks).filter(([id, r]) => !before.exRanks[id] || r.step > before.exRanks[id].step).map(([id, r]) => ({ ex: C.exById(id), r, was: before.exRanks[id] })).sort((a, b) => b.r.pct - a.r.pct);
    const oUp = after.overall && (!before.overall || after.overall.step > before.overall.step);
    const sets = entries.reduce((n, en) => n + en.sets.length, 0), bw = C.currentBW();
    const vol = entries.reduce((v, en) => { const ex = C.exById(en.ex); return v + en.sets.reduce((a, s) => a + (ex.kind === 'bw' ? bw + s.w : s.w) * s.r * (ex.kind === 'db' ? 2 : 1), 0); }, 0);
    const headTier = oUp ? after.overall.tier : ups.length ? ups[0].r.tier : after.overall?.tier ?? -1, t = tierInfo(headTier);
    U.openSheet(`<div class="summary" style="--c:${t.color}">
      ${oUp ? `<div class="kicker center">${before.overall ? 'Overall rank up' : 'You are ranked'}</div><div class="sheet-emblem">${emblem(after.overall.tier, 140, after.overall.div)}</div><div class="rank-name center" style="color:${t.color}">${esc(after.overall.label)}</div><p class="center muted">${before.overall ? `Up from ${esc(before.overall.label)}. ` : ''}Stronger than ${pctTxt(after.overall.pct)}% of lifters.</p>`
        : `<div class="sheet-emblem">${emblem(headTier, 110, after.overall?.div)}</div><h2 class="sheet-title center">Workout complete</h2><p class="center muted">${prs.length ? 'New records. That\'s how it\'s done.' : 'Another brick in the wall. Consistency wins.'}</p>`}
      <div class="mini-stats"><div><span class="muted xs">Exercises</span><b class="mono">${entries.length}</b></div><div><span class="muted xs">Sets</span><b class="mono">${sets}</b></div><div><span class="muted xs">Volume</span><b class="mono">${C.fmtW(vol)}</b></div><div><span class="muted xs">Date</span><b>${relDate(date)}</b></div></div>
      ${ups.length ? `<h3 class="sub">Rank ups</h3>${ups.map((u) => `<div class="sum-row">${emblem(u.r.tier, 34, u.r.div)}<span><b>${esc(u.ex.name)}</b><span class="muted xs">${u.was ? esc(u.was.label) + ' → ' : 'New: '}<span style="color:${tierInfo(u.r.tier).color}">${esc(u.r.label)}</span></span></span></div>`).join('')}` : ''}
      ${prs.length ? `<h3 class="sub">Personal records</h3>${prs.map((p) => `<div class="sum-row"><span class="ex-ic sm gold">${icon('trophy')}</span><span><b>${esc(p.ex.name)}</b><span class="muted xs">${C.fmtMetric(p.ex, p.v)} (+${C.fmtMetric(p.ex, p.d)})</span></span></div>`).join('')}` : ''}
      <button class="btn primary lg wide" data-act="close-sheet">Done</button>
      <a class="btn wide" href="#/log?id=${wid}">${icon('edit')} Made a mistake? Edit or delete</a></div>`);
    if (oUp || ups.length || prs.length) setTimeout(() => U.celebrateFX(t.color), 250);
  }
})();
