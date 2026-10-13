import {
  STATS, STAT_KEYS, STAT_INFO, DIFF, SKILLS, SKILL_REQ, MASTERY_STEP, SKILL_BONUS, MASTERY_BONUS, THEMES, BUFFS, JOBS, JOB_TIERS,
  ACHIEVEMENTS, INN_PER_MONTH, JOURNAL_XP
} from './data.js';
import * as C from './core.js';
import { chart, attachHover, radar } from './charts.js';
import { loadFonts, bindSettings, sfx, buzz, burst, scene } from './fx.js';
import { statusCard } from './card.js';
import * as Sync from './sync.js';

const { addDays, parse, fmt, WD, WDL, MONTHS, ALL } = C;
const KEY = 'the-system-v3';
const LEGACY_KEY = 'the-system-save-v1';
const RESTORE_KEY = 'the-system-restore';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const roman = n => { const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; if (n >= 40) return String(n); for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
const hms = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${C.pad(m)}:${C.pad(x)}` : `${m}:${C.pad(x)}`; };
const mins = s => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const NEW_THEMES = new Set(['shadow', 'sakura', 'frost', 'celestial', 'dragon', 'abyss', 'ronin', 'vrmmo']);
const CLOCK = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="9" r="5.5"/><path d="M8 6v3l2 1.5M6.5 1.5h3"/></svg>`;

// ---------- state ----------
let S = null;
function loadLocal() {
  let raw = null;
  try { raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY); } catch (e) { /* storage blocked */ }
  if (!raw) return null;
  try { return C.normalize(JSON.parse(raw)); } catch (e) { return null; }
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Save failed on this device. Export a backup from Settings.', 'gold', 'Warning'); }
}
function save() { saveLocal(); Sync.push(S); }
const isMeaningful = s => !!s && Object.values(s.days || {}).some(r => r.log && Object.keys(r.log).length);

S = loadLocal();
if (!S) S = C.defaultState();
const firstRun = !S.seen.intro;
bindSettings(() => S.settings);

const view = { tab: 'quests', date: null, logSub: 'calendar', month: null, selDay: null, range: 30, week: null };
let undoStack = [];

// ---------- toasts / modals ----------
function toast(msg, kind = '', label = 'System', undo = false) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `${undo ? '<button class="undo">UNDO</button>' : ''}<span class="sys-label">[ ${esc(label)} ]</span>${msg}`;
  $('toasts').appendChild(el);
  if (undo) el.querySelector('.undo').onclick = () => { doUndo(); el.remove(); };
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, undo ? 6000 : 3800);
}
function modal(label, headline, body, btn = 'Accept', cls = '') {
  $('modalroot').innerHTML = `<div class="modal"><div class="win ${cls}">
    <div class="sys-label">[ ${esc(label)} ]</div>
    ${headline ? `<div class="headline">${headline}</div>` : ''}<div class="mbody">${body}</div>
    ${btn ? `<button class="btn solid" id="mclose" style="margin-top:14px">${esc(btn)}</button>` : ''}</div></div>`;
  if (btn) $('mclose').onclick = closeModal;
  const m = $('modalroot').firstChild;
  m.addEventListener('click', e => { if (e.target === m && !m.dataset.locked) closeModal(); });
  return m;
}
function sheet(label, body, cls = 'left') {
  const m = modal(label, '', `<button class="x" aria-label="Close">×</button>${body}`, '', cls);
  m.querySelector('.x').onclick = closeModal;
  return m;
}
function closeModal() { $('modalroot').innerHTML = ''; onModalClose && onModalClose(); onModalClose = null; }
let onModalClose = null;

// ---------- undo ----------
function snapshot() { undoStack.push(JSON.stringify(S)); if (undoStack.length > 25) undoStack.shift(); }
function doUndo() {
  const prev = undoStack.pop(); if (!prev) return;
  S = JSON.parse(prev); save(); render(); toast('Undone.');
}

// ---------- derived ----------
let R = null;
const byId = () => Object.fromEntries(S.quests.map(q => [q.id, q]));
function recompute() { R = C.compute(S); return R; }
const today = () => C.today(S);
function displayTitle() {
  const titles = C.availableTitles(S, R);
  return S.titleSel && titles.includes(S.titleSel) ? S.titleSel : C.titleFor(R.best);
}
function displayClass() {
  const j = C.activeJob(S, R.today);
  return j ? C.jobName(j.key, C.jobTier(C.levelInfo(R.xp).L)) : C.topClass(R.stats);
}

// ---------- render ----------
let renderQueued = false;
function scheduleRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); } }
function render() {
  document.documentElement.dataset.theme = S.settings.theme;
  try { localStorage.setItem('the-system-theme', S.settings.theme); } catch (e) { /* optional */ }
  loadFonts(S.settings.theme);
  document.body.classList.toggle('nofx', !S.settings.fx);
  recompute();
  renderHeader();
  renderTabs();
  const t = view.tab;
  ({ quests: renderQuests, status: renderStatus, skills: renderSkills, feats: renderFeats, log: renderLog, manage: renderManage, themes: renderThemes, settings: renderSettings })[t]();
  checkAchievements();
}

function renderHeader() {
  const li = C.levelInfo(R.xp);
  const cap = R.perks.streakCap;
  const j = C.activeJob(S, R.today);
  const buffs = R.buffs.map(b => `<span class="buff ${BUFFS[b].good ? '' : 'bad'}" data-buff="${b}" title="${esc(BUFFS[b].desc)}"><b>${BUFFS[b].icon}</b>${esc(BUFFS[b].name)}</span>`).join('');
  const jobChip = j ? `<span class="buff job" data-goto="status"><b>◆</b>${esc(C.jobName(j.key, C.jobTier(li.L)))} +${Math.round(JOB_TIERS[Math.max(0, C.jobTier(li.L) - 1)][1] * 100)}% ${j.key.replace('+', '/')}</span>` : '';
  $('hdr').innerHTML = `
    <button class="syncpill" id="syncpill"><i></i><span id="synctext"></span></button>
    <div class="sys-label" style="margin-bottom:12px">[ Status Window ]</div>
    <div class="status">
      <div>
        <div class="pname"><span class="rank">${C.rankFor(li.L)}</span><span>${esc(S.name)}</span></div>
        <div class="pmeta">Class: <b>${esc(displayClass())}</b> · Title: <b>${esc(displayTitle())}</b></div>
      </div>
      <div>
        <div class="lvl-row"><div class="lvl"><small>LV</small>${li.L}</div><div class="mono" style="font-size:13px;color:var(--dim)">${li.rem} / ${li.need} XP</div></div>
        <div class="bar"><i style="width:${li.rem / li.need * 100}%"></i></div>
        <div class="mono" style="font-size:12px;color:var(--dim);margin-top:6px">Streak bonus: +${Math.round(Math.min(R.streak, cap) * C.STREAK_BONUS_PER_DAY * 100)}% XP · Total ${R.xp.toLocaleString()} XP</div>
      </div>
      <div class="streak">
        <div class="sys-label">Streak</div>
        <div class="big">${R.streak}<span>days</span></div>
        <div class="shields">Shields ${Array.from({ length: R.perks.maxShields }, (_, i) => `<span class="shield ${i < R.shields ? '' : 'off'}"></span>`).join('')}<br><span style="font-size:13px">Best: ${R.best} days</span></div>
      </div>
    </div>
    ${buffs || jobChip ? `<div class="buffrow">${buffs}${jobChip}</div>` : ''}`;
  $('hdr').querySelectorAll('[data-buff]').forEach(el => el.onclick = () => { const b = BUFFS[el.dataset.buff]; toast(`<b>${esc(b.name)}</b><br><span style="color:var(--dim);font-size:14px">${esc(b.desc)}</span>`, b.good ? 'green' : 'gold', b.good ? 'Buff' : 'Debuff'); });
  $('hdr').querySelectorAll('[data-goto]').forEach(el => el.onclick = () => setTab(el.dataset.goto));
  $('syncpill').onclick = () => setTab('settings');
  paintSync();
}

const TABS = [['quests', 'Quests'], ['status', 'Status'], ['skills', 'Skills'], ['feats', 'Feats'], ['log', 'Log'], ['manage', 'Edit Quests'], ['themes', 'Themes'], ['settings', 'Settings']];
function renderTabs() {
  const L = C.levelInfo(R.xp).L;
  const dots = { status: C.jobTokens(S, L) > 0, feats: Object.keys(S.ach).some(id => !(S.seen.ach || {})[id]) };
  $('tabs').innerHTML = TABS.map(([id, n]) => `<button class="tab ${view.tab === id ? 'on' : ''}" data-tab="${id}">${n}${dots[id] ? '<span class="dot"></span>' : ''}</button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
}
function setTab(t) {
  view.tab = t;
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('hidden', p.id !== 'pane-' + t));
  render();
  const tb = $('tabs').querySelector('.tab.on'); if (tb && tb.scrollIntoView) tb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ---------- quests ----------
function timerChip(d, q) {
  const s = C.timerSecs(S, d, q.id), t = S.days[d] && S.days[d].t && S.days[d].t[q.id];
  const run = !!(t && t.r), goal = q.goalMin ? q.goalMin * 60 : 0;
  if (!s && !run && !goal) return `<button class="tchip" data-act="timer" data-id="${q.id}" title="Stopwatch" aria-label="Open stopwatch">${CLOCK}</button>`;
  const cls = run ? 'run' : goal && s >= goal ? 'goal' : s ? 'has' : '';
  const label = goal ? `${Math.floor(s / 60)}/${q.goalMin}m` : hms(s);
  return `<button class="tchip ${cls}" data-act="timer" data-id="${q.id}" data-live="${run ? 1 : ''}" data-goal="${goal}" title="Stopwatch">${CLOCK}<span>${label}</span></button>`;
}
function questRow(d, q, isDone, right, hint, ex) {
  const e = C.logOf(S, d)[q.id];
  let sub = '';
  if (isDone && q.unit) sub += `<span class="amt"><button data-act="amt" data-id="${q.id}" data-v="-1" aria-label="Less">−</button><span>${(e && e.amt) || 0}</span><button data-act="amt" data-id="${q.id}" data-v="1" aria-label="More">+</button><span style="color:var(--dim);font-family:var(--f-body)">${esc(q.unit)}</span></span>`;
  return `<div class="quest ${isDone ? 'done' : ''} ${ex ? 'excused' : ''}" data-id="${q.id}">
      <div class="box"><i></i></div>
      <div class="qname"><span class="qn">${esc(q.name)}</span>${q.night ? '<span class="night" title="Counts what you did last night">☾ last night</span>' : ''}${hint ? `<span class="qhint">${hint}</span>` : ''}${sub}</div>
      ${ex ? '' : timerChip(d, q)}
      <span class="tag" style="color:var(--${q.stat})">${q.stat}</span>
      <span class="qxp">+${DIFF[q.diff].xp} XP</span>
      <span class="qstreak">${right}</span>
    </div>`;
}

function renderQuests() {
  const t = R.today, y = addDays(t, -1);
  const d = view.date || t;
  const older = d < y;
  const B = byId();
  const pane = $('pane-quests');
  const sched = C.scheduledFor(S, d);
  const rec = C.day(S, d), done = rec.log || {};
  const wd = parse(d).getDay();
  const nEx = sched.filter(id => C.isExcused(S, d, id)).length;
  const info = R.days[d] || { n: sched.length, c: 0, req: C.required(S, sched.length), status: 'pending' };
  const exNote = nEx ? ` · ${nEx} excused` : '';
  let pnote;
  if (rec.inn && d >= S.v3Since) pnote = `${WDL[wd]} · <b>Resting at the Inn.</b> Your streak is frozen today. Anything you do still earns XP.`;
  else if (info.n === 0) pnote = `${WDL[wd]} · <b>Rest day.</b> No daily quests ${nEx ? 'left' : 'scheduled'}. Your streak is safe.${exNote}`;
  else pnote = `${WDL[wd]} · <b>${info.c} / ${info.n}</b> complete · need <b>${info.req}</b> to clear the day${exNote}`;

  const dailyRight = q => { const s = C.questStreak(S, q); return s ? '▲' + s : ''; };
  const schedQuests = sched.map(id => B[id]).filter(Boolean).sort((a, b) => (b.night ? 1 : 0) - (a.night ? 1 : 0));
  const rows = schedQuests.length ? schedQuests.map(q => {
    const ex = C.isExcused(S, d, q.id);
    return questRow(d, q, !!done[q.id], (ex ? 'EXCUSED' : dailyRight(q)) + (done[q.id] ? '' : ` <button class="del-x" data-act="excuse" data-id="${q.id}" title="${ex ? 'Undo excuse' : 'Excuse for today: no XP, doesn\'t count either way'}">${ex ? '↺' : '×'}</button>`), '', ex);
  }).join('') : '<div class="empty">No daily quests today.</div>';

  const st = info.status;
  const banner = st === 'perfect' ? '<div class="clearbanner">★ Perfect clear ★</div>' : st === 'cleared' ? '<div class="clearbanner">Daily quest cleared</div>' : '';

  const weekly = S.quests.filter(C.isWeekly);
  const wsd = (+S.settings.weekStart);
  const weeklyHtml = weekly.length ? `<div class="sub">Weekly quests</div>` + weekly.map(q => {
    const c = C.weekCount(S, q, d), met = c >= q.target, ws = C.weeklyStreak(S, q);
    let hint = '';
    if (!done[q.id] && !met) {
      const left = q.target - c, daysLeft = 6 - (wd - wsd + 7) % 7;
      hint = q.days.includes(wd) ? 'Usual day. Good chance to knock one out.' : '';
      if (left > daysLeft + 1) hint = `Not enough days left for ${q.target}/${q.target} this week, but each one still gives XP.`;
      else if (left === daysLeft + 1) hint = `${left} left and ${daysLeft + 1} day${daysLeft ? 's' : ''} left this week. Every day counts now.`;
    }
    return questRow(d, q, !!done[q.id], `${c}/${q.target}${met ? ' ✓' : ''}${ws ? `<br>▲${ws}w` : ''}`, hint);
  }).join('') : '';
  const side = C.sideFor(S, d);
  const sideHtml = side.map(q => questRow(d, q, !!done[q.id], q.once ? `<button class="del-x" data-act="rmside" data-id="${q.id}" title="Remove">×</button>` : '')).join('');
  const bonus = S.quests.filter(q => C.isDaily(q) && !sched.includes(q.id));
  const bonusHtml = bonus.length ? `<div class="sub">Off-day quests · optional, extra XP</div>` + bonus.map(q => questRow(d, q, !!done[q.id], '')).join('') : '';

  const keepJournal = pane.contains(document.activeElement) && document.activeElement.id === 'j-text';
  const statOpts = STAT_KEYS.map(k => `<option value="${k}">${k} · ${STATS[k].name}</option>`).join('');
  const diffOpts = Object.keys(DIFF).map(k => `<option value="${k}" ${k === 'easy' ? 'selected' : ''}>${DIFF[k].label} (+${DIFF[k].xp} XP)</option>`).join('');
  const qaName = $('qa-name') ? $('qa-name').value : '';

  const html = `<div class="win">
    <div class="qhead"><h2 style="margin:0">Daily Quests</h2>
      <div class="daynav">
        ${y >= S.startDate ? `<button data-act="day" data-d="${y}" class="${d === y ? 'on' : ''}">Yesterday</button>` : ''}
        <button data-act="day" data-d="${t}" class="${d === t ? 'on' : ''}">Today</button>
        <label class="${older ? 'on' : ''}" title="Pick an earlier day">${older ? esc(C.prettyDate(d)) : 'Earlier…'}<input type="date" id="daypick" min="${S.startDate}" max="${t}" value="${d}"></label>
      </div></div>
    <div class="constellation" id="constellation"></div>
    ${older ? `<div class="innbanner">Editing <b>${esc(C.prettyDate(d))}</b>. Changes recalculate your history. <button class="btn sm" data-act="day" data-d="${t}">Back to today</button></div>` : ''}
    <div class="progress-note">${pnote}</div>
    <div style="margin-top:14px">${rows}</div>
    ${banner}
    ${weeklyHtml}
    <div class="sub">Side quests · optional, extra XP</div>
    ${sideHtml}
    <div class="frow quickadd">
      <input type="text" id="qa-name" maxlength="60" placeholder="Add a side quest for this day..." style="flex:1;min-width:180px" value="${esc(qaName)}">
      <select id="qa-stat">${statOpts}</select>
      <select id="qa-diff">${diffOpts}</select>
      <button class="btn" data-act="quickadd">+ Add</button>
    </div>
    ${bonusHtml}
    <div id="journalwrap"></div>
    <div class="qfoot">
      <button class="btn sm" data-act="inn">☖ Inn</button>
      <button class="btn sm" data-act="report">Weekly report</button>
    </div>
  </div>`;
  const prevStat = $('qa-stat') ? $('qa-stat').value : null;
  pane.innerHTML = html;
  if (prevStat && qaTouched) $('qa-stat').value = prevStat; else { const k = C.suggestStat(qaName); if (k) $('qa-stat').value = k; }
  renderJournal(d, keepJournal);
  renderConstellation(d, schedQuests, done);
}

function renderConstellation(d, quests, done) {
  if (S.settings.theme !== 'celestial' || !quests.length) { $('constellation').innerHTML = ''; return; }
  // deterministic star positions per date so the shape stays put through the day
  let seed = [...d].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7);
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const n = quests.length, W = 600, H = 70;
  const pts = quests.map((q, i) => [30 + (i + 0.5) * (W - 60) / n + (rnd() - 0.5) * 30, 12 + rnd() * (H - 24), !!done[q.id], q.name]);
  let lines = '';
  for (let i = 1; i < n; i++) if (pts[i][2] && pts[i - 1][2]) lines += `<line x1="${pts[i - 1][0]}" y1="${pts[i - 1][1]}" x2="${pts[i][0]}" y2="${pts[i][1]}"/>`;
  $('constellation').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}${pts.map(p => `<circle class="${p[2] ? 'on' : ''}" cx="${p[0]}" cy="${p[1]}" r="${p[2] ? 3.6 : 2.2}"><title>${esc(p[3])}</title></circle>`).join('')}</svg>`;
}

function renderJournal(d, keepText) {
  const w = $('journalwrap'); if (!w) return;
  const j = (S.days[d] && S.days[d].j) || {};
  const pips = (key, label) => `<div class="pips"><span class="pl">${label}</span>${[1, 2, 3, 4, 5].map(n => `<button data-act="pip" data-k="${key}" data-v="${n}" class="${j[key] === n ? 'on' : ''}" aria-label="${label} ${n}">${n}</button>`).join('')}</div>`;
  const xp = JOURNAL_XP * (R.perks.journalMult || 1);
  const text = keepText && $('j-text') ? $('j-text').value : (j.text || '');
  w.innerHTML = `<div class="journal"><div class="sys-label">[ Daily log ]</div>
    <div class="jrow">${pips('mood', 'Mood')}${pips('energy', 'Energy')}</div>
    <textarea id="j-text" maxlength="400" placeholder="One line about today. What went well, what didn't...">${esc(text)}</textarea>
    <div class="jhint">${d >= S.v3Since ? `Writing an entry gives +${xp} XP.` : 'Journal entries before the 3.0 update don\'t give XP.'} Mood and energy show up in your charts.</div></div>`;
  const ta = $('j-text');
  ta.oninput = () => { clearTimeout(jTimer); jTimer = setTimeout(() => setJournal(d, 'text', ta.value.trim()), 700); };
  ta.onblur = () => { clearTimeout(jTimer); setJournal(d, 'text', ta.value.trim()); };
  if (keepText) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
let jTimer = null;
function setJournal(d, k, v) {
  const r = C.ensureDay(S, d); r.j = Object.assign({}, r.j || {});
  if ((r.j[k] || '') === (v || '')) return;
  const had = !!(r.j.text && r.j.text.trim());
  if (v === '' || v == null) delete r.j[k]; else r.j[k] = v;
  C.cleanDay(S, d); save();
  const has = !!(S.days[d] && S.days[d].j && S.days[d].j.text);
  if (k === 'text' && has && !had && d >= S.v3Since) toast(`Journal entry saved. +${JOURNAL_XP * R.perks.journalMult} XP`, 'green', 'Log');
  renderHeader();
}

let qaTouched = false;
function questsClick(e) {
  const a = e.target.closest('[data-act]');
  const d = view.date || today();
  if (a) {
    const act = a.dataset.act, id = a.dataset.id;
    if (act === 'day') { view.date = a.dataset.d === today() ? null : a.dataset.d; render(); return; }
    if (act === 'excuse') return excuse(d, id);
    if (act === 'rmside') return removeOneOff(id, d);
    if (act === 'timer') return openTimer(d, id);
    if (act === 'amt') return adjustAmount(d, id, +a.dataset.v);
    if (act === 'pip') { const r = C.day(S, d); const cur = r.j && r.j[a.dataset.k]; setJournal(d, a.dataset.k, cur === +a.dataset.v ? null : +a.dataset.v); renderJournal(d); return; }
    if (act === 'quickadd') return quickAdd();
    if (act === 'inn') return openInn();
    if (act === 'report') { view.tab = 'log'; view.logSub = 'weekly'; view.week = null; setTab('log'); return; }
    return;
  }
  if (e.target.closest('input,select,textarea,label')) return;
  const row = e.target.closest('.quest');
  if (row) toggle(d, byId()[row.dataset.id], row);
}

// ---------- actions ----------
function toggle(date, q, row) {
  if (!q) return;
  snapshot();
  const before = R, lb = C.levelInfo(before.xp).L, skB = new Set(C.unlockedSkills(before.stats)), tB = C.titleFor(before.best);
  const stB = before.days[date] ? before.days[date].status : '';
  const rec = C.ensureDay(S, date);
  rec.log = Object.assign({}, rec.log || {});
  const adding = !rec.log[q.id];
  if (adding) {
    const e = { xp: DIFF[q.diff].xp, pts: DIFF[q.diff].pts, stat: q.stat, name: q.name, k: q.type || 'daily', at: Date.now() };
    if (C.isWeekly(q)) e.tg = q.target;
    if (q.night) e.n = 1;
    rec.log[q.id] = e;
    if (rec.skip) { rec.skip = Object.assign({}, rec.skip); delete rec.skip[q.id]; }
    // checking a quest off stops its stopwatch
    if (rec.t && rec.t[q.id] && rec.t[q.id].r) { rec.t = Object.assign({}, rec.t); rec.t[q.id] = { s: C.timerSecs(S, date, q.id), r: 0 }; }
  } else delete rec.log[q.id];
  C.cleanDay(S, date);
  save();
  const after = recompute(), la = C.levelInfo(after.xp).L;
  const stA = after.days[date] ? after.days[date].status : '';

  if (adding) {
    sfx('check'); buzz(10);
    if (row) { row.classList.add('pop'); burst(row.querySelector('.box'), S.settings.theme); }
    toast(`Quest complete: <b>${esc(q.name)}</b><br><span class="mono" style="font-size:13px;color:var(--dim)">+${after.xp - before.xp} XP · ${q.stat} +${DIFF[q.diff].pts}</span>`, 'green', 'Quest', true);
    if (after.weeklyClears > before.weeklyClears) toast(`Weekly quest cleared: <b>${esc(q.name)}</b> ${q.target}/${q.target}.`, 'gold', 'Weekly');
    if (!['cleared', 'perfect'].includes(stB) && ['cleared', 'perfect'].includes(stA)) { sfx('clear'); toast(`Daily quest cleared. Streak: <b>${after.streak}</b> days.`, 'gold', 'Streak'); }
    if (stB === 'cleared' && stA === 'perfect') toast('Perfect clear. Bonus XP granted.', 'gold', 'Bonus');
    if (after.shields > before.shields) toast('Streak milestone reached. <b>Shield</b> acquired. It will protect your streak on a missed day.', 'gold', 'Reward');
    C.unlockedSkills(after.stats).filter(s => !skB.has(s)).forEach(s => {
      const [k, i] = s.split(':');
      if (i[0] === 'm') scene('Mastery', `${STATS[k].cls.toUpperCase()} ${roman(+i.slice(1))}`, `<span style="color:var(--${k})">${STATS[k].name}</span> Mastery rank reached.`, `+${MASTERY_BONUS * 100}% XP on ${k} quests`, 'skill');
      else { const sk = SKILLS[k][+i]; scene('Skill Acquired', esc(sk[0]), `<span style="color:var(--dim)">${esc(sk[1])}</span>`, sk[2] ? `Perk: ${esc(sk[2])}` : `+${SKILL_BONUS * 100}% XP on ${k} quests`, 'skill'); }
    });
    const tA = C.titleFor(after.best);
    if (tA !== tB) toast(`New title earned: <b>${esc(tA)}</b>`, 'gold', 'Title');
    if (la > lb) {
      const rB = C.rankFor(lb), rA = C.rankFor(la);
      scene('Level Up', `LEVEL ${la}`, rA !== rB ? `Your rank has risen to <b style="color:var(--a)">${rA}-Rank</b>.` : 'All stats feel slightly lighter.', `Keep going, ${esc(S.name)}.`);
      if (Math.floor(la / 10) > Math.floor(lb / 10)) toast('A <b>job change</b> is available. Open the Status tab.', 'gold', 'Class');
    }
  } else sfx('uncheck');
  render();
}

function excuse(d, id) {
  snapshot();
  const r = C.ensureDay(S, d); r.skip = Object.assign({}, r.skip || {});
  const q = byId()[id];
  if (r.skip[id]) delete r.skip[id];
  else { r.skip[id] = true; toast(`Excused for the day: <b>${esc(q ? q.name : '')}</b><br><span style="color:var(--dim);font-size:14px">No XP, and it won't count against your streak.</span>`, '', 'System', true); }
  C.cleanDay(S, d); save(); render();
}
function removeOneOff(id, d) {
  snapshot();
  S.quests = S.quests.filter(x => x.id !== id);
  if (S.days[d] && S.days[d].log && S.days[d].log[id]) { S.days[d].log = Object.assign({}, S.days[d].log); delete S.days[d].log[id]; C.cleanDay(S, d); }
  save(); render();
}
function quickAdd() {
  const name = $('qa-name').value.trim(); if (!name) return;
  const d = view.date || today();
  snapshot();
  S.quests.push({ id: C.uid(), name, stat: $('qa-stat').value, diff: $('qa-diff').value, days: [], type: 'side', once: d, createdAt: d });
  $('qa-name').value = ''; qaTouched = false; save(); render();
  toast(`Side quest accepted: <b>${esc(name)}</b>`);
}
function adjustAmount(d, id, delta) {
  const r = C.ensureDay(S, d); if (!r.log || !r.log[id]) return;
  r.log = Object.assign({}, r.log); r.log[id] = Object.assign({}, r.log[id]);
  const v = Math.max(0, (r.log[id].amt || 0) + delta);
  if (v) r.log[id].amt = v; else delete r.log[id].amt;
  save(); render();
}

// ---------- stopwatch ----------
function setTimer(d, id, fn) {
  const r = C.ensureDay(S, d); r.t = Object.assign({}, r.t || {});
  const cur = Object.assign({ s: 0, r: 0 }, r.t[id] || {});
  const next = fn(cur);
  if (!next || (!next.s && !next.r)) delete r.t[id]; else r.t[id] = next;
  C.cleanDay(S, d); save();
}
function openTimer(d, id) {
  const q = byId()[id]; if (!q) return;
  const goal = q.goalMin ? q.goalMin * 60 : 0;
  const draw = () => {
    const t = (S.days[d] && S.days[d].t && S.days[d].t[id]) || {};
    const s = C.timerSecs(S, d, id), run = !!t.r, done = !!C.logOf(S, d)[id];
    const pct = goal ? Math.min(1, s / goal) : 0, Cc = 2 * Math.PI * 100;
    const body = `<h3 style="margin-top:4px">${esc(q.name)}</h3>
      <div class="note">${d === today() ? 'Today' : esc(C.prettyDate(d))} · ${goal ? `Goal ${mins(goal)}. ` : ''}Optional: you can check the quest off any time, timer or not.</div>
      ${goal ? `<div class="ring"><svg viewBox="0 0 220 220"><circle class="bg" cx="110" cy="110" r="100"/><circle class="fg" cx="110" cy="110" r="100" stroke-dasharray="${Cc}" stroke-dashoffset="${Cc * (1 - pct)}"/></svg>
        <div><div class="stopwatch" id="sw-time">${hms(s)}</div><div class="goal">${s >= goal ? 'GOAL REACHED' : `${mins(goal - s)} to goal`}</div></div></div>`
        : `<div class="stopwatch" style="text-align:center" id="sw-time">${hms(s)}</div>`}
      <div class="swbtns">
        <button class="btn solid" data-sw="toggle">${run ? 'Pause' : s ? 'Resume' : 'Start'}</button>
        ${s ? '<button class="btn danger" data-sw="reset">Reset</button>' : ''}
        ${done ? '' : '<button class="btn" data-sw="check">Check off quest</button>'}
      </div>
      <div class="adj"><span class="note" style="align-self:center">Forgot to start it?</span>
        <button class="btn sm" data-sw="-300">−5m</button><button class="btn sm" data-sw="300">+5m</button><button class="btn sm" data-sw="900">+15m</button><button class="btn sm" data-sw="3600">+1h</button></div>`;
    if (!$('modalroot').firstChild || !$('modalroot').querySelector('.timer-sheet')) {
      const m = sheet('Stopwatch', `<div class="timer-sheet">${body}</div>`);
      m.querySelector('.win').style.textAlign = 'center';
    } else $('modalroot').querySelector('.timer-sheet').innerHTML = body;
    $('modalroot').querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
      const v = b.dataset.sw;
      if (v === 'toggle') { setTimer(d, id, c => c.r ? { s: C.timerSecs(S, d, id), r: 0 } : { s: c.s, r: Date.now() }); sfx('timer'); buzz(8); }
      else if (v === 'reset') { if (!confirm('Reset this stopwatch to 0?')) return; setTimer(d, id, () => null); }
      else if (v === 'check') { closeModal(); toggle(d, q); return; }
      else setTimer(d, id, c => { const cur = C.timerSecs(S, d, id); const ns = Math.max(0, cur + +v); return c.r ? { s: ns, r: Date.now() } : { s: ns, r: 0 }; });
      draw(); render();
    });
  };
  draw();
  timerSheet = { d, id, draw };
  onModalClose = () => { timerSheet = null; };
}
let timerSheet = null;
const goalNotified = new Set();
function tick() {
  // live stopwatch text without re-rendering the page
  const d = view.date || today();
  document.querySelectorAll('.tchip[data-live="1"]').forEach(el => {
    const id = el.dataset.id, s = C.timerSecs(S, d, id), goal = +el.dataset.goal;
    el.querySelector('span').textContent = goal ? `${Math.floor(s / 60)}/${goal / 60}m` : hms(s);
  });
  if (timerSheet) {
    const s = C.timerSecs(S, timerSheet.d, timerSheet.id);
    const el = $('sw-time'); if (el) el.textContent = hms(s);
    const t = S.days[timerSheet.d] && S.days[timerSheet.d].t && S.days[timerSheet.d].t[timerSheet.id];
    if (t && t.r && s % 15 === 0) timerSheet.draw();
  }
  // goal reached while running
  for (const dd in S.days) {
    const ts = S.days[dd].t; if (!ts) continue;
    for (const id in ts) {
      if (!ts[id].r) continue;
      const q = byId()[id]; if (!q || !q.goalMin) continue;
      const key = dd + id;
      if (!goalNotified.has(key) && C.timerSecs(S, dd, id) >= q.goalMin * 60) {
        goalNotified.add(key);
        if (C.timerSecs(S, dd, id) < q.goalMin * 60 + 5) { sfx('goal'); buzz(40); toast(`Timer goal reached: <b>${esc(q.name)}</b> (${mins(q.goalMin * 60)}).`, 'gold', 'Stopwatch'); }
      }
    }
  }
}

// ---------- inn ----------
function openInn() {
  const t = today(), y = addDays(t, -1);
  const first = y >= S.v3Since ? y : S.v3Since;
  const draw = () => {
    const ym = t.slice(0, 7), used = C.innUsedInMonth(S, ym);
    const booked = Object.keys(S.days).filter(d => S.days[d].inn && d >= first).sort();
    const body = `<h3 style="margin-top:4px">The Inn</h3>
      <p class="note" style="text-align:left">Sick, traveling, or just need a real day off? A night at the Inn freezes your streak for that day:
      it won't break and won't grow. Quests you still do give XP. The day after, you wake up <b>Refreshed</b> (+5% XP).
      You get <b>${INN_PER_MONTH} nights per month</b>.</p>
      <div class="kv"><span>Nights used in ${MONTHS[+ym.slice(5) - 1]}</span><b>${used} / ${INN_PER_MONTH}</b></div>
      <div class="frow" style="margin:14px 0"><div class="field"><label>Book a night</label><input type="date" id="inn-date" min="${first}" max="${addDays(t, 60)}" value="${t}"></div>
        <button class="btn solid" id="inn-book">Book</button></div>
      <div class="sub" style="margin-top:6px">Booked</div>
      ${booked.length ? booked.map(d => `<div class="kv"><span>${esc(C.prettyDate(d))}${d === t ? ' · tonight' : ''}</span><button class="btn sm danger" data-cancel="${d}">Cancel</button></div>`).join('') : '<div class="empty">No nights booked.</div>'}`;
    const m = $('modalroot').querySelector('.inn-sheet');
    if (m) m.innerHTML = body; else sheet('Inn', `<div class="inn-sheet">${body}</div>`);
    $('inn-book').onclick = () => {
      const d = $('inn-date').value;
      if (!d || d < first) return toast('You can only book from yesterday onward.', 'gold', 'Inn');
      if (S.days[d] && S.days[d].inn) return toast('Already booked.', 'gold', 'Inn');
      if (C.innUsedInMonth(S, d.slice(0, 7)) >= INN_PER_MONTH) { sfx('error'); return toast(`No rooms left: you've used all ${INN_PER_MONTH} nights for that month.`, 'gold', 'Inn'); }
      snapshot(); C.ensureDay(S, d).inn = true; save(); render(); draw();
      toast(`Room booked for <b>${esc(C.prettyDate(d))}</b>. Rest well.`, 'green', 'Inn');
    };
    $('modalroot').querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { snapshot(); delete S.days[b.dataset.cancel].inn; C.cleanDay(S, b.dataset.cancel); save(); render(); draw(); });
  };
  draw();
}

// ---------- status ----------
function renderStatus() {
  const li = C.levelInfo(R.xp), L = li.L;
  const j = C.activeJob(S, R.today), tier = C.jobTier(L), tokens = C.jobTokens(S, L);
  const titles = C.availableTitles(S, R), curTitle = displayTitle();
  const P = R.perks;
  const sig = [];
  for (const k of STAT_KEYS) SKILLS[k].forEach((sk, i) => { if (sk[2] && R.stats[k] >= SKILL_REQ[i]) sig.push([k, sk[0], sk[2]]); });
  const nextTier = JOB_TIERS.find(([lv]) => L < lv);
  let jobHtml;
  if (tokens > 0) {
    const opts = C.jobOptions(R.stats);
    jobHtml = `<div class="jobcard"><div class="sys-label">[ Job change available ]</div>
      <p class="note">Pick a job based on your strongest stats. It gives <b>+${JOB_TIERS[Math.max(0, tier - 1)][1] * 100}% XP</b> on quests of its two stats and evolves at level 25 and 50. You can change jobs again every 10 levels.</p>
      <div class="jobopts">${opts.map(k => `<button class="jobopt" data-job="${k}"><div class="jn">${esc(JOBS[k][0])} <span class="mono" style="font-size:13px;color:var(--dim)">${k.replace('+', ' / ')}</span></div><div class="jd">${esc(JOBS[k][3])} Evolves into ${esc(JOBS[k][1])}, then ${esc(JOBS[k][2])}.</div></button>`).join('')}</div></div>`;
  } else if (j) {
    jobHtml = `<div class="jobcard"><div class="sys-label">[ Job ]</div><h3 style="margin:8px 0 4px">${esc(C.jobName(j.key, tier))}</h3>
      <div class="note">${esc(JOBS[j.key][3])} +${JOB_TIERS[tier - 1][1] * 100}% XP on ${j.key.replace('+', ' and ')} quests.
      ${nextTier ? `Evolves into <b>${esc(JOBS[j.key][JOB_TIERS.indexOf(nextTier)])}</b> at level ${nextTier[0]}.` : 'Final form reached.'} Next job change at level ${(Math.floor(L / 10) + 1) * 10}.</div></div>`;
  } else jobHtml = `<div class="jobcard"><div class="sys-label">[ Job ]</div><div class="note" style="margin-top:6px">Reach level 10 to choose a job.</div></div>`;

  $('pane-status').innerHTML = `<div class="win"><h2>Status</h2>
    <div class="statusgrid">
      <div class="radar">${radar(R.stats)}<div style="text-align:center;margin-top:10px"><button class="btn sm" id="card-btn">Save status card</button></div></div>
      <div>
        <div class="kv"><span>Level</span><b>${L} <span class="mono" style="font-size:12px;color:var(--dim)">(${C.rankFor(L)}-Rank)</span></b></div>
        <div class="kv"><span>Total XP</span><b class="mono">${R.xp.toLocaleString()}</b></div>
        <div class="kv"><span>Class</span><b>${esc(displayClass())}</b></div>
        <div class="kv"><span>Title</span><select id="title-sel">${titles.map(t => `<option ${t === curTitle ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="kv"><span>Streak · best</span><b class="mono">${R.streak} · ${R.best}</b></div>
        <div class="kv"><span>Shields</span><b class="mono">${R.shields} / ${P.maxShields}</b></div>
        ${jobHtml}
      </div>
    </div>
    <div class="sub">Active buffs</div>
    ${R.buffs.length ? R.buffs.map(b => `<div class="kv"><span>${BUFFS[b].icon} <b style="color:${BUFFS[b].good ? 'var(--green)' : 'var(--red)'}">${esc(BUFFS[b].name)}</b></span><span style="text-align:right">${esc(BUFFS[b].desc)}</span></div>`).join('') : '<div class="note">None right now. Buffs come from streaks of good habits: 3 nights of your sleep quest, 3 perfect days, an hour on the timer, or a night at the Inn.</div>'}
    <div class="sub">Perks</div>
    <ul class="perklist">
      ${STAT_KEYS.map(k => `<li><b style="color:var(--${k})">${k}</b><span>+${Math.round(P.statBonus[k] * 100)}% XP on ${STATS[k].name} quests <span style="color:var(--dim)">(${C.skillCount(R.stats[k])} skill${C.skillCount(R.stats[k]) === 1 ? '' : 's'}${C.masteryOf(R.stats[k]) ? ` · Mastery ${roman(C.masteryOf(R.stats[k]))}` : ''})</span></span></li>`).join('')}
      ${sig.map(([k, n, p]) => `<li><b style="color:var(--${k})">${k}</b><span><b style="font-family:var(--f-body);font-size:15px">${esc(n)}:</b> ${esc(p)}</span></li>`).join('')}
    </ul>
    <div class="note" style="margin-top:10px">Perks, buffs and jobs apply from ${esc(C.prettyDate(S.v3Since))} on. Everything you earned before that stays exactly as it was.</div>
  </div>`;
  $('title-sel').onchange = e => { S.titleSel = e.target.value; save(); render(); };
  $('card-btn').onclick = async () => {
    const quests = Object.values(S.days).reduce((a, r) => a + Object.keys(r.log || {}).length, 0);
    const r = await statusCard({ name: S.name, rank: C.rankFor(L), level: L, streak: R.streak, best: R.best, pct: li.rem / li.need, cls: displayClass(), title: displayTitle(), stats: R.stats, quests });
    if (r === 'downloaded') toast('Status card saved.');
  };
  $('pane-status').querySelectorAll('[data-job]').forEach(b => b.onclick = () => chooseJob(b.dataset.job));
}
function chooseJob(key) {
  snapshot();
  S.jobs.push({ date: today(), key });
  save();
  scene('Class Change', esc(JOBS[key][0]).toUpperCase(), esc(JOBS[key][3]), `+${JOB_TIERS[0][1] * 100}% XP on ${key.replace('+', ' and ')} quests`, 'skill');
  render();
}

// ---------- skills ----------
function renderSkills() {
  $('pane-skills').innerHTML = `<div class="win"><h2>Skills</h2>
    <div class="note" style="margin:-6px 0 16px">Every skill gives <b>+${SKILL_BONUS * 100}% XP</b> on quests of its stat. The 3rd and 6th skill of each line also grant a signature perk.</div>
    ${STAT_KEYS.map(k => {
      const m = C.masteryOf(R.stats[k]);
      return `<div class="skillgroup">
      <div class="sub" style="color:var(--${k});margin-top:0">${STATS[k].name} · ${STATS[k].cls} line${m ? `<span class="mastery">Mastery ${roman(m)}</span>` : ''}</div>
      <div class="skills">${SKILLS[k].map(([n, dsc, perk], i) => {
        const on = R.stats[k] >= SKILL_REQ[i];
        return `<div class="skill ${on ? 'on' : 'off'}" style="color:var(--${k})">
          <div class="sn" style="${on ? '' : 'color:var(--dim)'}">${on ? esc(n) : '???'}</div>
          <div class="sd">${on ? esc(dsc) : `Unlocks at ${k} ${SKILL_REQ[i]}`}</div>
          ${perk ? `<div class="sp"><em>SIGNATURE PERK</em>${esc(perk)}</div>` : ''}</div>`;
      }).join('')}</div></div>`;
    }).join('')}
    <div class="stat-note">After the 6th skill in a line, every +${MASTERY_STEP} in that stat raises its Mastery rank (+${MASTERY_BONUS * 100}% XP each).</div>
    <div class="sub">Stats</div>
    <div class="stats">${STAT_KEYS.map(k => {
      const v = R.stats[k], { next, prev } = C.nextThreshold(v), m = C.masteryOf(v);
      const pct = (v - prev) / (next - prev) * 100;
      const note = v < SKILL_REQ[5] ? `${next - v} more to unlock next skill` : `${m ? `Mastery ${roman(m)} · ` : ''}${next - v} to Mastery ${roman(m + 1)}`;
      return `<div class="stat ${openStats.has(k) ? 'open' : ''}" data-stat="${k}" style="color:var(--${k})">
        <div class="stat-top"><div><span class="stat-code">${k}</span><span class="stat-name">${STATS[k].name}</span></div><div class="stat-val">${v}</div></div>
        <div class="bar"><i style="width:${pct}%"></i></div><div class="stat-note">${note}</div>
        <div class="stat-info">${STAT_INFO[k][0]}<i>Quests like: ${STAT_INFO[k][1]}</i></div></div>`;
    }).join('')}</div></div>`;
  $('pane-skills').querySelectorAll('.stat').forEach(el => el.onclick = () => { const k = el.dataset.stat; openStats.has(k) ? openStats.delete(k) : openStats.add(k); el.classList.toggle('open'); });
}
const openStats = new Set();

// ---------- achievements ----------
let achBootstrapped = false;
function checkAchievements() {
  const earned = C.earnedAchievements(S, R);
  const fresh = earned.filter(id => !S.ach[id]);
  if (!fresh.length) return;
  const t = today();
  fresh.forEach(id => S.ach[id] = t);
  if (!S.seen.achInit) {
    // first run of 3.0: everything already earned unlocks quietly
    S.seen.achInit = true; S.seen.ach = Object.assign({}, S.seen.ach || {});
    save();
    if (fresh.length) setTimeout(() => toast(`You've already earned <b>${fresh.length}</b> achievement${fresh.length === 1 ? '' : 's'}. See the Feats tab.`, 'gold', 'Feats'), 1200);
    renderTabs();
    return;
  }
  save();
  fresh.forEach(id => { const a = ACHIEVEMENTS.find(x => x.id === id); sfx('skill'); toast(`<b>${esc(a.name)}</b><br><span style="color:var(--dim);font-size:14px">${esc(a.desc)}${a.title ? ` Title unlocked: ${esc(a.title)}.` : ''}</span>`, 'gold', 'Achievement'); });
  renderTabs();
}
function renderFeats() {
  const got = ACHIEVEMENTS.filter(a => S.ach[a.id]).length;
  $('pane-feats').innerHTML = `<div class="win"><h2>Feats</h2>
    <div class="note" style="margin:-6px 0 16px"><b>${got} / ${ACHIEVEMENTS.length}</b> unlocked. Some feats are hidden until you earn them. Feats with a title let you equip it on the Status tab.</div>
    <div class="achs">${ACHIEVEMENTS.map(a => {
      const on = !!S.ach[a.id], hide = a.hidden && !on;
      return `<div class="ach ${on ? 'on' : 'off'}"><div class="ai">${on ? '★' : hide ? '?' : '☆'}</div><div>
        <div class="an">${hide ? '???' : esc(a.name)}</div><div class="ad">${hide ? 'Hidden feat.' : esc(a.desc)}</div>
        ${on ? `<div class="at">${esc(C.prettyDate(S.ach[a.id]))}${a.title ? ` · Title: ${esc(a.title)}` : ''}</div>` : a.title && !hide ? `<div class="at" style="color:var(--dim)">Grants a title</div>` : ''}</div></div>`;
    }).join('')}</div></div>`;
  S.seen.ach = Object.assign({}, S.seen.ach || {});
  let changed = false;
  for (const id in S.ach) if (!S.seen.ach[id]) { S.seen.ach[id] = 1; changed = true; }
  if (changed) { save(); renderTabs(); }
}

// ---------- log ----------
function renderLog() {
  const sub = view.logSub;
  const tabs = [['calendar', 'Calendar'], ['charts', 'Charts'], ['weekly', 'Weekly report'], ['records', 'Records']];
  let body = '';
  if (sub === 'calendar') body = logCalendar();
  else if (sub === 'charts') body = logCharts();
  else if (sub === 'weekly') body = logWeekly();
  else body = logRecords();
  $('pane-log').innerHTML = `<div class="win"><h2>Quest Log</h2>
    <div class="subtabs">${tabs.map(([id, n]) => `<button data-sub="${id}" class="${sub === id ? 'on' : ''}">${n}</button>`).join('')}</div>${body}</div>`;
  const p = $('pane-log');
  p.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { view.logSub = b.dataset.sub; renderLog(); });
  p.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { view.month = b.dataset.month; renderLog(); });
  p.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { view.selDay = b.dataset.cell; renderLog(); });
  p.querySelectorAll('[data-range]').forEach(b => b.onclick = () => { view.range = +b.dataset.range; renderLog(); });
  p.querySelectorAll('[data-week]').forEach(b => b.onclick = () => { view.week = b.dataset.week; renderLog(); });
  p.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { view.date = b.dataset.open === today() ? null : b.dataset.open; setTab('quests'); });
  attachHover(p);
}
const LEGEND = `<div class="legend">
  <span><i style="background:rgba(var(--green-rgb),.6);border-color:var(--green)"></i>Perfect</span>
  <span><i style="background:rgba(var(--green-rgb),.25);border-color:var(--green)"></i>Cleared</span>
  <span><i style="background:rgba(var(--a-rgb),.25);border-color:var(--a)"></i>Shield used</span>
  <span><i style="background:rgba(var(--red-rgb),.18);border-color:var(--red)"></i>Missed</span>
  <span><i style="border-style:dotted;border-color:var(--a)"></i>Inn</span>
  <span><i style="border-style:dashed;border-color:var(--win-border)"></i>Rest</span></div>`;
function logCalendar() {
  const t = R.today;
  const ym = view.month || t.slice(0, 7);
  const [Y, M] = ym.split('-').map(Number);
  const first = new Date(Y, M - 1, 1), daysIn = new Date(Y, M, 0).getDate();
  const ws = +S.settings.weekStart, lead = (first.getDay() - ws + 7) % 7;
  const prev = fmt(new Date(Y, M - 2, 1)).slice(0, 7), next = fmt(new Date(Y, M, 1)).slice(0, 7);
  let cells = [0, 1, 2, 3, 4, 5, 6].map(i => `<div class="wd">${WD[(i + ws) % 7]}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div class="cell blank"></div>';
  const sel = view.selDay;
  for (let dn = 1; dn <= daysIn; dn++) {
    const ds = `${ym}-${C.pad(dn)}`;
    let cls = 'future';
    if (ds <= t && ds >= S.startDate) cls = R.days[ds] ? R.days[ds].status : 'rest';
    else if (ds < S.startDate) cls = '';
    else if (S.days[ds] && S.days[ds].inn) cls = 'inn future';
    const j = S.days[ds] && S.days[ds].j && S.days[ds].j.text;
    cells += `<button class="cell ${cls} ${sel === ds ? 'sel' : ''}" ${ds <= t && ds >= S.startDate ? `data-cell="${ds}"` : ''} title="${ds}${R.days[ds] ? ' · ' + R.days[ds].c + '/' + R.days[ds].n : ''}">${dn}${j ? '<span class="mk"></span>' : ''}</button>`;
  }
  return `<div class="loggrid"><div>
      <div class="monthnav"><button data-month="${prev}" aria-label="Previous month">‹</button><b>${MONTHS[M - 1]} ${Y}</b><button data-month="${next}" aria-label="Next month" ${next > t.slice(0, 7) ? 'disabled' : ''}>›</button></div>
      <div class="heat">${cells}</div>${LEGEND}
      <div class="note" style="margin-top:8px">Tap a day for details. A dot means you wrote a journal entry.</div></div>
    <div>${sel ? dayDetail(sel) : '<div class="note">Pick a day on the calendar to see what you did, how long it took, and your notes.</div>'}</div></div>
    <div class="sub">Last 26 weeks</div>${yearHeat()}`;
}
function dayDetail(d) {
  const info = R.days[d] || {}, r = S.days[d] || {}, lg = r.log || {}, B = byId();
  const names = { perfect: 'Perfect clear', cleared: 'Cleared', missed: 'Missed', shield: 'Saved by a shield', rest: 'Rest day', pending: 'In progress', inn: 'At the Inn' };
  const rows = Object.entries(lg).map(([id, e]) => {
    const secs = C.timerSecs(S, d, id), q = B[id];
    return `<div class="dl"><span style="color:var(--${e.stat})" class="mono">${e.stat}</span><span>${esc(e.name)}${e.amt ? ` · ${e.amt} ${esc((q && q.unit) || '')}` : ''}</span><span class="mono">${secs ? mins(secs) + ' · ' : ''}+${e.xp}</span></div>`;
  }).join('');
  const missed = C.scheduledFor(S, d).filter(id => !lg[id] && !C.isExcused(S, d, id)).map(id => (B[id] && B[id].name) || '').filter(Boolean);
  return `<div class="daydetail"><div class="sys-label">[ ${esc(C.prettyDate(d))} ]</div>
    <h3 style="margin:8px 0 2px">${names[info.status] || '—'}</h3>
    <div class="note">${info.n ? `${info.c}/${info.n} daily quests · ` : ''}+${info.dayXp || 0} XP${info.buffs && info.buffs.length ? ' · ' + info.buffs.map(b => BUFFS[b].name).join(', ') : ''}</div>
    <div style="margin-top:10px">${rows || '<div class="empty">Nothing checked off.</div>'}</div>
    ${missed.length ? `<div class="note" style="margin-top:6px">Not done: ${missed.map(esc).join(', ')}</div>` : ''}
    ${r.j ? `<div class="sub" style="margin-top:14px">Journal</div>${r.j.mood ? `<div class="dl"><span>Mood</span><span class="mono">${r.j.mood}/5</span></div>` : ''}${r.j.energy ? `<div class="dl"><span>Energy</span><span class="mono">${r.j.energy}/5</span></div>` : ''}${r.j.text ? `<p style="margin:6px 0 0;color:var(--text);font-size:15px">“${esc(r.j.text)}”</p>` : ''}` : ''}
    <button class="btn sm" data-open="${d}" style="margin-top:14px">Edit this day</button></div>`;
}
function yearHeat() {
  const t = R.today, ws = +S.settings.weekStart;
  let start = addDays(C.weekStart(S, t), -7 * 25);
  let out = '';
  for (let i = 0; i < 26 * 7; i++) {
    const d = addDays(start, i), info = R.days[d];
    let cls = '';
    if (info && d <= t) {
      if (info.status === 'missed') cls = 'miss';
      else if (info.n) { const r = info.c / info.n; cls = r >= 1 ? 'l4' : r >= 0.75 ? 'l3' : r >= 0.5 ? 'l2' : r > 0 ? 'l1' : ''; }
      else if (info.dayXp > 0) cls = 'l1';
    }
    out += `<i class="${cls}" title="${d}${info ? ` · ${info.c}/${info.n}` : ''}"></i>`;
  }
  void ws;
  return `<div class="yearheat">${out}</div>`;
}
function logCharts() {
  const t = R.today;
  let from = view.range ? addDays(t, -(view.range - 1)) : S.startDate;
  if (from < S.startDate) from = S.startDate;
  const ds = []; for (let d = from; d <= t; d = addDays(d, 1)) ds.push(d);
  const series = fn => ds.map(d => ({ d, y: fn(d) }));
  const xp = series(d => (R.days[d] || {}).dayXp || 0);
  const comp = series(d => { const i = R.days[d]; return i && i.n ? Math.round(i.c / i.n * 100) : null; });
  const mood = series(d => (S.days[d] && S.days[d].j && S.days[d].j.mood) || null);
  const energy = series(d => (S.days[d] && S.days[d].j && S.days[d].j.energy) || null);
  const time = series(d => Math.round(C.dayTimerTotal(S, d) / 60));
  const avg = a => { const v = a.map(p => p.y).filter(x => x != null); return v.length ? (v.reduce((s, x) => s + x, 0) / v.length) : null; };
  const statCharts = STAT_KEYS.map(k => {
    const pts = series(d => (R.days[d] || {}).stats ? R.days[d].stats[k] : null);
    const v = pts.filter(p => p.y != null), gain = v.length ? v[v.length - 1].y - (R.days[addDays(from, -1)] ? R.days[addDays(from, -1)].stats[k] : C.BASE_STAT) : 0;
    return chart({ title: `${k} · ${STATS[k].name}`, value: `${R.stats[k]} (+${gain})`, pts, color: `var(--${k})`, min: null });
  }).join('');
  const table = `<details class="tableview"><summary>Show as a table</summary><div class="tablewrap"><table><tr><th>Day</th><th>XP</th><th>Done</th><th>Mood</th><th>Energy</th><th>Timer</th></tr>
    ${ds.slice().reverse().map((d, i) => { const k = ds.length - 1 - i; return `<tr><td>${d}</td><td>${xp[k].y}</td><td>${comp[k].y == null ? '—' : comp[k].y + '%'}</td><td>${mood[k].y || '—'}</td><td>${energy[k].y || '—'}</td><td>${time[k].y ? time[k].y + 'm' : '—'}</td></tr>`; }).join('')}</table></div></details>`;
  const a1 = avg(mood), a2 = avg(energy), a3 = avg(comp);
  return `<div class="rangebar">${[[30, '30 days'], [90, '90 days'], [0, 'All time']].map(([r, n]) => `<button data-range="${r}" class="${view.range === r ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="charts">
      ${chart({ title: 'XP per day', value: `${xp.reduce((s, p) => s + p.y, 0).toLocaleString()} total`, pts: xp, kind: 'bar', unit: ' XP' })}
      ${chart({ title: 'Daily quests done', value: a3 == null ? '' : `avg ${Math.round(a3)}%`, pts: comp, min: 0, max: 100, unit: '%' })}
      ${chart({ title: 'Mood', value: a1 == null ? 'no entries yet' : `avg ${a1.toFixed(1)} / 5`, pts: mood, min: 1, max: 5, color: 'var(--CHA)', unit: '/5' })}
      ${chart({ title: 'Energy', value: a2 == null ? 'no entries yet' : `avg ${a2.toFixed(1)} / 5`, pts: energy, min: 1, max: 5, color: 'var(--VIT)', unit: '/5' })}
      ${chart({ title: 'Time on the stopwatch', value: `${mins(time.reduce((s, p) => s + p.y, 0) * 60)} total`, pts: time, kind: 'bar', color: 'var(--INT)', unit: ' min' })}
    </div>
    <div class="sub">Stats over time</div><div class="charts">${statCharts}</div>${table}`;
}
function logWeekly() {
  const t = R.today, cur = C.weekStart(S, t);
  const ws = view.week || cur;
  const rep = C.weekReport(S, R, ws);
  const prev = addDays(ws, -7), next = addDays(ws, 7);
  const minW = C.weekStart(S, S.startDate);
  const avg = a => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '—';
  const pq = Object.values(rep.perQuest).filter(p => p.of).sort((a, b) => b.done / b.of - a.done / a.of);
  const time = Object.entries(rep.time).sort((a, b) => b[1] - a[1]);
  const gains = STAT_KEYS.filter(k => rep.pts[k]).sort((a, b) => rep.pts[b] - rep.pts[a]);
  return `<div class="report">
    <div class="monthnav"><button data-week="${prev}" ${prev < minW ? 'disabled' : ''} aria-label="Previous week">‹</button><b>${esc(C.prettyDate(ws))} – ${esc(C.prettyDate(rep.end))}</b><button data-week="${next}" ${next > cur ? 'disabled' : ''} aria-label="Next week">›</button></div>
    <div class="big3">
      <div class="tile"><b>${rep.xp.toLocaleString()}</b><span>XP earned</span></div>
      <div class="tile"><b>${rep.cleared}<small style="font-size:16px;color:var(--dim)">/7</small></b><span>Days cleared</span></div>
      <div class="tile"><b>${rep.perfect}</b><span>Perfect days</span></div>
      <div class="tile"><b>${rep.done}</b><span>Quests done</span></div>
      <div class="tile"><b>${avg(rep.moods)}</b><span>Avg mood</span></div>
      <div class="tile"><b>${avg(rep.energies)}</b><span>Avg energy</span></div>
    </div>
    <div class="cols">
      <div><div class="sub" style="margin-top:0">Quest completion</div>
        ${pq.length ? pq.map(p => `<div class="row"><span>${esc(p.name)}</span><span>${p.done}/${p.of}${p.done === p.of ? ' ✓' : ''}</span></div>`).join('') : '<div class="empty">No scheduled quests yet.</div>'}</div>
      <div><div class="sub" style="margin-top:0">Stat gains</div>
        ${gains.length ? gains.map(k => `<div class="row"><span style="color:var(--${k})">${k} · ${STATS[k].name}</span><span>+${rep.pts[k]}</span></div>`).join('') : '<div class="empty">No stat gains yet.</div>'}
        <div class="sub">Time tracked</div>
        ${time.length ? time.map(([n, s]) => `<div class="row"><span>${esc(n)}</span><span>${mins(s)}</span></div>`).join('') : '<div class="empty">No stopwatch time this week.</div>'}
        ${Object.keys(rep.amounts).length ? `<div class="sub">Counts</div>${Object.entries(rep.amounts).map(([n, a]) => `<div class="row"><span>${esc(n)}</span><span>${a.n} ${esc(a.unit)}</span></div>`).join('')}` : ''}
      </div>
    </div></div>`;
}
function logRecords() {
  const vals = Object.values(R.days);
  let total = 0, journal = 0, time = 0, inn = 0, excused = 0;
  for (const d in S.days) { const r = S.days[d]; total += Object.keys(r.log || {}).length; if (r.j && r.j.text) journal++; if (r.inn) inn++; excused += Object.keys(r.skip || {}).length; time += C.dayTimerTotal(S, d); }
  return `<div class="records" style="max-width:520px">
    <div><span>Current streak</span><b>${R.streak}</b></div>
    <div><span>Best streak</span><b>${R.best}</b></div>
    <div><span>Days cleared</span><b>${vals.filter(v => v.status === 'cleared' || v.status === 'perfect').length}</b></div>
    <div><span>Perfect days</span><b>${vals.filter(v => v.status === 'perfect').length}</b></div>
    <div><span>Shields used</span><b>${vals.filter(v => v.status === 'shield').length}</b></div>
    <div><span>Weekly quests cleared</span><b>${R.weeklyClears}</b></div>
    <div><span>Side quests done</span><b>${R.sideDone}</b></div>
    <div><span>Quests excused</span><b>${excused}</b></div>
    <div><span>Quests completed</span><b>${total}</b></div>
    <div><span>Time on the stopwatch</span><b>${mins(time)}</b></div>
    <div><span>Journal entries</span><b>${journal}</b></div>
    <div><span>Nights at the Inn</span><b>${inn}</b></div>
    <div><span>Feats unlocked</span><b>${Object.keys(S.ach).length} / ${ACHIEVEMENTS.length}</b></div>
    <div><span>Journey began</span><b>${S.startDate}</b></div></div>`;
}

// ---------- manage ----------
let editing = null, formDays = ALL.slice(), statTouched = false;
function renderManage() {
  const p = $('pane-manage');
  if (!$('qform')) {
    p.innerHTML = `<div class="win"><h2>Edit Quests</h2>
      <div class="form" id="qform">
        <div class="sys-label" id="formtitle">New Quest</div>
        <div class="frow">
          <div class="field" style="flex:2;min-width:200px"><label>Quest name</label><input type="text" id="f-name" maxlength="60" placeholder="e.g. Read 10 pages"></div>
          <div class="field"><label>Stat <span class="suggest" id="f-suggest"></span></label><select id="f-stat">${STAT_KEYS.map(k => `<option value="${k}">${k} · ${STATS[k].name}</option>`).join('')}</select></div>
          <div class="field"><label>Difficulty</label><select id="f-diff">${Object.keys(DIFF).map(k => `<option value="${k}">${DIFF[k].label} (+${DIFF[k].xp} XP)</option>`).join('')}</select></div>
        </div>
        <div class="frow">
          <div class="field" style="flex:none;min-width:190px"><label>Type</label>
            <select id="f-type"><option value="daily">Daily · set days</option><option value="weekly">Weekly · X times a week</option><option value="side">Side quest · optional</option></select></div>
          <div class="field hidden" id="f-target-wrap" style="flex:none;min-width:130px"><label>Times / week</label>
            <select id="f-target">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="field" style="flex:none"><label id="f-days-label">Days</label><div class="days" id="f-days"></div></div>
        </div>
        <div class="frow">
          <div class="field" style="flex:none;min-width:150px"><label>Timer goal (min)</label><input type="number" id="f-goal" min="0" max="600" step="5" placeholder="none"></div>
          <div class="field" style="flex:none;min-width:170px"><label>Count it in…</label><input type="text" id="f-unit" maxlength="20" placeholder="e.g. applications"></div>
          <div style="display:flex;gap:8px;margin-left:auto">
            <button class="btn hidden" id="f-cancel">Cancel</button>
            <button class="btn solid" id="f-save">Add Quest</button>
          </div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;cursor:pointer;color:var(--dim)"><input type="checkbox" id="f-night"> ☾ Based on last night (check it off the next morning)</label>
        <div class="stat-note" id="f-help"></div>
        <div class="stat-note">Timer goal and count are optional. A goal shows progress on the quest's stopwatch; a count lets you log how many (e.g. 4 applications) after checking it off.</div>
      </div>
      <div id="mlist"></div></div>`;
    $('f-diff').value = 'normal';
    $('f-save').onclick = saveQuest;
    $('f-cancel').onclick = () => { resetForm(); renderManage(); };
    $('f-type').onchange = () => { if ($('f-type').value !== 'daily' && !editing && formDays.length === 7) formDays = []; updateFormType(); renderManage(); };
    $('f-name').onkeydown = e => { if (e.key === 'Enter') saveQuest(); };
    $('f-name').oninput = () => {
      const k = C.suggestStat($('f-name').value);
      if (k && !statTouched) $('f-stat').value = k;
      $('f-suggest').textContent = k ? `suggested: ${k}` : '';
      if (!editing && !$('f-goal').dataset.touched) { const g = C.goalFromName($('f-name').value); $('f-goal').value = g || ''; }
    };
    $('f-goal').oninput = () => { $('f-goal').dataset.touched = 1; };
    $('f-stat').onchange = () => { statTouched = true; };
    updateFormType();
  }
  $('f-days').innerHTML = WD.map((w, i) => `<button data-i="${i}" class="${formDays.includes(i) ? 'on' : ''}" title="${WDL[i]}">${w}</button>`).join('');
  $('f-days').querySelectorAll('button').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    formDays = formDays.includes(i) ? formDays.filter(x => x !== i) : [...formDays, i].sort();
    renderManage();
  });
  const daysText = q => {
    if (q.type === 'side') return 'Side quest · ' + (q.once ? `one-off (${q.once})` : q.days.map(i => WDL[i]).join(' '));
    if (C.isWeekly(q)) return `${q.target}× per week` + (q.days.length ? ` · usually ${q.days.map(i => WDL[i]).join(' ')}` : ' · any day');
    const ds = q.days;
    return ds.length === 7 ? 'Every day' : ds.length === 0 ? 'Bonus only (no days)' : ds.map(i => WDL[i]).join(' ');
  };
  $('mlist').innerHTML = S.quests.length ? S.quests.map((q, i) => `<div class="mq">
      <div class="ord"><button data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">▲</button><button data-down="${i}" ${i < S.quests.length - 1 ? '' : 'disabled'} aria-label="Move down">▼</button></div>
      <span class="tag" style="color:var(--${q.stat})">${q.stat}</span>
      <div style="flex:1;min-width:150px"><div class="qname">${esc(q.name)}${q.night ? '<span class="night">☾ last night</span>' : ''}</div>
        <div class="dd">${daysText(q)} · ${DIFF[q.diff].label}${q.goalMin ? ` · ⏱ ${q.goalMin}m` : ''}${q.unit ? ` · # ${esc(q.unit)}` : ''}</div></div>
      <div class="acts"><button class="btn sm" data-edit="${q.id}">Edit</button><button class="btn sm danger" data-del="${q.id}">Delete</button></div></div>`).join('')
    : '<div class="empty">No quests yet. Add one above.</div>';
  $('mlist').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => startEdit(b.dataset.edit));
  $('mlist').querySelectorAll('[data-del]').forEach(b => b.onclick = () => delQuest(b.dataset.del));
  $('mlist').querySelectorAll('[data-up],[data-down]').forEach(b => b.onclick = () => {
    const i = +(b.dataset.up ?? b.dataset.down), j = b.dataset.up != null ? i - 1 : i + 1;
    [S.quests[i], S.quests[j]] = [S.quests[j], S.quests[i]]; save(); renderManage();
  });
}
function updateFormType() {
  const ty = $('f-type').value, w = ty === 'weekly';
  $('f-target-wrap').classList.toggle('hidden', !w);
  $('f-days-label').textContent = w ? 'Usual days (optional)' : ty === 'side' ? 'Repeat on (none = today only)' : 'Days';
  $('f-help').textContent = w
    ? 'Weekly: do it any N days in the week. Usual days just get a reminder. Hitting the target gives bonus XP and builds a weekly streak. It never breaks your daily streak.'
    : ty === 'side' ? 'Side quest: optional extra work. Gives XP and stats but never counts toward (or against) your streak. Pick days to make it recurring, or none for a one-off today.'
      : 'Daily: shows up on the chosen days and counts toward clearing that day.';
}
function resetForm() {
  editing = null; formDays = ALL.slice(); statTouched = false; $('f-suggest').textContent = '';
  $('f-name').value = ''; $('f-diff').value = 'normal'; $('f-stat').value = 'STR';
  $('f-type').value = 'daily'; $('f-target').value = '2'; $('f-night').checked = false; $('f-goal').value = ''; $('f-unit').value = '';
  delete $('f-goal').dataset.touched; updateFormType();
  $('formtitle').textContent = 'New Quest'; $('f-save').textContent = 'Add Quest';
  $('f-cancel').classList.add('hidden');
}
function startEdit(id) {
  const q = S.quests.find(x => x.id === id); if (!q) return;
  editing = id; formDays = q.days.slice(); statTouched = true; $('f-suggest').textContent = '';
  $('f-name').value = q.name; $('f-stat').value = q.stat; $('f-diff').value = q.diff;
  $('f-type').value = q.type || 'daily'; $('f-target').value = String(q.target || 2); $('f-night').checked = !!q.night;
  $('f-goal').value = q.goalMin || ''; $('f-goal').dataset.touched = 1; $('f-unit').value = q.unit || '';
  updateFormType();
  $('formtitle').textContent = 'Edit Quest'; $('f-save').textContent = 'Save Changes';
  $('f-cancel').classList.remove('hidden');
  renderManage(); $('f-name').focus(); window.scrollTo({ top: $('qform').getBoundingClientRect().top + scrollY - 20, behavior: 'smooth' });
}
function saveQuest() {
  C.freezeHistory(S);
  const name = $('f-name').value.trim();
  if (!name) { toast('Give the quest a name.', 'gold', 'Error'); return; }
  const type = $('f-type').value;
  const data = { name, stat: $('f-stat').value, diff: $('f-diff').value, days: formDays.slice(), type };
  if (type === 'weekly') data.target = +$('f-target').value; else data.target = undefined;
  if (type === 'side' && !data.days.length) {
    const prev = editing && S.quests.find(x => x.id === editing);
    data.once = (prev && prev.once) || (view.date || today());
  } else data.once = undefined;
  data.night = $('f-night').checked;
  const g = Math.max(0, Math.min(600, Math.round(+$('f-goal').value || 0)));
  data.goalMin = g || undefined;
  data.unit = $('f-unit').value.trim() || undefined;
  if (type === 'daily' && !data.days.length) { toast('Pick at least one day, or make it a side quest.', 'gold', 'Error'); return; }
  snapshot();
  if (editing) { const q = S.quests.find(x => x.id === editing); Object.assign(q, data); for (const k in q) if (q[k] === undefined) delete q[k]; toast(`Quest updated: <b>${esc(name)}</b>`); }
  else { const q = { id: C.uid(), createdAt: today(), ...data }; for (const k in q) if (q[k] === undefined) delete q[k]; S.quests.push(q); toast(`New quest registered: <b>${esc(name)}</b>`); }
  C.snapshotDay(S, today()); save(); resetForm(); render();
}
function delQuest(id) {
  const q = S.quests.find(x => x.id === id); if (!q) return;
  if (!confirm(`Delete "${q.name}"? XP you already earned from it stays.`)) return;
  snapshot();
  C.freezeHistory(S);
  S.quests = S.quests.filter(x => x.id !== id);
  const t = today();
  if (S.days[t] && S.days[t].log && S.days[t].log[id]) { S.days[t].log = Object.assign({}, S.days[t].log); delete S.days[t].log[id]; }
  C.snapshotDay(S, t); C.cleanDay(S, t);
  if (editing === id) resetForm();
  save(); render();
  toast(`Deleted <b>${esc(q.name)}</b>.`, '', 'System', true);
}

// ---------- themes ----------
function renderThemes() {
  THEMES.forEach(([id]) => loadFonts(id));
  const cur = S.settings.theme;
  $('pane-themes').innerHTML = `<div class="win"><h2>Themes</h2><div class="themes">${THEMES.map(([id, name, desc]) => `<div class="tcard ${id === cur ? 'on' : ''}" data-theme="${id}" data-pick="${id}" role="button" tabindex="0">
    ${NEW_THEMES.has(id) && id !== cur ? '<span class="new">NEW</span>' : ''}
    <div class="win">
      <div class="sys-label">[ Status ]</div>
      <div class="tn" style="margin-top:6px">${esc(name)}</div>
      <div class="td">${esc(desc)}</div>
      <div class="bar"><i style="width:62%"></i></div>
      <div class="stars"><div class="quest" style="display:contents"><div class="box"><i></i></div></div><div class="quest done" style="display:contents"><div class="box"><i></i></div></div>
        <span style="display:flex;gap:6px;margin-left:6px">${['STR', 'VIT', 'WIS', 'CHA'].map(k => `<span class="tag" style="color:var(--${k});display:inline">${k}</span>`).join('')}</span></div>
      ${id === cur ? '<span class="chip">EQUIPPED</span>' : ''}
    </div></div>`).join('')}</div>
    <div class="note" style="margin-top:14px">Each card shows an unchecked and a checked star. Ambient effects (mist, aurora, petals) can be turned off in Settings.</div></div>`;
  $('pane-themes').querySelectorAll('[data-pick]').forEach(el => el.onclick = () => {
    S.settings.theme = el.dataset.pick; S.seen.themes = Object.assign({}, S.seen.themes || {}, { [el.dataset.pick]: 1 });
    save(); render(); sfx('check');
    toast(`Theme equipped: <b>${esc(THEMES.find(x => x[0] === el.dataset.pick)[1])}</b>`);
  });
}

// ---------- settings ----------
function paintSync() {
  const pill = $('syncpill'); if (!pill) return;
  const st = Sync.getStatus(), u = Sync.getUser();
  const txt = { off: 'LOCAL ONLY', synced: 'SYNCED', syncing: 'SYNCING', offline: 'OFFLINE', error: 'SYNC ERROR', unavailable: 'LOCAL ONLY' }[st] || st;
  pill.className = 'syncpill ' + st;
  $('synctext').textContent = txt;
  pill.title = u ? `Signed in as ${u.email}` : 'Not signed in: progress is saved on this device only';
}
function authErr(e) {
  const c = (e && e.code) || '';
  return ({
    'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email. Create one instead.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/weak-password': 'Password needs at least 6 characters.',
    'auth/invalid-email': 'That email doesn\'t look right.', 'auth/network-request-failed': 'No connection. Try again when you\'re online.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.', 'auth/operation-not-allowed': 'Email/Password sign-in isn\'t enabled in the Firebase console yet.'
  })[c] || (e && e.message) || 'Something went wrong.';
}
function authForm(prefix) {
  return `<div class="authbox">
    <input type="email" id="${prefix}-email" placeholder="Email" autocomplete="username" autocapitalize="off">
    <input type="password" id="${prefix}-pw" placeholder="Password (6+ characters)" autocomplete="current-password">
    <div class="err" id="${prefix}-err"></div>
    <div class="row"><button class="btn solid" id="${prefix}-in">Sign in</button><button class="btn" id="${prefix}-up">Create account</button><button class="btn sm" id="${prefix}-reset" style="border:none">Forgot password?</button></div>
  </div>`;
}
function wireAuth(prefix, done) {
  const v = () => [$(prefix + '-email').value.trim(), $(prefix + '-pw').value];
  const run = async (fn, okMsg) => {
    $(prefix + '-err').textContent = '';
    const [e, p] = v();
    if (!e || (fn !== 'reset' && !p)) { $(prefix + '-err').textContent = 'Enter your email and password.'; return; }
    try {
      if (fn === 'in') await Sync.signIn(e, p);
      else if (fn === 'up') await Sync.signUp(e, p);
      else { await Sync.resetPassword(e); toast('Password reset email sent.'); return; }
      toast(okMsg, 'green', 'Account'); done && done();
    } catch (err) { $(prefix + '-err').textContent = authErr(err); sfx('error'); }
  };
  $(prefix + '-in').onclick = () => run('in', 'Signed in. Syncing your save…');
  $(prefix + '-up').onclick = () => run('up', 'Account created. Your save is syncing to the cloud.');
  $(prefix + '-reset').onclick = () => run('reset');
  $(prefix + '-pw').onkeydown = e => { if (e.key === 'Enter') $(prefix + '-in').click(); };
}
function renderSettings() {
  const p = $('pane-settings');
  const u = Sync.getUser(), st = Sync.getStatus();
  const acct = st === 'unavailable'
    ? '<div class="note">Sync couldn\'t load. Your progress is still saved on this device.</div>'
    : u ? `<div><div class="note">Signed in as <b style="color:var(--text)">${esc(u.email)}</b>. Every change syncs to your other devices within a second or two, and works offline.</div>
        <div style="margin-top:10px"><button class="btn sm" id="s-signout">Sign out</button></div></div>`
      : `<div style="flex:1;min-width:260px"><div class="note" style="margin-bottom:10px">Sign in with the same email and password on your phone and computer to keep them in sync. Free, no card needed.</div>${authForm('sa')}</div>`;
  const keepFocus = p.contains(document.activeElement) ? document.activeElement.id : null;
  if (keepFocus && keepFocus.startsWith('sa-')) return;   // don't wipe a half-typed sign-in form
  const points = restorePoints();
  p.innerHTML = `<div class="win"><h2>Settings</h2>
    <div class="setrow"><div><div class="t">Account &amp; sync</div><div class="d">Status: ${esc({ off: 'not signed in, saved on this device only', synced: 'synced', syncing: 'syncing…', offline: 'offline, changes will sync when you reconnect', error: 'sync error', unavailable: 'unavailable' }[st] || st)}</div></div>${acct}</div>
    <div class="setrow"><div><div class="t">Player name</div></div><input type="text" id="s-name" maxlength="24" style="width:220px" value="${esc(S.name)}"></div>
    <div class="setrow"><div><div class="t">Streak rule</div>
      <div class="d">How many of a day's quests you need to finish for the day to count toward your streak. Weekly quests don't count here. They have their own weekly streak.</div></div>
      <select id="s-rule"><option value="all">All quests</option><option value="allButOne">All but 1 per 5 quests (recommended)</option><option value="half">At least half</option></select></div>
    <div class="setrow"><div><div class="t">Week starts on</div><div class="d">When weekly quest counters reset to 0.</div></div>
      <select id="s-weekstart"><option value="1">Monday</option><option value="0">Sunday</option></select></div>
    <div class="setrow"><div><div class="t">Day resets at</div><div class="d">Stuff you do after midnight but before this time still counts for the previous day.</div></div>
      <select id="s-daystart">${[0, 1, 2, 3, 4, 5, 6].map(h => `<option value="${h}">${h === 0 ? 'Midnight' : h + ':00 AM'}</option>`).join('')}</select></div>
    <div class="setrow"><div><div class="t">Sound effects</div><div class="d">Chimes for quests, clears, level-ups and skills. iPhones mute them when the ringer switch is off.</div></div><label class="switch"><input type="checkbox" id="s-sound" ${S.settings.sound ? 'checked' : ''}><span></span></label></div>
    <div class="setrow"><div><div class="t">Animations &amp; ambient effects</div><div class="d">Level-up scenes, particles, and theme effects like mist, aurora, and petals.</div></div><label class="switch"><input type="checkbox" id="s-fx" ${S.settings.fx ? 'checked' : ''}><span></span></label></div>
    <div class="setrow"><div><div class="t">Vibration</div><div class="d">Small taps on Android. iPhone doesn't let web apps vibrate.</div></div><label class="switch"><input type="checkbox" id="s-haptics" ${S.settings.haptics ? 'checked' : ''}><span></span></label></div>
    <div class="setrow"><div><div class="t">Backup</div><div class="d">Download your whole save as a file, or load one. Saves from the old version of the app work too.</div></div>
      <div style="display:flex;gap:8px"><button class="btn" id="s-export">Export</button><button class="btn" id="s-import">Import</button><input type="file" id="s-file" accept=".json,application/json" class="hidden"></div></div>
    <div class="setrow"><div><div class="t">Restore points</div><div class="d">A weekly snapshot kept on this device, in case something goes wrong.</div>
      ${points.length ? points.map((r, i) => `<div class="kv" style="max-width:420px"><span>${esc(C.prettyDate(r.at))}</span><button class="btn sm" data-restore="${i}">Restore</button></div>`).join('') : '<div class="d" style="margin-top:6px">None yet.</div>'}</div></div>
    <div class="setrow"><div><div class="t">Reset everything</div><div class="d">Deletes all progress, levels, and quests${u ? ', on every device' : ''}. Can't be undone.</div></div><button class="btn danger" id="s-reset">Reset</button></div>
    <div class="note" style="margin-top:14px">The System 3.0 · <a href="#" id="s-update">Check for updates</a></div>
  </div>`;
  $('s-rule').value = S.settings.rule;
  $('s-daystart').value = S.settings.dayStart;
  $('s-weekstart').value = String(S.settings.weekStart);
  if (!u && st !== 'unavailable') wireAuth('sa', () => renderSettings());
  if ($('s-signout')) $('s-signout').onclick = async () => { await Sync.signOutUser(); toast('Signed out. Progress stays on this device.'); render(); };
  $('s-name').oninput = e => { S.name = e.target.value.trim() || 'Player'; save(); renderHeader(); };
  $('s-rule').onchange = e => { snapshot(); S.settings.rule = e.target.value; save(); render(); toast('Streak rule updated. History recalculated.'); };
  $('s-daystart').onchange = e => { S.settings.dayStart = +e.target.value; save(); render(); };
  $('s-weekstart').onchange = e => { S.settings.weekStart = +e.target.value; save(); render(); toast('Week start updated.'); };
  for (const k of ['sound', 'fx', 'haptics']) $('s-' + k).onchange = e => { S.settings[k] = e.target.checked; save(); render(); if (k === 'sound' && e.target.checked) sfx('check'); };
  $('s-export').onclick = exportSave;
  $('s-import').onclick = () => $('s-file').click();
  $('s-file').onchange = e => importFile(e.target.files[0], () => { e.target.value = ''; });
  p.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => {
    const r = restorePoints()[+b.dataset.restore];
    if (!confirm(`Go back to your save from ${C.prettyDate(r.at)}? Anything after that is lost (you can undo right after).`)) return;
    snapshot(); S = C.normalize(r.data); save(); render(); toast('Restored.', '', 'System', true);
  });
  $('s-reset').onclick = async () => {
    if (!confirm('Reset ALL progress? This cannot be undone.')) return;
    if (!confirm('Seriously, everything. Levels, streak, quests. Still reset?')) return;
    const theme = S.settings.theme;
    S = C.defaultState(); S.settings.theme = theme; S.seen.intro = true; C.snapshotDay(S, today());
    saveLocal(); await Sync.overwriteCloud(S); view.date = null; render();
    toast('The System has been reset.');
  };
  $('s-update').onclick = e => { e.preventDefault(); checkUpdate(true); };
}
function exportSave() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `system-save-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Save exported.');
}
function importFile(f, after) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data.quests || !(data.log || data.days) || !data.startDate) throw 0;
      const incoming = C.normalize(data);
      const Rn = C.compute((C.freezeHistory(incoming), incoming));
      if (isMeaningful(S) && !confirm(`Replace your current progress with this save (${incoming.name}, level ${C.levelInfo(Rn.xp).L})?`)) { after && after(); return; }
      snapshot();
      const wasUpgrade = !!incoming._upgraded; delete incoming._upgraded;
      incoming.seen = Object.assign({}, incoming.seen, { intro: true });
      S = incoming; S.seen.intro = true; C.freezeHistory(S); C.snapshotDay(S, today()); save(); closeModal(); render();
      toast(`Save loaded: <b>${esc(S.name)}</b>, level ${C.levelInfo(R.xp).L}.`, 'green', 'Import', true);
      if (wasUpgrade) showPatchNotes();
    } catch (err) { toast('That file isn\'t a valid save.', 'gold', 'Error'); }
    after && after();
  };
  r.readAsText(f);
}

// ---------- restore points ----------
function restorePoints() { try { return JSON.parse(localStorage.getItem(RESTORE_KEY) || '[]'); } catch (e) { return []; } }
function maybeRestorePoint() {
  if (!isMeaningful(S)) return;
  const pts = restorePoints(), wk = C.weekStart(S, today());
  if (pts.length && C.weekStart(S, pts[0].at) === wk) return;
  pts.unshift({ at: today(), data: S });
  try { localStorage.setItem(RESTORE_KEY, JSON.stringify(pts.slice(0, 6))); } catch (e) { /* storage full: skip */ }
}

// ---------- sync glue ----------
function chooseSave(local, remote) {
  return new Promise(res => {
    const sum = s => { const n = C.normalize(s); C.freezeHistory(n); const r = C.compute(n); const days = Object.keys(n.days).filter(d => n.days[d].log).sort(); return `Level ${C.levelInfo(r.xp).L} · ${r.xp.toLocaleString()} XP · streak ${r.streak}<br>Last activity: ${days.length ? esc(C.prettyDate(days[days.length - 1])) : 'none'}`; };
    const m = modal('Sync', 'Two saves found', `<p>This device and your account have different progress. Which one should be kept? The other one is replaced everywhere.</p>
      <div class="choice"><button id="ch-cloud"><b>Cloud save</b><span>${sum(remote)}</span></button><button id="ch-local"><b>This device</b><span>${sum(local)}</span></button></div>`, '', 'left');
    m.dataset.locked = 1;
    $('ch-cloud').onclick = () => { closeModal(); res('cloud'); };
    $('ch-local').onclick = () => { closeModal(); res('local'); };
  });
}
function applyRemote(remote) {
  const n = C.normalize(remote);
  delete n._upgraded;
  if (!n.seen.intro) n.seen.intro = true;
  if ($('modalroot').querySelector('#wa-email')) closeModal();
  const focusTyping = document.activeElement && ['j-text', 'qa-name', 'f-name', 's-name'].includes(document.activeElement.id);
  S = n;
  saveLocal();
  if (!focusTyping) scheduleRender(); else renderHeader();
  return S;
}

// ---------- updates (service worker) ----------
let swReg = null;
async function checkUpdate(manual) {
  if (!swReg) { if (manual) toast('Updates are checked automatically when the app opens.'); return; }
  await swReg.update();
  if (manual && !swReg.installing && !swReg.waiting) toast('You\'re on the latest version.');
}
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    swReg = reg;
    const offer = w => {
      const el = document.createElement('div');
      el.className = 'toast gold';
      el.innerHTML = '<button class="undo">RELOAD</button><span class="sys-label">[ Update ]</span>A new version of The System is ready.';
      el.querySelector('.undo').onclick = () => { w.postMessage('skip'); };
      $('toasts').appendChild(el);
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(() => { /* offline support is optional */ });
  // reload only when an update replaces a running version, not on the very first install
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}

// ---------- onboarding / patch notes ----------
function showPatchNotes() {
  modal('System Update', 'PATCH 3.0', `<p style="text-align:left">Your progress carried over exactly: same level, stats and streak. New since last time:</p>
    <ul style="text-align:left;color:var(--dim);line-height:1.6;padding-left:20px;margin:0">
      <li><b style="color:var(--text)">Sync</b> between phone and computer (Settings → Account)</li>
      <li><b style="color:var(--text)">Stopwatch</b> on every quest. Timed quests got goals: Job Applications 60m, Sun lamp 30m</li>
      <li><b style="color:var(--text)">Skill perks</b>: every skill now gives real XP bonuses</li>
      <li><b style="color:var(--text)">Jobs</b>: you're past level 10, so pick one on the Status tab</li>
      <li><b style="color:var(--text)">Buffs &amp; debuffs</b>, the <b style="color:var(--text)">Inn</b>, <b style="color:var(--text)">Feats</b>, a daily journal, charts and weekly reports</li>
      <li><b style="color:var(--text)">8 new themes</b></li>
    </ul>`, 'Continue', 'left');
}
function showWelcome() {
  const m = modal('System', 'AWAKENING', `<p>You have been granted access to <b style="color:var(--a)">The System</b>. Complete daily quests to earn XP, raise your stats, and unlock skills.</p>
    <div class="sub" style="text-align:left">Already have progress?</div>
    <div style="text-align:left">${authForm('wa')}</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">
      <button class="btn" id="w-import">Import a save file</button><button class="btn solid" id="w-fresh">Start fresh</button></div>
    <input type="file" id="w-file" accept=".json,application/json" class="hidden">`, '', 'left');
  m.dataset.locked = 1;
  wireAuth('wa', () => { S.seen.intro = true; save(); closeModal(); });
  $('w-import').onclick = () => $('w-file').click();
  $('w-file').onchange = e => importFile(e.target.files[0]);
  $('w-fresh').onclick = () => { S.seen.intro = true; save(); closeModal(); render(); };
}
function maybeWeeklyReport() {
  const ws = C.weekStart(S, today()), prev = addDays(ws, -7);
  if (S.seen.report === ws || prev < C.weekStart(S, S.startDate) || !isMeaningful(S)) return;
  S.seen.report = ws; save();
  toast('Last week\'s report is ready. <b>Log → Weekly report</b>.', 'gold', 'Report');
  view.week = prev;
}

// ---------- boot ----------
document.addEventListener('click', e => { if (e.target.closest('#pane-quests')) questsClick(e); });
document.addEventListener('change', e => {
  if (e.target.id === 'daypick' && e.target.value) { view.date = e.target.value === today() ? null : e.target.value; render(); }
  if (e.target.id === 'qa-stat') qaTouched = true;
});
document.addEventListener('keydown', e => { if (e.target.id === 'qa-name' && e.key === 'Enter') quickAdd(); if (e.key === 'Escape' && $('modalroot').firstChild && !$('modalroot').firstChild.dataset.locked) closeModal(); });
document.addEventListener('input', e => { if (e.target.id === 'qa-name' && !qaTouched) { const k = C.suggestStat(e.target.value); if (k) $('qa-stat').value = k; } });

let lastDay = today();
C.freezeHistory(S); C.snapshotDay(S, lastDay);
const upgraded = !!S._upgraded; delete S._upgraded;
saveLocal();
render();
setInterval(() => {
  if (today() !== lastDay) { lastDay = today(); C.freezeHistory(S); C.snapshotDay(S, lastDay); save(); view.date = null; render(); }
  tick();
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (today() !== lastDay) { lastDay = today(); C.freezeHistory(S); C.snapshotDay(S, lastDay); save(); view.date = null; } render(); } });

if (firstRun) showWelcome();
else if (upgraded) showPatchNotes();
maybeRestorePoint();
maybeWeeklyReport();

Sync.initSync({
  getState: () => S,
  isMeaningful,
  normalize: s => C.normalize(s),
  applyRemote,
  chooseSave,
  onStatus: () => { paintSync(); if (view.tab === 'settings') renderSettings(); },
  onError: e => { if (e && e.code === 'permission-denied') toast('The cloud refused this save. Check that the Firestore rules were published.', 'gold', 'Sync'); }
});
registerSW();
window.__system = { get S() { return S; }, C, Sync };
