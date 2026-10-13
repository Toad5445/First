// Live check: a change saved while sync hasn't loaded yet survives the cloud load and reaches another device.
import { chromium } from 'playwright';
const email = `replay-test-${Date.now()}@example.com`, pw = 'test-' + Math.random().toString(36).slice(2, 12);
const b = await chromium.launch();
const ctxA = await b.newContext({ serviceWorkers: 'block' });
const status = p => p.evaluate(() => window.__system.Sync.getStatus());
const waitFor = async (p, want, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await status(p) === want) return want; await p.waitForTimeout(300); } return status(p); };
let A = await ctxA.newPage();
await A.goto('http://localhost:8765/');
await A.click('#w-fresh');
await A.click('.tab[data-tab="settings"]');
await A.fill('#sa-email', email); await A.fill('#sa-pw', pw); await A.click('#sa-up');
console.log('A signed up:', await waitFor(A, 'synced'));
await A.close();
// edit the saved state directly, as if a change happened before sync finished loading
const B0 = await ctxA.newPage();
await B0.route('**/vendor/firebase.js', r => r.abort());   // load without sync to edit local state
await B0.goto('http://localhost:8765/');
await B0.evaluate(() => { const s = JSON.parse(localStorage.getItem('the-system-v3')); s.seen.report = 'MARK'; s.name = 'Replayed'; localStorage.setItem('the-system-v3', JSON.stringify(s)); });
await B0.close();
A = await ctxA.newPage();
await A.goto('http://localhost:8765/');
console.log('A reopened:', await waitFor(A, 'synced'));
await A.waitForTimeout(1500);
console.log('A keeps local change:', await A.evaluate(() => [window.__system.S.seen.report, window.__system.S.name]));
// second device sees it
const B = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
await B.goto('http://localhost:8765/');
await B.fill('#wa-email', email); await B.fill('#wa-pw', pw); await B.click('#wa-in');
await waitFor(B, 'synced'); await B.waitForTimeout(1500);
console.log('B received:', await B.evaluate(() => [window.__system.S.seen.report, window.__system.S.name]));
await B.evaluate(() => window.__system.Sync.deleteAccount());
console.log('cleanup done');
await b.close();
