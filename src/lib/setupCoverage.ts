export const contactStates=['hit','block','whiff'] as const;
export type ContactState=typeof contactStates[number];
type Value=string|number|boolean|null;
export interface SetupImage {id:string;outcome:string;primary:boolean;opponent_air:boolean;guard_policy:string|null;values:Record<string,Value>}
export interface SetupTrial {
 id:string;source_recording:string;requested:string;outcome:string;kind:'ground'|'guard';
 guard_policy:string|null;guard_direction?:string;values:Record<string,Value>;
 phase:string|null;repetitions:number;pacings:number[];repeat_equal:boolean;provisional:boolean;
}
export interface SetupGroup {images:SetupImage[];trials:SetupTrial[];states:Record<ContactState,{image_count:number;trial_count:number;repeat_matched_count:number}>}
export interface SetupRegistry {groups:Record<string,SetupGroup>}
export const setupKey=(selector:number,mode:string,move:string)=>`${selector}|${mode}|${move}`;
export function imageForState(group:SetupGroup,state:ContactState):SetupImage|undefined {
 const images=group.images.filter(i=>i.outcome===state);
 return images.find(i=>i.primary)||images[0];
}
export function trialsForState(group:SetupGroup,state:ContactState):SetupTrial[] {
 // A requested whiff that hit never counts as a whiff observation.
 return group.trials.filter(t=>t.outcome===state).sort((a,b)=>Number(b.repeat_equal)-Number(a.repeat_equal)||a.id.localeCompare(b.id));
}
export function stateReadout(group:SetupGroup,state:ContactState):string {
 const images=group.images.filter(i=>i.outcome===state).length;
 const trials=trialsForState(group,state).length;
 return images?`${images} image clip${images===1?'':'s'}${trials?` + ${trials} RAM trial${trials===1?'':'s'}`:''}`:trials?`${trials} RAM trial${trials===1?'':'s'} · no image clip`:'Missing · no confirmed observation';
}
