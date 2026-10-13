import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, applyDiff } from '../docs/js/sync.js';

test('local changes replay onto a newer cloud copy without losing either side', () => {
  const synced = { name: 'A', seen: { intro: true }, days: { '2026-10-13': { log: { q1: { xp: 10 } } } } };
  // this device, before sync loaded: marked the report seen and checked q2
  const local = { name: 'A', seen: { intro: true, report: '2026-10-13' }, days: { '2026-10-13': { log: { q1: { xp: 10 }, q2: { xp: 20 } } } } };
  // the cloud meanwhile got q3 from the phone
  const cloud = { name: 'A', seen: { intro: true }, days: { '2026-10-13': { log: { q1: { xp: 10 }, q3: { xp: 35 } } } } };
  const merged = applyDiff(JSON.parse(JSON.stringify(cloud)), diff(synced, local));
  assert.equal(merged.seen.report, '2026-10-13');
  assert.deepEqual(Object.keys(merged.days['2026-10-13'].log).sort(), ['q1', 'q2', 'q3']);
});

test('local unchecks replay as deletions', () => {
  const synced = { days: { d: { log: { q1: {}, q2: {} } } } };
  const local = { days: { d: { log: { q1: {} } } } };
  const cloud = { days: { d: { log: { q1: {}, q2: {}, q3: {} } } } };
  const merged = applyDiff(JSON.parse(JSON.stringify(cloud)), diff(synced, local));
  assert.deepEqual(Object.keys(merged.days.d.log).sort(), ['q1', 'q3']);
});
