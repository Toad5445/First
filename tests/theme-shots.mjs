import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const save = JSON.parse(readFileSync(new URL('./fixture-save-v2.json', import.meta.url), 'utf8'));
const OUT = process.env.SHOTS; mkdirSync(OUT, { recursive: true });
const themes = (process.env.THEMES || 'shadow,sakura,frost,celestial,dragon,abyss,ronin,vrmmo').split(',');
const vp = process.env.MOBILE ? { width: 390, height: 844 } : { width: 1100, height: 760 };
const b = await chromium.launch();
for (const th of themes) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-10-13T12:00:00') });
  const s = structuredClone(save); s.settings.theme = th;
  await p.addInitScript(x => localStorage.setItem('the-system-save-v1', x), JSON.stringify(s));
  await p.goto('http://localhost:8765/');
  await p.waitForSelector('#hdr .lvl');
  await p.click('#mclose');
  for (const n of ['Meditate', 'Edit & post', 'Multivitamin']) await p.click(`.quest:has-text("${n}")`);
  await p.evaluate(() => { document.querySelectorAll('.scene').forEach(e => e.remove()); document.getElementById('toasts')?.remove(); });
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/theme-${th}${process.env.MOBILE ? '-m' : ''}.png` });
  await ctx.close();
}
await b.close();
