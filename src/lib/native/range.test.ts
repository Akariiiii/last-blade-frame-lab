import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativeRange, nativeOrigin, grabRangeSpan } from './range.ts';
import type { Entry, Row } from './types.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/juzoh-range.json', import.meta.url), 'utf8')) as {
  source: string; entry: Entry; row: Row;
}[];
const far = fixtures[0];
function edited(who: 'p1' | 'p2', changes: [number, number][], row = far.row): Row {
  const bytes = Buffer.from(row[who + '_actor_packet'], 'hex');
  for (const [offset, value] of changes) bytes[offset] = value;
  return { ...row, [who + '_actor_packet']: bytes.toString('hex') };
}

test('actual Juzoh snapshots distinguish far whiff, near approach and post-grab repositioning', () => {
  const farRange = nativeRange(far.row, far.entry);
  assert.equal(farRange.positionGap, 254);
  assert.equal(farRange.nativeDistance, 254);
  assert.equal(farRange.grab?.adjustedDistance, 254);
  assert.equal(farRange.grab?.distancePasses, false);
  const approach = nativeRange(fixtures[1].row, fixtures[1].entry);
  assert.equal(approach.grab?.distancePasses, true);
  const captured = nativeRange(fixtures[2].row, fixtures[2].entry);
  assert.equal(captured.positionGap, 0);
  assert.equal(captured.nativeDistance, 0);
  assert.equal(captured.grab?.limit, 72); // zero gap is the post-grab sample, not its reach
});

test('native mode and stored distance control the comparison, with inclusive boundary', () => {
  const row = edited('p1', [[0x178, 0], [0x179, 59], [0x17a, 1]]);
  const range = nativeRange(row, { ...far.entry, mode: 'power' });
  assert.equal(range.positionGap, 254);
  assert.equal(range.grab?.limit, 58);
  assert.equal(range.grab?.distancePasses, false);
  assert.equal(nativeRange(edited('p1', [[0x179, 58]], row), far.entry).grab?.distancePasses, true);
  assert.equal(nativeRange(edited('p1', [[0x17a, 2]], row), far.entry).grab?.limit, 58);
});

test('target character and special pose allowances use the native order and clamp', () => {
  let row = edited('p1', [[0x178, 0], [0x179, 90]]);
  row = edited('p2', [[0x60, 0], [0x61, 5], [0x72, 0], [0x73, 0xb0]], row);
  const grab = nativeRange(row, far.entry).grab!;
  assert.equal(grab.characterAllowance, 8);
  assert.equal(grab.poseAllowance, 16);
  assert.equal(grab.adjustedDistance, 66);
  assert.equal(grab.positionRadius, 96);
  assert.equal(grab.distancePasses, true);
  assert.equal(nativeRange(edited('p1', [[0x179, 1]], row), far.entry).grab?.adjustedDistance, 0);
  assert.equal(nativeRange(edited('p2', [[0x73, 0x23]], far.row), far.entry).grab?.poseAllowance, 16);
});

test('distance passing does not hide airborne or protected target conditions', () => {
  let row = edited('p1', [[0x178, 0], [0x179, 20]]);
  row = edited('p2', [[0x88, 0], [0x89, 5], [0x1ae, 3]], row);
  const grab = nativeRange(row, far.entry).grab!;
  assert.equal(grab.distancePasses, true);
  assert.equal(grab.targetGrounded, false);
  assert.equal(grab.targetProtected, true);
});

test('missing packets stay unknown and unsupported air/conditional routes never borrow a ground range', () => {
  const missing = nativeRange({ ...far.row, p1_actor_packet: '' }, far.entry);
  assert.equal(missing.nativeDistance, null);
  assert.equal(missing.grab, null);
  assert.equal(missing.positionGap, 254);
  assert.equal(nativeRange(far.row, { ...far.entry, action_id: '10:matcher:035', label: 'j.63214C' }).grab, null);
  assert.equal(nativeRange(far.row, { ...far.entry, action_id: '14:matcher:009', label: '623B' }).grab, null);
  assert.equal(nativeRange(far.row, { ...far.entry, metadata: {} }).grab, null);
  assert.equal(nativeRange(far.row, { ...far.entry, metadata: { original_rom_sha256: 'different-program' } }).grab, null);
  assert.equal(nativeRange(far.row, { ...far.entry, action_id: 'throw', group: 'throw', label: 'C+D' }).grab?.limit, 40);
});

test('native check markers appear only at the frame pinned by the clip protocol', () => {
  const entry = { ...far.entry, measurement_protocol: { native_grab_whiff: { rejected_gate_frames0: [20] } } };
  assert.equal(nativeRange(far.row, entry).recordedCheck, 'rejected');
  assert.equal(nativeRange({ ...far.row, relative_frame: '21' }, entry).recordedCheck, null);
  assert.equal(nativeRange(far.row, far.entry).recordedCheck, null);
});

test('ruler origins match native camera floor transforms and ignore facing', () => {
  assert.deepEqual(nativeOrigin(far.row, 'p1'), { x: 59, y: 203, ground: 203, scaleX: 205 / 256, worldX: 274 });
  assert.equal(nativeOrigin({ ...far.row, p1_facing: '0' }, 'p1')?.x, nativeOrigin({ ...far.row, p1_facing: '1' }, 'p1')?.x);
  assert.equal(nativeOrigin({ ...far.row, p2_origin_x_word: '' }, 'p2'), null);
  assert.equal(nativeOrigin({ ...far.row, p1_x: '65526', origin_x_word: '100' }, 'p1')?.x, 91);
});

test('grab span is the full one-sided reach, follows target side and accounts for stage zoom', () => {
  const row = { ...far.row, scale_x_byte: '255', p2_scale_x_byte: '255', origin_x_word: '0', p2_origin_x_word: '0' };
  let range = nativeRange(row, far.entry);
  assert.deepEqual(grabRangeSpan(row, range), { start: 274, end: 346, direction: 1, reach: 72 });
  const behind = { ...row, p2_x: '200', p1_facing: '1' };
  assert.deepEqual(grabRangeSpan(behind, range), { start: 274, end: 202, direction: -1, reach: 72 });
  const wideTarget = edited('p2', [[0x61, 5], [0x73, 0xb0]], row);
  range = nativeRange(wideTarget, far.entry);
  assert.equal(grabRangeSpan(wideTarget, range)?.reach, 96);
  assert.equal(grabRangeSpan(far.row, nativeRange(far.row, far.entry))?.end, 117);
});
