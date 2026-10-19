import test from 'node:test';
import assert from 'node:assert/strict';
import {chargeEvidence,chargeFrame,chargeTrialKey,chargeTrialsForSetup,type ChargeTrial}from './charge.ts';
test('charge proof requires full bundle and all three distinct pacings',()=>{
 const proof={verification_status:'repeat_verified_fixture',repetitions:3,pacings:[1,2,4],full_bundle_equal:true};
 assert.equal(chargeEvidence(proof),'3 runs · full match');
 assert.equal(chargeEvidence({...proof,pacings:[4,4,4]}),'Needs review');
 assert.equal(chargeEvidence({...proof,full_bundle_equal:false}),'Needs review');
 assert.equal(chargeEvidence({...proof,verification_status:'provisional'}),'Needs review');
});
test('charge setup filter preserves requested-whiff that actually hit',()=>{
 const base={id:'a',input_label:'21416B',hold_frames:97,held_buttons:'B',requested_condition:'hit',guard_posture:null}as ChargeTrial;
 const far={...base,id:'far',requested_condition:'whiff',outcome:'hit'};
 const guard={...base,id:'guard',guard_posture:'crouching'};
 assert.deepEqual(chargeTrialsForSetup([far,guard,base],'hit').map(t=>t.id),['a']);
 assert.deepEqual(chargeTrialsForSetup([far,guard,base],'whiff').map(t=>t.id),['far']);
 assert.deepEqual(chargeTrialsForSetup([far,guard,base],'crouching').map(t=>t.id),['guard']);
 assert.equal(chargeTrialsForSetup([far,guard,base],'all').length,3);
});
test('independent charge keys preserve selector identity and frame zero',()=>{
 assert.equal(chargeTrialKey(18,'power','00:input:B+C'),'18|power|00:input:B+C');
 assert.equal(chargeFrame(0),'1');assert.equal(chargeFrame(null),'—');
});
