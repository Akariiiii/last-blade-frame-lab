import type {Entry} from './native/types.ts';
import type {Mode} from '../types/reference.ts';
import {contactStates, setupKey, trialsForState, type ContactState, type SetupRegistry} from './setupCoverage.ts';
import type {TimingComparison} from './timing.ts';

export type SummaryValues = Record<string, string | number | boolean | null>;
export interface SummaryMetric {
  canonical_move: string;
  default_visible: boolean;
  primary_recording: boolean;
  values: SummaryValues;
  comparison?: {fields: Record<string, TimingComparison>};
}
export interface SummaryAttempt {
  mode: Mode;
  outcome: ContactState;
  values?: SummaryValues;
  comparisons?: Record<string, TimingComparison>;
  source?: string;
  evidence: 'clip' | 'repeat-trial' | 'trial' | 'missing';
  guard: Partial<Record<'held' | 'release' | 'switch', number>>;
}

/** Each cell uses one whole attempt. Never fill its gaps from another outcome/mode. */
export function moveSummary(entries: Entry[], metrics: Record<string, SummaryMetric>, registry: SetupRegistry | null,
  selector: number, move: string): SummaryAttempt[] {
  return (['power','speed','ex'] as const).flatMap(mode=>{
    const candidates=entries.filter(e=>e.selector_id===selector&&e.mode===mode&&
      metrics[e.id]?.canonical_move===move&&metrics[e.id].default_visible);
    const group=registry?.groups[setupKey(selector,mode,move)];
    return contactStates.map(outcome=>{
      const matching=candidates.filter(e=>metrics[e.id].values.Setup===outcome);
      const entry=matching.find(e=>metrics[e.id].primary_recording)||matching[0];
      const metric=entry&&metrics[entry.id];
      const trial=group&&trialsForState(group,outcome)[0];
      const guard:SummaryAttempt['guard']={};
      if(outcome==='block') {
        // Guard policies are independent trials, not aliases of generic BlockAdvantage.
        for(const policy of ['held','release','switch'] as const) {
          const field={held:'HeldGuardAdvantage',release:'ReleasedGuardAdvantage',switch:'SwitchGuardAdvantage'}[policy];
          const explicit=metric?.values[field];
          if(typeof explicit==='number')guard[policy]=explicit;
          else {
            const image=matching.find(e=>metrics[e.id].values.GuardPolicy===policy);
            const imageValue=image&&metrics[image.id].values.BlockAdvantage;
            const t=group&&trialsForState(group,'block').find(t=>t.guard_policy===policy);
            const value=typeof imageValue==='number'?imageValue:t?.values.BlockAdvantage;
            if(typeof value==='number')guard[policy]=value;
          }
        }
      }
      return {mode,outcome,values:metric?.values||trial?.values,comparisons:metric?.comparison?.fields,
        source:entry?.id||trial?.id,evidence:entry?'clip':trial?.repeat_equal?'repeat-trial':trial?'trial':'missing',guard};
    });
  });
}
