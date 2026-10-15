import {numeric} from '../../lib/guard.ts';
type Value=string|number|boolean|null;
export default function TimingStatus({values}:{values:Record<string,Value>}) {
  const review=String(values.TimingReview||'');
  if(!review)return null;
  const bound=numeric(values.StartupUpperBound),captured=numeric(values.CapturedActive);
  return <aside className="timing-review" aria-label="Timing evidence review">
    <strong>Timing evidence</strong>
    {bound!==null&&<p>Contact occurred before the first captured hitbox. Startup is at most {bound}f; the exact first active frame is unavailable.</p>}
    {values.GeometryCoverage==='contact_not_fully_sampled'&&<p>Some contact hitboxes were not retained in the snapshots. Full active duration is unknown{captured!==null?`; ${captured} advancing ticks of hitboxes were captured`:''}.</p>}
    {values.ParentChain===true&&<p>Timing starts at the selected follow-up. Damage includes its parent chain; the selected follow-up deals {String(values.TargetDamage)} damage.</p>}
    {review.includes('Later repeated input')&&<p>A later repeated attack is excluded from these move statistics. The full recording still includes it.</p>}
    {review.includes('Defender became ready')&&<p>The defender became ready between contacts. Final-hit advantage does not confirm a true combo.</p>}
  </aside>;
}
