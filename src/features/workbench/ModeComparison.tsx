import type {Mode} from '../../types/reference.ts';
import type {SummaryAttempt} from '../../lib/modeSummary.ts';
import type {ContactState} from '../../lib/setupCoverage.ts';
import {comparisonReadout, timingText} from '../../lib/timing.ts';
import {throwWhiffDuration} from '../../lib/moveSelection.ts';

const number=(value:unknown,signed=false)=>typeof value==='number'?`${signed&&value>0?'+':''}${value}`:'—';
const sourceLabel={clip:'Image clip', 'repeat-trial':'Repeat-checked RAM trial', trial:'Provisional RAM trial', missing:'No measurement'};
function Value({row,field}:{row:SummaryAttempt;field:string}) {
  const c=row.outcome==='whiff'&&['Damage','MeterGain','StunDamage','HitAdvantage'].includes(field)?undefined:row.comparisons?.[field];
  const readout=comparisonReadout(row.values,field,c);
  const duration=field==='Recovery'?throwWhiffDuration(row.values||{},row.outcome):null;
  const value=duration??timingText(row.values,field)??row.values?.[field];
  const display=typeof value==='string'?value:number(value,field.includes('Advantage'));
  const title=[sourceLabel[row.evidence],row.source,readout.label,c?.raw.length?`Wiki: ${c.raw.join(' / ')}`:'',
    row.values?.TimingScope,row.values?.TimingReview].filter(Boolean).join(' · ');
  return <td className={duration===null?`summary-${readout.kind}`:''} title={title}>
    <span>{display}</span>
    {duration!==null&&<small>whole whiff</small>}
    {field==='Recovery'&&typeof row.values?.ReboundRecovery==='number'&&<small>Rebound {row.values.ReboundRecovery}f</small>}
    {field==='Startup'&&typeof row.values?.StartupInclusive==='number'&&<small>{row.values.StartupInclusive} incl.</small>}
  </td>;
}
export default function ModeComparison({rows,mode,outcome,onSelect}:{rows:SummaryAttempt[];mode:Mode;outcome:string;onSelect:(mode:Mode,outcome:ContactState)=>void}) {
 return <section className="mode-comparison" aria-label="All modes frame data">
  <div className="comparison-heading"><h2>Frame data · all modes</h2><span>Click an outcome to view its recording</span></div>
  <div className="mode-table-scroll"><table><thead><tr><th>Mode</th><th>Outcome</th><th>Startup</th><th>Active</th><th>Recovery</th><th>Damage</th><th>Stun</th><th>Meter</th><th>On hit</th><th>On block <small>Held / Released / Switch</small></th></tr></thead>
   <tbody>{rows.map((row,i)=><tr key={`${row.mode}-${row.outcome}`} className={`${i%3===0?'mode-group-start ':''}${mode===row.mode&&outcome===row.outcome?'selected-attempt':''}`}>
    {i%3===0&&<th scope="rowgroup" rowSpan={3} className={`mode-label mode-${row.mode}`}>{row.mode==='ex'?'EX':row.mode==='power'?'Power':'Speed'}</th>}
    <th scope="row"><button aria-label={`View ${row.mode} ${row.outcome} recording`} aria-pressed={mode===row.mode&&outcome===row.outcome} onClick={()=>onSelect(row.mode,row.outcome)} title={`${sourceLabel[row.evidence]}${row.source?` · ${row.source}`:''}`}><i className={`summary-source ${row.evidence}`}/>{row.outcome}<small>{row.evidence==='missing'?'No data':row.evidence==='clip'?'Clip':row.evidence==='repeat-trial'?'RAM ✓':'RAM · provisional'}</small></button></th>
    {['Startup','Active','Recovery','Damage','StunDamage','MeterGain'].map(field=><Value key={field} row={row} field={field}/>)}
    {row.outcome==='hit'?<Value row={row} field="HitAdvantage"/>:<td>—</td>}
    <td className="guard-summary">{row.outcome==='block'?<>{(['held','release','switch'] as const).map((policy,index)=><span key={policy} title={`${policy} guard advantage`}>{index>0&&<em> / </em>}{number(row.guard[policy],true)}</span>)}</>:'—'}</td>
   </tr>)}</tbody>
  </table></div>
  <p className="summary-legend">Frames exclude identified hitpause. Startup also shows first-active-inclusive count. Damage on block is chip. Red = wiki disagreement; hover for source and comparison. Missing values stay —. Primary setups are shown; variants remain below. Separate recordings are not universal move constants.</p>
 </section>;
}
