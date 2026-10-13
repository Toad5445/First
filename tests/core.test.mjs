import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import * as C from '../docs/js/core.js';

// The fixture is a real personal save, kept out of git. Without it, only the generic tests run.
const FX = new URL('./fixture-save-v2.json', import.meta.url), BL = new URL('./fixture-baseline.json', import.meta.url);
const have = existsSync(FX) && existsSync(BL);
const v2 = have ? JSON.parse(readFileSync(FX, 'utf8')) : null;
const base = have ? JSON.parse(readFileSync(BL, 'utf8')) : null;
const t = have ? test : test.skip;
const NOW = new Date('2026-10-13T12:00:00').getTime();

t('v2 save migrates with identical level, XP, streak and stats', () => {
  const S = C.normalize(v2, NOW);
  C.freezeHistory(S, NOW);
  const R = C.compute(S, NOW);
  assert.equal(R.xp, base.xp);
  assert.equal(C.levelInfo(R.xp).L, base.level);
  assert.equal(R.streak, base.streak);
  assert.equal(R.best, base.best);
  assert.equal(R.shields, base.shields);
  assert.deepEqual(R.stats, base.stats);
  assert.equal(R.weeklyClears, base.weeklyClears);
  assert.equal(R.sideDone, base.sideDone);
  for (const d in base.days) assert.equal(R.days[d].status, base.days[d], d);
});

t('migration keeps every log entry and infers timer goals', () => {
  const S = C.normalize(v2, NOW);
  let n = 0; for (const d in S.days) n += Object.keys(S.days[d].log || {}).length;
  let m = 0; for (const d in v2.log) m += Object.keys(v2.log[d]).length;
  assert.equal(n, m);
  assert.equal(S.quests.find(q => q.name.startsWith('Job')).goalMin, 60);
  assert.equal(S.quests.find(q => q.name.startsWith('Sun light')).goalMin, 30);
  assert.equal(S.v3Since, '2026-10-13');
  assert.equal(S.settings.theme, 'demon');
});

t('new rules only affect days from the upgrade on', () => {
  const S = C.normalize(v2, NOW);
  C.freezeHistory(S, NOW);
  const before = C.compute(S, NOW).xp;
  const later = NOW + 3 * 86400000;
  C.freezeHistory(S, later);
  const R = C.compute(S, later);
  // three empty days later: nothing earned, streak history up to the upgrade unchanged
  assert.equal(R.days['2026-10-12'].xp, C.compute(S, NOW).days['2026-10-12'].xp);
  assert.ok(R.xp === before);
});

t('perks and buffs apply on new-rule days', () => {
  const S = C.normalize(v2, NOW);
  C.freezeHistory(S, NOW);
  const q = S.quests.find(x => x.name === 'Multivitamin');
  const t = C.today(S, NOW);
  const before = C.compute(S, NOW);
  // VIT 51 has 3 skills (+6%) and Regeneration makes you immune to Fatigued from the 10-12 shield day
  assert.ok(!before.buffs.includes('fatigued'));
  // sleep quest done the last 3 nights -> Well-Rested +5%
  assert.deepEqual(before.buffs, ['rested']);
  C.ensureDay(S, t).log = { [q.id]: { xp: 10, pts: 1, stat: 'VIT', name: q.name, k: 'daily' } };
  const after = C.compute(S, NOW);
  const mult = 1 + Math.min(before.streak, 25) * 0.02;   // streak 13 -> 1.26
  assert.equal(after.xp - before.xp, Math.round(10 * mult * (1 + 0.06 + 0.05)));
});

t('inn days freeze the streak', () => {
  const S = C.normalize(v2, NOW);
  C.freezeHistory(S, NOW);
  const t = C.today(S, NOW);
  C.ensureDay(S, t).inn = true;
  const later = NOW + 86400000;
  C.freezeHistory(S, later);
  const R = C.compute(S, later);
  assert.equal(R.days[t].status, 'inn');
  assert.equal(R.streak, 13);
});

test('goalFromName', () => {
  assert.equal(C.goalFromName('Job Applications (1+ hrs)'), 60);
  assert.equal(C.goalFromName('Read 30 mins'), 30);
  assert.equal(C.goalFromName('Workout'), 0);
});

test('job names are not offered as titles', () => {
  const S = C.normalize({ v: 3, name: 'X', startDate: '2026-10-01', v3Since: '2026-10-01', settings: {}, quests: [], days: {}, jobs: [{ date: '2026-10-01', key: 'VIT+WIS' }], ach: {}, seen: {} }, new Date('2026-10-13T12:00:00').getTime());
  const R = C.compute(S, new Date('2026-10-13T12:00:00').getTime());
  const titles = C.availableTitles(S, { ...R, xp: 100000 });
  assert.ok(!titles.includes('Necromancer') && !titles.includes('Lich') && !titles.includes('Grave Monarch'));
  assert.ok(titles.includes('Wanderer'));
});

test('a tie for 3rd place offers jobs for every tied stat', () => {
  const opts = C.jobOptions({ STR: 40, VIT: 60, WIS: 40, CHA: 55, WIL: 30, INT: 30 });
  for (const k of ['VIT+CHA', 'VIT+WIS', 'STR+VIT', 'WIS+CHA', 'STR+CHA']) assert.ok(opts.includes(k), k);
  assert.deepEqual(C.jobOptions({ STR: 10, VIT: 60, WIS: 40, CHA: 55, WIL: 30, INT: 30 }).sort(), ['VIT+CHA', 'VIT+WIS', 'WIS+CHA'].sort());
});
