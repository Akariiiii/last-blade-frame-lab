import test from 'node:test';
import assert from 'node:assert/strict';
import { guardWikiBasis, numeric,guardTrialEvidence } from './guard.ts';
test('wiki guard identity distinguishes numerical agreement from missing conditions', () => {
  assert.equal(guardWikiBasis(-1,-7,-7),'switch_guard_value_matches');
  assert.equal(guardWikiBasis(-5,-11,-11),'switch_guard_value_matches');
  assert.equal(guardWikiBasis(-1,null,-7),'guard_policy_unresolved');
  assert.equal(guardWikiBasis(-1,-7,-1),'held_guard_value_matches');
  assert.equal(guardWikiBasis(-1,-1,-1),'both_values_match');
  assert.equal(guardWikiBasis(-1,-7,-4),'neither_value_matches');
  assert.equal(guardWikiBasis(-1,-7,null),'no_numeric_reference');
  assert.equal(numeric(null),null);assert.equal(numeric(''),null);assert.equal(numeric(0),0);
});
test('single-run and explicit provisional guard evidence cannot look repeat-verified',()=>{
 assert.equal(guardTrialEvidence({repetitions:1,pacings:[4]}),'Single run · provisional');
 assert.equal(guardTrialEvidence({repetitions:3,pacings:[4,4,4]}),'Single run · provisional');
 assert.equal(guardTrialEvidence({repetitions:3,pacings:[1,2,4],verification_status:'provisional'}),'Single run · provisional');
 assert.equal(guardTrialEvidence({repetitions:3,pacings:[1,2,4]}),'3 runs · repeat-checked');
});
