// Firebase sync. Layout: users/{uid}/core/main holds everything except days;
// users/{uid}/months/{YYYY-MM} holds {days: {date: {...}}} for that month.
// Writes are per field (down to a single quest on a single day), so changes made on two
// devices merge instead of overwriting each other.

export const firebaseConfig = {
  apiKey: 'AIzaSyD9IdvdtegogMZawL1VwtOw4093uoXvZeg',
  authDomain: 'the-system-53dd3.firebaseapp.com',
  projectId: 'the-system-53dd3',
  storageBucket: 'the-system-53dd3.firebasestorage.app',
  messagingSenderId: '906999385353',
  appId: '1:906999385353:web:0d23919ce021044a4857d8'
};

const MAP_SECTIONS = new Set(['log', 'skip', 't']);
const OWNER_KEY = 'the-system-owner';
const BASE_KEY = 'the-system-synced';   // last state known to be in the cloud, kept across app restarts
const clone = o => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const coreKeys = s => Object.keys(s).filter(k => k !== 'days' && k[0] !== '_');

let F = null;            // firebase module
let auth = null, db = null, user = null;
let base = null;         // last state known to be in Firestore
function setBase(s) {
  base = clone(s);
  try { localStorage.setItem(BASE_KEY, JSON.stringify(base)); } catch (e) { /* storage full: fall back to memory only */ }
}
function savedBase() { try { return JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch (e) { return null; } }
let hooks = {};
let unsubs = [];
let ready = false;       // listeners attached and initial decision made
let pending = 0;
let status = 'off';

function setStatus(s) { status = s; hooks.onStatus && hooks.onStatus(s, user); }
export const getStatus = () => status;
export const getUser = () => user;

export async function initSync(h) {
  hooks = h;
  try {
    F = await import('../vendor/firebase.js');
  } catch (e) { console.warn('Firebase unavailable', e); setStatus('unavailable'); return; }
  const app = F.initializeApp(firebaseConfig);
  try {
    db = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.memoryLocalCache() });
  }
  auth = F.getAuth(app);
  F.onAuthStateChanged(auth, u => { user = u; u ? attach(u) : detach(); });
  addEventListener('online', () => user && setStatus(pending ? 'syncing' : 'synced'));
  addEventListener('offline', () => user && setStatus('offline'));
}

export async function signIn(email, pw) { return F.signInWithEmailAndPassword(auth, email, pw); }
export async function signUp(email, pw) { return F.createUserWithEmailAndPassword(auth, email, pw); }
export async function resetPassword(email) { return F.sendPasswordResetEmail(auth, email); }
export async function signOutUser() { await F.signOut(auth); }

const coreRef = () => F.doc(db, 'users', user.uid, 'core', 'main');
const monthsCol = () => F.collection(db, 'users', user.uid, 'months');
const monthRef = ym => F.doc(db, 'users', user.uid, 'months', ym);

function detach() {
  unsubs.forEach(u => u()); unsubs = [];
  ready = false; base = null;
  setStatus(F ? 'off' : 'unavailable');
}

function assemble(coreData, monthDocs) {
  const s = Object.assign({}, coreData, { days: {} });
  for (const m of monthDocs) Object.assign(s.days, (m.data() || {}).days || {});
  return s;
}

async function attach(u) {
  setStatus('syncing');
  let core, months;
  try {
    core = await F.getDoc(coreRef());
    months = await F.getDocs(monthsCol());
  } catch (e) {
    console.warn('initial sync read failed', e);
    setStatus(navigator.onLine ? 'error' : 'offline');
    hooks.onError && hooks.onError(e);
    return;
  }
  const local = hooks.getState();
  const owner = localStorage.getItem(OWNER_KEY);
  if (!core.exists()) {
    // first device to sign in: upload this device's save
    await pushAll(local);
  } else {
    const remote = assemble(core.data(), months.docs);
    let useLocal = false;
    if (owner !== u.uid && hooks.isMeaningful(local) && !same(stripLocal(local), stripLocal(hooks.normalize(remote)))) {
      useLocal = (await hooks.chooseSave(local, remote)) === 'local';
    }
    const prev = owner === u.uid && savedBase();
    if (useLocal) await pushAll(local, months.docs.map(d => d.id));
    else if (prev) {
      // Same device as before: changes made since the last sync (offline, or in the first
      // seconds after opening the app) are replayed on top of the cloud save, not thrown away.
      const changes = diff(prev, local);
      const merged = applyDiff(clone(remote), changes);
      setBase(hooks.normalize(remote));
      hooks.applyRemote(merged);
      localStorage.setItem(OWNER_KEY, u.uid);
      ready = true;
      push(hooks.getState());
      listen();
      setStatus(navigator.onLine ? (pending ? 'syncing' : 'synced') : 'offline');
      return;
    }
    else setBase(hooks.applyRemote(remote));
  }
  localStorage.setItem(OWNER_KEY, u.uid);
  ready = true;
  listen();
  setStatus(navigator.onLine ? 'synced' : 'offline');
}

const stripLocal = s => { const o = clone(s); for (const k of Object.keys(o)) if (k[0] === '_') delete o[k]; return o; };

function listen() {
  let coreData = null, monthDocs = null;
  const apply = () => {
    if (!coreData || !monthDocs) return;
    const remote = assemble(coreData, monthDocs);
    setBase(hooks.applyRemote(remote));
  };
  unsubs.push(F.onSnapshot(coreRef(), snap => { if (snap.exists()) { coreData = snap.data(); apply(); } }, e => console.warn(e)));
  unsubs.push(F.onSnapshot(monthsCol(), snap => { monthDocs = snap.docs; apply(); }, e => console.warn(e)));
}

async function pushAll(s, existingMonths = []) {
  const b = F.writeBatch(db);
  const core = {}; for (const k of coreKeys(s)) core[k] = s[k];
  b.set(coreRef(), clone(core));
  const byMonth = {};
  for (const d in s.days) (byMonth[d.slice(0, 7)] = byMonth[d.slice(0, 7)] || {})[d] = s.days[d];
  for (const ym in byMonth) b.set(monthRef(ym), { days: clone(byMonth[ym]) });
  for (const ym of existingMonths) if (!byMonth[ym]) b.delete(monthRef(ym));
  setBase(s);
  await commit(b);
}

// Compare the last synced state with the current one and write only what changed.
export function push(s) {
  if (!user || !ready || !base) return;
  const writes = diff(base, s);
  setBase(s);
  if (!writes.core.length && !Object.keys(writes.months).length) return;
  const b = F.writeBatch(db);
  if (writes.core.length) {
    const data = {}, fields = [];
    for (const [k, v] of writes.core) { data[k] = v === undefined ? F.deleteField() : clone(v); fields.push(new F.FieldPath(k)); }
    b.set(coreRef(), data, { mergeFields: fields });
  }
  for (const ym in writes.months) {
    const data = {}, fields = [];
    for (const [path, v] of writes.months[ym]) {
      setIn(data, path, v === undefined ? F.deleteField() : clone(v));
      fields.push(new F.FieldPath(...path));
    }
    b.set(monthRef(ym), data, { mergeFields: fields });
  }
  commit(b);
}

async function commit(b) {
  pending++; setStatus(navigator.onLine ? 'syncing' : 'offline');
  const p = b.commit().catch(e => { console.warn('sync write failed', e); hooks.onError && hooks.onError(e); });
  // with offline persistence commit() resolves only once the server acknowledges
  await p;
  pending = Math.max(0, pending - 1);
  if (!pending) setStatus(navigator.onLine ? 'synced' : 'offline');
}

function setIn(o, path, v) {
  let cur = o;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] = cur[path[i]] || {};
  cur[path[path.length - 1]] = v;
}

// Apply diff() output to a state object (used to replay local changes onto the cloud copy).
export function applyDiff(s, writes) {
  for (const [k, v] of writes.core) { if (v === undefined) delete s[k]; else s[k] = clone(v); }
  for (const ym in writes.months) for (const [path, v] of writes.months[ym]) {
    let cur = s;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] = cur[path[i]] || {};
    const last = path[path.length - 1];
    if (v === undefined) delete cur[last]; else cur[last] = clone(v);
  }
  return s;
}

export function diff(a, b) {
  const core = [], months = {};
  for (const k of new Set([...coreKeys(a), ...coreKeys(b)])) if (!same(a[k], b[k])) core.push([k, b[k]]);
  const da = a.days || {}, db_ = b.days || {};
  const add = (d, path, v) => (months[d.slice(0, 7)] = months[d.slice(0, 7)] || []).push([path, v]);
  for (const d of new Set([...Object.keys(da), ...Object.keys(db_)])) {
    const ra = da[d] || {}, rb = db_[d];
    if (same(ra, rb || {})) continue;
    if (!rb) { add(d, ['days', d], undefined); continue; }
    for (const sec of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
      if (same(ra[sec], rb[sec])) continue;
      if (MAP_SECTIONS.has(sec)) {
        const ma = ra[sec] || {}, mb = rb[sec] || {};
        for (const k of new Set([...Object.keys(ma), ...Object.keys(mb)])) if (!same(ma[k], mb[k])) add(d, ['days', d, sec, k], mb[k]);
      } else add(d, ['days', d, sec], rb[sec]);
    }
  }
  return { core, months };
}

// Deletes this account's cloud data and the account itself (used by tests and "Delete account").
export async function deleteAccount() {
  if (!user) return;
  const months = await F.getDocs(monthsCol());
  const b = F.writeBatch(db);
  months.docs.forEach(d => b.delete(d.ref));
  b.delete(coreRef());
  await b.commit();
  localStorage.removeItem(OWNER_KEY);
  await F.deleteUser(user);
}

// Wipe the cloud copy (used by "Reset everything").
export async function overwriteCloud(s) {
  if (!user || !ready) return;
  const months = await F.getDocs(monthsCol());
  await pushAll(s, months.docs.map(d => d.id));
}
