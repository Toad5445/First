// Screenshots the job tree sheet in every theme at phone size.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const save = JSON.parse(readFileSync(new URL('./fixture-save-v2.json', import.meta.url), 'utf8'));
const O = process.env.SHOTS;
const themes = (process.env.THEMES || 'system,demon,arcane,guild,blessing,shadow,sakura,frost,celestial,dragon,abyss,ronin,vrmmo').split(',');
const b = await chromium.launch();
for (const th of themes) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage();
  p.on('pageerror', e => console.log(th, 'pageerror', e.message));
  await p.clock.install({ time: new Date('2026-10-14T12:00:00') });
  const s = structuredClone(save); s.settings.theme = th;
  await p.addInitScript(x => localStorage.setItem('the-system-save-v1', x), JSON.stringify(s));
  await p.goto('http://localhost:8765/'); await p.click('#mclose');
  await p.evaluate(() => { const S = window.__system.S; S.jobs = [{ date: '2026-10-13', key: 'VIT+WIS' }]; });
  await p.click('.tab[data-tab="status"]'); await p.evaluate(() => document.getElementById('toasts').remove());
  await p.click('#tree-btn'); await p.waitForTimeout(700);
  await p.locator('.modal .win').screenshot({ path: `${O}/tree-${th}.png` });
  await p.context().close();
}
await b.close();
