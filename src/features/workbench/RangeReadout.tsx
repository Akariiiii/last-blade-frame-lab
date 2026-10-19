import type { NativeRange } from '../../lib/native/range.ts';

const units = (value: number | null) => value === null ? '—' : `${value} u`;

export default function RangeReadout({ range }: { range: NativeRange }) {
  const grab = range.grab;
  return <div className="range-readout" aria-label="Native distance measurements">
    <div className="range-values">
      <span>Position gap <b>{units(range.positionGap)}</b></span>
      <span>Native distance <b>{units(range.nativeDistance)}</b></span>
      {grab && <>
        <span>Adjusted / limit <b>{grab.adjustedDistance} / {grab.limit} u</b></span>
        <span className={grab.distancePasses ? 'range-within' : 'range-outside'}>
          Distance test <b>{grab.distancePasses ? 'Within range' : 'Out of range'}</b>
        </span>
        <span>Target <b>{grab.targetGrounded === null ? 'Height unknown' : grab.targetGrounded ? 'Grounded' : 'Airborne'}
          {grab.targetProtected === null ? ' · protection unknown' : grab.targetProtected ? ' · throw protected' : ''}</b></span>
      </>}
      {range.recordedCheck && <strong className="recorded-grab-check">Recorded grab check: rejected</strong>}
    </div>
    <p>{grab ? `Dashed span = ${grab.positionRadius} u from P1 toward the opponent, not the total width of a centered box. Range reference only; distance alone does not guarantee a grab.` : 'Origin-to-origin distance. Native grab range is not mapped for this move.'}</p>
    <details><summary>How distance is measured</summary>
      <p>Units are game coordinates before stage zoom. Position gap uses the two recorded origins; native distance is the game’s stored distance. Both follow the displayed frame.</p>
      {grab && <p>The native test compares max(0, max(0, native distance − {grab.characterAllowance} character allowance) − {grab.poseAllowance} pose allowance) against {grab.limit}. Grounded state, throw protection and permitted target box classes are separate conditions.</p>}
      {grab && <p>The span uses the opponent’s side, independently of facing. The distance predicate has no facing test; earlier command admission and turning are separate. This drawing does not certify a rear grab.</p>}
      <p>These are end-of-frame snapshots. Successful throws can move both characters before that snapshot; their displayed distance is not necessarily the pre-grab distance. Recorded native checks, when available, are marked separately.</p>
    </details>
  </div>;
}
