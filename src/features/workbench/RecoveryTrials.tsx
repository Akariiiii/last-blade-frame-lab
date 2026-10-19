import {dataUrl} from '../../lib/data.ts';

export interface RecoveryTrial {
  recording:string;source:string;family:string;
  protocol:{direction:string;buttons:string;delay:number;frames:number};
  gate_frame0:number;first_input_frame0:number;gate_context:number;
  recovery_admitted:{frame0:number;script:number;state:number;height:number;x:number}|null;
  defender_ready_frame0:number|null;repetitions:number;pacings:number[];
  verification_status:string;full_bundle_equal:boolean;
}
export interface RecoveryRegistry {captures:number;trials:number;groups:Record<string,RecoveryTrial[]>}
const names:Record<string,string>={ground_roll:'Ground roll',air_recovery:'Air recovery',bounce_recovery:'Bounce recovery'};
const frame=(value:number|null)=>value===null?'—':String(value+1);

export default function RecoveryTrials({trials,csvUrl}:{trials?:RecoveryTrial[];csvUrl?:string}) {
  if(!trials?.length)return null;
  return <details className="contact-detail" aria-label="Defender recovery tests">
    <summary>Defender recovery tests · {trials.length} input conditions</summary>
    <p>Separate hit trials against Kaede. Inputs begin at an observed native recovery window. Frames below belong to those trials, not the selected clip. An input with no observed recovery does not prove the move is universally untechable. Throw breaks are not tested here.</p>
    <div className="contact-table-scroll"><table><thead><tr><th>Recovery</th><th>Defender input</th><th>Delay</th><th>Eligible frame</th><th>Input frame</th><th>Recovery admitted</th><th>Ground ready</th><th>Evidence</th></tr></thead>
      <tbody>{trials.map(t=><tr key={t.recording} title={t.recording}>
        <th>{names[t.family]||t.family}</th><td>{t.protocol.direction==='5'&&!t.protocol.buttons?'No recovery input':`${t.protocol.direction}${t.protocol.buttons}`}</td>
        <td>{t.protocol.delay}f</td><td>{frame(t.gate_frame0)}</td><td>{frame(t.first_input_frame0)}</td>
        <td>{t.recovery_admitted?`${frame(t.recovery_admitted.frame0)} · ${t.family==='ground_roll'?'roll':t.family==='air_recovery'?'air recovery':'bounce recovery'}`:'Not observed'}</td>
        <td>{frame(t.defender_ready_frame0)}</td><td>{t.verification_status==='repeat_verified_fixture'&&t.full_bundle_equal&&t.repetitions>=3&&[1,2,4].every(p=>t.pacings.includes(p))?'3 runs · full match':'Needs review'}</td>
      </tr>)}</tbody></table></div>
    {csvUrl&&<a href={dataUrl(csvUrl)} download>Recovery tests CSV ↗</a>}
  </details>;
}
