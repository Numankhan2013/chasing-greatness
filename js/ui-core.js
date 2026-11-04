'use strict';
/* Shared UI toolkit: helpers, emblems, charts, sheets, rest timer, animations. */
window.UI = (() => {
  const C = window.CG;
  const { TIERS } = C;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${window.CG_ICONS[n] || ''}</svg>`;
  const fmtDate = (iso, withYear) => { const d = C.parseDate(iso); return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? ', ' + d.getFullYear() : ''}`; };
  const relDate = (iso) => {
    const n = C.daysBetween(iso, C.todayISO());
    if (n === 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n > 1 && n < 7) return `${n} days ago`;
    return fmtDate(iso, C.parseDate(iso).getFullYear() !== new Date().getFullYear());
  };
  const pctTxt = (p) => (p >= 99.5 ? '99.5' : p < 1 ? '<1' : String(Math.round(p)));
  const tierInfo = (i) => (i == null || i < 0 ? { name: 'Unranked', color: '#6b7385', c2: '#3a404d', blurb: 'Log a ranked lift to get placed.', exp: '' } : TIERS[i]);
  const unitLabel = (ex) => (ex.kind === 'db' ? `${C.unit()} / DB` : ex.kind === 'bw' ? `+${C.unit()}` : C.unit());

  /* deferred mounts + charts */
  let mounts = [];
  const afterRender = (fn) => mounts.push(fn);
  const flushMounts = () => { const m = mounts; mounts = []; m.forEach((fn) => fn()); };
  let charts = [];
  function destroyCharts() { charts.forEach((c) => { try { c.destroy(); } catch (e) { /* noop */ } }); charts = []; mounts = []; }
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = isObj(a[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k]; return o; }
  function mountChart(el, opts) {
    if (typeof el === 'string') el = $(el);
    if (!el) return;
    if (!window.ApexCharts) { el.innerHTML = '<div class="empty-chart">Charts load when you\'re online</div>'; return; }
    const base = {
      chart: { background: 'transparent', foreColor: '#8e8e93', fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', toolbar: { show: false }, zoom: { enabled: false }, parentHeightOffset: 0, animations: { enabled: !reduceMotion, speed: 700 } },
      theme: { mode: 'dark' },
      grid: { borderColor: 'rgba(84,84,88,.35)', strokeDashArray: 4, padding: { left: 6, right: 10 } },
      dataLabels: { enabled: false }, legend: { show: false },
      tooltip: { theme: 'dark' },
    };
    const c = new ApexCharts(el, merge(base, opts));
    c.render();
    charts.push(c);
  }

  /* emblems: hexagon core; Champion+ laurels, Elite+ wings, Mythic crown; pips = division */
  let seq = 0;
  const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`; }).join(' ');
  function starPath(cx, cy, R, r) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r : R; d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`; }
    return d + 'Z';
  }
  function emblem(tier, size = 64, div = 0) {
    const t = tierInfo(tier), id = 'em' + ++seq, ranked = tier != null && tier >= 0;
    let back = '', front = '';
    if (tier >= 4) for (const [x, y, ang, rx] of [[4, 36, -28, 19], [0, 50, -8, 17], [5, 64, 14, 14]]) {
      back += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="5.2" transform="rotate(${ang} ${x} ${y})" fill="url(#${id}w)"/><ellipse cx="${100 - x}" cy="${y}" rx="${rx}" ry="5.2" transform="rotate(${-ang} ${100 - x} ${y})" fill="url(#${id}w)"/>`;
    }
    if (tier >= 3) for (let k = 0; k < 6; k++) {
      const a = ((118 + k * 17) * Math.PI) / 180, x = 50 + 47 * Math.cos(a), y = 54 + 47 * Math.sin(a), rot = (a * 180) / Math.PI + 65;
      back += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6.5" ry="2.6" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${t.color}" opacity=".85"/><ellipse cx="${(100 - x).toFixed(1)}" cy="${y.toFixed(1)}" rx="6.5" ry="2.6" transform="rotate(${(-rot).toFixed(1)} ${(100 - x).toFixed(1)} ${y.toFixed(1)})" fill="${t.color}" opacity=".85"/>`;
    }
    if (tier === 6) front = `<path d="M35,13 L31,-3 L42,5 L50,-8 L58,5 L69,-3 L65,13 Z" fill="url(#${id}g)" stroke="${t.color}" stroke-width="1"/>`;
    const chev = (y, w = 5, o = 1) => `<path d="M39,${y + 6} L50,${y - 3} L61,${y + 6}" fill="none" stroke="${t.color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
    let glyph;
    if (!ranked) glyph = `<text x="50" y="61" text-anchor="middle" font-family="-apple-system, Inter, sans-serif" font-weight="700" font-size="26" fill="${t.color}">?</text>`;
    else if (tier <= 2) glyph = [[52], [56, 46], [61, 51, 41]][tier].map((y) => chev(y)).join('');
    else glyph = `<path d="${starPath(50, tier >= 4 ? 46 : 50, tier >= 4 ? 13 : 15, tier >= 4 ? 5.6 : 6.4)}" fill="${t.color}"/>` + (tier === 4 ? chev(64) : tier >= 5 ? chev(63) + chev(71, 3.5, 0.7) : '');
    const np = 4 - div;
    const pips = ranked && div ? Array.from({ length: np }, (_, i) => { const x = 50 + (i - (np - 1) / 2) * 9; return `<path d="M${x},81 l3.2,3.2 l-3.2,3.2 l-3.2,-3.2Z" fill="${t.color}"/>`; }).join('') : '';
    const shine = tier >= 3 && !reduceMotion ? `<rect x="-60" y="0" width="40" height="110" fill="url(#${id}s)" clip-path="url(#${id}c)" transform="skewX(-20)"><animate attributeName="x" values="-60;160;160" keyTimes="0;.45;1" dur="${4 + (seq % 3)}s" repeatCount="indefinite"/></rect>` : '';
    return `<svg class="emblem t${tier}" width="${Math.round(size * 1.125)}" height="${size}" viewBox="-22 -14 144 128" role="img" aria-label="${esc(t.name)}"><defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.color}"/><stop offset=".55" stop-color="${t.c2}"/><stop offset="1" stop-color="${t.color}"/></linearGradient>
      <linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.c2}" stop-opacity=".2"/><stop offset="1" stop-color="${t.color}" stop-opacity=".95"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}c"><polygon points="${hexPts(50, 52, 40)}"/></clipPath></defs>
      ${back}<polygon points="${hexPts(50, 52, 40)}" fill="url(#${id}g)" stroke="${t.color}" stroke-width="1.5"/>
      <polygon points="${hexPts(50, 52, 31)}" fill="rgba(7,8,12,.78)" stroke="${t.color}" stroke-opacity=".45" stroke-width="1.2"/>
      ${glyph}${pips}${shine}${front}</svg>`;
  }
  const chip = (tier, label) => `<span class="chip" style="--c:${tierInfo(tier).color}">${esc(label || tierInfo(tier).name)}</span>`;
  const bar = (frac, color) => `<div class="bar"><span style="width:${(C.clamp(frac, 0, 1) * 100).toFixed(1)}%;--c:${color}"></span></div>`;
  const ladder = (pct) => `<div class="ladder">${TIERS.map((t, i) => { const to = TIERS[i + 1]?.from ?? 100; return `<span style="--c:${t.color};flex:${to - t.from}" class="${pct >= t.from ? 'on' : ''}" title="${t.name}"></span>`; }).join('')}<i style="left:${C.clamp(pct, 0, 100)}%"></i></div>`;
  function ring(frac, color, size, label) {
    const r = 26, c = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" stroke="rgba(255,255,255,.08)" stroke-width="7" fill="none"/><circle cx="32" cy="32" r="${r}" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - C.clamp(frac, 0, 1))}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" class="ring-t">${label}</text></svg>`;
  }

  /* toast, sheet, rest timer, confetti */
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.innerHTML = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3000); }
  function openSheet(html, cls = '') {
    const el = $('#sheet');
    el.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet-panel ${cls}" role="dialog" aria-modal="true"><div class="sheet-top"><div class="sheet-grip"></div><button class="sheet-close" data-act="close-sheet" aria-label="Close">${icon('x')}</button></div>${html}</div>`;
    el.hidden = false; document.body.classList.add('sheet-open');
    requestAnimationFrame(() => el.classList.add('show'));
    enableSwipe(el.querySelector('.sheet-panel'));
    paint(el);
  }
  /* Swipe down to dismiss, like iOS sheets: drag from anywhere when the content is scrolled to the top. */
  function enableSwipe(panel) {
    let y0 = null, dy = 0, t0 = 0;
    const atTop = (t) => { const sc = t.closest('.pick-list'); return panel.scrollTop <= 0 && (!sc || sc.scrollTop <= 0); };
    const start = (y, target) => { if (target.closest('input, select, textarea') || !atTop(target)) return; y0 = y; dy = 0; t0 = Date.now(); };
    const move = (y, e) => {
      if (y0 == null) return;
      dy = y - y0;
      if (dy <= 0) { if (dy < -6) { y0 = null; panel.style.transform = ''; } return; }  // scrolling up: let the content scroll
      panel.style.transition = 'none';
      panel.style.transform = `translate(-50%, ${dy}px)`;
      if (e.cancelable) e.preventDefault();
    };
    const end = () => {
      if (y0 == null) return;
      y0 = null; panel.style.transition = '';
      if (dy > 110 || (dy > 35 && dy / (Date.now() - t0) > 0.55)) closeSheet(); else panel.style.transform = '';
    };
    panel.addEventListener('touchstart', (e) => start(e.touches[0].clientY, e.target), { passive: true });
    panel.addEventListener('touchmove', (e) => move(e.touches[0].clientY, e), { passive: false });
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
    const grip = panel.querySelector('.sheet-top');   // mouse: drag the handle
    grip.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.target.closest('button')) return; start(e.clientY, e.target); grip.setPointerCapture(e.pointerId); });
    grip.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') move(e.clientY, e); });
    grip.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') end(); });
  }
  function closeSheet() {
    const el = $('#sheet');
    if (el.hidden) return;
    const panel = el.querySelector('.sheet-panel');
    if (panel) { panel.style.transition = 'transform .26s cubic-bezier(.3,.7,.4,1)'; panel.style.transform = 'translate(-50%, 105%)'; }
    el.classList.remove('show'); document.body.classList.remove('sheet-open');
    setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 270);
  }
  const timer = { end: 0, dur: 0, iv: null };
  function startRest(sec) { timer.dur = sec; timer.end = Date.now() + sec * 1000; clearInterval(timer.iv); timer.iv = setInterval(tickRest, 250); $('#rest').hidden = false; tickRest(); }
  function stopRest() { clearInterval(timer.iv); $('#rest').hidden = true; }
  function tickRest() {
    const left = Math.max(0, timer.end - Date.now()), s = Math.ceil(left / 1000);
    $('#rest-time').textContent = `${Math.floor(s / 60)}:${C.pad(s % 60)}`;
    $('#rest-bar').style.width = `${(left / (timer.dur * 1000)) * 100}%`;
    if (left <= 0) { stopRest(); try { navigator.vibrate?.([180, 90, 180]); } catch (e) { /* noop */ } toast(`${icon('zap')} Rest's over. Next set.`); }
  }
  function celebrateFX(color) {
    if (!window.confetti || reduceMotion) return;
    const colors = [color, '#ffffff', '#ffb547'];
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.65 }, colors, zIndex: 9999 });
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 9999 }), 220);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 9999 }), 380);
  }
  function paint(root = document) {
    if (!window.gsap || reduceMotion) { $$('[data-count]', root).forEach((el) => { el.textContent = el.dataset.count; }); return; }
    const items = $$('.reveal', root);
    if (items.length) gsap.from(items, { y: 10, opacity: 0, duration: 0.45, stagger: 0.03, ease: 'power2.out', clearProps: 'transform,opacity' });
    $$('[data-count]', root).forEach((el) => { const end = parseFloat(el.dataset.count), o = { v: 0 }; gsap.to(o, { v: end, duration: 1.1, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } }); });
    $$('.bar span', root).forEach((el) => gsap.from(el, { width: 0, duration: 0.9, ease: 'power3.out', delay: 0.15 }));
    $$('.hero-emblem .emblem, .sheet-emblem .emblem', root).forEach((el) => gsap.from(el, { scale: 0.85, opacity: 0, duration: 0.6, ease: 'power3.out' }));
  }

  return { C, MONTHS, reduceMotion, $, $$, esc, icon, fmtDate, relDate, pctTxt, tierInfo, unitLabel, afterRender, flushMounts, destroyCharts, mountChart, emblem, chip, bar, ladder, ring, toast, openSheet, closeSheet, timer, startRest, stopRest, tickRest, celebrateFX, paint, views: {}, st: { draft: null, stash: null, calc: null } };
})();
