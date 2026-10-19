import test from 'node:test';
import assert from 'node:assert/strict';
import {imageForState,stateReadout,trialsForState,setupKey,type SetupGroup,type SetupTrial}from './setupCoverage.ts';
const group=()=>({images:[],trials:[],states:{}}as unknown as SetupGroup);
test('actual contact defines coverage; intended whiff does not fill whiff',()=>{
 const g=group();g.trials=[{id:'a',requested:'whiff',outcome:'hit',repeat_equal:false}as SetupTrial];
 assert.equal(trialsForState(g,'whiff').length,0);
 assert.equal(stateReadout(g,'whiff'),'Missing · no confirmed observation');
 assert.equal(stateReadout(g,'hit'),'1 RAM trial · no image clip');
 assert.equal(imageForState(g,'hit'),undefined);
});
test('image selection uses the actual setup and prefers the primary clip',()=>{
 const g=group();g.images=[{id:'alias',outcome:'whiff',primary:false},{id:'primary',outcome:'whiff',primary:true},{id:'hit',outcome:'hit',primary:true}]as SetupGroup['images'];
 assert.equal(imageForState(g,'whiff')?.id,'primary');
 assert.equal(imageForState(g,'block'),undefined);
 assert.equal(stateReadout(g,'whiff'),'2 image clips');
});
test('coverage never merges selectors or modes and ranks matched trials first',()=>{
 assert.notEqual(setupKey(0,'power','5A'),setupKey(17,'power','5A'));
 assert.notEqual(setupKey(0,'speed','5A'),setupKey(0,'power','5A'));
 const g=group();g.trials=[{id:'a',outcome:'hit',repeat_equal:false},{id:'z',outcome:'hit',repeat_equal:true}]as SetupTrial[];
 assert.deepEqual(trialsForState(g,'hit').map(t=>t.id),['z','a']);
});
