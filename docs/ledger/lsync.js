// Cloud sync for Ledger. Same Firebase project and account as The System, separate documents:
//   users/{uid}/ledger/main          settings + workouts
//   users/{uid}/ledgerDays/{date}    {tasks: {id: {t, done, at}}, wo: {id: sets}}
// Every write is a merge of the one field that changed, so two devices editing at once both win.

const firebaseConfig = {
  apiKey: 'AIzaSyD9IdvdtegogMZawL1VwtOw4093uoXvZeg',
  authDomain: 'the-system-53dd3.firebaseapp.com',
  projectId: 'the-system-53dd3',
  storageBucket: 'the-system-53dd3.firebasestorage.app',
  messagingSenderId: '906999385353',
  appId: '1:906999385353:web:0d23919ce021044a4857d8'
};

let F = null, auth = null, db = null, user = null;
let hooks = {}, status = 'off', pending = 0, ready = false;
let unMain = null, unDay = null, dayWatched = null;

const setStatus = s => { status = s; hooks.onStatus && hooks.onStatus(s, user); };
export const getStatus = () => status;
export const getUser = () => user;
export const isReady = () => ready;

export async function initSync(h) {
  hooks = h;
  try { F = await import('../vendor/firebase.js'); } catch (e) { setStatus('unavailable'); return; }
  const app = F.initializeApp(firebaseConfig, 'ledger');
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

export const signIn = (e, p) => F.signInWithEmailAndPassword(auth, e, p);
export const signUp = (e, p) => F.createUserWithEmailAndPassword(auth, e, p);
export const resetPassword = e => F.sendPasswordResetEmail(auth, e);
export const signOutUser = () => F.signOut(auth);

const mainRef = () => F.doc(db, 'users', user.uid, 'ledger', 'main');
const dayRef = d => F.doc(db, 'users', user.uid, 'ledgerDays', d);
const clone = o => JSON.parse(JSON.stringify(o));

function detach() {
  unMain && unMain(); unDay && unDay(); unMain = unDay = null; dayWatched = null;
  ready = false;
  setStatus(F ? 'off' : 'unavailable');
}

// Workouts from The System's cloud save, used once when Ledger has never been set up on this account.
export async function oldWorkouts() {
  if (!user) return null;
  try {
    const s = await F.getDoc(F.doc(db, 'users', user.uid, 'core', 'main'));
    return s.exists() && s.data().workouts ? s.data().workouts : null;
  } catch (e) { return null; }
}

async function attach(u) {
  setStatus('syncing');
  let main;
  try { main = await F.getDoc(mainRef()); } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline'); hooks.onError && hooks.onError(e); return;
  }
  const local = hooks.getState();
  if (!main.exists()) {
    // first device on this account: this device's setup becomes the cloud copy
    let workouts = local.workouts;
    if (local.woSource !== 'edited') { const w = await oldWorkouts(); if (w) workouts = hooks.adoptWorkouts(w); }
    await write(F.setDoc(mainRef(), { settings: clone(local.settings), workouts: clone(workouts), created: F.serverTimestamp() }));
  } else if (local.owner === u.uid && local.dirty && local.dirty.main) {
    // changed here while signed out: those changes win
    write(F.setDoc(mainRef(), { settings: clone(local.settings), workouts: clone(local.workouts) }, { mergeFields: ['settings', 'workouts'] }));
  } else hooks.onMain(main.data());
  // tasks added on this device while signed out (or before the first sign-in) are added to the cloud day
  const days = (local.dirty && local.dirty.days) || {};
  for (const d of Object.keys(days)) {
    const day = local.days[d]; if (!day) continue;
    const data = { tasks: clone(day.tasks || {}) };
    if (day.wo && Object.keys(day.wo).length) data.wo = clone(day.wo);
    write(F.setDoc(dayRef(d), data, { merge: true }));
  }
  hooks.onAttached(u.uid);
  ready = true;
  unMain = F.onSnapshot(mainRef(), s => { if (s.exists()) hooks.onMain(s.data()); }, e => console.warn(e));
  watchDay(hooks.today());
  setStatus(navigator.onLine ? (pending ? 'syncing' : 'synced') : 'offline');
}

export function watchDay(d) {
  if (!user || !db || dayWatched === d) return;
  unDay && unDay(); dayWatched = d;
  unDay = F.onSnapshot(dayRef(d), s => hooks.onDay(d, s.exists() ? s.data() : { tasks: {}, wo: {} }), e => console.warn(e));
}

async function write(p) {
  pending++; setStatus(navigator.onLine ? 'syncing' : 'offline');
  try { await p; } catch (e) { console.warn('sync write failed', e); hooks.onError && hooks.onError(e); }
  pending = Math.max(0, pending - 1);
  if (!pending && user) setStatus(navigator.onLine ? 'synced' : 'offline');
}

export function putTask(d, id, task) {
  if (!ready) return false;
  write(F.setDoc(dayRef(d), { tasks: { [id]: task ? clone(task) : F.deleteField() } }, { merge: true }));
  return true;
}
export function putWo(d, id, n) {
  if (!ready) return false;
  write(F.setDoc(dayRef(d), { wo: { [id]: n ? n : F.deleteField() } }, { merge: true }));
  return true;
}
export function putMain(field, value) {
  if (!ready) return false;
  write(F.setDoc(mainRef(), { [field]: clone(value) }, { mergeFields: [field] }));
  return true;
}
