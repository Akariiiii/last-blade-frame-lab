export interface ChargeWait {
  init_frame0:number;exit_frame0:number;iteration_calls:number;native_operand:number;
  exit_observation:string;
}
export interface ChargeTrial {
  id:string;source_recording:string;input_label:string;requested_condition:string;
  outcome:string;hold_frames:number;initial_buttons:string;held_buttons:string;
  guard_direction:string|null;guard_posture:string|null;guard_input_valid:boolean|null;
  damage:number|null;stun_depletion:number|null;stun_capacity:number|null;
  entry_frame:number|null;physical_first_frame:number|null;physical_release_frame:number|null;
  first_sampled_active_frame:number|null;contact_frame:number|null;
  release_to_sampled_activity:number|null;source_ready_frame:number|null;
  native_waits:ChargeWait[];geometry_coverage:string;timing_review:string;
  verification_status:string;repetitions:number;pacings:number[];full_bundle_equal:boolean;
}
export interface ChargeRegistry {groups:Record<string,ChargeTrial[]>}
export type ChargeSetup='hit'|'whiff'|'standing'|'crouching'|'all';
export function chargeTrialKey(selector:number,mode:string,catalogId:string):string {
  return `${selector}|${mode}|${catalogId}`;
}
export function chargeEvidence(trial:Pick<ChargeTrial,'verification_status'|'repetitions'|'pacings'|'full_bundle_equal'>):string {
  return trial.verification_status==='repeat_verified_fixture'&&trial.full_bundle_equal&&trial.repetitions>=3&&[1,2,4].every(p=>trial.pacings.includes(p))?'3 runs · full match':'Needs review';
}
export function chargeTrialsForSetup(trials:ChargeTrial[],setup:ChargeSetup):ChargeTrial[] {
  return trials.filter(t=>setup==='all'||(setup==='standing'||setup==='crouching'?t.guard_posture===setup:!t.guard_posture&&t.requested_condition===setup))
    .sort((a,b)=>a.input_label.localeCompare(b.input_label)||a.hold_frames-b.hold_frames||a.held_buttons.localeCompare(b.held_buttons)||a.id.localeCompare(b.id));
}
export function chargeFrame(value:number|null):string {return value===null?'—':String(value+1);}
