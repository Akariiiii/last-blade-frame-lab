import type {CharacterData} from '../../types/reference.ts';
import type {StunResearchData} from './StunResearch';
import CharacterPortrait from '../reference/CharacterPortrait';

const scale=(value:number|undefined)=>value===undefined?'—':`${(value/256).toFixed(2)}×`;
export default function CharacterOverview({character,name,selector,research}:{character?:CharacterData;name?:string;selector:number;research:StunResearchData|null}) {
 const comparisons=research?.defender_comparisons?.filter(c=>c.selector===selector)||[];
 return <section className="character-overview" aria-label="Character overview">
  <div className="character-overview-heading"><div className="character-identity"><CharacterPortrait character={character?.character} name={name}/><div><span className="eyebrow">CHARACTER OVERVIEW</span><h2>{name||character?.character.name||'Loading character…'}</h2></div></div><span>HP <b>—</b><small>Maximum not verified in this dataset</small></span></div>
  <div className="character-stat-grid">{(['power','speed','ex'] as const).map(mode=>{
   const measured=comparisons.find(c=>c.defender_mode===mode);
   return <div className={`character-mode mode-${mode}`} key={mode}><strong>{mode==='ex'?'EX':mode==='power'?'Power':'Speed'}</strong><dl>
    <div><dt>Damage taken</dt><dd title={measured?`Measured native scale: ${measured.defense} / 256`:'No measured defender scale for this mode'}>{scale(measured?.defense)}</dd></div>
    <div><dt>Stun capacity</dt><dd>{measured?.capacity??'—'}</dd></div>
    <div><dt>Attack scale</dt><dd title="ROM reference multiplier; this is not the complete damage formula">{scale(character?.attackQ8[mode])}</dd></div>
   </dl></div>;
  })}</div>
  <p>Damage taken: lower means less HP loss. Stun capacity is separate from HP scaling. Attack scales are ROM references; defender values come from measured neutral fixtures.</p>
  <details><summary>Character notes and measurement limits</summary><p>{selector===18?'Hagure keeps its initialized defensive stats after transforming; the copied appearance does not select its stun capacity. ':''}Stun first depletes the gauge, then primes a follow-up window before dizziness. Move results depend on contact height, spacing, guard and target state. Character-specific mechanics without confirmed data remain undocumented.</p></details>
 </section>;
}
