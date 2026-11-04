'use strict';
/* Cloud sync: Google sign-in (Firebase Auth) + Firestore backup across devices.
 * The device copy in localStorage stays the source the app reads from; this module
 * merges it with the cloud on sign-in / app focus and pushes changes after each save.
 *
 * Firestore layout (rules: only the signed-in owner can read or write):
 *   users/{uid}                 { profile, bodyweights, custom, deleted, metaUpdatedAt }
 *   users/{uid}/workouts/{id}   one workout, with updatedAt for last-write-wins
 */
window.CG_CLOUD = (() => {
  const C = window.CG;
  const cfg = window.CG_FIREBASE_CONFIG;
  const META_KEY = 'chasing-greatness.meta';
  const PULL_EVERY = 5 * 60 * 1000;
  const listeners = new Set();
  const cloud = { ready: false, user: null, status: 'off', lastSync: 0, error: '' };

  let db = null, auth = null, pushTimer = null, busy = false, again = false, lastPull = 0;
  const pushed = new Map();   // workout id -> updatedAt known to be in the cloud
  let pushedMeta = '';        // JSON of the meta last known to be in the cloud

  const emit = () => listeners.forEach((fn) => { try { fn(cloud); } catch (e) { /* ignore */ } });
  const setStatus = (s, err = '') => { cloud.status = s; cloud.error = err; emit(); };
  const metaOf = (s) => ({ profile: s.profile, bodyweights: s.bodyweights, custom: s.custom, deleted: s.deleted });
  const metaJSON = (s) => JSON.stringify(metaOf(s));

  // Local edit time of the meta (profile, weigh-ins, custom exercises, tombstones).
  const localMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } };
  const writeLocalMeta = (m) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } };
  function touchMeta() {
    const m = localMeta(), j = metaJSON(C.state);
    if (m.json !== j) writeLocalMeta({ json: j, at: Date.now() });
  }

  const userRef = () => db.collection('users').doc(cloud.user.uid);
  const strip = (o) => JSON.parse(JSON.stringify(o)); // drops undefined, which Firestore rejects

  async function commitOps(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = db.batch();
      ops.slice(i, i + 400).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  /* Full merge: read the cloud, combine with this device, write back what differs. */
  async function pull() {
    const [metaSnap, woSnap] = await Promise.all([userRef().get(), userRef().collection('workouts').get()]);
    const remoteMeta = metaSnap.exists ? metaSnap.data() : null;
    const remote = new Map();
    woSnap.forEach((d) => remote.set(d.id, d.data()));

    const local = C.state;
    const lm = localMeta();
    const localAt = lm.at || 0;

    // Tombstones: union, newest time per id.
    const tomb = new Map();
    for (const t of [...(remoteMeta?.deleted || []), ...local.deleted]) {
      if (t && t.id && (!tomb.has(t.id) || tomb.get(t.id) < t.at)) tomb.set(t.id, t.at);
    }
    // Workouts: union by id, newest updatedAt wins, tombstoned ones dropped.
    const byId = new Map();
    for (const w of [...remote.values(), ...local.workouts]) {
      const cur = byId.get(w.id);
      if (!cur || (w.updatedAt || 0) > (cur.updatedAt || 0)) byId.set(w.id, w);
    }
    const workouts = [...byId.values()].filter((w) => !(tomb.has(w.id) && tomb.get(w.id) >= (w.updatedAt || 0)));
    const cutoff = Date.now() - 180 * C.DAY; // keep tombstones half a year
    const deleted = [...tomb].map(([id, at]) => ({ id, at })).filter((t) => t.at > cutoff);

    // Profile, weigh-ins and custom exercises: whichever side was edited last.
    const useRemote = remoteMeta && (remoteMeta.metaUpdatedAt || 0) > localAt;
    const metaSrc = useRemote ? remoteMeta : local;
    const metaAt = useRemote ? remoteMeta.metaUpdatedAt : (localAt || Date.now());
    const merged = C.normalize({ ...local, profile: metaSrc.profile, bodyweights: metaSrc.bodyweights, custom: metaSrc.custom, workouts, deleted });

    const before = JSON.stringify(local);
    C.replaceState(merged, { silent: true });
    writeLocalMeta({ json: metaJSON(C.state), at: metaAt });

    // Write back: workouts the cloud lacks or has older, deletions, and the meta doc.
    const ops = [];
    const col = userRef().collection('workouts');
    pushed.clear();
    for (const w of C.state.workouts) {
      const r = remote.get(w.id);
      if (!r || (r.updatedAt || 0) < (w.updatedAt || 0)) ops.push((b) => b.set(col.doc(w.id), strip(w)));
      pushed.set(w.id, w.updatedAt || 0);
    }
    const keep = new Set(C.state.workouts.map((w) => w.id));
    for (const id of remote.keys()) if (!keep.has(id)) ops.push((b) => b.delete(col.doc(id)));
    const mj = metaJSON(C.state);
    if (!remoteMeta || JSON.stringify(metaOf(remoteMeta)) !== mj || remoteMeta.metaUpdatedAt !== metaAt) {
      ops.push((b) => b.set(userRef(), strip({ ...metaOf(C.state), metaUpdatedAt: metaAt })));
    }
    await commitOps(ops);
    pushedMeta = mj;
    lastPull = Date.now();
    return JSON.stringify(C.state) !== before;
  }

  /* Cheap push: only what changed on this device since the last sync. */
  async function push() {
    const ops = [];
    const col = userRef().collection('workouts');
    const live = new Set();
    for (const w of C.state.workouts) {
      live.add(w.id);
      if (pushed.get(w.id) !== (w.updatedAt || 0)) ops.push((b) => b.set(col.doc(w.id), strip(w)));
    }
    for (const id of [...pushed.keys()]) if (!live.has(id)) ops.push((b) => b.delete(col.doc(id)));
    const mj = metaJSON(C.state);
    const metaAt = localMeta().at || Date.now();
    if (mj !== pushedMeta) ops.push((b) => b.set(userRef(), strip({ ...metaOf(C.state), metaUpdatedAt: metaAt })));
    if (!ops.length) return;
    await commitOps(ops);
    pushed.clear();
    for (const w of C.state.workouts) pushed.set(w.id, w.updatedAt || 0);
    pushedMeta = mj;
  }

  async function run(full) {
    if (!cloud.user || !db) return false;
    if (busy) { again = true; return false; }
    busy = true; setStatus('syncing');
    let changed = false;
    try {
      changed = full || !lastPull ? await pull() : (await push(), false);
      cloud.lastSync = Date.now();
      setStatus('synced');
    } catch (e) {
      console.warn('Cloud sync failed', e);
      setStatus(navigator.onLine ? 'error' : 'offline', e && e.message || String(e));
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(() => run(false), 300); }
    }
    if (changed) document.dispatchEvent(new CustomEvent('cg:cloud-merged'));
    return changed;
  }

  /* Called by engine.save() after every local change. */
  function onSave() {
    touchMeta();
    if (!cloud.user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => run(false), 1500);
  }

  async function signIn() {
    if (!auth) throw new Error('Cloud sync is not configured yet.');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
        await auth.signInWithRedirect(provider);
      } else if (e.code !== 'auth/popup-closed-by-user') throw e;
    }
  }
  async function signOut() {
    if (!auth) return;
    if (cloud.user) await run(false);
    await auth.signOut();
  }
  const syncNow = () => run(true);
  const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  function init() {
    if (!cfg || !cfg.apiKey || !window.firebase) { setStatus('unconfigured'); return; }
    try {
      firebase.initializeApp(cfg);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) { setStatus('error', e.message); return; }
    cloud.ready = true;
    auth.getRedirectResult().catch((e) => setStatus('error', e.message));
    auth.onAuthStateChanged((u) => {
      cloud.user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null;
      pushed.clear(); pushedMeta = ''; lastPull = 0;
      if (u) run(true); else setStatus('signed-out');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && cloud.user && Date.now() - lastPull > PULL_EVERY) run(true);
    });
    window.addEventListener('online', () => { if (cloud.user) run(true); });
  }

  touchMeta();
  init();
  return Object.assign(cloud, { signIn, signOut, syncNow, onSave, onChange });
})();
