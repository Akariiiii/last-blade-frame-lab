import type { Entry, Row } from './types.ts';
import { groundGrabRanges, normalThrowRange, originalProgramSHA256, targetCharacterAllowance, targetPoseAllowance } from './rangeProfiles.ts';

function packet(hex?: string): Uint8Array | null {
  if (!hex || !/^(?:[a-f0-9]{2})+$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g)!, pair => parseInt(pair, 16));
}
function word(bytes: Uint8Array | null, offset: number): number | null {
  return bytes && bytes.length >= offset + 2 ? bytes[offset] * 256 + bytes[offset + 1] : null;
}
function signed16(value: number) { return value >= 0x8000 ? value - 0x10000 : value; }
function number(row: Row, key: string): number | null {
  const value = row[key];
  return value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
}

export interface NativeRange {
  positionGap: number | null;
  nativeDistance: number | null;
  grab: {
    predicate: number; limit: number; adjustedDistance: number;
    characterAllowance: number; poseAllowance: number; positionRadius: number;
    distancePasses: boolean; targetGrounded: boolean | null; targetProtected: boolean | null;
  } | null;
  recordedCheck: 'rejected' | null;
}

/** End-of-frame samples. A passing distance alone never asserts throw admission. */
export function nativeRange(row: Row, entry: Entry): NativeRange {
  const source = packet(row.p1_actor_packet), target = packet(row.p2_actor_packet);
  const sourceX = number(row, 'p1_x'), targetX = number(row, 'p2_x');
  const positionGap = sourceX !== null && targetX !== null ? Math.abs(signed16(sourceX) - signed16(targetX)) : null;
  const nativeDistance = word(source, 0x178);
  const result: NativeRange = { positionGap, nativeDistance, grab: null, recordedCheck: null };
  const checks = entry.measurement_protocol?.native_grab_whiff?.rejected_gate_frames0;
  const frame = number(row, 'relative_frame');
  if (frame !== null && checks?.includes(frame)) result.recordedCheck = 'rejected';
  if (entry.metadata?.original_rom_sha256 !== originalProgramSHA256) return result;
  const profile = groundGrabRanges[entry.action_id] || (entry.group === 'throw' && entry.label === 'C+D' ? normalThrowRange : undefined);
  const targetCharacter = word(target, 0x60), targetState = word(target, 0x72);
  const sourceMode = source && source.length > 0x17a ? source[0x17a] : null;
  if (!profile || nativeDistance === null || sourceMode === null || targetCharacter === null || targetState === null) return result;
  const characterAllowance = targetCharacterAllowance[targetCharacter & 31];
  const poseAllowance = targetState === 0x23 || targetState === 0x24 || targetPoseAllowance[targetCharacter]?.includes(targetState) ? 16 : 0;
  const adjustedDistance = Math.max(0, Math.max(0, nativeDistance - characterAllowance) - poseAllowance);
  const limit = profile.limits[sourceMode === 0 ? 0 : 1];
  const targetHeight = word(target, 0x88);
  result.grab = {
    predicate: profile.predicate, limit, adjustedDistance, characterAllowance, poseAllowance,
    positionRadius: limit + characterAllowance + poseAllowance,
    distancePasses: adjustedDistance <= limit,
    targetGrounded: targetHeight === null ? null : targetHeight === 0,
    targetProtected: target && target.length > 0x1ae ? target[0x1ae] !== 0 : null,
  };
  return result;
}

/** Same floor / camera transform as native collision boxes; units precede stage zoom. */
export function nativeOrigin(row: Row, who: 'p1' | 'p2') {
  const x = number(row, who + '_x'), height = number(row, who + '_y');
  const scale = number(row, who === 'p1' ? 'scale_x_byte' : 'p2_scale_x_byte');
  const scaleY = number(row, who === 'p1' ? 'scale_y_byte' : 'p2_scale_y_byte');
  const originX = number(row, who === 'p1' ? 'origin_x_word' : 'p2_origin_x_word');
  const originY = number(row, who === 'p1' ? 'origin_y_word' : 'p2_origin_y_word');
  if (x === null || height === null || scale === null || scaleY === null || originX === null || originY === null) return null;
  const sx = (scale + 1) / 256, sy = (scaleY + 1) / 256;
  return { x: Math.floor(signed16(x) * sx) + signed16(originX),
    y: Math.floor(-signed16(height) * sy) + signed16(originY) - 16,
    ground: signed16(originY) - 16, scaleX: sx, worldX: signed16(x) };
}

/** One origin-to-limit span on the target's side, not a full-width attack box. */
export function grabRangeSpan(row: Row, range: NativeRange) {
  const source = nativeOrigin(row, 'p1'), target = nativeOrigin(row, 'p2');
  if (!source || !target || !range.grab) return null;
  const direction = target.worldX < source.worldX ? -1 : 1;
  const endWorld = source.worldX + direction * range.grab.positionRadius;
  const end = source.x + Math.floor(endWorld * source.scaleX) - Math.floor(source.worldX * source.scaleX);
  return { start: source.x, end, direction, reach: range.grab.positionRadius };
}
