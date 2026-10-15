export type GuardBasis = 'no_numeric_reference' | 'both_values_match' | 'switch_guard_value_matches' | 'held_guard_value_matches' | 'neither_value_matches' | 'guard_policy_unresolved';
export function guardWikiBasis(held: number | null, switched: number | null, wiki: number | null): GuardBasis {
  if (wiki === null) return 'no_numeric_reference';
  if (held !== null && switched !== null && held === switched && held === wiki) return 'both_values_match';
  if (switched !== null && switched === wiki) return 'switch_guard_value_matches';
  if (held !== null && held === wiki) return 'held_guard_value_matches';
  if (held !== null && switched !== null) return 'neither_value_matches';
  return 'guard_policy_unresolved';
}
export function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
