// Reads level/XP/streak/stats from the legacy single-file app for a given save, at a fixed clock.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const save = readFileSync(new URL('./fixture-save-v2.json', import.meta.url), 'utf8');
const when = process.argv[2] || '2026-10-13T12:00:00';
const b = await chromium.launch();
const p = await b.newPage();
await p.clock.install({ time: new Date(when) });
await p.addInitScript(s => localStorage.setItem('the-system-save-v1', s), save);
await p.route('**/fonts.googleapis.com/**', r => r.abort());
await p.goto(new URL('./legacy-v2.html', import.meta.url).href);
const out = await p.evaluate(() => { const R = compute(); const li = levelInfo(R.xp); return { xp: R.xp, level: li.L, rem: li.rem, streak: R.streak, best: R.best, shields: R.shields, stats: R.stats, weeklyClears: R.weeklyClears, sideDone: R.sideDone, days: Object.fromEntries(Object.entries(R.days).map(([d, v]) => [d, v.status])) }; });
console.log(JSON.stringify(out));
await b.close();
