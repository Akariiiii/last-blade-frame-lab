import {comparisonReadout,hasTimingValue,timingText,type TimingComparison}from '../../lib/timing.ts';
import {outcomeFields,throwWhiffDuration,type MoveOutcome}from '../../lib/moveSelection.ts';
type Value=string|number|boolean|null;
const text=(v:Value|undefined,signed=false)=>v===null||v===undefined||v===''?'—':`${signed&&typeof v==='number'&&v>0?'+':''}${v}`;
const labels:Record<string,string>={HitAdvantage:'On hit',BlockAdvantage:'On block',MeterGain:'Meter',StunDamage:'Stun'};
export default function MoveStats({values,comparisons,outcome}:{values:Record<string,Value>;comparisons?:Record<string,TimingComparison>;outcome:MoveOutcome}) {
 return <div className="stats-row measured-stats" aria-label={`${outcome} move statistics`}>{outcomeFields(outcome).map(field=>{
  const duration=field==='Recovery'?throwWhiffDuration(values,outcome):null;
  const comparison=outcome==='whiff'&&['Damage','MeterGain','StunDamage','HitAdvantage'].includes(field)?undefined:comparisons?.[field];
  const scopedComparison=duration===null?comparison:undefined;
  const readout=comparisonReadout(values,field,scopedComparison);
  return <div className={`stat ${readout.kind==='different'?'stat-different':readout.kind==='match'?'stat-match':''}`} key={field}>
   <span>{duration!==null?'Whiff duration':outcome==='whiff'&&field==='HitAdvantage'?'Advantage':labels[field]||field}</span>
   <strong>{duration!==null?String(duration):timingText(values,field)??text(values[field],field.includes('Advantage'))}{(duration!==null||hasTimingValue(values,field))&&<em>f</em>}</strong>
   {duration!==null&&<small>Entry → control ready</small>}
   {field==='Startup'&&values.StartupInclusive!=null&&<small>{String(values.StartupInclusive)}f including first active</small>}
   {field==='StunDamage'&&<small>Observed stun loss</small>}
   {field==='Damage'&&outcome==='block'&&<small>Chip damage</small>}
   <small>Wiki: {scopedComparison?.raw.join(' / ')||'—'}</small>
   <small>{duration!==null?'Whole attempt · grab window separate':outcome==='whiff'&&field==='HitAdvantage'?'No contact':readout.label}</small>
  </div>;
 })}</div>;
}
