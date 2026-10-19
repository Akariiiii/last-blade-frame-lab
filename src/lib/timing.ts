type Value = string | number | boolean | null;
export interface RepeatVerification {
  status: 'verified' | 'different';
  repetitions: number;
  pacings: number[];
  source_match: boolean;
  added_actor_frames: number[];
  added_projectile_frames: number[];
  evidence_url: string;
  clock: 'source animation / independent projectile ticks';
  limitation?: string;
}
export interface TimingComparison {
  status: string;
  measured: number | null;
  wiki: number | null;
  raw: string[];
  reason: string;
}
export interface SameCaptureVerification {
  status: 'observed_same_capture';
  repetitions: number;
  pacings: number[];
  source_match: boolean;
  added_actor_frames: number[];
  proof_sha256: string;
  original_ram_sha256: string;
  collision_hook_sha256: string;
  clock: string;
  limitation?: string;
}

/** Direct native samples belong to this image execution, never independent repeats. */
export function sameCaptureObserved(proof: SameCaptureVerification | undefined): boolean {
  return proof?.status==='observed_same_capture'&&proof.source_match===true&&proof.repetitions===1&&
    proof.pacings.length===1&&Number.isFinite(proof.pacings[0])&&proof.pacings[0]>0&&
    [proof.proof_sha256,proof.original_ram_sha256,proof.collision_hook_sha256].every(hash=>/^[a-f0-9]{64}$/.test(hash));
}

export function sameCaptureLabel(proof: SameCaptureVerification | undefined): string | null {
  return sameCaptureObserved(proof)?'Native pre-response samples · same capture · 1 run':null;
}
export function timingText(values: Record<string, Value> | undefined, field: string): string | null {
  if(!['Startup','Active','Recovery'].includes(field))return null;
  const value=values?.[field];
  if(typeof value==='number')return String(value);
  const bound=values?.StartupUpperBound;
  return field==='Startup'&&typeof bound==='number'?`≤${bound}`:null;
}
export function hasTimingValue(values: Record<string, Value> | undefined, field: string) {
  return timingText(values,field)!==null;
}

/** Absence of a wiki number must not make an available measurement look unknown. */
export function comparisonReadout(values: Record<string, Value> | undefined, field: string, comparison?: TimingComparison) {
  const value=values?.[field];
  if(value===null||value===undefined||value==='') {
    if(field==='Startup'&&typeof values?.StartupUpperBound==='number')return {kind:'review',label:'Bound only — exact startup unknown'} as const;
    return {kind:'unavailable',label:'Measurement unavailable'} as const;
  }
  if(comparison?.wiki===null||comparison?.wiki===undefined) {
    return comparison?.raw.some(raw=>raw.trim())
      ? {kind:'review',label:'Wiki conditions need review'} as const
      : {kind:'missing_reference',label:'Measured · no wiki reference'} as const;
  }
  if(comparison.status==='needs_review')return {kind:'review',label:'Review comparison conditions'} as const;
  if(field==='Startup'&&typeof values?.StartupInclusive==='number'&&value!==comparison.wiki&&values.StartupInclusive===comparison.wiki)
    return {kind:'review',label:'Inclusive startup matches wiki'} as const;
  if(typeof value==='number')return value===comparison.wiki
    ? {kind:'match',label:'✓ Numbers match'} as const
    : {kind:'different',label:'⚠ Different — review'} as const;
  return {kind:'review',label:'Review comparison conditions'} as const;
}

/** A repeat disagreement cannot silently authorize an exact geometry measurement. */
export function repeatVerified(repeat: RepeatVerification | undefined): boolean {
  return repeat?.status==='verified'&&repeat.source_match&&repeat.repetitions>=2&&
    repeat.pacings.length>0&&repeat.pacings.every(pacing=>Number.isFinite(pacing)&&pacing>0);
}
