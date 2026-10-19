import {useState}from 'react';
import {chargeEvidence,chargeFrame,chargeTrialsForSetup,type ChargeTrial,type ChargeSetup}from '../../lib/charge.ts';
import {dataUrl}from '../../lib/data.ts';
const count=(n:number|null)=>n===null?'—':String(n);
const setup=(t:ChargeTrial)=>t.guard_posture?`${t.guard_posture==='standing'?'Standing':'Crouching'} guard`:t.requested_condition==='whiff'?'Whiff setup':'Near hit setup';
export default function ChargeTrials({trials,csvUrl}:{trials?:ChargeTrial[];csvUrl?:string}) {
 const [selected,setSelected]=useState<ChargeSetup>('hit');
 if(!trials?.length)return null;
 const visible=chargeTrialsForSetup(trials,selected);
 return <section className="contact-detail charge-trials" aria-label="Charge and held-input trials">
  <div className="contact-detail-heading"><h2>Charge / held-input variants</h2><span>{trials.length} independent trials</span></div>
  <label>Setup <select aria-label="Charge trial setup" value={selected} onChange={e=>setSelected(e.target.value as ChargeSetup)}>
   <option value="hit">Near hit</option><option value="standing">Standing guard</option><option value="crouching">Crouching guard</option><option value="whiff">Whiff setup</option><option value="all">All setups</option>
  </select></label>
  <div className="contact-table-scroll"><table><thead><tr><th>Input</th><th>Physical hold</th><th>Setup</th><th>Observed</th><th>HP loss</th><th>Stun lost</th><th>Native wait markers</th><th>Sampled activity</th><th>Release → activity</th><th>Contact</th><th>Source ready</th><th>Evidence</th></tr></thead><tbody>{visible.map(t=><tr key={t.id}>
   <th>{t.input_label}</th><td title={`Initial chord ${t.initial_buttons}; entry ${chargeFrame(t.entry_frame)}; physical release ${chargeFrame(t.physical_release_frame)}`}>{t.held_buttons} · {t.hold_frames} ticks</td>
   <td>{setup(t)}</td><td>{t.outcome}{t.requested_condition==='whiff'&&t.outcome!=='whiff'?' · reached target':''}</td>
   <td>{count(t.damage)}{t.outcome==='block'?' chip':''}</td><td title={`Observed depletion; defender capacity ${count(t.stun_capacity)}`}>{count(t.stun_depletion)}</td>
   <td>{t.native_waits.length?t.native_waits.map((w,i)=><div key={i} title={`Native operand ${w.native_operand}; ${w.iteration_calls} iteration calls; ${w.exit_observation}`}>{chargeFrame(w.init_frame0)} → {chargeFrame(w.exit_frame0)}</div>):'No held wait observed'}</td>
   <td title={t.timing_review}>{chargeFrame(t.first_sampled_active_frame)}</td>
   <td title="Signed video ticks from physical release to first retained activity; a negative value means activity started before the scheduled release.">{t.release_to_sampled_activity===null?'—':`${t.release_to_sampled_activity>0?'+':''}${t.release_to_sampled_activity} ticks`}</td>
   <td>{chargeFrame(t.contact_frame)}</td><td>{chargeFrame(t.source_ready_frame)}</td><td title={t.id}>{chargeEvidence(t)}</td>
  </tr>)}</tbody></table></div>
  {!visible.length&&<p>No qualified trials for this setup.</p>}
  <p>Markers are 1-based video frames within each independent trial, separate from the selected image recording. Physical hold ticks, native wait operands and iteration calls use different clocks. A wait can start and exit in the same frame. Sampled activity shows retained geometry; missing projectile activity stays unknown.</p>
  <p>Source ready is an observed controller marker, not a test of the earliest possible attack or guard. Damage is observed HP loss and stun is depletion against the recorded Kaede defender. Both guard postures are measured separately; these trials do not establish every defender/state or a universal charge threshold.</p>
  <details><summary>Input and evidence details</summary><p>Directions release after the initial command while the listed buttons remain held. A long hold can auto-release natively before physical release. Every qualified row matches full RAM/object schemas, values and native events at normal / 2× / 4× host pacing. These are separate fixture checks; verified scalar statistics and original clip images remain unchanged. An actual input such as Kojiroh 6BC can be linked here from a BC source recipe; read the Input column.</p></details>
  {csvUrl&&<a href={dataUrl(csvUrl)} download="charge-trials.csv">Download charge measurements CSV</a>}
 </section>;
}
