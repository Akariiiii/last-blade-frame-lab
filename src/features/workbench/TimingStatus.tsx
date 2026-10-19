import {numeric} from '../../lib/guard.ts';
import {repeatVerified, sameCaptureObserved, sameCaptureLabel, type RepeatVerification, type SameCaptureVerification} from '../../lib/timing.ts';
import RepeatEvidence from './RepeatEvidence';
type Value=string|number|boolean|null;
export default function TimingStatus({values,repeatVerification,sameCaptureVerification}:{values:Record<string,Value>;repeatVerification?:RepeatVerification;sameCaptureVerification?:SameCaptureVerification}) {
  const review=String(values.TimingReview||'');
  if(!review&&!repeatVerification&&!sameCaptureVerification)return null;
  const bound=numeric(values.StartupUpperBound),captured=numeric(values.CapturedActive);
  const fullGeometry=values.GeometryCoverage==='pre_response_verified'&&repeatVerified(repeatVerification);
  const directGeometry=values.GeometryCoverage==='same_capture_pre_response_observed'&&sameCaptureObserved(sameCaptureVerification);
  return <>
  {repeatVerification&&<RepeatEvidence evidence={repeatVerification}/>}
  {review&&<aside className="timing-review" aria-label="Timing evidence review">
    <strong>Timing evidence</strong>
    {bound!==null&&!fullGeometry&&numeric(values.Startup)===null&&<p>Contact occurred before the first captured hitbox. Startup is at most {bound}f; the exact first active frame is unavailable.</p>}
    {values.GeometryCoverage==='contact_not_fully_sampled'&&!fullGeometry&&<p>Some contact hitboxes were not retained in the snapshots. Full active duration is unknown{captured!==null?`; ${captured} advancing ticks of hitboxes were captured`:''}.</p>}
    {fullGeometry&&<p>Equivalent independent repeats retained the missing pre-response collision samples. Startup / active timing includes those samples; the displayed clip retains its original snapshot coverage.</p>}
    {directGeometry&&<p><strong>{sameCaptureLabel(sameCaptureVerification)}</strong><br/>Timing includes actor hitboxes logged before the response cleared them in this exact recording. The displayed snapshots retain their original coverage. Independent repeat verification is pending.</p>}
    {values.GeometryCoverage==='same_capture_pre_response_observed'&&!directGeometry&&<p>Native same-capture proof is missing or incomplete. Review this timing before relying on it.</p>}
    {values.ParentChain===true&&<p>Timing starts at the selected follow-up. Damage includes its parent chain; the selected follow-up deals {String(values.TargetDamage)} damage.</p>}
    {review.includes('Later repeated input')&&<p>A later repeated attack is excluded from these move statistics. The full recording still includes it.</p>}
    {review.includes('Defender became ready')&&<p>The defender became ready between contacts. Final-hit advantage does not confirm a true combo.</p>}
  </aside>}
  </>;
}
