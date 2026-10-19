export interface MovementTrial {
  recording:string;selector:number;mode:string;label:string;
  max_height:number;airborne_snapshots:number;travel_x:number;
  takeoff_frame0:number;peak_frame0:number;landing_frame0:number;
  landing_control_frame0:number;landing_control_delay:number;
  verification:string;
  super_jump_comparison:{recording:string;label:string;equal_observables:boolean;compared_fields:string[]}|null;
}
export interface MovementRegistry {
  schema_version:number;trajectories:number;
  clips:Record<string,MovementTrial>;groups:Record<string,string>;
}

export default function MovementReadout({trial,recording,onSeek}:{
  trial?:MovementTrial;recording?:string;onSeek?:(frame0:number)=>void;
}) {
  // Never attach one retained trajectory's markers to another image variant.
  if(!trial||trial.recording!==recording)return null;
  const marker=(label:string,value:number)=><span key={label}>{label}{' '}
    {onSeek?<button type="button" onClick={()=>onSeek(value)} aria-label={`${label}: frame ${value+1}`}>{value+1}</button>:<b>{value+1}</b>}
  </span>;
  const comparison=trial.super_jump_comparison;
  return <section className="contact-detail" aria-label="Jump trajectory">
    <h2>Jump trajectory</h2>
    <div className="contact-table-scroll"><table><thead><tr>
      <th>Maximum height</th><th>Airborne frames</th><th>Horizontal travel</th><th>Landing → control flag</th>
    </tr></thead><tbody><tr>
      <td>{trial.max_height} units</td><td>{trial.airborne_snapshots}f</td>
      <td>{trial.travel_x>0?'+':''}{trial.travel_x} units</td><td>{trial.landing_control_delay}f</td>
    </tr></tbody></table></div>
    <div className="frame-boundaries">
      {marker('Takeoff',trial.takeoff_frame0)}{marker('Peak',trial.peak_frame0)}
      {marker('Landing',trial.landing_frame0)}{marker('Control flag restored',trial.landing_control_frame0)}
    </div>
    <p>Measured from this saved recording in native game units. Airborne frames count snapshots above the ground. Control restored is an observed flag; it does not establish the earliest frame another attack can start.</p>
    {comparison&&<p title={comparison.recording}>
      {comparison.equal_observables?'Same measured height, airtime, travel and landing control delay':'Different measured trajectory'}
      {' as '}{comparison.label.replaceAll('-',' ')} in this character and mode.
      {' '}This compares two saved trajectories; it does not establish identical input behavior or full trace equivalence.
    </p>}
  </section>;
}
