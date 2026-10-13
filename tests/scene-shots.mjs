// Screenshots the full-screen scenes (class change, level up, skill) at phone size.
import { chromium } from 'playwright';
const OUT = process.env.SHOTS;
const W = +(process.env.W || 390);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', isMobile: true, hasTouch: true })).newPage();
if (process.env.THEME) await p.addInitScript(t => { const s = { v: 3, name: 'Trixx', startDate: '2026-10-13', v3Since: '2026-10-13', settings: { theme: t }, quests: [], days: {}, seen: { intro: true } }; localStorage.setItem('the-system-v3', JSON.stringify(s)); }, process.env.THEME);
await p.goto('http://localhost:8765/');
await p.waitForSelector('#hdr .lvl');
const shots = [
  ['class', 'Class Change', 'NECROMANCER', 'Commands the body\'s decay through ritual and discipline.', '+5% XP on VIT and WIS quests', 'skill'],
  ['class2', 'Class Change', 'PLAGUE DOCTOR', 'Treats the body like an experiment.', '+5% XP on VIT and INT quests', 'skill'],
  ['level', 'Level Up', 'LEVEL 12', 'Your rank has risen to <b style="color:var(--a)">C-Rank</b>.', 'Keep going, Trixx.', 'levelup'],
  ['skill', 'Skill Acquired', 'Unbreakable Frame', '<span style="color:var(--dim)">Fatigue asks permission first.</span>', 'Perk: Hold up to 3 streak shields instead of 2.', 'skill'],
  ['mastery', 'Mastery', 'GUARDIAN III', 'Vitality Mastery rank reached.', '+1% XP on VIT quests', 'skill']
];
for (const [name, ...args] of shots) {
  await p.evaluate(a => import('./js/fx.js').then(m => { document.getElementById('modalroot').innerHTML = ''; m.scene(...a); }), args);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/scene-${name}-${W}.png` });
  await p.click('.scene');
  await p.waitForTimeout(200);
}
await b.close();
