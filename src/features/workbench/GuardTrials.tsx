import {guardTrialEvidence} from '../../lib/guard.ts';
import {dataUrl} from '../../lib/data.ts';
export interface GuardTrial {
 id:string;policy:string;verification_status?:string;guard_direction?:string;outcome?:string;source?:string;retaliation_phase:number;contact_frame:number|null;guard_input_change_frame:number|null;
 attacker_ready_frame:number|null;defender_ready_frame:number|null;advantage:number|null;
 retaliation_admission_frame:number|null;attacker_hit_frame:number|null;repetitions:number;pacings:number[];
}
const frame=(v:number|null)=>v===null?'—':String(v+1);
const label:Record<string,string>={held:'Held guard',release:'Release to neutral',switch:'Switch guard',switch4A:'Switch → 4A'};
export default function GuardTrials({trials,csvUrl}:{trials?:GuardTrial[];csvUrl?:string}) {
 if(!trials?.length)return null;
 return <section className="contact-detail" aria-label="Guard release and retaliation trials"><h2>Guard release / switch / retaliation</h2>
 <div className="contact-table-scroll"><table><thead><tr><th>Protocol</th><th>Initial stance</th><th>Evidence</th><th>Contact</th><th>Input changes</th><th>Attacker ready</th><th>Defender ready</th><th>Attacker advantage</th><th>4A admitted</th><th>Attacker hit</th></tr></thead><tbody>{trials.map(t=><tr key={t.id}><th>{label[t.policy]||t.policy}{t.policy==='switch4A'?` · pulse ${t.retaliation_phase}`:''}</th><td>{t.guard_direction==='1'?'Crouching':t.guard_direction==='4'?'Standing':'Recorded setup'}</td><td title={t.source}>{guardTrialEvidence(t)}{t.outcome&&t.outcome!=='block'&&<small> · {t.outcome}</small>}</td><td>{frame(t.contact_frame)}</td><td>{frame(t.guard_input_change_frame)}</td><td>{frame(t.attacker_ready_frame)}</td><td>{frame(t.defender_ready_frame)}</td><td>{t.advantage===null?'—':`${t.advantage>0?'+':''}${t.advantage}f`}</td><td>{frame(t.retaliation_admission_frame)}</td><td>{frame(t.attacker_hit_frame)}</td></tr>)}</tbody></table></div>
 <p>Attacker advantage = defender ready − attacker ready. A negative value means the defender can act first. Switching guard changes defender recovery; it does not add recovery to the attacker’s move.</p><p>Separate near-range original-ROM trials. Evidence labels distinguish single runs from normal / 2× / 4× repeat checks; provisional results do not fill verified move statistics. Frame markers are 1-based within each trial, not the selected clip. Guard inputs change only after observed contact. Releasing down-back to neutral can itself switch to standing guard.</p>
 {csvUrl&&<a href={dataUrl(csvUrl)} download="guard-trials.csv">Download guard measurements CSV</a>}
 <p>4A uses alternating button edges at both tested pulse phases where available. Admission proves the observed attack began; an interrupted attacker has no normal-recovery value in that trial. A missing control-ready flag does not mean the defender could not attack.</p></section>;
}
