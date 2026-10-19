import {trialsForState,type ContactState,type SetupGroup}from '../../lib/setupCoverage.ts';
import {timingText}from '../../lib/timing.ts';
const display=(v:unknown,signed=false)=>v===null||v===undefined||v===''?'—':`${signed&&typeof v==='number'&&v>0?'+':''}${v}`;
const title=(s:string)=>s[0].toUpperCase()+s.slice(1);
export default function SetupMeasurements({group,state}:{group?:SetupGroup;state:string}) {
 if(!group||!['hit','block','whiff'].includes(state))return null;
 const trials=trialsForState(group,state as ContactState);
 return <section className="contact-detail setup-measurements" aria-label="Independent outcome measurements">
  <h2>{title(state)} · independent measurements</h2>
   {trials.length?<div className="contact-table-scroll"><table><thead><tr><th>Actual / requested</th><th>Guard</th><th>Startup</th><th>Active</th><th>Recovery</th><th>HP loss</th><th>Stun lost</th><th>Advantage</th><th>Evidence</th></tr></thead><tbody>{trials.map(t=><tr key={t.id}>
    <th title={`Source image recipe: ${t.source_recording}`}>{title(t.outcome)}{t.requested!==t.outcome&&<small>Requested {t.requested}</small>}</th>
    <td>{t.guard_policy?`${t.guard_direction==='1'?'Crouch':'Stand'} · ${t.guard_policy}`:'—'}</td>
    {['Startup','Active','Recovery'].map(f=><td key={f} title={String(t.values.TimingReview||t.phase||'')}>{timingText(t.values,f)??display(t.values[f])}</td>)}
    <td>{display(t.values.Damage)}</td><td>{display(t.values.StunDamage)}</td>
    <td>{display(state==='whiff'?null:t.values[state==='block'?'BlockAdvantage':'HitAdvantage'],true)}{state!=='whiff'&&<small>{state==='block'?'on block':'on hit'}</small>}</td>
    <td title={t.id}>{t.repeat_equal?'1× / 2× / 4× matched':'Single pacing · provisional'}{t.phase&&<small>Throw / counter phase review</small>}</td>
   </tr>)}</tbody></table></div>:<p>No qualified RAM measurements for this outcome. Use the selected recording for image-based measurements.</p>}
   <p>Frame counts exclude identified source hitpause; readiness advantage is defender ready minus attacker ready. Guard policies remain separate. A matched repeat applies to this fixture only. Spacing, target height and follow-up recipes can differ within a move group; three observed outcomes do not mean every variant is covered. Throws/counters keep ordinary timing blank until the relevant native phase is established.</p>
 </section>;
}
