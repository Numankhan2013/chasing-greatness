'use strict';
/* Routing, events, demo data. Views live in views-*.js; shared UI in ui-core.js. */
(() => {
  const U = window.UI, C = U.C;
  const { $, $$, icon, toast, st } = U;
  const S = () => C.state;

  const NAV = [
    { r: 'home', label: 'Home', icon: 'home' },
    { r: 'ranks', label: 'Ranks', icon: 'trophy' },
    { r: 'log', label: 'Log', icon: 'plus', fab: true },
    { r: 'progress', label: 'Progress', icon: 'chart' },
    { r: 'insights', label: 'Insights', icon: 'bulb' },
    { r: 'profile', label: 'Profile', icon: 'user', desk: true },
    { r: 'history', label: 'History', icon: 'history', desk: true },
    { r: 'settings', label: 'Settings', icon: 'settings', desk: true },
  ];
  function renderNav(route) {
    $('#nav').innerHTML = NAV.map((n) => `<a href="#/${n.r}" class="${n.r === route ? 'on' : ''} ${n.desk ? 'desk' : ''} ${n.fab ? 'fab' : ''}" ${n.r === route ? 'aria-current="page"' : ''}><span class="nav-ic">${icon(n.icon)}</span><span class="nav-l">${n.label}</span></a>`).join('');
    const un = C.unit();
    $('#unit-slot').innerHTML = `<button class="unit-toggle" data-act="toggle-unit" aria-label="Units: ${un === 'kg' ? 'kilograms' : 'pounds'}. Tap to switch."><span class="${un === 'kg' ? 'on' : ''}">kg</span><span class="${un === 'lb' ? 'on' : ''}">lb</span></button>`;
    $('#mobile-actions').innerHTML = `<a href="#/profile" aria-label="Profile" class="${route === 'profile' ? 'on' : ''}">${icon('user')}</a><a href="#/history" aria-label="History" class="${route === 'history' ? 'on' : ''}">${icon('history')}</a><a href="#/settings" aria-label="Settings" class="${route === 'settings' ? 'on' : ''}">${icon('settings')}</a>`;
  }
  function parseRoute() {
    const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
    return { route: U.views[path] ? path : 'home', params: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  /* Sign-in gate: visitors see the landing page until they sign in (or choose guest mode). */
  const GUEST_KEY = 'chasing-greatness.guest';
  const isGuest = () => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch (e) { return false; } };
  let authTimedOut = false, signingIn = false;
  setTimeout(() => { authTimedOut = true; if (document.body.dataset.gate) render(); }, 5000);
  function gate() {
    const cl = window.CG_CLOUD;
    if (!cl || cl.status === 'unconfigured') return null;
    if ((cl.redirecting || signingIn) && !cl.user) return U.splashView('Signing you in…');
    if (cl.user) return !cl.lastSync && !C.currentBW() && !['error', 'offline'].includes(cl.status) ? U.splashView('Loading your profile…') : null;
    if (isGuest()) return null;
    if (cl.status === 'off' && !authTimedOut) return U.splashView('Loading…');
    return U.landingView();
  }
  function render() {
    const { route, params } = parseRoute();
    U.destroyCharts();
    const main = $('#view');
    const g = gate();
    if (g) { document.body.dataset.gate = '1'; main.innerHTML = g; U.paint(main); return; }
    delete document.body.dataset.gate;
    renderNav(route);
    // Onboarding (setup + first profile build): no tab bar, so the user finishes the flow.
    if (!C.currentBW() || (route === 'profile' && params.setup)) document.body.dataset.onboard = '1'; else delete document.body.dataset.onboard;
    main.innerHTML = U.views[route](params);
    document.body.dataset.route = route;
    document.title = route === 'home' ? 'Chasing Greatness' : `${NAV.find((n) => n.r === route)?.label} · Chasing Greatness`;
    U.flushMounts();
    U.paint(main);
  }
  function rerenderLog() { const y = window.scrollY; $('#view').innerHTML = U.renderLog(); window.scrollTo(0, y); }
  window.addEventListener('hashchange', () => { U.closeSheet(); render(); window.scrollTo(0, 0); });

  function demoData() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const plan = { bench: [70, 92, 5], squat: [85, 118, 5], deadlift: [110, 150, 3], ohp: [40, 52, 5], row: [55, 74, 8], pullup: [5, 11, 0], incline: [55, 70, 8], dbpress: [18, 25, 10], legpress: [150, 210, 10], rdl: [80, 110, 8], curl: [30, 38, 10], pushdown: [30, 42, 12], pulldown: [55, 70, 10], hipthrust: [90, 140, 10] };
    const split = [['bench', 'incline', 'ohp', 'pushdown'], ['deadlift', 'row', 'pulldown', 'curl'], ['squat', 'legpress', 'rdl', 'hipthrust'], ['ohp', 'pullup', 'dbpress', 'bench']];
    const days = 140, start = C.addDays(C.todayISO(), -days), workouts = [], bodyweights = [];
    let k = 0;
    for (let i = 0; i < days; i++) {
      const iso = C.addDays(start, i), dow = C.parseDate(iso).getDay();
      if (i % 7 === 0) bodyweights.push({ date: iso, kg: 76 + (i / days) * 2.5 + rnd(-0.6, 0.6) });
      if (![1, 2, 4, 5].includes(dow) || Math.random() < 0.1) continue;
      const prog = Math.pow(i / days, 0.8);
      const entries = split[k++ % 4].map((ex) => {
        const [a, b, reps] = plan[ex];
        if (ex === 'pullup') { const rr = Math.round(a + (b - a) * prog + rnd(-1, 0.5)); return { ex, sets: [rr, rr - 1, rr - 2].map((r) => ({ w: 0, r: Math.max(1, r) })) }; }
        const est = a + (b - a) * prog + rnd(-0.03, 0.02) * b, step = C.exById(ex).kind === 'db' ? 1 : 2.5;
        const w = Math.round(est / (1 + reps / 30) / step) * step;
        return { ex, sets: [{ w, r: reps }, { w, r: reps }, { w, r: reps - (Math.random() < 0.35 ? 1 : 0) }] };
      });
      workouts.push({ id: C.uid(), date: iso, notes: Math.random() < 0.08 ? ['Felt strong', 'Bad sleep, got it done', 'Easy day'][Math.floor(rnd(0, 3))] : '', entries, updatedAt: Date.now() - (days - i) * C.DAY });
    }
    return { workouts, bodyweights };
  }

  function applyProfile(fd) {
    const p = S().profile;
    p.name = (fd.get('name') || '').trim(); p.sex = fd.get('sex'); p.unit = fd.get('unit');
    if (fd.get('goal')) p.weeklyGoal = +fd.get('goal');
    if (fd.get('months')) p.trainingMonths = +fd.get('months');
    if (fd.get('rest')) p.rest = +fd.get('rest');
    const bw = parseFloat(fd.get('bw'));
    if (bw > 0) {
      const kg = C.fromDisp(bw), today = C.todayISO(), ex = S().bodyweights.find((b) => b.date === today);
      p.bodyweight = kg;
      if (ex) ex.kg = kg;
      else if (!S().bodyweights.length || Math.abs(kg - C.currentBW()) > 0.05) S().bodyweights.push({ date: today, kg });
    }
    st.calc = null;
    C.save();
  }

  document.addEventListener('submit', (e) => {
    const f = e.target;
    e.preventDefault();
    if (f.id === 'setup-form') { applyProfile(new FormData(f)); location.hash = '#/profile?setup=1'; }
    else if (f.id === 'profile-form') { document.activeElement?.blur(); }
    else if (f.id === 'lifts-form') { U.saveLifts(f); location.hash = '#/profile'; toast('Profile updated. Here\'s where you stand.'); }
    else if (f.id === 'bw-form') {
      const kg = C.fromDisp(parseFloat(new FormData(f).get('bw')));
      if (!(kg > 0)) return;
      const today = C.todayISO(), ex = S().bodyweights.find((b) => b.date === today);
      if (ex) ex.kg = kg; else S().bodyweights.push({ date: today, kg });
      S().profile.bodyweight = C.currentBW();
      C.save(); toast('Weigh-in logged.'); render();
    } else if (f.id === 'create-ex') {
      const fd = new FormData(f), name = String(fd.get('name')).trim();
      if (!name) return;
      const id = 'c_' + C.uid();
      S().custom.push({ id, name, cat: fd.get('cat'), kind: fd.get('kind') });
      C.save(); U.addEntry(id); U.closeSheet(); rerenderLog();
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target, d = st.draft;
    if (el.id === 'pick-q') { $('#pick-list').innerHTML = U.pickList(el.value, $('#pick-list').dataset.cat || 'all'); return; }
    if (el.id === 'log-notes' && d) { d.notes = el.value; U.persistDraft(); return; }
    if (el.dataset.f && d) {
      const ei = +el.closest('[data-e]').dataset.e, si = +el.closest('[data-s]').dataset.s;
      d.entries[ei].sets[si][el.dataset.f] = el.value;
      $(`[data-preview="${ei}"]`).innerHTML = U.entryPreview(d.entries[ei]);
      $(`[data-sanity="${ei}"]`).innerHTML = U.entrySanity(d.entries[ei], ei);
      const fm = $('.finish-meta'); if (fm) fm.textContent = U.finishMeta();
      U.persistDraft();
      return;
    }
    if (el.dataset.pf) { const row = el.closest('.pl-row'); row.querySelector('[data-lp]').innerHTML = U.liftPreview(row.dataset.ex, row.querySelector('[data-pf=w]').value, row.querySelector('[data-pf=r]').value); return; }
    if (el.closest('#calc-form')) { st.calc[el.name] = el.value; $('#calc-result').innerHTML = U.calcResult(); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'log-date' && st.draft) { st.draft.date = el.value || C.todayISO(); st.draft.dateTouched = !!st.draft.id || st.draft.date !== C.todayISO(); U.persistDraft(); rerenderLog(); }
    if (el.name === 'unit' && el.closest('#setup-form')) {
      const bwIn = $('#setup-form [name=bw]'), f = el.value === 'lb' ? 1 / C.KG_PER_LB : C.KG_PER_LB;
      if (bwIn.value && el.value !== C.unit()) bwIn.value = String(C.round(parseFloat(bwIn.value) * f, 1));
      S().profile.unit = el.value; $('#setup-unit').textContent = el.value; bwIn.placeholder = el.value === 'lb' ? '165' : '75'; renderNav(parseRoute().route);
      return;
    }
    if (el.closest('#profile-form')) {
      applyProfile(new FormData(el.closest('#profile-form')));
      if (el.name === 'unit') { render(); toast('Units updated.'); return; }
      const r = el.closest('.set-row-i'); if (r) { r.classList.add('saved'); setTimeout(() => r.classList.remove('saved'), 1600); }
      return;
    }
    if (el.closest('#calc-form') && el.tagName === 'SELECT') { st.calc[el.name] = el.value; $('#calc-wlabel').textContent = U.calcWLabel(); $('#calc-result').innerHTML = U.calcResult(); }
    if (el.id === 'import-file' && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = C.normalize(JSON.parse(reader.result));
          if (!confirm(`Import ${data.workouts.length} workouts? This replaces what's stored on this device.`)) return;
          C.replaceState(data); toast('Backup restored.'); render();
        } catch (err) { toast('That file isn\'t a Chasing Greatness backup.'); }
      };
      reader.readAsText(el.files[0]);
      el.value = '';
    }
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, d = st.draft;
    const ei = b.dataset.e != null ? +b.dataset.e : null, si = b.dataset.s != null ? +b.dataset.s : null;
    switch (act) {
      case 'close-sheet': U.closeSheet(); break;
      case 'ex-sheet': U.exSheet(b.dataset.id); break;
      case 'pick': U.pickerSheet(); break;
      case 'pick-cat': $$('#pick-cats .pill').forEach((p) => p.classList.toggle('on', p === b)); $('#pick-list').dataset.cat = b.dataset.id; $('#pick-list').innerHTML = U.pickList($('#pick-q').value, b.dataset.id); break;
      case 'pick-ex': {
        const id = b.dataset.id, idx = d.entries.findIndex((x) => x.ex === id);
        U.closeSheet();
        if (idx < 0) U.addEntry(id);
        rerenderLog();
        setTimeout(() => $(`.entry[data-e="${idx < 0 ? d.entries.length - 1 : idx}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
        break;
      }
      case 'quick-add': U.addEntry(b.dataset.id); rerenderLog(); break;
      case 'mode': d.mode = b.dataset.mode; d.date = C.todayISO(); d.dateTouched = false; U.persistDraft(); rerenderLog(); U.paint($('#view')); break;
      case 'set-date': d.date = b.dataset.d; d.dateTouched = d.date !== C.todayISO(); U.persistDraft(); rerenderLog(); break;
      case 'copy-last': {
        const en = d.entries[ei], last = U.lastSession(en.ex), ex = C.exById(en.ex);
        if (last) { en.sets = last.en.sets.map((s0) => ({ w: ex.kind === 'bw' && !s0.w ? '0' : String(C.wNum(s0.w)), r: String(s0.r), done: false })); U.persistDraft(); rerenderLog(); }
        break;
      }
      case 'repeat-last': {
        const lw = [...S().workouts].sort((a, x) => x.date.localeCompare(a.date))[0];
        lw.entries.forEach((en) => { if (!d.entries.some((x) => x.ex === en.ex)) d.entries.push({ ex: en.ex, sets: en.sets.map(U.blankSet) }); });
        U.persistDraft(); rerenderLog(); toast('Loaded. Grey numbers are last time\'s, so tap ✓ to repeat a set.');
        break;
      }
      case 'add-set': { const en = d.entries[ei], l = en.sets.at(-1); en.sets.push(l ? { w: l.w, r: l.r, done: false } : U.blankSet()); U.persistDraft(); rerenderLog(); break; }
      case 'rm-set': { const en = d.entries[ei]; if (en.sets.length > 1) en.sets.pop(); U.persistDraft(); rerenderLog(); break; }
      case 'halve': {
        d.entries[ei].sets.forEach((s) => { const w = parseFloat(s.w); if (w > 0) s.w = String(C.round(w / 2, 2)); });
        U.persistDraft(); rerenderLog(); toast('Halved. Now it\'s the weight of one dumbbell.');
        break;
      }
      case 'cancel-edit': location.hash = '#/history'; break;
      case 'done-set': {
        const s = d.entries[ei].sets[si], row = b.closest('.set-row');
        if (!s.done) {
          const wi = $('[data-f=w]', row), ri = $('[data-f=r]', row);
          if (!s.w && wi.placeholder) s.w = wi.placeholder;
          if (!s.r && ri.placeholder) s.r = ri.placeholder;
          if (!(parseInt(s.r, 10) > 0)) { ri.focus(); toast('Enter your reps first.'); break; }
          s.done = true;
          U.startRest(S().profile.rest || 120);
        } else s.done = false;
        U.persistDraft(); rerenderLog();
        break;
      }
      case 'rm-entry': d.entries.splice(ei, 1); U.persistDraft(); rerenderLog(); break;
      case 'toggle-notes': d.showNotes = !d.showNotes; rerenderLog(); if (d.showNotes) $('#log-notes')?.focus(); break;
      case 'discard': if (confirm('Discard this workout?')) { st.draft = U.newDraft(); U.clearDraft(); U.stopRest(); rerenderLog(); } break;
      case 'finish': U.finishWorkout(); break;
      case 'del-wo': {
        e.preventDefault(); e.stopPropagation();
        const id = b.dataset.id, w = S().workouts.find((x) => x.id === id);
        if (!w || !confirm(`Delete the workout from ${U.fmtDate(w.date, true)}? This can't be undone.`)) break;
        S().workouts = S().workouts.filter((x) => x.id !== id);
        S().deleted.push({ id, at: Date.now() });
        C.save();
        if (st.draft?.id === id) { st.draft = st.stash; st.stash = null; }
        toast('Workout deleted.');
        if (location.hash.startsWith('#/history')) render(); else location.hash = '#/history';
        break;
      }
      case 'del-custom':
        if (C.history(b.dataset.id).length && !confirm('This exercise has logged sets. Delete it and its sets?')) break;
        S().custom = S().custom.filter((c) => c.id !== b.dataset.id);
        S().workouts.forEach((w) => { const n = w.entries.length; w.entries = w.entries.filter((en) => en.ex !== b.dataset.id); if (w.entries.length !== n) w.updatedAt = Date.now(); });
        C.tombstoneMissing({ workouts: S().workouts }, Object.assign(S(), { workouts: S().workouts.filter((w) => w.entries.length) }));
        C.save(); render();
        break;
      case 'export': {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' }));
        a.download = `chasing-greatness-${C.todayISO()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('Backup downloaded.');
        break;
      }
      case 'demo':
        if (S().workouts.length && !confirm('Replace your workouts with demo data? Export a backup first to keep yours.')) break;
        {
          const dd = demoData();
          if (!C.currentBW()) S().profile.unit = 'kg';
          C.tombstoneMissing({ workouts: S().workouts }, Object.assign(S(), { workouts: dd.workouts }));
          S().bodyweights = dd.bodyweights; S().profile.bodyweight = C.currentBW();
          st.draft = null; st.calc = null; U.clearDraft();
          C.save(); location.hash = '#/home'; render();
          toast('Demo data loaded. Erase it anytime in Settings.');
        }
        break;
      case 'reset':
        if (confirm(window.CG_CLOUD && window.CG_CLOUD.user ? 'Erase all workouts, weigh-ins and settings from this device AND your cloud backup?' : 'Erase all workouts, weigh-ins and settings from this device?')) { C.replaceState(C.clone(C.DEFAULT)); st.draft = null; st.calc = null; U.clearDraft(); location.hash = '#/home'; render(); }
        break;
      case 'toggle-unit': {
        const from = C.unit(), to = from === 'kg' ? 'lb' : 'kg';
        const f = to === 'lb' ? 1 / C.KG_PER_LB : C.KG_PER_LB, cv = (v) => (v === '' || v == null || isNaN(parseFloat(v)) ? v : String(C.round(parseFloat(v) * f, 1)));
        if (st.draft) st.draft.entries.forEach((en) => { if (C.exById(en.ex).kind !== 'bw' || parseFloat(en.sets[0]?.w)) en.sets.forEach((s0) => { s0.w = cv(s0.w); }); });
        if (st.calc) { st.calc.w = cv(st.calc.w); st.calc.bw = cv(st.calc.bw); }
        S().profile.unit = to; U.persistDraft(); C.save();
        const sf = $('#setup-form'); const bwIn = sf && sf.querySelector('[name=bw]');
        if (sf) { bwIn.value = cv(bwIn.value); sf.querySelector(`[name=unit][value=${to}]`).checked = true; $('#setup-unit').textContent = to; renderNav(parseRoute().route); }
        else render();
        toast(`Showing everything in ${to === 'kg' ? 'kilograms' : 'pounds'}.`);
        break;
      }
      case 'guest': try { localStorage.setItem(GUEST_KEY, '1'); } catch (err) { /* noop */ } render(); break;
      case 'cloud-signin':
        // Show progress right away: Google's hand-off takes a few seconds after the account is picked.
        signingIn = true; render();
        window.CG_CLOUD.signIn()
          .then(() => setTimeout(() => { if (!window.CG_CLOUD.user && signingIn) { signingIn = false; render(); } }, 4000))
          .catch((err) => { signingIn = false; render(); toast(`Sign-in failed: ${U.esc(err.message || String(err))}`); });
        break;
      case 'cloud-signout': {
        const out = (force) => window.CG_CLOUD.signOut(force).then(() => { try { localStorage.removeItem(GUEST_KEY); } catch (err) { /* noop */ } location.hash = '#/home'; render(); toast('Signed out. Your data is safe in your account.'); });
        if (!confirm('Sign out? Your data stays safe in your Google account and is removed from this device.')) break;
        out(false).catch((err) => {
          if (err.code === 'unsynced' && confirm('Some recent changes haven\'t synced yet (you may be offline). Sign out anyway and lose them?')) out(true).catch((e2) => toast(U.esc(e2.message)));
          else if (err.code !== 'unsynced') toast(U.esc(err.message || String(err)));
        });
        break;
      }
      case 'cloud-sync':
        window.CG_CLOUD.syncNow().then(() => { if (window.CG_CLOUD.status === 'synced') toast('All synced.'); });
        break;
      case 'rest-add': U.timer.end += 30000; U.timer.dur += 30; U.tickRest(); break;
      case 'rest-stop': U.stopRest(); break;
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') U.closeSheet(); });

  // Cloud sync: refresh the Settings card on status changes, and redraw when a merge brought new data.
  if (window.CG_CLOUD) {
    let lastUser = null, lastGate = '';
    window.CG_CLOUD.onChange((cl) => {
      const uid = cl.user && cl.user.uid;
      if (uid) signingIn = false;
      const gk = `${uid}|${cl.status === 'off'}|${!!cl.lastSync}|${cl.status === 'error'}|${!!cl.redirecting}`;
      if (gk !== lastGate && (document.body.dataset.gate || !lastGate || uid !== lastUser)) { lastGate = gk; lastUser = uid; render(); return; }
      lastGate = gk;
      if (document.body.dataset.route === 'settings' && (uid !== lastUser || !$('#cloud-status'))) { lastUser = uid; render(); return; }
      lastUser = uid;
      const el = $('#cloud-status'); if (el) el.outerHTML = (new DOMParser().parseFromString(U.cloudCard(), 'text/html')).querySelector('#cloud-status')?.outerHTML || '';
    });
    // Device data was cleared (sign-out or a different account): drop in-memory drafts too.
    document.addEventListener('cg:local-reset', () => { st.draft = null; st.stash = null; st.calc = null; U.stopRest(); });
    document.addEventListener('cg:cloud-merged', () => { if (document.body.dataset.route !== 'log') render(); toast('Synced from the cloud.'); });
  }

  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
