import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectPack } from './import-data.mjs';
test('demo pack references and every encoded-file checksum validate',async()=>{
  const result=await inspectPack(new URL('../public/demo/',import.meta.url));assert.equal(result.clips,9);assert.ok(result.files.size>25);assert.ok(result.bytes>0);
});
test('data import rejects a reference escaping the pack',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-pack-'));
  try{await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify({schemaVersion:1,characters:[{file:'/data/../outside.json'}]}));await assert.rejects(inspectPack(directory),/Unsafe pack path/);}finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('optional guard evidence is included in the imported pack references',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-guard-pack-'));
  try {
    await fs.cp(new URL('../public/demo/',import.meta.url),directory,{recursive:true});
    const target=path.join(directory,'extended/metrics.json');const metrics=JSON.parse(await fs.readFile(target,'utf8'));metrics.guard_evidence_url='/data/extended/guard-evidence.json';
    await fs.writeFile(target,JSON.stringify(metrics));await fs.writeFile(path.join(directory,'extended/guard-evidence.json'),'{}');
    assert.equal((await inspectPack(directory)).files.has('extended/guard-evidence.json'),true);
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});
