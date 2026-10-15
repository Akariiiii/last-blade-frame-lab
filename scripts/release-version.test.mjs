import assert from 'node:assert/strict';
import test from 'node:test';
import {versionInfo,windowsVersionHeader,releaseVersion} from './release-version.mjs';
test('release identity preserves beta label with numeric OS versions and archive names',()=>{
  const v=versionInfo('0.1.0-beta.1');
  assert.equal(v.tag,'v0.1.0-beta.1');assert.equal(v.core,'0.1.0');assert.deepEqual(v.native,[0,1,0,1]);
  assert.equal(v.macZip,'LastBlade2-FrameLab-v0.1.0-beta.1-macOS-universal.zip');
  assert.match(v.windowsZip,/v0\.1\.0-beta\.1-Windows-x64\.zip$/);
  assert.match(windowsVersionHeader(v),/#define FRAME_LAB_FILE_VERSION 0,1,0,1/);
});
test('native version resources reject malformed or out-of-range components',()=>{
  for(const v of ['v1.2.3','1.2','01.2.3','1.2.3-beta.0','1.2.3-beta.65536','65536.0.0','1.2.3\n'])assert.throws(()=>versionInfo(v));
  assert.deepEqual(versionInfo('1.2.3').native,[1,2,3,0]);
  assert.equal(versionInfo('1.2.3').prerelease,false);
});
test('package and lock file share one release version',async()=>{
  const fs=await import('node:fs/promises');const lock=JSON.parse(await fs.readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.version,releaseVersion().version);assert.equal(lock.packages[''].version,lock.version);
});
