// End-to-end sync test against the real Firebase project with a throwaway account (deleted at the end).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const save = readFileSync(new URL('./fixture-save-v2.json', import.meta.url), 'utf8');
const email = `sync-test-${Date.now()}@example.com`, pw = 'test-' + Math.random().toString(36).slice(2, 12);
const b = await chromium.launch();
const errs = [];
async function open(withSave) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  if (withSave) await p.addInitScript(s => { if (!localStorage.getItem('the-system-v3')) localStorage.setItem('the-system-save-v1', s); }, save);
  await p.goto('http://localhost:8765/');
  await p.waitForSelector('#hdr .lvl');
  return p;
}
const status = p => p.evaluate(() => window.__system.Sync.getStatus());
const waitStatus = async (p, want, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await status(p); if (s === want) return s; await p.waitForTimeout(300); } return status(p); };

// Device A: has the save, creates the account
const A = await open(true);
await A.click('#mclose');
await A.click('.tab[data-tab="settings"]');
await A.fill('#sa-email', email); await A.fill('#sa-pw', pw);
await A.click('#sa-up');
console.log('A after sign-up:', await waitStatus(A, 'synced'), '| err:', await A.textContent('#sa-err').catch(() => '-'));
const lvlA = await A.textContent('#hdr .lvl');

// Device B: fresh phone, signs in from the welcome screen
const B = await open(false);
await B.fill('#wa-email', email); await B.fill('#wa-pw', pw);
await B.click('#wa-in');
console.log('B after sign-in:', await waitStatus(B, 'synced'));
await B.waitForTimeout(1500);
const lvlB = await B.textContent('#hdr .lvl');
console.log('levels A/B:', lvlA, lvlB);

// B checks a quest, A should see it
await B.click('.tab[data-tab="quests"]');
await B.click('.quest:has-text("Multivitamin")');
await waitStatus(B, 'synced');
await A.click('.tab[data-tab="quests"]');
let seen = false;
for (let i = 0; i < 40 && !seen; i++) { await A.waitForTimeout(300); seen = await A.locator('.quest.done:has-text("Multivitamin")').count() > 0; }
console.log('A sees B\'s check-off:', seen);

// both offline-style concurrent edits on the same day merge
await A.click('.quest:has-text("Meditate")');
await B.click('.quest:has-text("Edit & post")');
await A.waitForTimeout(4000);
const doneA = await A.$$eval('.quest.done .qn', els => els.map(e => e.textContent));
const doneB = await B.$$eval('.quest.done .qn', els => els.map(e => e.textContent));
console.log('A done:', doneA.join(' | '));
console.log('B done:', doneB.join(' | '));

// cleanup
await A.evaluate(() => window.__system.Sync.deleteAccount());
console.log('cleanup done; page errors:', errs.length ? errs : 'none');
await b.close();
