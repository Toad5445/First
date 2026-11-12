// Ledger: a plain daily to-do list. Every morning the page is blank; nothing carries over.
import * as Sync from './lsync.js';
import { THEMES, ART, roman, word } from './themes.js';

const KEY = 'ledger-v1', REST_KEY = 'ledger-rest', OLD_KEY = 'the-system-save-v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => 'l' + Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// Book-title case, same rule as The System: small joining words stay lower case unless first or last.
const SMALL = new Set('a an the and but or nor for so yet as at by in of off on per to up via vs with from into onto over than'.split(' '));
export function taskCase(t) {
  const w = String(t || '').replace(/\s+/g, ' ').trim().split(' ');
  const first = w.findIndex(x => /\p{L}/u.test(x)), last = w.map(x => /\p{L}/u.test(x)).lastIndexOf(true);
  return w.map((x, i) => {
    const core = x.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
    if (SMALL.has(core) && i !== first && i !== last && !/[:—]$/.test(w[i - 1] || '')) return x;
    return x.split('-').map(p => p.replace(/^([^\p{L}\p{N}]*)(\p{Ll})/u, (m, pre, c) => pre + c.toUpperCase())).join('-');
  }).join(' ');
}

const DEFAULT_WORKOUTS = {
  mon: [
    { name: 'Wall Handstand Holds', sets: 3, reps: 'attempts' },
    { name: 'Chin-Ups (+15 lb)', sets: 3, reps: '9, 8, 8' },
    { name: 'Feet-Elevated Rows (Neutral Grip)', sets: 3, reps: '10' },
    { name: 'Static Lunges', sets: 3, reps: '11', per: 'leg' },
    { name: 'Weighted V-Ups (5 lb)', sets: 3, reps: '12' }],
  wed: [
    { name: 'Single-Arm Dumbbell Curls', sets: 3, reps: '10', per: 'arm' },
    { name: 'Single-Arm Hammer Curls', sets: 3, reps: '10', per: 'arm' },
    { name: 'Isometric Hold (90°)', sets: 3, reps: '25s', per: 'arm' },
    { name: 'Abs Circuit', rounds: 3, moves: [{ name: 'Leg Raises', reps: '12' }, { name: 'Reverse Crunches', reps: '10' }, { name: 'Side Plank Reach-Throughs', reps: '10', per: 'side' }] }],
  fri: [
    { name: 'Pike Push-Ups', sets: 3, reps: '11' },
    { name: 'Dips', sets: 3, reps: '9' },
    { name: 'Diamond Push-Ups', sets: 3, reps: '11' },
    { name: 'Static Lunges', sets: 3, reps: '11', per: 'leg' },
    { name: 'Hanging Leg Raises', sets: 3, reps: '11' }]
};
// give every exercise and move an id (The System's saves already have them; the defaults don't)
function withIds(w) {
  const o = JSON.parse(JSON.stringify(w || {}));
  for (const k of ['mon', 'wed', 'fri']) {
    o[k] = Array.isArray(o[k]) ? o[k] : [];
    for (const x of o[k]) { x.id = x.id || uid(); if (x.moves) for (const m of x.moves) m.id = m.id || uid(); }
  }
  return o;
}

// ---------- state ----------
const SETTINGS = { theme: 'light', layout: 'right', check: 'theme', restSec: 90 };
let S = load();
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* start fresh */ }
  if (!s || typeof s !== 'object') {
    s = { v: 1, days: {}, dirty: { main: false, days: {} } };
    // first run: bring the workout over from The System on this device
    let old = null;
    try { old = JSON.parse(localStorage.getItem(OLD_KEY)); } catch (e) { /* none */ }
    if (old && old.workouts) { s.workouts = withIds(old.workouts); s.woSource = 'system'; if (old.settings && old.settings.restSec) s.restSec = old.settings.restSec; }
  }
  s.settings = Object.assign({}, SETTINGS, s.settings);
  if (s.restSec) { s.settings.restSec = s.restSec; delete s.restSec; }
  if (!s.workouts) { s.workouts = withIds(DEFAULT_WORKOUTS); s.woSource = 'default'; }
  s.days = s.days || {}; s.dirty = s.dirty || { main: false, days: {} }; s.dirty.days = s.dirty.days || {};
  // past days are kept for the history view (two years is plenty); empty ones are dropped
  const cut = new Date(); cut.setFullYear(cut.getFullYear() - 2); const cutKey = cut.toISOString().slice(0, 10);
  for (const d of Object.keys(s.days)) {
    const x = s.days[d];
    if (d !== today() && (d < cutKey || (!Object.keys(x.tasks || {}).length && !Object.keys(x.wo || {}).length))) delete s.days[d];
  }
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full */ } }
const dayOf = d => (S.days[d] = S.days[d] || { tasks: {}, wo: {} });
const T = () => THEMES[S.settings.theme] || THEMES.light;
const checkStyle = () => S.settings.check === 'theme' ? T().check : S.settings.check;

function setTask(id, task) {
  const d = today(), day = dayOf(d);
  if (task) day.tasks[id] = task; else delete day.tasks[id];
  if (!Sync.putTask(d, id, task)) S.dirty.days[d] = true;
  save();
}
function setWo(id, n) {
  const d = today(), day = dayOf(d);
  if (n) day.wo[id] = n; else delete day.wo[id];
  if (!Sync.putWo(d, id, n)) S.dirty.days[d] = true;
  save();
}
function setMain(field) {
  if (field === 'workouts') S.woSource = 'edited';
  if (!Sync.putMain(field, S[field])) S.dirty.main = true;
  save();
}

// ---------- dates ----------
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth',
  'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third',
  'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];
function ctx() {
  const now = new Date(), day = S.days[today()] || { tasks: {} };
  const list = Object.entries(day.tasks).map(([id, t]) => Object.assign({ id }, t)).sort((a, b) => (a.at || 0) - (b.at || 0));
  return {
    now, list, done: list.filter(t => t.done).length, total: list.length,
    dow: DAYS[now.getDay()], month: MONTHS[now.getMonth()], date: now.getDate(), year: now.getFullYear(),
    ord: ORD[now.getDate()], doy: Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5),
    user: Sync.getUser(), status: Sync.getStatus(), layout: S.settings.layout, tab: view.tab
  };
}

// ---------- checkboxes ----------
// theme defaults: aero gel bead, cyber crossed square, dark wax seal, light ink tick; or a plain circle/square/star everywhere
const CHECKS = {
  gel: '<span class="ck-gel"><i></i></span>',
  xbox: '<span class="ck-x"></span>',
  seal: '<span class="ck-seal"><svg viewBox="0 0 40 40"><path class="wax" d="M20 2.6c2.2 0 3 1.6 4.9 1.9 2 .3 3.6-.8 5.3.3 1.6 1.1 1.4 3 2.6 4.6 1.2 1.6 3 2 3.6 3.9.6 1.9-.6 3.3-.5 5.3.1 2 1.5 3.3 1.1 5.2-.4 1.9-2.3 2.5-3.2 4.2-.9 1.8-.5 3.7-2 5-1.5 1.4-3.3.8-5.2 1.5-1.9.7-2.8 2.4-4.7 2.5-2 .1-3-1.6-4.9-2.1-1.9-.5-3.7.4-5.3-.7-1.7-1.1-1.5-3.1-2.6-4.7-1.2-1.6-3.1-2.1-3.6-4-.6-1.9.7-3.4.6-5.3 0-2-1.4-3.3-1-5.2.5-1.9 2.4-2.4 3.4-4.1.9-1.7.6-3.6 2.1-4.9 1.5-1.3 3.4-.6 5.2-1.2C17 4.2 17.9 2.6 20 2.6Z"/><circle class="ring" cx="20" cy="20" r="11.5"/><text x="20" y="25.2">L</text></svg></span>',
  tick: '<span class="ck-tick"><svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="12.5"/><path d="M8.5 15.5c2.2 1.6 3.8 3.6 5 6 2.6-6.4 6.2-11 10-14"/></svg></span>',
  circle: '<span class="ck-circle"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.25"/><path d="M7.2 12.4l3.2 3.1 6.4-7"/></svg></span>',
  square: '<span class="ck-square"><svg viewBox="0 0 24 24"><rect x="1.75" y="1.75" width="20.5" height="20.5" rx="4.5"/><path d="M7.2 12.4l3.2 3.1 6.4-7"/></svg></span>',
  star: '<span class="ck-star"><svg viewBox="0 0 24 24"><path d="M12 1.8l3 6.4 7 .8-5.2 4.8 1.4 6.9L12 17.2l-6.2 3.5 1.4-6.9L2 9l7-.8z"/></svg></span>'
};
const check = (style = checkStyle()) => CHECKS[style] || CHECKS.circle;
const X_ICON = '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

// ---------- view ----------
const view = { tab: 'tasks', woDay: null, woEdit: false, editing: null, histMonth: null, histDay: null };
let artKey = '';

// ---------- video ----------
// A YouTube video beside the list, added from Settings. Nothing is shown until a link is pasted there,
// and hiding it removes the frame entirely. Kept on this device only.
const VKEY = 'ledger-video';
let video = (() => { try { return JSON.parse(localStorage.getItem(VKEY)) || {}; } catch (e) { return {}; } })();
const videoSave = () => { try { localStorage.setItem(VKEY, JSON.stringify(video)); } catch (e) { /* optional */ } };
// youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /live/ID, /embed/ID, m./music. hosts, ?t=90 / 1m30s, playlists
export function ytParse(raw) {
  let u; try { u = new URL(String(raw).trim().replace(/^(?!https?:)/, 'https://')); } catch (e) { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/) || [])[1] || null;
  } else return null;
  const list = u.searchParams.get('list');
  if (id && !/^[\w-]{11}$/.test(id)) id = null;
  if (!id && !list) return null;
  const tt = u.searchParams.get('t') || u.searchParams.get('start') || '';
  const m = String(tt).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  const start = m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
  return { id, list, start };
}
function videoSrc(v, autoplay) {
  // YouTube's own controls are switched off; Ledger draws its own over the video and drives the player
  // through YouTube's IFrame API, so they can match the theme and get out of the way quickly
  const q = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1', controls: '0', disablekb: '1', fs: '0',
    iv_load_policy: '3', enablejsapi: '1', origin: location.origin });
  if (v.start) q.set('start', v.start);
  if (autoplay) q.set('autoplay', '1');
  if (v.list) q.set('list', v.list);
  return `https://www.youtube-nocookie.com/embed/${v.id || 'videoseries'}?${q}`;
}
// center layout only: the enlarge button folds the art column away and gives the video the room
function theater() {
  const center = S.settings.layout === 'center' && video.on && ytParse(video.url);
  const on = !!(center && video.big);
  document.body.classList.toggle('theater', on);
  document.body.classList.toggle('video-left', !!(center && video.side === 'left'));
  const b = document.querySelector('#vdock .vexpand');
  if (b) { b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Make video smaller' : 'Enlarge video'); b.title = on ? 'Smaller' : 'Enlarge'; }
  const w = document.querySelector('#vdock .vswap');
  if (w) { const l = video.side === 'left'; w.setAttribute('aria-label', l ? 'Move video to the right' : 'Move video to the left'); w.title = l ? 'Move right' : 'Move left'; }
}
// moving between sides is a change of grid areas, which CSS can't animate, so slide each piece from where
// it was to where it lands (FLIP)
function glide(change) {
  const els = [...document.querySelectorAll('.stage > .panel, .stage > .brand, .stage > .vdock')];
  const first = els.map(e => e.getBoundingClientRect());
  document.body.classList.add('no-col-anim');
  change();
  els.forEach((e, i) => {
    const l = e.getBoundingClientRect(), f = first[i];
    if (!l.width || (Math.abs(f.left - l.left) < 1 && Math.abs(f.top - l.top) < 1)) return;
    e.animate([{ transform: `translate(${f.left - l.left}px, ${f.top - l.top}px)` }, { transform: 'none' }],
      { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 620, easing: 'cubic-bezier(.65,0,.35,1)' });
  });
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('no-col-anim')));
}

const VI = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z"/><path class="ln" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z"/><path class="ln" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path class="ln" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><path class="ln" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>'
};
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
let yt = null, ytTimer = null, ytApi = null;
const tfmt = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
function loadYtApi() {
  if (ytApi) return ytApi;
  ytApi = new Promise((res, rej) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.onerror = rej;
    document.head.appendChild(sc);
    setTimeout(() => rej(new Error('timeout')), 9000);
  });
  return ytApi;
}
// Ledger's own controls: shown while the pointer moves over the video, gone ~1s after it stops (2s when
// paused) and straight away when it leaves. Tap on a phone to show them, tap again to play/pause.
function wireControls(scr, iframe) {
  const ctl = scr.querySelector('.vctl'), hit = scr.querySelector('.vhit'), prog = scr.querySelector('.vprog');
  const fill = scr.querySelector('.vfill'), buf = scr.querySelector('.vbuf'), knob = scr.querySelector('.vknob');
  const time = scr.querySelector('.vtime'), bPlay = scr.querySelector('.vplay'), bMute = scr.querySelector('.vmute');
  const bRate = scr.querySelector('.vrate'), menu = scr.querySelector('.vmenu'), bFull = scr.querySelector('.vfull');
  let hideT = null, playing = false, dragging = false, touchShown = 0;
  const show = (ms) => {
    scr.classList.add('show'); clearTimeout(hideT);
    hideT = setTimeout(() => { if (!dragging && menu.hidden) scr.classList.remove('show'); }, ms || (playing ? 1100 : 2200));
  };
  const hide = () => { clearTimeout(hideT); if (!dragging) { scr.classList.remove('show'); menu.hidden = true; } };
  scr.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') show(); });
  // the settings menu lives just outside the video (so a small player doesn't clip it), inside it in full screen
  const home = scr.closest('.vframe'); home.appendChild(menu);
  const inMenu = el => el && (el === menu || menu.contains(el));
  scr.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !inMenu(e.relatedTarget)) hide(); });
  menu.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !scr.contains(e.relatedTarget)) hide(); });
  menu.addEventListener('pointermove', () => show(4000));
  const toggle = () => { if (!yt || !yt.getPlayerState) return; playing ? yt.pauseVideo() : yt.playVideo(); };
  hit.addEventListener('click', e => {
    if (e.pointerType === 'touch' || (e.pointerType === undefined && matchMedia('(hover: none)').matches)) {
      if (!scr.classList.contains('show') || Date.now() - touchShown < 300) { touchShown = Date.now(); show(2600); return; }
    }
    toggle(); show();
  });
  hit.addEventListener('dblclick', () => bFull.click());
  bPlay.onclick = () => { toggle(); show(); };
  bMute.onclick = () => { if (!yt) return; yt.isMuted() ? yt.unMute() : yt.mute(); setTimeout(paint, 60); show(); };
  bRate.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; show(4000); };
  menu.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => { if (yt) yt.setPlaybackRate(+b.dataset.rate); menu.hidden = true; setTimeout(paint, 80); show(); });
  // Quality: YouTube ignores quality requests from the page, but it picks quality from how big its player is.
  // So the player is drawn larger than the frame (and scaled down to fit) by just enough for the chosen quality.
  const QH = { highres: 4320, hd2160: 2160, hd1440: 1440, hd1080: 1080, hd720: 720, large: 480, medium: 360, small: 240, tiny: 144 };
  const qName = h => h >= 2160 ? '4K' : h + 'p';
  const qbox = menu.querySelector('.vqs'), qnow = menu.querySelector('.vqnow');
  const applyQ = () => {
    const want = video.q && video.q !== 'auto' ? +video.q : 0;
    const h = scr.clientHeight * (devicePixelRatio || 1);
    const k = want && h ? Math.min(8, Math.max(1, want / h)) : 1;
    scr.style.setProperty('--vs', k.toFixed(3));
    qbox.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === String(video.q || 'auto')));
  };
  const listQ = () => {
    const lv = (yt && yt.getAvailableQualityLevels ? yt.getAvailableQualityLevels() : []).map(l => QH[l]).filter(h => h >= 720);
    const hs = [...new Set(lv)].sort((a, b) => b - a);
    if (!hs.length || qbox.dataset.n === hs.join()) return;
    qbox.dataset.n = hs.join();
    qbox.innerHTML = '<button data-q="auto">Auto</button>' + hs.map(h => `<button data-q="${h}">${qName(h)}</button>`).join('');
    qbox.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { video.q = b.dataset.q; videoSave(); applyQ(); menu.hidden = true; show(); });
    applyQ();
  };
  qbox.querySelector('[data-q]').onclick = () => { video.q = 'auto'; videoSave(); applyQ(); };
  new ResizeObserver(applyQ).observe(scr);
  applyQ();
  const canFull = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!canFull) bFull.hidden = true;
  bFull.onclick = () => {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (scr.requestFullscreen || scr.webkitRequestFullscreen).call(scr);
  };
  document.addEventListener('fullscreenchange', () => {
    const fs = document.fullscreenElement === scr;
    bFull.innerHTML = fs ? VI.exit : VI.full; (fs ? scr : home).appendChild(menu);
  });
  // scrubbing
  const seekAt = x => { const r = prog.getBoundingClientRect(), f = Math.min(1, Math.max(0, (x - r.left) / r.width)); return f; };
  prog.addEventListener('pointerdown', e => {
    if (!yt || !yt.getDuration) return; dragging = true; prog.classList.add('drag'); prog.setPointerCapture(e.pointerId);
    const f = seekAt(e.clientX); fill.style.width = knob.style.left = f * 100 + '%';
  });
  prog.addEventListener('pointermove', e => { if (!dragging) return; const f = seekAt(e.clientX); fill.style.width = knob.style.left = f * 100 + '%'; time.textContent = `${tfmt(f * yt.getDuration())} / ${tfmt(yt.getDuration())}`; });
  prog.addEventListener('pointerup', e => { if (!dragging) return; dragging = false; prog.classList.remove('drag'); yt.seekTo(seekAt(e.clientX) * yt.getDuration(), true); show(); });
  function paint() {
    if (!yt || !yt.getDuration) return;
    const d = yt.getDuration() || 0, t = yt.getCurrentTime() || 0;
    if (!dragging && d) { fill.style.width = knob.style.left = (t / d * 100) + '%'; time.textContent = `${tfmt(t)} / ${tfmt(d)}`; }
    buf.style.width = ((yt.getVideoLoadedFraction && yt.getVideoLoadedFraction()) || 0) * 100 + '%';
    bMute.innerHTML = yt.isMuted && yt.isMuted() ? VI.muted : VI.vol;
    const r = yt.getPlaybackRate ? yt.getPlaybackRate() : 1;
    const cq = QH[yt.getPlaybackQuality && yt.getPlaybackQuality()]; qnow.textContent = cq ? `· now ${qName(cq)}` : '';
    listQ();
    menu.querySelectorAll('[data-rate]').forEach(b => b.classList.toggle('on', +b.dataset.rate === r));
  }
  loadYtApi().then(YT => {
    if (!iframe.isConnected) return;
    yt = new YT.Player(iframe, { events: {
      onReady: () => { scr.classList.add('ready'); paint(); },
      onStateChange: e => {
        playing = e.data === 1 || e.data === 3;
        if (e.data === 1) scr.classList.remove('fresh');   // first play: the poster gives way to the video
        scr.classList.toggle('paused', !playing);
        bPlay.innerHTML = playing ? VI.pause : VI.play;
        bPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        clearTimeout(scr._settle); scr.classList.remove('settled');
        if (!playing) scr._settle = setTimeout(() => scr.classList.add('settled'), 1100);
        if ((e.data === 2 || e.data === 0) && scr.matches(':hover')) show(); paint();
      },
      onError: () => { scr.classList.add('failed'); }
    } });
    clearInterval(ytTimer); ytTimer = setInterval(paint, 250);
  }).catch(() => {
    // the API didn't load: fall back to YouTube's own controls
    scr.classList.add('native'); const u = new URL(iframe.src); u.searchParams.set('controls', '1'); u.searchParams.delete('fs'); iframe.src = u;
  });
}

// builds (or removes) the player; called only when the video itself changes, so theme switches and
// re-renders never restart playback
function placeVideo(autoplay) {
  const dock = $('vdock'), v = video.on && ytParse(video.url);
  document.body.classList.toggle('has-video', !!v);
  if (!v) { dock.hidden = true; dock.innerHTML = ''; yt = null; clearInterval(ytTimer); theater(); return; }
  const src = videoSrc(v, autoplay);
  const frame = dock.querySelector('iframe');
  if (frame && frame.dataset.key === video.url) { dock.hidden = false; theater(); return; }
  dock.innerHTML = `<div class="vframe">
      <i class="vc tl"></i><i class="vc tr"></i><i class="vc bl"></i><i class="vc br"></i><i class="vpin" aria-hidden="true"></i>
      <div class="vbar"><span class="orbs" aria-hidden="true"><i></i><i></i><i></i></span><span class="vlabel"></span>
        <span class="vtools"><button class="vswap" aria-label="Move video to the left" title="Move left"><svg viewBox="0 0 16 16"><path d="M5.5 3 2.5 6l3 3M2.5 6h11M10.5 7l3 3-3 3M13.5 10h-11"/></svg></button>
        <button class="vexpand" aria-label="Enlarge video" title="Enlarge"><svg viewBox="0 0 16 16" class="i-grow"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg><svg viewBox="0 0 16 16" class="i-shrink"><path d="M13 7H9V3M9 7l4.5-4.5M3 9h4v4M7 9l-4.5 4.5"/></svg></button>
        <button class="vclose" aria-label="Hide video">${X_ICON}</button></span></div>
      <div class="vscreen paused fresh"><div class="vscale"><iframe src="${esc(src)}" data-key="${esc(video.url)}" title="YouTube video"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        ${v.id ? `<img class="vposter" alt="" src="https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'">` : ''}
        <div class="vhit" aria-hidden="true"></div>
        <span class="vbig" aria-hidden="true">${VI.play}</span>
        <div class="vctl"><button class="vplay" aria-label="Play">${VI.play}</button>
          <span class="vtime">0:00 / 0:00</span>
          <div class="vprog" role="slider" aria-label="Seek"><i class="vrail"></i><i class="vbuf"></i><i class="vfill"></i><i class="vknob"></i></div>
          <button class="vmute" aria-label="Mute">${VI.vol}</button>
          <button class="vrate" aria-label="Settings: quality and speed"><svg viewBox="0 0 24 24"><path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.4 4.7.1-1.3-.1-1.3 2.1-1.6-2-3.5-2.5 1a8 8 0 0 0-2.2-1.3L15.4 2.6h-4l-.4 2.7a8 8 0 0 0-2.2 1.3l-2.5-1-2 3.5L6.4 10.7l-.1 1.3.1 1.3-2.1 1.6 2 3.5 2.5-1a8 8 0 0 0 2.2 1.3l.4 2.7h4l.4-2.7a8 8 0 0 0 2.2-1.3l2.5 1 2-3.5Z"/></svg></button>
          <button class="vfull" aria-label="Full screen">${VI.full}</button>
          <div class="vmenu" hidden><div class="vmh">Quality <span class="vqnow"></span></div><div class="vqs"><button data-q="auto">Auto</button></div>
            <div class="vmh">Speed</div><div class="vrates">${RATES.map(r => `<button data-rate="${r}">${r === 1 ? 'Normal' : r + '×'}</button>`).join('')}</div></div></div>
      </div></div>`;
  dock.hidden = false;
  dock.querySelector('.vclose').onclick = () => { video.on = false; videoSave(); placeVideo(); if (view.tab === 'settings') renderPanel(); };
  dock.querySelector('.vexpand').onclick = () => { video.big = !video.big; videoSave(); theater(); };
  dock.querySelector('.vswap').onclick = () => glide(() => { video.side = video.side === 'left' ? 'right' : 'left'; videoSave(); theater(); });
  wireControls(dock.querySelector('.vscreen'), dock.querySelector('iframe'));
  theater();
  dock.querySelector('.vlabel').textContent = T().vlabel || '';
}

function render() {
  const b = document.body, st = S.settings;
  b.dataset.theme = st.theme; b.dataset.layout = st.layout; b.dataset.check = checkStyle(); b.dataset.tab = view.tab;
  const c = ctx(), t = T();
  const key = st.theme;
  if (artKey !== key) { $('art').innerHTML = ART[st.theme](); artKey = key; }
  $('brand').innerHTML = t.brand(c);
  $('side').innerHTML = t.side(c);
  renderPanel(c);
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = t.color;
  // what shows behind the art, e.g. in the iPhone home-bar strip, is the colour of the theme's bottom edge
  document.documentElement.dataset.theme = st.theme;
  const vl = document.querySelector('#vdock .vlabel'); if (vl) vl.textContent = t.vlabel || '';
  theater();
  tickClocks();
}

function renderPanel(c = ctx()) {
  const t = T();
  const tabs = [['tasks', t.tabNames[0]], ['workout', t.tabNames[1]], ['history', t.tabNames[2]], ['settings', t.tabNames[3]]];
  $('panel').innerHTML = `${t.head(c)}
    <div class="pbody" id="pbody">${view.tab === 'tasks' ? tasksHTML(c) : view.tab === 'workout' ? workoutHTML() : view.tab === 'history' ? historyHTML() : settingsHTML(c)}</div>
    <footer class="pfoot"><nav class="tabs" role="tablist">${tabs.map(([k, n], i) => `${i ? '<i class="sep" aria-hidden="true"></i>' : ''}<button role="tab" class="${view.tab === k ? 'on' : ''}" data-tab="${k}" aria-selected="${view.tab === k}">${n}</button>`).join('')}</nav>
      <div class="count" aria-label="${c.done} of ${c.total} done">${t.count(c)}</div></footer>`;
  bindPanel();
}

function tasksHTML(c) {
  const t = T();
  const rows = c.list.map((x, i) => `<div class="task ${x.done ? 'done' : ''}" data-id="${x.id}">
      <button class="ck" aria-label="${x.done ? 'Mark not done' : 'Mark done'}" aria-pressed="${!!x.done}">${check()}</button>
      ${view.editing === x.id ? `<input class="t-edit" value="${esc(x.t)}" maxlength="120" aria-label="Edit task">` : `<span class="t">${esc(x.t)}</span>`}
      <span class="meta">${t.num(i + 1, x.done)}</span>
      <button class="del" aria-label="Remove">${X_ICON}</button></div>`).join('');
  return `<form class="addrow" id="addform" autocomplete="off">${t.addIcon || ''}<input id="addin" maxlength="120" placeholder="${esc(t.placeholder)}" aria-label="New task" enterkeyhint="done">
      <button class="addbtn" type="submit">${t.addLabel}</button></form>
    <div class="list" id="list">${rows || `<div class="empty">${t.empty}</div>`}</div>`;
}

// ---------- workout (ported from The System) ----------
const WDAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const WORKOUT_DAYS = [['mon', 'Monday'], ['wed', 'Wednesday'], ['fri', 'Friday']];
const todayKey = () => Object.keys(WDAY).find(k => WDAY[k] === new Date().getDay());
function woAmount(x) {
  const reps = String(x.reps || '').trim(), per = x.per ? ` per ${x.per}` : '';
  if (x.sets == null) return reps + per;
  if (reps.includes(',')) return reps.split(',').map(r => r.trim()).filter(Boolean).join(', ') + per;
  if (reps && !/\d/.test(reps)) return `${x.sets} ${reps}`;
  return reps ? `${x.sets} × ${reps}${per}` : `${x.sets} sets`;
}
function perSet(x) {
  const r = String(x.reps).split(',').map(v => v.trim()).filter(Boolean);
  return Array.from({ length: x.sets }, (_, k) => r[k] || r[r.length - 1] || '10');
}
let rest = (() => { try { return JSON.parse(localStorage.getItem(REST_KEY)) || {}; } catch (e) { return {}; } })();
const restSave = () => { try { localStorage.setItem(REST_KEY, JSON.stringify(rest)); } catch (e) { /* optional */ } };
const restLen = () => S.settings.restSec || 90;
const restLeft = () => rest.end ? Math.max(0, (rest.end - Date.now()) / 1000) : rest.paused != null ? rest.paused : restLen();
const mmss = t => { t = Math.ceil(t); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
const RING = 2 * Math.PI * 54;
const ringOffset = () => (RING * (1 - ((rest.end || rest.paused != null) ? restLeft() / restLen() : 1))).toFixed(2);
function restHTML() {
  const run = !!rest.end, paused = rest.paused != null, left = restLeft();
  return `<div class="rest ${run ? 'run' : ''} ${paused ? 'paused' : ''}" id="rest">
    <div class="rest-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rest-ticks" cx="60" cy="60" r="58"/><circle class="rest-track" cx="60" cy="60" r="54"/>
      <circle class="rest-ring" id="rest-ring" cx="60" cy="60" r="54" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="${ringOffset()}"/></svg>
      <div class="rest-face"><span class="rest-label">Rest</span>${run || paused ? `<span class="rest-time" id="rest-time">${mmss(left)}</span>`
        : `<input class="rest-time rest-input" id="rest-time" value="${mmss(left)}" inputmode="numeric" maxlength="5" aria-label="Rest length">`}</div></div>
    <div class="rest-btns">${run || paused ? `<button class="btn solid" data-rest="${run ? 'pause' : 'resume'}">${run ? 'Pause' : 'Resume'}</button><button class="btn" data-rest="reset">Reset</button>`
      : `<button class="btn solid" data-rest="start">Start</button><div class="rest-adj"><button class="btn" data-rest="-15">−15s</button><button class="btn" data-rest="+15">+15s</button></div>`}</div></div>`;
}
function parseRest(v) {
  v = String(v).trim();
  const m = v.match(/^(\d{1,2}):(\d{1,2})$/);
  const sec = m ? +m[1] * 60 + +m[2] : /^\d+$/.test(v) ? (+v <= 10 ? +v * 60 : +v) : NaN;
  return isNaN(sec) ? null : Math.min(600, Math.max(5, sec));
}
function restBind() {
  const el = $('rest'); if (!el) return;
  const inp = el.querySelector('.rest-input');
  if (inp) {
    inp.onfocus = () => inp.select();
    inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
    inp.onchange = () => { const v = parseRest(inp.value); if (v) { S.settings.restSec = v; setMain('settings'); } inp.value = mmss(restLen()); };
  }
  el.querySelectorAll('[data-rest]').forEach(b => b.onclick = () => {
    const a = b.dataset.rest;
    if (a === 'start') { rest = { end: Date.now() + restLen() * 1000 }; chime(0); }
    else if (a === 'pause') rest = { paused: restLeft() };
    else if (a === 'resume') rest = { end: Date.now() + rest.paused * 1000 };
    else if (a === 'reset') rest = {};
    else { S.settings.restSec = Math.min(600, Math.max(5, restLen() + +a)); setMain('settings'); }
    restSave(); el.outerHTML = restHTML(); restBind();
  });
}
setInterval(() => {
  if (!rest.end) return;
  const el = $('rest');
  if (Date.now() >= rest.end) {
    rest = {}; restSave(); chime(1);
    try { navigator.vibrate && navigator.vibrate([200, 150, 200]); } catch (e) { /* no vibration */ }
    toast('Rest is over. Next set.');
    if (el) { el.outerHTML = restHTML(); restBind(); }
  } else if (el) { $('rest-time').textContent = mmss(restLeft()); $('rest-ring').setAttribute('stroke-dashoffset', ringOffset()); }
}, 250);
let actx = null;
function chime(big) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = big ? [880, 1174.7, 1568] : [660];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * .14;
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.12, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .6);
      o.start(t0); o.stop(t0 + .65);
    });
  } catch (e) { /* no audio */ }
}

const woTotal = x => x.moves ? (x.rounds || 1) : (x.sets || 1);
function workoutHTML() {
  const tk = todayKey(), order = WORKOUT_DAYS.map(w => w[0]);
  if (!view.woDay) view.woDay = order.includes(tk) ? tk : order.find(k => WDAY[k] > WDAY[tk]) || order[0];
  const key = view.woDay, list = S.workouts[key] || [], isToday = key === tk;
  const wo = dayOf(today()).wo || {};
  const doneOf = x => (wo[x.id] || 0) >= woTotal(x);
  const pips = (n, t) => `<span class="pips">${Array.from({ length: t }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>`;
  const nDone = isToday ? list.filter(doneOf).length : 0;
  const tabs = WORKOUT_DAYS.map(([k, n]) => `<button class="${k === key ? 'on' : ''}" data-wday="${k}">${n.slice(0, 3)}${k === tk ? '<i class="today-dot"></i>' : ''}</button>`).join('');
  const PER = ['', 'arm', 'leg', 'side'];
  const perSel = (v, i, j) => `<select data-f="per" data-i="${i}"${j != null ? ` data-j="${j}"` : ''}>${PER.map(o => `<option value="${o}" ${o === (v || '') ? 'selected' : ''}>${o ? 'per ' + o : '—'}</option>`).join('')}</select>`;
  let body;
  if (view.woEdit) {
    body = list.map((x, i) => x.moves
      ? `<div class="wo-edit" data-i="${i}">
          <div class="frow"><input type="text" data-f="name" data-i="${i}" value="${esc(x.name)}" maxlength="50">
            <label class="num">Rounds <input type="number" data-f="rounds" data-i="${i}" value="${x.rounds || 1}" min="1" max="20"></label>
            <button class="del" data-wdel="${i}" aria-label="Remove">${X_ICON}</button></div>
          ${x.moves.map((m, j) => `<div class="frow move"><input type="text" data-f="name" data-i="${i}" data-j="${j}" value="${esc(m.name)}" maxlength="50">
            <input type="text" class="reps" data-f="reps" data-i="${i}" data-j="${j}" value="${esc(m.reps)}" maxlength="20" placeholder="reps">
            ${perSel(m.per, i, j)}<button class="del" data-wdel="${i}" data-j="${j}" aria-label="Remove">${X_ICON}</button></div>`).join('')}
          <button class="btn small" data-wadd="move" data-i="${i}">+ Move</button></div>`
      : (() => {
          const varied = String(x.reps).includes(','), per = varied ? perSet(x) : [];
          return `<div class="wo-edit" data-i="${i}"><div class="frow"><input type="text" data-f="name" data-i="${i}" value="${esc(x.name)}" maxlength="50">
            <button class="del" data-wdel="${i}" aria-label="Remove">${X_ICON}</button></div>
          <div class="frow"><label class="num">Sets <input type="number" data-f="sets" data-i="${i}" value="${x.sets}" min="1" max="20"></label>
            <select data-mode="${i}"><option value="same" ${varied ? '' : 'selected'}>Same reps each set</option><option value="varied" ${varied ? 'selected' : ''}>Different each set</option></select>
            ${perSel(x.per, i)}</div>
          <div class="frow">${varied
            ? per.map((r, k) => `<label class="num">Set ${k + 1} <input type="text" class="reps" data-setrep="${k}" data-i="${i}" value="${esc(r)}" maxlength="8"></label>`).join('')
            : `<label class="num">Reps <input type="text" class="reps" data-f="reps" data-i="${i}" value="${esc(x.reps)}" maxlength="20" placeholder="10, 25s…"></label>`}</div></div>`;
        })()).join('')
      + `<div class="wo-addrow"><button class="btn" data-wadd="ex">+ Exercise</button><button class="btn" data-wadd="circuit">+ Circuit</button></div>
         <p class="note">Reps can be a number (10), a time (25s) or a word (attempts). Pick “Different each set” to give every set its own count.</p>`;
  } else {
    body = list.map(x => {
      const isDone = isToday && doneOf(x), r = isToday ? Math.min(wo[x.id] || 0, woTotal(x)) : 0;
      return `<div class="task wo-row ${isDone ? 'done' : ''} ${isToday ? '' : 'plan'}" data-wid="${x.id}">
          <button class="ck" data-all aria-label="Mark every set done">${check()}</button>
          <div class="wo-name"><span class="t">${esc(x.name)}</span>${isToday ? pips(r, woTotal(x)) : ''}
            ${x.moves ? `<span class="moves">${x.moves.map(m => `<span><b>${esc(m.name)}</b> <em>${esc(woAmount(m))}</em></span>`).join('')}</span>` : ''}</div>
          <span class="meta amt">${x.moves ? `${x.rounds || 1} rounds` : esc(woAmount(x))}</span></div>`;
    }).join('') || '<div class="empty">No exercises yet. Tap Edit to add some.</div>';
  }
  return `<div class="wo-head"><div class="subtabs">${tabs}</div><button class="btn ${view.woEdit ? 'solid' : ''}" id="wo-edit">${view.woEdit ? 'Done' : 'Edit'}</button></div>
    ${view.woEdit ? '' : restHTML()}
    <div class="wo-note">${isToday ? `Today · <b>${nDone} of ${list.length}</b> done${list.length ? ' · tap a row for one set' : ''}` : `${WORKOUT_DAYS.find(w => w[0] === key)[1]}’s plan`}</div>
    <div class="list wo-list">${body}</div>`;
}
function bindWorkout(p) {
  const key = view.woDay, list = S.workouts[key] || [];
  p.querySelectorAll('[data-wday]').forEach(b => b.onclick = () => { view.woDay = b.dataset.wday; renderPanel(); });
  $('wo-edit').onclick = () => { view.woEdit = !view.woEdit; renderPanel(); };
  restBind();
  const changed = re => { S.workouts = Object.assign({}, S.workouts, { [key]: list }); setMain('workouts'); if (re) renderPanel(); };
  if (view.woEdit) {
    const item = el => { const x = list[+el.dataset.i]; return el.dataset.j != null ? x.moves[+el.dataset.j] : x; };
    p.querySelectorAll('[data-f]').forEach(el => el.onchange = () => {
      const t = item(el), f = el.dataset.f; let v = el.value.trim();
      if (f === 'sets' || f === 'rounds') v = Math.max(1, Math.min(20, parseInt(v, 10) || 1));
      if (f === 'name' && !v) { el.value = t.name; return; }
      if (f === 'per' && !v) delete t.per; else t[f] = v;
      if (f === 'sets' && String(t.reps).includes(',')) t.reps = perSet(t).join(', ');
      changed(f === 'sets');
    });
    p.querySelectorAll('[data-mode]').forEach(el => el.onchange = () => {
      const t = list[+el.dataset.mode], first = String(t.reps).split(',')[0].trim() || '10';
      t.reps = el.value === 'varied' ? Array(t.sets).fill(first).join(', ') : first;
      changed(true);
    });
    p.querySelectorAll('[data-setrep]').forEach(el => el.onchange = () => {
      const t = list[+el.dataset.i], r = perSet(t);
      r[+el.dataset.setrep] = el.value.trim() || r[+el.dataset.setrep];
      t.reps = r.join(', '); changed(false);
    });
    p.querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => {
      const x = list[+b.dataset.wdel];
      if (b.dataset.j != null) { if (x.moves.length > 1) x.moves.splice(+b.dataset.j, 1); }
      else if (confirm(`Remove ${x.name}?`)) list.splice(+b.dataset.wdel, 1);
      changed(true);
    });
    p.querySelectorAll('[data-wadd]').forEach(b => b.onclick = () => {
      const k = b.dataset.wadd;
      if (k === 'move') list[+b.dataset.i].moves.push({ id: uid(), name: 'New Move', reps: '10' });
      else if (k === 'circuit') list.push({ id: uid(), name: 'New Circuit', rounds: 3, moves: [{ id: uid(), name: 'New Move', reps: '10' }] });
      else list.push({ id: uid(), name: 'New Exercise', sets: 3, reps: '10' });
      changed(true);
    });
    return;
  }
  if (key !== todayKey()) return;
  // tap a row for one set (one round of a circuit); the checkbox marks every set; a finished row starts over
  p.querySelectorAll('.wo-row').forEach(row => row.onclick = e => {
    const x = list.find(q => q.id === row.dataset.wid); if (!x) return;
    const wo = dayOf(today()).wo, was = wo[x.id] || 0, t = woTotal(x);
    const n = e.target.closest('[data-all]') ? (was >= t ? 0 : t) : (was >= t ? 0 : was + 1);
    setWo(x.id, n);
    renderPanel();
    if (n >= t) pop(document.querySelector(`.wo-row[data-wid="${x.id}"] .ck`));
  });
}

// ---------- history ----------
// A month calendar of past days; pick one to see what was on the list and what got done.
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayStats = x => {
  const tasks = Object.values((x && x.tasks) || {});
  return { total: tasks.length, done: tasks.filter(t => t.done).length, wo: Object.keys((x && x.wo) || {}).length };
};
let histLoaded = false, histLoading = false;
function loadHistory() {
  if (histLoaded || histLoading || !Sync.isReady()) return;
  histLoading = true;
  Sync.fetchDays().then(all => {
    histLoading = false; if (!all) return;
    histLoaded = true;
    const t = today();
    for (const [d, x] of Object.entries(all)) if (d !== t) S.days[d] = { tasks: x.tasks || {}, wo: x.wo || {} };
    save();
    if (view.tab === 'history') renderPanel();
  });
}
function woNames() {
  const m = {};
  for (const k of Object.keys(S.workouts || {})) for (const x of S.workouts[k] || []) m[x.id] = x;
  return m;
}
function historyHTML() {
  loadHistory();
  const now = new Date(), t = today();
  if (!view.histMonth) view.histMonth = [now.getFullYear(), now.getMonth()];
  const [y, m] = view.histMonth;
  if (!view.histDay) {
    // start on the most recent past day that has anything on it
    const past = Object.keys(S.days).filter(d => d < t && (dayStats(S.days[d]).total || dayStats(S.days[d]).wo)).sort();
    view.histDay = past.length ? past[past.length - 1] : t;
    const hd = new Date(view.histDay + 'T12:00'); view.histMonth = [hd.getFullYear(), hd.getMonth()];
    return historyHTML();
  }
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = first.getDay();
  let cells = '', rec = 0, tot = 0, dn = 0;
  for (let i = 0; i < lead; i++) cells += '<span class="hd blank"></span>';
  for (let d = 1; d <= days; d++) {
    const k = keyOf(new Date(y, m, d)), st = dayStats(S.days[k]), fut = k > t, has = st.total || st.wo;
    if (has && k <= t) { rec++; tot += st.total; dn += st.done; }
    const p = st.total ? st.done / st.total : st.wo ? 1 : 0;
    cells += `<button class="hd ${has ? 'has' : ''} ${k === t ? 'today' : ''} ${k === view.histDay ? 'sel' : ''} ${p === 1 && st.total ? 'full' : ''}" data-hday="${k}" ${fut ? 'disabled' : ''}
      aria-label="${d} ${MONTHS[m]}${st.total ? `, ${st.done} of ${st.total} done` : ''}"><span class="n">${d}</span><i class="hbar"><b style="width:${(p * 100).toFixed(0)}%"></b></i></button>`;
  }
  const canNext = new Date(y, m + 1, 1) <= now;
  // the chosen day
  const sel = S.days[view.histDay], st = dayStats(sel), sd = new Date(view.histDay + 'T12:00');
  const list = Object.entries((sel && sel.tasks) || {}).map(([id, x]) => Object.assign({ id }, x)).sort((a, b) => (a.at || 0) - (b.at || 0));
  const names = woNames();
  const wo = Object.entries((sel && sel.wo) || {}).map(([id, n]) => {
    const x = names[id]; if (!x) return null;
    const total = x.moves ? (x.rounds || 1) : (x.sets || 1);
    return `<div class="task hist wo ${n >= total ? 'done' : ''}"><span class="ck" aria-hidden="true">${check()}</span><span class="t">${esc(x.name)}</span><span class="meta">${Math.min(n, total)} / ${total} ${x.moves ? 'rounds' : 'sets'}</span></div>`;
  }).filter(Boolean).join('');
  const isToday = view.histDay === t;
  const detail = `<div class="hhead"><h3>${DAYS[sd.getDay()]}, ${sd.getDate()} ${MONTHS[sd.getMonth()]}${isToday ? ' <em>· today</em>' : ''}</h3>
      <span class="hcount">${st.total ? `${st.done} of ${st.total} done` : ''}</span></div>
    ${list.length ? `<div class="list">${list.map((x, i) => `<div class="task hist ${x.done ? 'done' : ''}"><span class="ck" aria-hidden="true">${check()}</span><span class="t">${esc(x.t)}</span><span class="meta">${T().num(i + 1, x.done)}</span></div>`).join('')}</div>`
      : `<div class="empty">${isToday ? 'Nothing on today’s list yet.' : 'Nothing was recorded this day.'}</div>`}
    ${wo ? `<div class="hsub">Workout</div><div class="list">${wo}</div>` : ''}`;
  return `<div class="history">
    <div class="hmonth"><button class="hnav" data-hnav="-1" aria-label="Previous month">‹</button><h3>${MONTHS[m]} <span>${y}</span></h3>
      <button class="hnav" data-hnav="1" aria-label="Next month" ${canNext ? '' : 'disabled'}>›</button></div>
    <div class="cal"><span class="dow">S</span><span class="dow">M</span><span class="dow">T</span><span class="dow">W</span><span class="dow">T</span><span class="dow">F</span><span class="dow">S</span>${cells}</div>
    <p class="hsum">${rec ? `${rec} day${rec === 1 ? '' : 's'} recorded${tot ? ` · ${Math.round(dn / tot * 100)}% of tasks done` : ''}` : 'No days recorded this month.'}${!Sync.getUser() ? ' · Sign in to see days from your other devices.' : histLoading ? ' · Loading…' : ''}</p>
    <div class="hday">${detail}</div></div>`;
}
function bindHistory(p) {
  p.querySelectorAll('[data-hnav]').forEach(b => b.onclick = () => {
    const [y, m] = view.histMonth, d = new Date(y, m + +b.dataset.hnav, 1);
    view.histMonth = [d.getFullYear(), d.getMonth()]; renderPanel();
  });
  p.querySelectorAll('[data-hday]').forEach(b => b.onclick = () => { view.histDay = b.dataset.hday; renderPanel(); });
}

// ---------- settings ----------
const LAYOUTS = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
const CK_OPTS = [['theme', 'Theme'], ['circle', 'Circle'], ['square', 'Square'], ['star', 'Star']];
function settingsHTML(c) {
  const st = S.settings, u = c.user;
  const status = { off: 'Not signed in', syncing: 'Syncing…', synced: 'Synced', offline: 'Offline — will sync when back online', error: 'Sync error', unavailable: 'Sync unavailable' }[c.status] || c.status;
  return `<div class="settings">
    <section><h3>Theme</h3><div class="themes">${Object.entries(THEMES).map(([k, t]) => `<button class="theme-card tc-${k} ${st.theme === k ? 'on' : ''}" data-theme-pick="${k}" aria-pressed="${st.theme === k}">
        <span class="tc-art">${t.swatch}</span><span class="tc-name">${t.name}</span></button>`).join('')}</div></section>
    <section><h3>List position</h3><div class="seg-opts">${LAYOUTS.map(([k, n]) => `<button class="lay ${st.layout === k ? 'on' : ''}" data-layout-pick="${k}" aria-pressed="${st.layout === k}">
        <span class="lay-pic lay-${k}"><i></i><i></i><i></i></span>${n}</button>`).join('')}</div>
      <p class="note">Where the list sits on a wide screen. Phones always stack.</p></section>
    <section><h3>Checkbox</h3><div class="seg-opts">${CK_OPTS.map(([k, n]) => `<button class="ckopt ${st.check === k ? 'on' : ''}" data-check-pick="${k}" aria-pressed="${st.check === k}">
        <span class="ck done-demo">${check(k === 'theme' ? T().check : k)}</span>${n}</button>`).join('')}</div></section>
    <section><h3>Rest between sets</h3><div class="frow"><input class="rest-set" id="rest-set" value="${mmss(restLen())}" inputmode="numeric" maxlength="5" aria-label="Rest length">
      <span class="note">Type 1:30, 90, or 2 for two minutes.</span></div></section>
    <section><h3>Account</h3>${u ? `<p class="acct">Signed in as <b>${esc(u.email || '')}</b><br><span class="sync-state s-${c.status}">${status}</span></p>
        <div class="frow"><button class="btn" id="signout">Sign out</button></div>`
      : `<p class="note">Sign in with your account from The System to keep your list on every device. Your tasks stay on this device until you do.</p>
        <form class="auth" id="auth"><input type="email" id="em" placeholder="Email" autocomplete="email" required>
          <input type="password" id="pw" placeholder="Password" autocomplete="current-password" required minlength="6">
          <div class="frow"><button class="btn solid" type="submit">Sign in</button><button class="btn" type="button" id="signup">Create account</button><button class="btn link" type="button" id="reset">Forgot password</button></div>
          <p class="note err" id="autherr" role="alert"></p></form>`}</section>
    <section><h3>Video</h3>
      <form class="frow" id="vform" novalidate><input type="url" id="vlink" placeholder="Paste a YouTube link" value="${esc(video.url || '')}" inputmode="url" autocomplete="off">
        <button class="btn solid" type="submit">${video.on && video.url ? 'Update' : 'Show'}</button></form>
      ${video.url ? `<div class="frow"><button class="btn" id="vtoggle">${video.on ? 'Hide video' : 'Show video'}</button><button class="btn link" id="vforget">Forget link</button></div>` : ''}
      <p class="note err" id="verr" role="alert"></p>
      <p class="note">Plays beside your list, on this device only. A few videos can’t be played outside YouTube.</p></section>
    <section><h3>Workout</h3><div class="frow"><button class="btn" id="import">Copy routine from The System</button></div>
      <p class="note">Replaces Ledger’s Monday, Wednesday and Friday routines with the ones saved in The System.</p></section>
    <p class="note fine"><a href="../">Open The System</a></p></div>`;
}
function bindSettings(p) {
  p.querySelectorAll('[data-theme-pick]').forEach(b => b.onclick = () => { S.settings.theme = b.dataset.themePick; setMain('settings'); render(); });
  p.querySelectorAll('[data-layout-pick]').forEach(b => b.onclick = () => { S.settings.layout = b.dataset.layoutPick; setMain('settings'); render(); });
  p.querySelectorAll('[data-check-pick]').forEach(b => b.onclick = () => { S.settings.check = b.dataset.checkPick; setMain('settings'); render(); });
  const rs = $('rest-set');
  rs.onfocus = () => rs.select();
  rs.onkeydown = e => { if (e.key === 'Enter') rs.blur(); };
  rs.onchange = () => { const v = parseRest(rs.value); if (v) { S.settings.restSec = v; setMain('settings'); } rs.value = mmss(restLen()); };
  const err = m => { const e = $('autherr'); if (e) e.textContent = m; };
  const nice = e => ({ 'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/weak-password': 'Use at least 6 characters.', 'auth/invalid-email': 'That email doesn’t look right.',
    'auth/network-request-failed': 'No connection.', 'auth/too-many-requests': 'Too many tries. Wait a minute.' })[e && e.code] || 'Something went wrong.';
  const form = $('auth');
  if (form) {
    form.onsubmit = e => { e.preventDefault(); err(''); Sync.signIn($('em').value.trim(), $('pw').value).catch(x => err(nice(x))); };
    $('signup').onclick = () => { if (!form.reportValidity()) return; err(''); Sync.signUp($('em').value.trim(), $('pw').value).catch(x => err(nice(x))); };
    $('reset').onclick = () => { const em = $('em').value.trim(); if (!em) return err('Type your email first.'); Sync.resetPassword(em).then(() => err('Reset link sent. Check your email.')).catch(x => err(nice(x))); };
  }
  const so = $('signout'); if (so) so.onclick = () => Sync.signOutUser();
  $('vform').onsubmit = e => {
    e.preventDefault();
    const url = $('vlink').value.trim();
    if (!ytParse(url)) { $('verr').textContent = 'That doesn’t look like a YouTube link.'; return; }
    video = { url, on: true }; videoSave(); placeVideo(true); renderPanel();
  };
  const vt = $('vtoggle'); if (vt) vt.onclick = () => { video.on = !video.on; videoSave(); placeVideo(video.on); renderPanel(); };
  const vf = $('vforget'); if (vf) vf.onclick = () => { video = {}; videoSave(); placeVideo(); renderPanel(); };
  $('import').onclick = async () => {
    let w = null;
    try { const old = JSON.parse(localStorage.getItem(OLD_KEY)); w = old && old.workouts; } catch (e) { /* none */ }
    if (!w) w = await Sync.oldWorkouts();
    if (!w) return toast('No routine found in The System on this device or account.');
    if (!confirm('Replace Ledger’s routines with the ones from The System?')) return;
    S.workouts = withIds(w); setMain('workouts'); toast('Routine copied.'); renderPanel();
  };
}

// ---------- events ----------
function bindPanel() {
  const p = $('panel');
  p.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { view.tab = b.dataset.tab; view.woEdit = false; document.body.dataset.tab = view.tab; renderPanel(); });
  if (view.tab === 'workout') return bindWorkout(p);
  if (view.tab === 'history') return bindHistory(p);
  if (view.tab === 'settings') return bindSettings(p);
  const form = $('addform'), inp = $('addin');
  form.onsubmit = e => {
    e.preventDefault();
    const v = taskCase(inp.value); if (!v) return;
    const id = uid();
    setTask(id, { t: v, done: false, at: Date.now() });
    inp.value = '';
    refresh();
    $('addin').focus();
    const row = document.querySelector(`.task[data-id="${id}"]`); if (row) row.classList.add('new');
  };
  p.querySelectorAll('.task').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('.ck').onclick = () => toggle(id);
    const t = row.querySelector('.t');
    // a click on the words ticks the task; a double-click edits it instead
    if (t) {
      let wait = null;
      t.onclick = () => { clearTimeout(wait); wait = setTimeout(() => toggle(id), 230); };
      t.ondblclick = e => { e.preventDefault(); clearTimeout(wait); view.editing = id; refresh(); };
    }
    row.querySelector('.del').onclick = () => remove(id);
    const ed = row.querySelector('.t-edit');
    if (ed) {
      ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length);
      const done = keep => { if (view.editing !== id) return; view.editing = null; const v = taskCase(ed.value); const x = dayOf(today()).tasks[id]; if (keep && v && x && v !== x.t) setTask(id, Object.assign({}, x, { t: v })); refresh(); };
      ed.onkeydown = e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
      ed.onblur = () => done(true);
    }
  });
}
// re-render while keeping the add box's text and focus
function refresh() {
  const inp = $('addin'), had = inp && document.activeElement === inp, val = inp ? inp.value : '';
  render();
  const n = $('addin'); if (n) { n.value = val; if (had) n.focus(); }
}
function toggle(id) {
  const x = dayOf(today()).tasks[id]; if (!x) return;
  setTask(id, Object.assign({}, x, { done: !x.done }));
  refresh();
  if (!x.done) pop(document.querySelector(`.task[data-id="${id}"] .ck`));
}
function remove(id) {
  const x = dayOf(today()).tasks[id]; if (!x) return;
  setTask(id, null); refresh();
  toast(`Removed “${x.t}”`, () => { setTask(id, x); refresh(); });
}
function pop(el) { if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

let toastTimer = null;
function toast(msg, undo, label = 'Undo') {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button>${label}</button>` : ''}`;
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

// live clocks in the theme art (aero gadget, cyber timestamp)
function tickClocks() {
  const n = new Date(), h = n.getHours(), m = n.getMinutes(), s = n.getSeconds();
  document.querySelectorAll('[data-clock]').forEach(el => {
    const f = el.dataset.clock;
    el.textContent = f === 'hms' ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
  });
  const set = (sel, deg) => document.querySelectorAll(sel).forEach(el => el.setAttribute('transform', `rotate(${deg} 50 50)`));
  set('.hand-h', (h % 12) * 30 + m / 2); set('.hand-m', m * 6 + s / 10); set('.hand-s', s * 6);
}
let lastDay = today();
setInterval(() => {
  tickClocks();
  if (today() !== lastDay) { lastDay = today(); view.editing = null; Sync.watchDay(lastDay); render(); }
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== lastDay) { lastDay = today(); Sync.watchDay(lastDay); render(); } });

// ---------- sync hooks ----------
const focusBusy = () => { const a = document.activeElement; return a && a.closest && a.closest('.wo-edit, .settings, .t-edit'); };
Sync.initSync({
  getState: () => S,
  today,
  adoptWorkouts: w => { S.workouts = withIds(w); S.woSource = 'system'; save(); return S.workouts; },
  onMain: data => {
    if (data.settings) S.settings = Object.assign({}, SETTINGS, data.settings);
    if (data.workouts) S.workouts = withIds(data.workouts);
    save(); if (!focusBusy()) refresh();
  },
  onDay: (d, data) => {
    S.days[d] = { tasks: data.tasks || {}, wo: data.wo || {} };
    save(); if (!focusBusy()) refresh();
  },
  onAttached: u => { S.owner = u; S.dirty = { main: false, days: {} }; save(); },
  onStatus: () => { if (view.tab === 'settings' && !focusBusy()) renderPanel(); },
  onError: () => {}
});

// The art is sized to the full screen by script: an iPhone home-screen app can start with fixed layers sized
// to a stale, shorter screen, which left an unpainted strip above the home bar until the layout changed.
function fitArt() {
  let h = Math.max(innerHeight, document.documentElement.clientHeight);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    const full = innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    h = Math.max(h, full);
  }
  document.documentElement.style.setProperty('--art-h', h + 'px');
}
fitArt();
for (const ev of ['resize', 'orientationchange', 'pageshow', 'load']) addEventListener(ev, () => { fitArt(); setTimeout(fitArt, 250); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) fitArt(); });
for (const ms of [50, 300, 1000]) setTimeout(fitArt, ms);   // iOS settles the real size a moment after launch
// Safari in a browser tab ignores user-scalable=no, so stop pinch-zoom here too (the layout is built for the screen it's on)
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
render();
placeVideo(false);
if (matchMedia('(min-width: 861px)').matches && view.tab === 'tasks') { const a = $('addin'); if (a) a.focus({ preventScroll: true }); }

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const had = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => toast('A new version of Ledger is ready.', () => w.postMessage('skip'), 'Reload');
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
}
