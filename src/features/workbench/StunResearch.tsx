export interface StunResearchData {
  source_character:string;source_mode:string;defender_character:string;defender_mode:string;
  defender_capacity:number;captures:number;prime_window_updates:number;qualifying_operand_static:number;
  boundary_verification?:{captures:number;paired_native_contacts:number;natural_exact_zero_verified:boolean;runtime_operand24_trigger_verified:boolean;
    events:{label:string;recording:string;frame0:number;operand:number;remaining_before:number;remaining_after:number;prime_before:number;prime_after:number;dizzy_trigger:boolean}[]};
  operand_inventory?:{possible_operands:number[];operand23_reachable:boolean;table_words:number};
  remaining_verification?:{captures:number;full_bundle_equal:boolean;
    airborne_trigger:{recording:string;frame0:number;operand:number;height:number;dizzy_frame0:number;exit_frame0:number};
    prior_recharge:{recording:string;hit_frame0:number;prior_dizzy:number;events:{frame0:number;before:number;after:number;gain:number}[]}};
  dizzy_trials:{input:string;updates:number;dizzy_frame0:number;exit_frame0:number;exit_recovery_intervals:number;recording:string}[];
  defender_comparisons?:{selector:number;defender:string;defender_mode:string;source_mode:string;defense:number;capacity:number;hp_loss:number;native_operands:number[]}[];
}
const inputs:Record<string,string>={none:'No input',held:'Hold A after dizzy begins',buttons:'Repeated A',directions:'Alternate left / right',both:'Directions + repeated A'};
export default function StunResearch({data,selectorId}:{data:StunResearchData;selectorId:number}) {
 const comparisons=data.defender_comparisons?.filter(c=>c.selector===selectorId)||[];
 return <details className="contact-detail" aria-label="Verified stun system tests">
  <summary>Stun / dizzy system tests · {data.captures} repeated captures{data.boundary_verification?` + ${data.boundary_verification.captures} boundary captures`:''}{data.remaining_verification?` + ${data.remaining_verification.captures} air/recharge captures`:''}</summary>
  <p>Independent tests: {data.source_character} {data.source_mode} 4B / 2A against {data.defender_character} {data.defender_mode}, starting capacity {data.defender_capacity}. These results do not describe the selected move’s hit count or recovery.</p>
  <p>Stun remaining must underflow to prime a {data.prime_window_updates}-update follow-up window. Reaching exactly zero does not prime{data.boundary_verification?.natural_exact_zero_verified?' in both native code and repeated gameplay tests':' in the native code'}. A subsequent qualifying hit triggers dizzy. The native threshold is {data.qualifying_operand_static}; runtime controls verified a 14-stun light hit preserving the prime and a 64-stun hit triggering dizzy. {data.boundary_verification?.runtime_operand24_trigger_verified?'An actual 24-stun follow-up also triggered dizzy. ':''}{data.operand_inventory?.operand23_reachable===false?`Operand 23 cannot be selected by the unchanged original routine: all ${data.operand_inventory.table_words} reachable table words were checked.`:'The exact 23 / 24 boundary remains untested.'}</p>
  {data.boundary_verification&&<><h3>Exact-zero and minimum-trigger controls</h3>
    <p>{data.boundary_verification.captures} captures / {data.boundary_verification.paired_native_contacts} paired native contacts, full normal / 2× / 4× bundles equal. Frames belong to separate test recordings.</p>
    <div className="contact-table-scroll"><table><thead><tr><th>Control</th><th>Frame (1-based)</th><th>Stun operand</th><th>Remaining</th><th>Prime window</th><th>Dizzy reaction</th></tr></thead><tbody>{data.boundary_verification.events.map(e=><tr key={e.label}><th title={e.recording}>{e.label}</th><td>{e.frame0+1}</td><td>{e.operand}</td><td>{e.remaining_before} → {e.remaining_after}</td><td>{e.prime_before} → {e.prime_after}</td><td>{e.dizzy_trigger?'Triggered':'No'}</td></tr>)}</tbody></table></div>
  </>}
  {data.remaining_verification&&<><h3>Airborne dizzy and later recharge</h3>
    <p>{data.remaining_verification.captures} separate captures; full 1× / 2× / 4× bundles match. A qualifying {data.remaining_verification.airborne_trigger.operand}-stun hit at height {data.remaining_verification.airborne_trigger.height} selected the airborne dizzy reaction, followed by the dizzy state at frame {data.remaining_verification.airborne_trigger.dizzy_frame0+1}.</p>
    <p>After one prior dizzy, a new hit depleted stun. The next three uncapped recharge steps restored 20 each; the last step stopped at capacity. This tests prior dizzy count 1, separately from the initial +10 recharge.</p>
    <div className="contact-table-scroll"><table><thead><tr><th>Recharge frame</th><th>Before</th><th>After</th><th>Restored</th></tr></thead><tbody>{data.remaining_verification.prior_recharge.events.map(e=><tr key={e.frame0}><td>{e.frame0+1}</td><td>{e.before}</td><td>{e.after}</td><td>{e.gain}</td></tr>)}</tbody></table></div>
  </>}
  <div className="contact-table-scroll"><table><thead><tr><th>Defender input during dizzy</th><th>Timer updates</th><th>Tested exit animation</th></tr></thead><tbody>{data.dizzy_trials.map(t=><tr key={t.input}><th>{inputs[t.input]||t.input}</th><td>{t.updates}</td><td>{t.exit_recovery_intervals} frame intervals</td></tr>)}</tbody></table></div>
  <p>Fresh attack edges and horizontal direction edges reduce the timer; continued holding adds no repeated bonus. The held-A test includes its first fresh press. Counts include the first timer update and exit update, and are one greater than the difference between those frame markers. The exit animation is separate from the timer.</p>
  <p>All normal / 2× / 4× capture bundles agree. No measured HP, stun, animation or recovery values were forced. Stun can recharge between attacks, so subtracting move values without tracking recharge can predict the wrong dizzy timing.</p>
  {!!comparisons.length&&<><h3>{comparisons[0].defender} · measured defender stats</h3>
   <p>A separate Kaede 5A test strikes this character while standing neutral. HP loss, incoming stun and stun capacity are separate values. The test attacker’s mode is shown explicitly.</p>
   <div className="contact-table-scroll"><table><thead><tr><th>Defender mode</th><th>Stun capacity</th><th>HP damage scale</th><th>Kaede attacker mode</th><th>HP loss</th><th>Incoming stun</th></tr></thead><tbody>{comparisons.map(c=><tr key={c.defender_mode}><th>{c.defender_mode.toUpperCase()}</th><td>{c.capacity}</td><td title="Native damage-taken scale; 256 is the unit scale. This test does not isolate every damage multiplier.">{c.defense} / 256</td><td>{c.source_mode.toUpperCase()}</td><td>{c.hp_loss}</td><td>{c.native_operands.join(' / ')}</td></tr>)}</tbody></table></div>
   {selectorId===18&&<p>Hagure retains its own initialized stats after transforming. Looking up the visible copied character would give the wrong capacity. These fixtures also mirror the opponent’s mode.</p>}</>}
 </details>;
}
