import {dataUrl} from '../../lib/data.ts';
import {repeatVerified, type RepeatVerification} from '../../lib/timing.ts';

export default function RepeatEvidence({evidence}:{evidence:RepeatVerification}) {
  const verified=repeatVerified(evidence);
  const pacings=[...new Set(evidence.pacings)].sort((a,b)=>a-b).map(value=>value===1?'normal':`${value}×`).join(' / ');
  const actorFrames=[...new Set(evidence.added_actor_frames)].sort((a,b)=>a-b);
  const projectileFrames=[...new Set(evidence.added_projectile_frames)].sort((a,b)=>a-b);
  return <aside className={`repeat-evidence ${verified?'repeat-verified':'repeat-different'}`} aria-label="Independent RAM repeat evidence">
    <strong>{verified?'RAM repeats agree':'RAM repeats require review'}</strong>
    <p>{evidence.repetitions} repeats · {pacings} host pacing · emulator CPU 100%. Host pacing changes test throughput; game speed stays fixed. This is a per-recording check.</p>
    <p>Clock: {evidence.clock}. Original image recordings and their captured-hitbox markers are unchanged.</p>
    {verified&&<p>{actorFrames.length} additional actor / {projectileFrames.length} projectile pre-response samples support the measured timing. These samples come from separate RAM trials, not the displayed image recording.</p>}
    {!verified&&<p>Repeat disagreement does not establish exact timing or resolve missing hitboxes.</p>}
    {evidence.limitation&&<p>{evidence.limitation}</p>}
    <details><summary>Repeat provenance</summary>
      <p>Additional actor sample indices: {actorFrames.join(', ')||'none'}. Additional projectile sample indices: {projectileFrames.join(', ')||'none'}.</p>
      <p>Indices use the original recording’s zero-based frame coordinates. First / last captured-hitbox markers still refer only to the original snapshots.</p>
      {evidence.evidence_url.startsWith('/data/')&&<a href={dataUrl(evidence.evidence_url)} download>Export independent RAM repeat evidence</a>}
    </details>
  </aside>;
}
