import { guardWikiBasis, numeric } from '../../lib/guard.ts';
import { dataUrl } from '../../lib/data.ts';
export interface GuardSource {
  id: string; method: string; limitation: string; attacker_ready_frame: number; defender_ready_frame: number;
  source_csv: string; source_line_start: number; source_line_end: number;
}
type Value = string | number | boolean | null;
export default function GuardComparison({ values, wiki, wikiRaw, switchValue, source, recording, mode, evidenceUrl, onViewHeld }: {
  values?: Record<string, Value>; wiki: number | null; wikiRaw: string; switchValue: number | null;
  source?: GuardSource; recording?: string; mode: string; evidenceUrl?: string; onViewHeld?: () => void;
}) {
  const held=numeric(values?.HeldGuardAdvantage), recoil=numeric(values?.ReboundRecovery);
  const basis=guardWikiBasis(held,switchValue,wiki);
  const format=(n:number|null,signed=true)=>n===null?'—':signed&&n>0?`+${n}`:String(n);
  const descriptions={
    no_numeric_reference:'No single numeric wiki block value is available for this move/part.',
    both_values_match:'The wiki number matches both guard results; its guard policy cannot be distinguished.',
    switch_guard_value_matches:'Wiki number matches switch guard in the retained trial. Its guard policy is inferred from this match.',
    held_guard_value_matches:'Wiki number matches held guard. This alone does not establish the wiki guard policy.',
    neither_value_matches:'Neither measured guard value matches the wiki number. Review the conditions and readiness method.',
    guard_policy_unresolved:'Switch guard has not been measured for this context; the wiki guard policy remains unresolved.',
  };
  return <section className="guard-comparison" aria-label="Guard and rebound measurements">
    <div className="guard-heading"><h2>Guard and rebound</h2><span>Advantage and recovery are separate measurements</span></div>
    <div className="guard-stats">
      <div className="guard-stat"><span>Held guard advantage</span><strong>{format(held)}{held!==null&&<em>f</em>}</strong><small>{held===null?'Not measured for this setup':'Defender ready − attacker ready, with guard held'}</small>{onViewHeld&&<button onClick={onViewHeld}>View held-guard recording</button>}</div>
      <div className={`guard-stat ${basis==='switch_guard_value_matches'?'guard-reference-match':''}`}><span>Switch guard advantage</span><strong>{format(switchValue)}{switchValue!==null&&<em>f</em>}</strong><small>{source?'Separate retained RAM trial · normal-dispatch readiness':'Not measured for this character/mode/context'}</small>{basis==='switch_guard_value_matches'&&<b className="guard-match-label">Matches wiki block value</b>}</div>
      <div className="guard-stat"><span>Rebound recovery</span><strong>{format(recoil,false)}{recoil!==null&&<em>f</em>}</strong><small>{recoil!==null?'Rebound response entry → attacker control-ready, excluding source hitpause':mode==='power'?'No measured rebound in this setup':'Power weapon rebound does not apply to this mode'}</small></div>
    </div>
    <p className={`guard-wiki ${basis==='neither_value_matches'?'guard-difference':''}`}><b>Wiki on block: {wikiRaw||'—'}</b> {descriptions[basis]}</p>
    <p className="guard-note">Held guard keeps the same stance; switch guard changes standing ↔ crouching after the block reaction. Rebound recovery measures the attacker’s weapon bounce. The wiki Recovery column is attack recovery. Each trial uses its own frame indices.</p>
    <details><summary>Guard measurement sources</summary>
      <p>Held guard: {recording||'not recorded'}{held!==null&&<> · attacker ready {String(values?.ActionableFrame)} / defender ready {String(values?.DefenderReadyFrame)} (CSV indices, 0-based).</>}</p>
      {source&&<p>Switch guard: {source.source_csv}, rows {source.source_line_start}–{source.source_line_end}. Attacker animation exit {source.attacker_ready_frame}; defender normal dispatch {source.defender_ready_frame}. {source.limitation}</p>}
      {recoil!==null&&<p>Rebound response starts at {String(values?.ReboundEntryFrame)}; first rebound animation at {String(values?.ReboundAnimationFrame)}; control-ready at {String(values?.ActionableFrame)}. Animation-entry duration: {String(values?.ReboundAnimationDuration)}f. These boundaries are not interchangeable.</p>}
      {source&&evidenceUrl&&<a href={dataUrl(evidenceUrl)} download="guard-evidence.json">Export switch-guard RAM evidence</a>}
    </details>
  </section>;
}
