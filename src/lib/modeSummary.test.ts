import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveSummary, type SummaryMetric} from './modeSummary.ts';
import type {Entry} from './native/types.ts';
import type {SetupRegistry,SetupTrial} from './setupCoverage.ts';
const entry=(id:string,mode='power')=>({id,selector_id:0,mode} as Entry);
const metric=(Setup:string,Startup:number|null):SummaryMetric=>({canonical_move:'5A',default_visible:true,primary_recording:true,values:{Setup,Startup}});
test('all nine contexts remain isolated; hidden aliases and wrong characters cannot supply values',()=>{
 const metrics={hit:metric('hit',5),block:metric('block',null),speed:metric('hit',7),hidden:{...metric('whiff',12),default_visible:false},other:metric('whiff',1)};
 const rows=moveSummary([entry('hit'),entry('block'),entry('speed','speed'),entry('hidden'),{...entry('other'),selector_id:1}],metrics,null,0,'5A');
 assert.equal(rows.length,9);assert.equal(rows[0].values?.Startup,5);assert.equal(rows[1].values?.Startup,null);
 assert.equal(rows[2].evidence,'missing');assert.equal(rows[3].values?.Startup,7);assert.equal(rows[6].evidence,'missing');
});
test('RAM fallback uses actual outcome, prefers matching repeats, and does not inherit image comparisons',()=>{
 const trial=(id:string,outcome:string,repeat_equal:boolean)=>({id,outcome,requested:'whiff',repeat_equal,values:{Startup:repeat_equal?9:8},source_recording:id,kind:'ground',guard_policy:null,phase:null,repetitions:repeat_equal?3:1,pacings:repeat_equal?[1,2,4]:[1],provisional:!repeat_equal} as SetupTrial);
 const registry={groups:{'0|power|5A':{images:[],states:{},trials:[trial('mishit','hit',true),trial('single','whiff',false),trial('repeat','whiff',true)]}}} as unknown as SetupRegistry;
 const rows=moveSummary([],{},registry,0,'5A');
 assert.equal(rows[2].source,'repeat');assert.equal(rows[2].values?.Startup,9);assert.equal(rows[2].evidence,'repeat-trial');assert.equal(rows[2].comparisons,undefined);
 assert.equal(rows[1].evidence,'missing');assert.equal(rows[5].evidence,'missing');
});
test('guard policies stay separate; generic block cannot masquerade as held or switch guard',()=>{
 const generic=metric('block',6);generic.values.BlockAdvantage=-4;
 let rows=moveSummary([entry('g')],{g:generic},null,0,'5A');assert.deepEqual(rows[1].guard,{});
 const held=metric('block',6);Object.assign(held.values,{GuardPolicy:'held',BlockAdvantage:-4,SwitchGuardAdvantage:-9});
 const release={...metric('block',6),primary_recording:false};Object.assign(release.values,{GuardPolicy:'release',BlockAdvantage:-3});
 rows=moveSummary([entry('h'),entry('r')],{h:held,r:release},null,0,'5A');assert.deepEqual(rows[1].guard,{held:-4,release:-3,switch:-9});assert.deepEqual(rows[0].guard,{});
});
