import assert from 'node:assert/strict';
import test from 'node:test';
import {timingText,hasTimingValue} from './timing.ts';
test('contact bounds never become exact startup or invented active durations',()=>{
  const values={Startup:null,StartupUpperBound:25,Active:null,CapturedActive:14};
  assert.equal(timingText(values,'Startup'),'≤25');
  assert.equal(timingText(values,'Active'),null);
  assert.equal(hasTimingValue(values,'Active'),false);
  assert.equal(timingText({Startup:0,StartupUpperBound:25},'Startup'),'0');
  assert.equal(timingText({Startup:null,StartupUpperBound:null},'Startup'),null);
});
