import type {Entry}from './native/types.ts';
import type {ContactState}from './setupCoverage.ts';
export type MoveOutcome=ContactState|'mixed'|'unresolved';
type Value=string|number|boolean|null;
interface ClipMetric {values:Record<string,Value>;primary_recording:boolean;default_visible?:boolean}
/** Never substitute a different contact state when an image is missing. */
export function recordingsForOutcome(entries:Entry[],metrics:Record<string,ClipMetric>,outcome:MoveOutcome,allVariants=false):Entry[] {
 const matching=entries.filter(e=>metrics[e.id]?.values.Setup===outcome&&(allVariants||metrics[e.id].default_visible!==false));
 const primary=matching.filter(e=>metrics[e.id].primary_recording);
 return allVariants||!primary.length?matching:primary;
}
export function selectedRecording(entries:Entry[],selected:string):Entry|undefined {
 return entries.find(e=>e.id===selected)||entries[0];
}
export function outcomeFields(outcome:MoveOutcome):string[] {
 return ['Startup','Active','Recovery','Damage',outcome==='block'?'BlockAdvantage':'HitAdvantage','MeterGain','StunDamage'];
}
/** Whiff has no defender contact, therefore no hit/block advantage. */
export function outcomeValues(values:Record<string,Value>|undefined,outcome:MoveOutcome):Record<string,Value> {
 return outcome==='whiff'?{...values,HitAdvantage:null,BlockAdvantage:null}:values||{};
}

/** A throw's complete failed attempt must not masquerade as post-active recovery. */
export function throwWhiffDuration(values:Record<string,Value>,outcome:MoveOutcome):number|null {
 return outcome==='whiff'&&values.TimingScope==='throw_whiff_trial'&&typeof values.WhiffAttemptDuration==='number'?values.WhiffAttemptDuration:null;
}
