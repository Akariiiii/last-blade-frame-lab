import assert from 'node:assert/strict';
import test from 'node:test';
import {timingText,hasTimingValue,comparisonReadout,repeatVerified,sameCaptureObserved,sameCaptureLabel} from './timing.ts';
test('contact bounds never become exact startup or invented active durations',()=>{
  const values={Startup:null,StartupUpperBound:25,Active:null,CapturedActive:14};
  assert.equal(timingText(values,'Startup'),'≤25');
  assert.equal(timingText(values,'Active'),null);
  assert.equal(hasTimingValue(values,'Active'),false);
  assert.equal(timingText({Startup:0,StartupUpperBound:25},'Startup'),'0');
  assert.equal(timingText({Startup:null,StartupUpperBound:null},'Startup'),null);
});
test('missing wiki reference does not hide a measured zero or exact timing',()=>{
  assert.equal(comparisonReadout({StunDamage:0},'StunDamage').kind,'missing_reference');
  assert.equal(comparisonReadout({Startup:null,StartupUpperBound:25},'Startup').kind,'review');
  assert.equal(comparisonReadout({Startup:null},'Startup').kind,'unavailable');
  assert.equal(comparisonReadout({Startup:4},'Startup',{status:'needs_review',measured:4,wiki:4,raw:['4'],reason:'clock'}).kind,'review');
});
test('repeat status and original source equality are both required',()=>{
  const evidence={status:'verified' as const,repetitions:3,pacings:[1,2,4],source_match:true,added_actor_frames:[47],added_projectile_frames:[],evidence_url:'/data/proof.json',clock:'source animation / independent projectile ticks' as const};
  assert.equal(repeatVerified(evidence),true);
  assert.equal(repeatVerified({...evidence,source_match:false}),false);
  assert.equal(repeatVerified({...evidence,status:'different'}),false);
});
test('same-capture samples require pinned identity and retain a single-run label',()=>{
  const evidence={status:'observed_same_capture' as const,repetitions:1,pacings:[4],source_match:true,
    added_actor_frames:[24],proof_sha256:'a'.repeat(64),original_ram_sha256:'b'.repeat(64),
    collision_hook_sha256:'c'.repeat(64),clock:'same engine frame'};
  assert.equal(sameCaptureObserved(evidence),true);
  assert.equal(sameCaptureLabel(evidence),'Native pre-response samples · same capture · 1 run');
  assert.equal(sameCaptureObserved({...evidence,source_match:false}),false);
  assert.equal(sameCaptureObserved({...evidence,proof_sha256:''}),false);
  assert.equal(sameCaptureObserved({...evidence,original_ram_sha256:'not-pinned'}),false);
  assert.equal(sameCaptureObserved({...evidence,collision_hook_sha256:''}),false);
  assert.equal(sameCaptureObserved({...evidence,repetitions:3,pacings:[1,2,4]}),false);
  assert.equal(sameCaptureLabel(undefined),null);
  assert.equal(sameCaptureObserved(undefined),false);
});
