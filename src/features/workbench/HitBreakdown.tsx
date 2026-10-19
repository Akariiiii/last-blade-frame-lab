type Value=string|number|boolean|null;
export interface HitEvent {
  index:number;frame:number;kind:string;damage:number;cumulative_damage:number;gap_from_previous:number|null;
  stun_damage:number|null;stun_remaining:number|null;stun_capacity:number|null;defender_ready_before_next:number|null;
  attacker_height:number;defender_height:number;
}
export interface Landing {airborne_frame:number|null;landing_frame:number|null;control_ready_frame:number|null;recovery:number|null;contact_height:number|null}
export interface MovePhase {kind:string;first_damage_delay?:number;grab_frame?:number;limitation?:string;wait_to_response?:number;response_startup?:number;response_startup_inclusive?:number;whiff_duration?:number}
const show=(v:unknown)=>v===null||v===undefined?'—':String(v);
export default function HitBreakdown({events,values,landing,movePhase,defenderPacket,onSeek}:{events:HitEvent[];values:Record<string,Value>;landing?:Landing;movePhase?:MovePhase|null;defenderPacket?:string;onSeek:(frame:number)=>void}) {
  const damage=events.reduce((n,e)=>n+e.damage,0);
  const byte=(offset:number)=>defenderPacket&&defenderPacket.length>=offset*2+2?Number.parseInt(defenderPacket.slice(offset*2,offset*2+2),16):null;
  const remaining=byte(0x188),capacity=byte(0x189),primed=byte(0x18d);
  return <section className="contact-detail" aria-label="Hit sequence and stun">
    <div className="contact-detail-heading"><h2>Hit sequence / stun</h2><span>Selected recording · observed values</span></div>
    <div className="contact-summary"><strong>{events.length?events.map(e=>e.damage).join(' + '):'0'}{events.length>1?` = ${damage}`:''} damage</strong>
      <span>Stun loss <b>{show(values.StunDamage)}</b> · defender starts at <b>{show(values.InitialStunRemaining)} / {show(values.StunCapacity)}</b></span></div>
    {remaining!==null&&capacity!==null&&capacity>0&&capacity!==255&&<div className="live-stun"><label>Current frame · stun buildup {capacity-remaining} / {capacity}<meter min={0} max={capacity} value={Math.max(0,capacity-remaining)} aria-label="Defender stun buildup"/></label><span>{remaining} remaining{primed?` · follow-up window ${primed}`:''}</span></div>}
    {events.length>0?<div className="contact-table-scroll"><table><thead><tr><th>Event</th><th>Frame</th><th>Gap</th><th>Damage</th><th>Total</th><th>Stun loss</th><th>Stun left</th><th>Defender ready</th></tr></thead><tbody>{events.map(e=><tr key={`${e.frame}-${e.index}`}>
      <th>{e.index} · {e.kind==='block'?'block':'hit'}</th><td><button onClick={()=>onSeek(e.frame)}>{e.frame+1} ↗</button></td><td>{e.gap_from_previous===null?'—':`${e.gap_from_previous}t`}</td><td>{e.damage}</td><td>{e.cumulative_damage}</td><td>{show(e.stun_damage)}</td><td>{show(e.stun_remaining)}</td><td>{e.defender_ready_before_next===null?'Not observed':`frame ${e.defender_ready_before_next+1}`}</td>
    </tr>)}</tbody></table></div>:<p>No target HP-loss events in this recording. This can be a whiff or a zero-chip guard; it is not proof that no collision occurred.</p>}
    <p>These events belong to the selected move/follow-up; earlier parent damage is excluded. Gaps use recorded ticks, including pauses. Damage and stun are separate resources; these are observed values against this defender. A frame can contain more than one native contact, so HP-loss events are not always an exact hit count.</p>
    {movePhase&&<div className="phase-detail"><strong>{movePhase.kind==='successful_throw_sequence'?'Throw sequence':movePhase.kind==='throw_whiff_trial'?'Throw whiff':'Counter response'}</strong>
      {movePhase.kind==='throw_whiff_trial'?<p>Whiff attempt: <b>{show(movePhase.whiff_duration)} counted frames</b>. No successful grab was observed.</p>:<p>{movePhase.grab_frame!==undefined?`Grab already admitted at frame ${movePhase.grab_frame+1}. `:''}First damage occurs {show(movePhase.first_damage_delay)} recorded ticks after selected entry. This delay includes the sequence/wait and is not ordinary startup.</p>}
      {movePhase.kind==='counter_response'&&<p>Wait until response: {show(movePhase.wait_to_response)} ticks · response startup: <b>{show(movePhase.response_startup)} elapsed / {show(movePhase.response_startup_inclusive)} including first active</b>. Waiting for the opponent is separate from the response attack.</p>}
      {movePhase.limitation&&<p>{movePhase.limitation}</p>}</div>}
    {landing?.landing_frame!==null&&landing?.landing_frame!==undefined&&<div className="phase-detail"><strong>Air attack / landing</strong><p>Contact height: {show(landing.contact_height)} game units · landing frame {landing.landing_frame+1} · grounded control ready {landing.control_ready_frame===null?'unobserved':landing.control_ready_frame+1} · observed landing control delay <b>{show(landing.recovery)}f</b>.</p><p>The remaining flight after an air attack is separate from landing recovery. This is one jump/input-height setup; it does not establish the earliest next attack for every height.</p></div>}
    <details><summary>How stun works</summary><p>The defender has a character/mode capacity and a remaining stun resource. Native byte underflow primes a follow-up window; a later qualifying hit can start the dizzy response. Zero remaining alone is not the threshold test. Stun loss here comes from captured resource changes; a reset/overflow stays unknown until an instruction sample resolves it. It is not calculated from HP damage or the defence multiplier.</p></details>
  </section>;
}
