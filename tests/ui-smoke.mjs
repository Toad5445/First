// Loads the app with the legacy save in localStorage, checks numbers, clicks around, screenshots.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const save = readFileSync(new URL('./fixture-save-v2.json', import.meta.url), 'utf8');
const OUT = process.env.SHOTS || 'shots';
mkdirSync(OUT, { recursive: true });
const url = process.env.URL || 'http://localhost:8765/';
const b = await chromium.launch();
const errors = [];
async function page(vp, theme) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|Failed to load resource|firestore|ERR_/i.test(m.text())) errors.push(m.text()); });
  await p.clock.install({ time: new Date('2026-10-13T12:00:00') });
  await p.addInitScript(([s, th]) => { if (!localStorage.getItem('the-system-v3')) { const o = JSON.parse(s); if (th) o.settings.theme = th; localStorage.setItem('the-system-save-v1', JSON.stringify(o)); } }, [save, theme]);
  await p.goto(url);
  await p.waitForSelector('#hdr .lvl');
  return p;
}
const p = await page({ width: 1200, height: 900 });
const hdr = await p.textContent('#hdr');
console.log('header:', hdr.replace(/\s+/g, ' ').trim().slice(0, 220));
await p.screenshot({ path: `${OUT}/01-patch.png` });
await p.click('#mclose');
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/02-quests-demon.png`, fullPage: true });
// check off Meditate today
await p.click('.quest:has-text("Meditate")');
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/03-after-check.png` });
await p.click('.scene', { timeout: 1500 }).catch(() => {});
for (const t of ['status', 'skills', 'feats', 'log', 'manage', 'themes', 'settings']) {
  await p.click(`.tab[data-tab="${t}"]`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/10-${t}.png`, fullPage: true });
}
await p.click('.tab[data-tab="log"]');
for (const s of ['charts', 'weekly', 'records']) { await p.click(`[data-sub="${s}"]`); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/11-log-${s}.png`, fullPage: true }); }
// timer sheet
await p.click('.tab[data-tab="quests"]');
await p.click('.quest:has-text("Job Applications") [data-act="timer"]');
await p.click('[data-sw="toggle"]');
await p.clock.runFor(65000);
await p.screenshot({ path: `${OUT}/12-timer.png` });
console.log('S level check', await p.evaluate(() => { const S = window.__system.S, C = window.__system.C; return C.levelInfo(C.compute(S).xp).L; }));
// mobile
const m = await page({ width: 390, height: 844 });
await m.click('#mclose').catch(() => {});
await m.waitForTimeout(300);
await m.screenshot({ path: `${OUT}/20-mobile-quests.png`, fullPage: true });
console.log('errors:', errors.length ? errors : 'none');
await b.close();
