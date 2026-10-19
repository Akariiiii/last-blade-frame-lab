import test from 'node:test';
import assert from 'node:assert/strict';
import type {Entry}from './native/types.ts';
import {throwWhiffDuration,outcomeFields,outcomeValues,recordingsForOutcome,selectedRecording}from './moveSelection.ts';
const entries=['hit','block','whiff-alias'].map(id=>({id}as Entry));
const metrics={hit:{values:{Setup:'hit',Damage:13,StunDamage:14},primary_recording:true},block:{values:{Setup:'block',Damage:1,StunDamage:0},primary_recording:true},'whiff-alias':{values:{Setup:'whiff',Damage:0,StunDamage:0},primary_recording:false}};
test('outcome dropdown changes recording, stats source and timeline source together',()=>{
 const hit=selectedRecording(recordingsForOutcome(entries,metrics,'hit'),'');
 const block=selectedRecording(recordingsForOutcome(entries,metrics,'block'),hit!.id);
 assert.equal(block?.id,'block');assert.equal(metrics[block!.id as 'block'].values.Damage,1);
 assert.equal(metrics[block!.id as 'block'].values.StunDamage,0);
 assert.ok(outcomeFields('block').includes('BlockAdvantage'));assert.ok(!outcomeFields('block').includes('HitAdvantage'));
});
test('missing whiff images cannot fall back to a hit clip; aliases remain accessible',()=>{
 assert.equal(selectedRecording(recordingsForOutcome(entries.slice(0,2),metrics,'whiff'),'hit'),undefined);
 assert.equal(selectedRecording(recordingsForOutcome(entries,metrics,'whiff'),'hit')?.id,'whiff-alias');
});
test('whiff suppresses contact advantage without mutating source measurements',()=>{
 const source={HitAdvantage:7,BlockAdvantage:-1,Damage:0,StunDamage:0};
 assert.deepEqual(outcomeValues(source,'whiff'),{...source,HitAdvantage:null,BlockAdvantage:null});
 assert.equal(source.HitAdvantage,7);assert.ok(outcomeFields('hit').includes('StunDamage'));
});

test('default selection does not promote hidden calibration/alias recordings',()=>{
 const hidden={...metrics,'whiff-alias':{...metrics['whiff-alias'],default_visible:false}};
 assert.deepEqual(recordingsForOutcome(entries,hidden,'whiff'),[]);
 assert.equal(recordingsForOutcome(entries,hidden,'whiff',true)[0].id,'whiff-alias');
});

test('throw whiff duration stays distinct from recovery and successful cinematics',()=>{
 const values={TimingScope:'throw_whiff_trial',WhiffAttemptDuration:43,Recovery:null};
 assert.equal(throwWhiffDuration(values,'whiff'),43);
 assert.equal(throwWhiffDuration({...values,WhiffAttemptDuration:0},'whiff'),0);
 assert.equal(throwWhiffDuration(values,'hit'),null);
 assert.equal(throwWhiffDuration({...values,TimingScope:'successful_throw_sequence'},'whiff'),null);
 assert.equal(values.Recovery,null);
});
