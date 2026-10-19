import {dataUrl}from '../../lib/data.ts';

interface LandingTrial {
  recording:string;landing_frame0:number;landing_animation_frame0:number;
  baseline_neutral_frame0:number|null;requested_pulse0:number|null;
  observed_input_frame0:number|null;admission_frame0:number|null;
  repetitions:number;pacings:number[];full_bundle_equal:boolean;
}
interface LandingBoundary {
  buttons:string;earliest_tested:LandingTrial;failed_pulse_interval0:[number,number]|null;
}
interface LandingOutcome {baseline:LandingTrial;boundaries:LandingBoundary[];trials:LandingTrial[]}
export interface LandingRegistry {groups:Record<string,Partial<Record<string,LandingOutcome>>>}
const frame=(value:number|null)=>value===null?'—':String(value+1);

export default function LandingTrials({data,csvUrl}:{data?:LandingOutcome;csvUrl?:string}) {
  if(!data)return null;
  const baseline=data.baseline;
  return <details className="contact-detail" aria-label="Landing input tests">
    <summary>Landing input tests · {data.trials.length} conditions</summary>
    <p>Power jB at one recorded jump height against grounded Kaede. These are separate trials for the selected outcome. Landing, button input and the start of a new attack are distinct events. Frames belong to these trials, not the selected clip.</p>
    <p>Physical landing: frame {frame(baseline.landing_frame0)}. Landing animation: frame {frame(baseline.landing_animation_frame0)}. Neutral with no follow-up input: frame {frame(baseline.baseline_neutral_frame0)}.</p>
    <div className="contact-table-scroll"><table><thead><tr><th>Follow-up</th><th>Earliest tested pulse</th><th>Button observed</th><th>Ground attack starts</th><th>After landing</th><th>Earlier failed pulses</th><th>Evidence</th></tr></thead>
      <tbody>{data.boundaries.map(b=>{
        const t=b.earliest_tested;
        const verified=t.full_bundle_equal&&t.repetitions===3&&[1,2,4].every(p=>t.pacings.includes(p));
        return <tr key={b.buttons} title={t.recording}><th>{b.buttons}</th>
          <td>{frame(t.requested_pulse0)}</td><td>{frame(t.observed_input_frame0)}</td><td>{frame(t.admission_frame0)}</td>
          <td>{t.admission_frame0===null?'—':`${t.admission_frame0-t.landing_frame0}f`}</td>
          <td>{b.failed_pulse_interval0?`${frame(b.failed_pulse_interval0[0])}–${frame(b.failed_pulse_interval0[1])}`:'Earlier pulses not tested'}</td>
          <td>{verified?'3 runs · full match':'Needs review'}</td></tr>;
      })}</tbody></table></div>
    <p>“Earliest tested” covers the recorded pulse range. It does not establish universal landing recovery for other heights, moves or modes. BCD uses a B attack alias in these trials. Successful aerial deflect is still untested.</p>
    {csvUrl&&<a href={dataUrl(csvUrl)} download>All landing trials CSV ↗</a>}
  </details>;
}
