import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeRectangles } from './geometry.ts';
import type { Row, Profiles } from './types.ts';
const profiles:Profiles={flags_by_character:{'0':Array(256).fill(0)}};
const row:Row={registered_collision:'1',character:'0',facing:'0',x:'96',y:'0',boxes:'0101000030d8ec100000',scale_x_byte:'255',scale_y_byte:'255',origin_x_word:'0',origin_y_word:'200'};
test('native collision projection preserves facing and filters unregistered/stale object slots',()=>{
  assert.deepEqual(nativeRectangles(row,profiles,'object').boxes[0],{role:'attack',x:96,y:144,width:48,height:20,damage:16,label:'OBJ'});
  assert.equal(nativeRectangles({...row,facing:'1'},profiles,'object').boxes[0].x,48);
  assert.equal(nativeRectangles({...row,registered_collision:'0'},profiles,'object').boxes.length,0);
  assert.equal(nativeRectangles({...row,boxes:'0100000030d8ec100000'},profiles,'object').boxes.length,0);
});
