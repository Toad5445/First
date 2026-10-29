// Game rules and state. No DOM here, so it can be unit-tested in Node.
import {
  STATS, STAT_KEYS, STAT_KEYWORDS, DIFF, SKILL_REQ, MASTERY_STEP, SKILL_BONUS, MASTERY_BONUS,
  TITLES, RANKS, JOBS, JOB_TIERS, BUFFS, JOURNAL_XP, ACHIEVEMENTS, THEMES, DEFAULT_WORKOUTS
} from './data.js';

export const VERSION = 3;
export const CLEAR_XP = 25, PERFECT_XP = 25, WEEKLY_XP_PER = 20;
export const SIDE_FACTORS = [1, 1, 0.5, 0.5, 0.25];
export const MAIN_FULL = 6, MAIN_EXTRA_FACTOR = 0.5;
export const STREAK_BONUS_PER_DAY = 0.02, STREAK_BONUS_CAP_DAYS = 25;
export const BASE_STAT = 10;
export const ALL = [0, 1, 2, 3, 4, 5, 6];
export const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WDL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------- dates ----------
export const pad = n => String(n).padStart(2, '0');
export const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
export const logicalToday = (startHour, now = Date.now()) => fmt(new Date(now - startHour * 3600000));
export const prettyDate = s => { const d = parse(s); return `${WDL[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`; };

export function uid() { return 'q' + Math.random().toString(36).slice(2, 9); }

export function suggestStat(name) {
  const sc = {}; let best = null, bv = 0;
  for (const [re, k, w] of STAT_KEYWORDS) if (re.test(name)) sc[k] = (sc[k] || 0) + w;
  for (const k in sc) if (sc[k] > bv) { bv = sc[k]; best = k; }
  return best;
}
// "Job Applications (1+ hrs)" -> 60, "Sun light lamp 30 Minutes" -> 30
export function goalFromName(name) {
  const m = /(\d+(?:\.\d+)?)\s*\+?\s*(hrs?|hours?|h\b|mins?|minutes?|m\b)/i.exec(name);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(/^h/i.test(m[2]) ? n * 60 : n);
}

// ---------- state ----------
export const defaultSettings = () => ({ rule: 'allButOne', dayStart: 4, theme: 'system', weekStart: 1, sound: true, fx: true, haptics: true, restSec: 90 });

export function defaultState(now = Date.now()) {
  const t = logicalToday(4, now);
  const q = (name, stat, diff, days, extra) => Object.assign({ id: uid(), name, stat, diff, days, type: 'daily', createdAt: t }, extra || {});
  return {
    v: VERSION, name: 'Player', startDate: t, v3Since: t,
    settings: defaultSettings(),
    quests: [
      q('Meditate', 'WIS', 'normal', ALL),
      q('Workout', 'STR', 'hard', [1, 3, 5]),
      q('Fall asleep without your phone', 'VIT', 'normal', ALL, { night: true }),
      q('Read 10 pages', 'INT', 'easy', ALL)
    ],
    days: {}, jobs: [], titleSel: '', ach: {}, seen: { intro: false }
  };
}

const isObj = o => o && typeof o === 'object' && !Array.isArray(o);

// Accepts a v2 save (log/sched/skip at the top level) or a v3 save, returns a clean v3 state.
export function normalize(s, now = Date.now()) {
  s = JSON.parse(JSON.stringify(s || {}));
  s.settings = Object.assign(defaultSettings(), s.settings || {});
  if (!THEMES.some(t => t[0] === s.settings.theme)) s.settings.theme = 'system';
  const t = logicalToday(s.settings.dayStart, now);
  s.quests = Array.isArray(s.quests) ? s.quests : [];
  s.days = isObj(s.days) ? s.days : {};

  // v2 -> v3: fold per-day maps into s.days, mark where the new rules begin
  if (!s.v || s.v < 3) {
    for (const [key, sec] of [['log', 'log'], ['sched', 'sched'], ['skip', 'skip']]) {
      for (const d in (s[key] || {})) {
        s.days[d] = s.days[d] || {};
        s.days[d][sec] = s[key][d];
      }
      delete s[key];
    }
    s.quests.forEach(q => { if (q.goalMin == null) { const g = goalFromName(q.name); if (g) q.goalMin = g; } });
    s.v3Since = s.v3Since || t;
    s._upgraded = true;
  }
  delete s.nightMigrated;
  s.startDate = s.startDate || t;
  s.v3Since = s.v3Since || t;
  s.name = s.name || 'Player';
  s.jobs = Array.isArray(s.jobs) ? s.jobs : [];
  s.titleSel = s.titleSel || '';
  s.ach = isObj(s.ach) ? s.ach : {};
  s.seen = isObj(s.seen) ? s.seen : {};
  s.wkx = isObj(s.wkx) ? s.wkx : {};
  s.pauses = Array.isArray(s.pauses) ? s.pauses : [];
  s.limbos = Array.isArray(s.limbos) ? s.limbos : [];
  // workout plan: seeded once from the default routine, then the player's own edits
  if (!isObj(s.workouts)) {
    s.workouts = JSON.parse(JSON.stringify(DEFAULT_WORKOUTS));
    for (const d in s.workouts) s.workouts[d].forEach(x => { x.id = uid(); (x.moves || []).forEach(m => { m.id = uid(); }); });
  }
  s.quests.forEach(q => {
    q.type = q.type || 'daily';
    q.days = Array.isArray(q.days) ? q.days : [];
    if (q.type === 'weekly') q.target = q.target || 1;
    q.createdAt = q.createdAt || s.startDate;
  });
  // drop one-off side quests older than yesterday (their XP is already in the log)
  const cutoff = addDays(t, -1);
  s.quests = s.quests.filter(q => !(q.type === 'side' && q.once && q.once < cutoff));
  for (const d in s.days) cleanDay(s, d);
  s.v = VERSION;
  return s;
}

// Remove empty sections/days so state compares cleanly across devices.
export function cleanDay(s, d) {
  const r = s.days[d]; if (!r) return;
  for (const k of ['log', 'skip', 't', 'wo']) if (r[k] && !Object.keys(r[k]).length) delete r[k];
  if (r.j && !r.j.text && !r.j.mood && !r.j.energy) delete r.j;
  if (!r.inn) delete r.inn;
  if (!Object.keys(r).length) delete s.days[d];
}

export const day = (S, d) => S.days[d] || {};
export const logOf = (S, d) => (S.days[d] && S.days[d].log) || {};
export const ensureDay = (S, d) => (S.days[d] = S.days[d] || {});

// ---------- scheduling ----------
export const isWeekly = q => q.type === 'weekly';
export const isDaily = q => (q.type || 'daily') === 'daily';
const wsDay = S => (S.settings.weekStart != null ? +S.settings.weekStart : 1);
export const weekStart = (S, s) => { const d = parse(s); d.setDate(d.getDate() - (d.getDay() - wsDay(S) + 7) % 7); return fmt(d); };
export const today = (S, now = Date.now()) => logicalToday(S.settings.dayStart, now);

export const sideFor = (S, date) => { const wd = parse(date).getDay(); return S.quests.filter(q => q.type === 'side' && (q.once ? q.once === date : q.days.includes(wd))); };
export function scheduledFor(S, date) {
  const r = S.days[date];
  if (r && r.sched) return r.sched;
  const wd = parse(date).getDay();
  return S.quests.filter(q => isDaily(q) && q.days.includes(wd) && q.createdAt <= date).map(q => q.id);
}
export function snapshotDay(S, d) {
  const wd = parse(d).getDay();
  ensureDay(S, d).sched = S.quests.filter(q => isDaily(q) && q.days.includes(wd) && q.createdAt <= d).map(q => q.id);
}
// Lock in each past day's schedule so later quest edits never rewrite history.
export function freezeHistory(S, now = Date.now()) {
  const t = today(S, now); let d = S.startDate, g = 0;
  while (d < t && g++ < 40000) { if (!(S.days[d] && S.days[d].sched)) ensureDay(S, d).sched = scheduledFor(S, d); d = addDays(d, 1); }
}
// Pause and Limbo: S.pauses and S.limbos are lists of {from, to}. Days from `from` up to (not including) `to`
// are covered; an open range has no `to`.
// - A paused day is as if it never happened: no XP or stat points, and streaks, shields and buffs carry
//   straight over it.
// - A limbo day still counts quests (XP, stat points, weekly progress), but like a night at the Inn it neither
//   grows nor breaks the streak and earns no clear bonus or shields.
const inRanges = (list, d) => (list || []).some(p => d >= p.from && (!p.to || d < p.to));
export const isPaused = (S, d) => inRanges(S.pauses, d);
export const isLimbo = (S, d) => inRanges(S.limbos, d);
export const pausedNow = S => (S.pauses || []).some(p => !p.to);
export const limboNow = S => (S.limbos || []).some(p => !p.to);
function setRange(S, key, on, now) {
  const t = today(S, now); S[key] = (S[key] || []).slice();
  if (on && !S[key].some(p => !p.to)) S[key].push({ from: t });
  if (!on) S[key] = S[key].map(p => p.to ? p : { from: p.from, to: t }).filter(p => p.to > p.from);
}
// only one of the two at a time: starting one ends the other
export function setPaused(S, on, now = Date.now()) { if (on) setRange(S, 'limbos', false, now); setRange(S, 'pauses', on, now); }
export function setLimbo(S, on, now = Date.now()) { if (on) setRange(S, 'pauses', false, now); setRange(S, 'limbos', on, now); }
export const isExcused = (S, d, id) => !!(S.days[d] && S.days[d].skip && S.days[d].skip[id]);
export function required(S, n) {
  const r = S.settings.rule;
  if (n === 0) return 0;
  if (r === 'all') return n;
  if (r === 'half') return Math.ceil(n / 2);
  return n - Math.max(n > 1 ? 1 : 0, Math.floor(n / 5));   // 1 miss allowed per 5 quests (min 1)
}
export function weekCount(S, q, anyDateInWeek) {
  const ws = weekStart(S, anyDateInWeek); let c = 0;
  for (let i = 0; i < 7; i++) if (logOf(S, addDays(ws, i))[q.id]) c++;
  return c;
}

// ---------- timers ----------
export function timerSecs(S, d, id, now = Date.now()) {
  const t = S.days[d] && S.days[d].t && S.days[d].t[id];
  if (!t) return 0;
  return (t.s || 0) + (t.r ? Math.max(0, Math.floor((now - t.r) / 1000)) : 0);
}
export function dayTimerTotal(S, d, now = Date.now()) {
  const t = S.days[d] && S.days[d].t; if (!t) return 0;
  let s = 0; for (const id in t) s += timerSecs(S, d, id, now); return s;
}

// ---------- progression ----------
export const need = L => Math.min(1000, 60 + 30 * L);
export function levelInfo(xp) { let L = 1, rem = xp; while (rem >= need(L)) { rem -= need(L); L++; } return { L, rem, need: need(L) }; }
export const rankFor = L => RANKS.filter(r => L >= r[0]).pop()[1];
export const titleFor = best => TITLES.filter(t => best >= t[0]).pop()[1];
export const masteryOf = v => v >= SKILL_REQ[5] ? Math.floor((v - SKILL_REQ[5]) / MASTERY_STEP) : 0;
export const skillCount = v => SKILL_REQ.filter(r => v >= r).length;
export const hasSkill = (stats, k, i) => stats[k] >= SKILL_REQ[i];

export function jobKey(a, b) { const [x, y] = [a, b].sort((p, q) => STAT_KEYS.indexOf(p) - STAT_KEYS.indexOf(q)); return x + '+' + y; }
export function jobTier(L) { let t = 0; JOB_TIERS.forEach(([lv], i) => { if (L >= lv) t = i + 1; }); return t; }
export function jobName(key, tier) { const j = JOBS[key]; return j ? j[Math.max(0, Math.min(2, tier - 1))] : ''; }
export function activeJob(S, d) { let j = null; for (const e of S.jobs) if (e.date <= d) j = e; return j; }

// Perk snapshot for a given stat line-up.
export function perksFor(stats) {
  const h = (k, i) => hasSkill(stats, k, i);
  const statBonus = {};
  for (const k of STAT_KEYS) statBonus[k] = skillCount(stats[k]) * SKILL_BONUS + masteryOf(stats[k]) * MASTERY_BONUS;
  return {
    statBonus,
    hardBonus: h('STR', 2) ? 0.10 : 0,
    weeklyMult: h('STR', 5) ? 1.5 : 1,
    fatigueImmune: h('VIT', 2),
    maxShields: h('VIT', 5) ? 3 : 2,
    journalMult: h('WIS', 2) ? 2 : 1,
    perfectMult: h('WIS', 5) ? 1.5 : 1,
    sideFactors: h('CHA', 2) ? [1, 1, 1, 1, 0.25] : SIDE_FACTORS,
    sideBonus: h('CHA', 5) ? 0.15 : 0,
    streakCap: h('WIL', 2) ? 30 : STREAK_BONUS_CAP_DAYS,
    shieldEvery: h('WIL', 5) ? 6 : 7,
    goalBonus: h('INT', 2) ? 0.10 : 0,
    globalBonus: h('INT', 5) ? 0.05 : 0
  };
}

const LEGACY_PERKS = perksFor(Object.fromEntries(STAT_KEYS.map(k => [k, 0])));

function buffsFor(S, d, days, byId, perks) {
  const out = [];
  // the days before d, skipping paused ones
  const back = []; for (let k = 1, dd = d; back.length < 14 && k < 400; k++) { dd = addDays(dd, -1); if (!days[dd]) break; if (days[dd].status !== 'paused') back.push(dd); }
  const st = n => back[n - 1] ? days[back[n - 1]].status : undefined;
  const nightDone = n => { const dd = back[n - 1] || addDays(d, -n), lg = logOf(S, dd); return Object.keys(lg).some(id => lg[id].n || (byId[id] && byId[id].night)); };
  if ([1, 2, 3].every(nightDone)) out.push('rested');
  if ([1, 2, 3].every(n => st(n) === 'perfect')) out.push('onfire');
  if (back[0] && dayTimerTotal(S, back[0]) >= 3600) out.push('focused');
  if (st(1) === 'inn') out.push('refreshed');
  if (!perks.fatigueImmune) {
    for (let n = 1; n <= 14; n++) {
      const s = st(n);
      if (!s) break;
      if (s === 'rest' || s === 'inn' || s === 'limbo') continue;
      if (s === 'missed' || s === 'shield') out.push('fatigued');
      break;
    }
  }
  return out;
}

// Replays every day from the start. Days before S.v3Since use the original rules exactly,
// so upgrading never changes a level you already earned.
export function compute(S, now = Date.now()) {
  const t = today(S, now);
  const byId = Object.fromEntries(S.quests.map(q => [q.id, q]));
  let xp = 0, streak = 0, best = 0, shields = 0, weeklyClears = 0, sideDone = 0, maxShieldsHeld = 0, maxBuffs = 0;
  const pts = {}; STAT_KEYS.forEach(k => pts[k] = 0);
  const days = {}, wk = {};
  let d = S.startDate, guard = 0;
  while (d <= t && guard++ < 40000) {
    const v3 = d >= S.v3Since;
    const statsStart = {}; for (const k in pts) statsStart[k] = BASE_STAT + pts[k];
    const perks = v3 ? perksFor(statsStart) : LEGACY_PERKS;
    const buffs = v3 ? buffsFor(S, d, days, byId, perks) : [];
    maxBuffs = Math.max(maxBuffs, buffs.length);
    const buffAdd = buffs.reduce((a, b) => a + BUFFS[b].bonus, 0);
    const L0 = levelInfo(xp).L;
    const job = v3 ? activeJob(S, d) : null;
    const jobStats = job ? job.key.split('+') : [];
    const jobAdd = job ? JOB_TIERS[Math.max(0, jobTier(L0) - 1)][1] : 0;
    const xpStart = xp;

    if (isPaused(S, d)) {
      const statsEnd = {}; for (const k in pts) statsEnd[k] = BASE_STAT + pts[k];
      days[d] = { status: 'paused', n: 0, c: 0, req: 0, xp, dayXp: 0, buffs: [], stats: statsEnd, streak };
      d = addDays(d, 1); continue;
    }
    const rec = S.days[d] || {};
    const inn = v3 && !!rec.inn, limbo = isLimbo(S, d);
    const sched = scheduledFor(S, d).filter(id => !isExcused(S, d, id)), done = rec.log || {};
    const mult = 1 + Math.min(streak, perks.streakCap) * STREAK_BONUS_PER_DAY;
    const schedSet = new Set(sched), sides = [], mains = [];
    const entryXp = (e, id, extra = 0) => {
      if (!v3) return e.xp * mult;
      let add = perks.globalBonus + buffAdd + (perks.statBonus[e.stat] || 0) + extra;
      if (jobStats.includes(e.stat)) add += jobAdd;
      if (e.xp >= DIFF.hard.xp) add += perks.hardBonus;
      const q = byId[id];
      if (perks.goalBonus && q && q.goalMin && timerSecs(S, d, id, now) >= q.goalMin * 60) add += perks.goalBonus;
      return e.xp * mult * Math.max(0, 1 + add);
    };
    for (const id in done) {
      const e = done[id], q = byId[id];
      if (pts[e.stat] != null) pts[e.stat] += e.pts;
      const weekly = e.k ? e.k === 'weekly' : (q && isWeekly(q));
      if (!schedSet.has(id) && !weekly) { sides.push([e, id]); continue; }
      if (!weekly) { mains.push([e, id]); continue; }
      xp += Math.round(entryXp(e, id));
      const target = e.tg || (q && q.target) || 1;
      const key = weekStart(S, d) + '|' + id;
      wk[key] = (wk[key] || 0) + 1;
      if (wk[key] === target) { xp += Math.round(WEEKLY_XP_PER * target * perks.weeklyMult); weeklyClears++; }
    }
    mains.sort((a, b) => b[0].xp - a[0].xp).forEach(([e, id], i) => { xp += Math.round(entryXp(e, id) * (i < MAIN_FULL ? 1 : MAIN_EXTRA_FACTOR)); });
    sides.sort((a, b) => b[0].xp - a[0].xp).forEach(([e, id], i) => {
      xp += Math.round(entryXp(e, id, perks.sideBonus) * perks.sideFactors[Math.min(i, perks.sideFactors.length - 1)]); sideDone++;
    });
    if (v3 && rec.j && rec.j.text && rec.j.text.trim()) xp += JOURNAL_XP * perks.journalMult;

    const n = sched.length, c = sched.filter(id => done[id]).length, req = required(S, n);
    let status;
    if (inn) status = 'inn';
    else if (limbo) status = 'limbo';
    else if (n === 0) status = 'rest';
    else if (c >= req) {
      status = c === n ? 'perfect' : 'cleared';
      streak++; xp += CLEAR_XP; if (c === n) xp += Math.round(PERFECT_XP * perks.perfectMult);
      if (streak % perks.shieldEvery === 0 && shields < perks.maxShields) shields++;
    }
    else if (d === t) status = 'pending';
    else if (shields > 0) { shields--; status = 'shield'; }
    else { status = 'missed'; streak = 0; }
    best = Math.max(best, streak);
    maxShieldsHeld = Math.max(maxShieldsHeld, shields);
    const statsEnd = {}; for (const k in pts) statsEnd[k] = BASE_STAT + pts[k];
    days[d] = { status, n, c, req, xp, dayXp: xp - xpStart, buffs, stats: statsEnd, streak };
    d = addDays(d, 1);
  }
  const stats = {}; for (const k in pts) stats[k] = BASE_STAT + pts[k];
  const perks = perksFor(stats);
  const todayBuffs = (days[t] && days[t].buffs) || [];
  // shields can exceed the legacy cap only through the perk
  return { xp, streak, best, shields, stats, days, weeklyClears, sideDone, today: t, perks, buffs: todayBuffs, maxShieldsHeld, maxBuffs };
}

export function unlockedSkills(stats) {
  const out = [];
  for (const k of STAT_KEYS) {
    SKILL_REQ.forEach((req, i) => { if (stats[k] >= req) out.push(k + ':' + i); });
    for (let m = 1; m <= masteryOf(stats[k]); m++) out.push(k + ':m' + m);
  }
  return out;
}
export function nextThreshold(v) {
  const n = SKILL_REQ.find(r => v < r);
  if (n) return { next: n, prev: [BASE_STAT, ...SKILL_REQ].filter(r => r <= v).pop() };
  const m = masteryOf(v);
  return { prev: SKILL_REQ[5] + m * MASTERY_STEP, next: SKILL_REQ[5] + (m + 1) * MASTERY_STEP };
}
export function questStreak(S, q, now = Date.now()) {
  const t = today(S, now); let s = 0, d = t;
  if (!logOf(S, t)[q.id]) d = addDays(t, -1);
  let guard = 0;
  while (d >= S.startDate && guard++ < 5000) {
    if (isPaused(S, d) || isLimbo(S, d) || !scheduledFor(S, d).includes(q.id) || isExcused(S, d, q.id) || (S.days[d] && S.days[d].inn)) { d = addDays(d, -1); continue; }
    if (logOf(S, d)[q.id]) { s++; d = addDays(d, -1); } else break;
  }
  return s;
}
// A weekly quest can be excused for a whole week (sick, gym closed...). An excused week that falls
// short neither breaks the weekly streak nor adds to it. XP from sessions you did make is unaffected.
export const weekKey = (S, q, anyDateInWeek) => weekStart(S, anyDateInWeek) + '|' + q.id;
export const isWeekExcused = (S, q, anyDateInWeek) => !!(S.wkx && S.wkx[weekKey(S, q, anyDateInWeek)]);
export function weeklyStreak(S, q, now = Date.now()) {
  let w = weekStart(S, today(S, now)), s = 0, guard = 0;
  const first = weekStart(S, q.createdAt < S.startDate ? S.startDate : q.createdAt);
  if (weekCount(S, q, w) < q.target) w = addDays(w, -7);
  while (w >= first && guard++ < 1000) {
    if (weekCount(S, q, w) >= q.target) s++;
    else if (!isWeekExcused(S, q, w) && ![0, 1, 2, 3, 4, 5, 6].some(i => isPaused(S, addDays(w, i)) || isLimbo(S, addDays(w, i)))) break;
    w = addDays(w, -7);
  }
  return s;
}
export function topClass(stats) {
  let best = null, v = -1;
  for (const k in stats) if (stats[k] > v) { v = stats[k]; best = k; }
  return v <= BASE_STAT ? 'Unawakened' : STATS[best].cls;
}
export const topStats = stats => STAT_KEYS.slice().sort((a, b) => stats[b] - stats[a] || STAT_KEYS.indexOf(a) - STAT_KEYS.indexOf(b));

// Job choices: pairs drawn from your top 3 stats. Stats tied with 3rd place all count, so a tie never
// hides a job (two stats tied for 3rd gives the pairs for both).
export function jobOptions(stats) {
  const order = topStats(stats);
  const cut = stats[order[Math.min(2, order.length - 1)]];
  const cand = order.filter(k => stats[k] >= cut);
  const out = [];
  for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) out.push(jobKey(cand[i], cand[j]));
  return out;
}
// One job change per 10 levels reached.
export const jobTokens = (S, L) => Math.max(0, Math.floor(L / 10) - S.jobs.length);

export function innUsedInMonth(S, ym) { return Object.keys(S.days).filter(d => d.startsWith(ym) && S.days[d].inn).length; }

// ---------- achievements ----------
export function achContext(S, R, now = Date.now()) {
  let totalDone = 0, journalDays = 0, timeTotal = 0, innDays = 0, comeback = false, nightOwl = false;
  for (const d in S.days) {
    const r = S.days[d];
    totalDone += Object.keys(r.log || {}).length;
    if (r.j && r.j.text) journalDays++;
    if (r.t) for (const id in r.t) timeTotal += timerSecs(S, d, id, now);
    if (r.inn) innDays++;
    for (const id in (r.log || {})) {
      const at = r.log[id].at;
      if (at) { const h = new Date(at).getHours(); if (h < S.settings.dayStart) nightOwl = true; }
    }
  }
  const ds = Object.keys(R.days).sort();
  for (let i = 1; i < ds.length; i++) if (R.days[ds[i - 1]].status === 'missed' && ['cleared', 'perfect'].includes(R.days[ds[i]].status)) comeback = true;
  let bestQuestStreak = 0, bestWeeklyStreak = 0;
  for (const q of S.quests) {
    if (isDaily(q)) bestQuestStreak = Math.max(bestQuestStreak, longestQuestStreak(S, q, R.today));
    if (isWeekly(q)) bestWeeklyStreak = Math.max(bestWeeklyStreak, weeklyStreak(S, q, now));
  }
  return {
    totalDone, journalDays, timeTotal, innDays, comeback, nightOwl, bestQuestStreak, bestWeeklyStreak,
    perfect: Object.values(R.days).filter(v => v.status === 'perfect').length,
    best: R.best, level: levelInfo(R.xp).L, stats: R.stats, sideDone: R.sideDone, hasJob: S.jobs.length > 0,
    maxShieldsHeld: R.maxShieldsHeld, maxBuffs: R.maxBuffs, themesTried: Object.keys(S.seen.themes || {}).length
  };
}
export function longestQuestStreak(S, q, t) {
  let best = 0, cur = 0, d = S.startDate, g = 0;
  while (d <= t && g++ < 40000) {
    const skip = !scheduledFor(S, d).includes(q.id) || isExcused(S, d, q.id) || (S.days[d] && S.days[d].inn);
    if (!skip) { if (logOf(S, d)[q.id]) { cur++; best = Math.max(best, cur); } else if (d < t) cur = 0; }
    d = addDays(d, 1);
  }
  return best;
}
export function earnedAchievements(S, R, now = Date.now()) {
  const c = achContext(S, R, now);
  return ACHIEVEMENTS.filter(a => a.test(c)).map(a => a.id);
}
// Titles come from streaks and feats only. Job names stay on the Class line, so they aren't repeated here.
export function availableTitles(S, R) {
  const out = TITLES.filter(t => R.best >= t[0]).map(t => t[1]);
  for (const a of ACHIEVEMENTS) if (a.title && S.ach[a.id]) out.push(a.title);
  return [...new Set(out)];
}

// ---------- reports ----------
export function weekReport(S, R, ws, now = Date.now()) {
  const byId = Object.fromEntries(S.quests.map(q => [q.id, q]));
  const rep = { start: ws, end: addDays(ws, 6), xp: 0, cleared: 0, perfect: 0, missed: 0, done: 0, pts: {}, time: {}, amounts: {}, moods: [], energies: [], perQuest: {} };
  STAT_KEYS.forEach(k => rep.pts[k] = 0);
  let prevXp = null;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), info = R.days[d];
    if (prevXp === null) { const p = R.days[addDays(d, -1)]; prevXp = p ? p.xp : 0; }
    if (info) { rep.xp += info.dayXp; if (info.status === 'perfect') { rep.perfect++; rep.cleared++; } else if (info.status === 'cleared') rep.cleared++; else if (info.status === 'missed' || info.status === 'shield') rep.missed++; }
    const r = S.days[d] || {}, lg = r.log || {};
    for (const id in lg) { rep.done++; rep.pts[lg[id].stat] = (rep.pts[lg[id].stat] || 0) + lg[id].pts; if (lg[id].amt) { const nm = lg[id].name; rep.amounts[nm] = rep.amounts[nm] || { n: 0, unit: (byId[id] && byId[id].unit) || '' }; rep.amounts[nm].n += lg[id].amt; } }
    if (r.t) for (const id in r.t) { const nm = (byId[id] && byId[id].name) || (lg[id] && lg[id].name) || 'Quest'; rep.time[nm] = (rep.time[nm] || 0) + timerSecs(S, d, id, now); }
    if (r.j && r.j.mood) rep.moods.push(r.j.mood);
    if (r.j && r.j.energy) rep.energies.push(r.j.energy);
    if (d <= R.today) for (const id of scheduledFor(S, d)) {
      if (isExcused(S, d, id) || r.inn) continue;
      const pq = rep.perQuest[id] = rep.perQuest[id] || { name: (byId[id] && byId[id].name) || (lg[id] && lg[id].name) || id, done: 0, of: 0 };
      if (d < R.today || lg[id]) pq.of++;
      if (lg[id]) pq.done++;
    }
  }
  return rep;
}
