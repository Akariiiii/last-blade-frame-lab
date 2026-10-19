/** Original fixed_cpu.bin SHA256 f72510ce2f8a411d9958c49b0ef74d6c9d65c09db7c9f62b64ca145653a9f028.
 * CPU030436 ground-grab distance test. Keep other predicates unmapped until reviewed.
 * Evidence: Analysis/roster_extended/catalog/native-throw-redirects.json and
 * Analysis/exports/game_disassembly.asm, CPU030436–03063E / CPU030670–0308D2.
 */
export interface GrabRangeProfile {
  predicate: number;
  limits: readonly [number, number]; // Power / nonzero native mode
}

// Captured program identity retained by the original-ROM producer ledger.
export const originalProgramSHA256 = '7a227510f39d1202486e1d225ae6fab52d361f5416d83f6221892c3fdf52b6e5';

export const normalThrowRange: GrabRangeProfile = { predicate: 0x30670, limits: [40, 40] };

// Native route identity, not a fuzzy match against the displayed move name.
export const groundGrabRanges: Record<string, GrabRangeProfile> = {
  '00:matcher:040': { predicate: 0x306ac, limits: [40, 40] },
  '02:matcher:023': { predicate: 0x30708, limits: [40, 40] },
  '05:matcher:016': { predicate: 0x30764, limits: [72, 58] },
  '07:matcher:035': { predicate: 0x307de, limits: [56, 56] },
  '08:matcher:024': { predicate: 0x30804, limits: [56, 56] },
  '10:matcher:019': { predicate: 0x30886, limits: [56, 56] },
  '10:matcher:033': { predicate: 0x3082a, limits: [56, 56] },
  '11:matcher:033': { predicate: 0x308ac, limits: [80, 80] },
  '17:matcher:040': { predicate: 0x306ac, limits: [40, 40] },
  '19:matcher:033': { predicate: 0x308ac, limits: [80, 80] },
};

// Word table CPU0304A6. Added to the unadjusted distance limit.
export const targetCharacterAllowance = [
  0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0,
  8, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
] as const;

// CPU0304E6–03063E returns16 for these target poses, otherwise0.
export const targetPoseAllowance: Record<number, readonly number[]> = {
  1: [0xc5, 0xc6], 2: [0xa8], 4: [0xb1], 18: [0xb1],
  5: [0xb0, 0xb9, 0xa0], 8: [0xb2], 9: [0xa0],
  11: [0xca, 0xa8, 0x92, 0x9c, 0xa1, 0xac],
  19: [0xca, 0xa8, 0x92, 0x9c, 0xa1, 0xac],
  14: [0x97], 15: [0x9c, 0xa4], 16: [0xa2],
};
