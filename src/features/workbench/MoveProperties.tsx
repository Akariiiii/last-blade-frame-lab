/** Conditional original-ROM observations; never turn sparse trials into booleans. */
export interface MovePropertyObservation {
  property:string;status:string;value:string;outcome?:string;scope?:string;
  recording?:string;source_recording?:string;posture?:string;frame0?:number;
  native_predicate_cpu?:string;conditions?:string[];evidence_sha256?:string[];
  native?:{input_context:number;control:number;raw_control:number;handler_cpu:string;
    normal_destinations:{script:number;inputs:string[]}[]};
  input?:{direction:string;buttons:string;delay:number;frames:number};
}
export interface MovePropertyGroup {
  selector:number;character:string;mode:string;move:string;category:string;
  attack_property_applicability:string;
  properties:MovePropertyObservation[];
  native_dispatch_contract?:{conditions:string[];scope:string};
  remaining_class_ids?:Record<string,string[]>;
  remaining?:Record<string,{status:string;contexts:number;scope:string}>;
}
export interface MovePropertyRegistry {
  schema_version:number;frame_index_base:number;scope:string;class_scope:string;
  completion_status?:'incomplete_research'|'scoped_complete';
  groups:Record<string,MovePropertyGroup>;
  summary:{catalogue_groups:number;applicable_attack_groups:number;
    pending_probe_signature_classes:Record<string,number>};
}

export interface MovePropertyManifest extends Omit<MovePropertyRegistry,'groups'> {
  shards:Record<string,{url:string;sha256:string;bytes:number;groups:number}>;
}
export interface MovePropertyShard {
  schema_version:number;selector:number;mode:string;frame_index_base:number;
  fixed_cpu_sha256:string;groups:Record<string,MovePropertyGroup>;
}

const names:Record<string,string>={
  guard_response:'Guard response',guard_posture_pair:'Guard postures',
  techability:'Recovery / tech',knockdown_trajectory:'Target trajectory',
  required_target_state:'Target requirement',required_target_observation:'Target state',
  cancelability:'Cancel research',cancel_native_dispatch:'Native input dispatch',
  guard_native_matrix:'Native guard response',guard_profile_details:'Captured guard profiles',
  recovery_lookup_candidates:'Native recovery candidates',attack_properties:'Applicability',
};
const statuses:Record<string,string>={
  native_derived:'Native code',runtime_observed:'Recorded',
  runtime_confirmed:'Input verified',repeat_verified_fixture:'3 runs · full match',
  not_applicable:'Not applicable',not_applicable_to_observed_context:'This target context',
  not_tested:'Not measured',inconclusive:'Needs review',
};

export default function MoveProperties({group,outcome}:{group?:MovePropertyGroup;outcome:string}) {
  if(!group)return null;
  const selected=group.properties.filter(p=>!p.outcome||p.outcome===outcome);
  const rows=new Map<string,{property:MovePropertyObservation;recordings:Set<string>}>();
  for(const property of selected){
    const key=[property.property,property.value,property.posture,property.source_recording,property.status,JSON.stringify(property.native||null)].join('|');
    const row=rows.get(key)||{property,recordings:new Set<string>()};
    if(property.recording)row.recordings.add(property.recording);
    rows.set(key,row);
  }
  const pending=group.remaining
    ?Object.entries(group.remaining).map(([family,value])=>[family,value.contexts] as const).filter(([,count])=>count>0)
    :Object.entries(group.remaining_class_ids||{}).map(([family,ids])=>[family,ids.length] as const).filter(([,count])=>count>0);
  return <details className="contact-detail" aria-label="Conditional move properties">
    <summary>Move properties · {outcome}</summary>
    <p>These values belong to the stated target, input and phase. A recorded result is separate from a native permission rule. “Not observed” does not mean impossible.</p>
    {group.native_dispatch_contract&&<details><summary>Native dispatch conditions</summary>
      <p>{group.native_dispatch_contract.scope}</p>
      <ul>{group.native_dispatch_contract.conditions.map(condition=><li key={condition}>{condition}</li>)}</ul>
    </details>}
    <div className="contact-table-scroll"><table>
      <thead><tr><th>Property</th><th>Observed value / condition</th><th>Evidence</th></tr></thead>
      <tbody>{Array.from(rows.entries()).map(([key,{property:p,recordings}])=><tr key={key} title={p.scope}>
        <th>{names[p.property]||p.property}</th>
        <td>{p.posture&&`${p.posture} · `}{p.value}
          {p.native&&<div className="metric-note">Input context {p.native.input_context.toString(16).toUpperCase()} · controller {p.native.control} · {p.native.handler_cpu}
            {p.native.normal_destinations.length>0&&<details><summary>Normal lookup candidates · {p.native.normal_destinations.length} destinations</summary>
              {p.native.normal_destinations.map(route=><div key={route.script}>{route.inputs.join(', ')} → native {route.script.toString(16).toUpperCase()}</div>)}
              <p>Lookup candidates require the stated gates and real input. They are not physically confirmed cancels.</p>
            </details>}</div>}
          {p.conditions&&p.conditions.length>0&&<div className="metric-note">{p.conditions.join(' · ')}</div>}
          {p.input&&<small> · input {p.input.direction}{p.input.buttons} at +{p.input.delay}f</small>}
          {p.scope&&<div className="metric-note">{p.scope}</div>}</td>
        <td title={Array.from(recordings).join('\n')}>{statuses[p.status]||p.status}
          {recordings.size>1&&<div>{recordings.size} trials</div>}</td>
      </tr>)}</tbody>
    </table></div>
    {pending.length>0&&<p>Still awaiting native review or input tests: {pending.map(([family,count])=>`${family.replaceAll('_',' ')} (${count} candidate contexts)`).join('; ')}. Candidate contexts are a research inventory, not proven interchangeable moves.</p>}
  </details>;
}
