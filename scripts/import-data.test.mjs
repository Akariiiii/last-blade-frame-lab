import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
    metrics.guard_trials_csv_url='/data/extended/guard-trials.csv';
    await fs.writeFile(target,JSON.stringify(metrics));await fs.writeFile(path.join(directory,'extended/guard-evidence.json'),'{}');
    await fs.writeFile(path.join(directory,'extended/guard-trials.csv'),'Move,Advantage\n5A,-7\n');
    const imported=await inspectPack(directory);
    assert.equal(imported.files.has('extended/guard-evidence.json'),true);
    assert.equal(imported.files.has('extended/guard-trials.csv'),true);
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});

test('optional saved movement research is portable and required when advertised',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-movement-pack-'));
  try {
    await fs.cp(new URL('../public/demo/',import.meta.url),directory,{recursive:true});
    const metricsFile=path.join(directory,'extended/metrics.json');
    const metrics=JSON.parse(await fs.readFile(metricsFile,'utf8'));
    metrics.movement_trials_url='/data/extended/movement-trials.json';
    await fs.writeFile(metricsFile,JSON.stringify(metrics));
    const movementFile=path.join(directory,'extended/movement-trials.json');
    await fs.writeFile(movementFile,JSON.stringify({schema_version:1,clips:{},groups:{}}));
    const imported=await inspectPack(directory);
    assert.ok(imported.files.has('extended/movement-trials.json'));
    await fs.rm(movementFile);
    await assert.rejects(inspectPack(directory),{code:'ENOENT'});
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('move property shards survive import and reject altered evidence',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-properties-pack-'));
  try {
    await fs.cp(new URL('../public/demo/',import.meta.url),directory,{recursive:true});
    const metricsFile=path.join(directory,'extended/metrics.json');
    const metrics=JSON.parse(await fs.readFile(metricsFile,'utf8'));
    metrics.move_properties_url='/data/extended/move-properties.json';
    await fs.writeFile(metricsFile,JSON.stringify(metrics));
    const content=JSON.stringify({schema_version:2,selector:0,mode:'power',groups:{}});
    const shardFile=path.join(directory,'extended/properties-power.json');
    await fs.writeFile(shardFile,content);
    await fs.writeFile(path.join(directory,'extended/move-properties.json'),JSON.stringify({schema_version:2,shards:{'0|power':{
      url:'/data/extended/properties-power.json',bytes:Buffer.byteLength(content),sha256:createHash('sha256').update(content).digest('hex'),groups:0,
    }}}));
    const imported=await inspectPack(directory);
    assert.ok(imported.files.has('extended/move-properties.json'));
    assert.ok(imported.files.has('extended/properties-power.json'));
    await fs.writeFile(shardFile,content.replace('power','speed'));
    await assert.rejects(inspectPack(directory),/Checksum failed/);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('optional charge registry and CSV references are retained by pack import',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-charge-pack-'));
  try {
    await fs.cp(new URL('../public/demo/',import.meta.url),directory,{recursive:true});
    const target=path.join(directory,'extended/metrics.json');const metrics=JSON.parse(await fs.readFile(target,'utf8'));
    metrics.charge_trials_url='/data/extended/charge-trials.json';
    metrics.charge_trials_csv_url='/data/extended/charge-trials.csv';
    metrics.setup_coverage_url='/data/extended/setup-coverage.json';
    metrics.stun_research_url='/data/extended/stun-research.json';
    await fs.writeFile(target,JSON.stringify(metrics));
    await fs.writeFile(path.join(directory,'extended/charge-trials.json'),JSON.stringify({schema_version:1,groups:{}}));
    await fs.writeFile(path.join(directory,'extended/charge-trials.csv'),'Move,Hold\n21416B,97\n');
    await fs.writeFile(path.join(directory,'extended/setup-coverage.json'),JSON.stringify({schema_version:1,groups:{}}));
    await fs.writeFile(path.join(directory,'extended/stun-research.json'),JSON.stringify({schema_version:1,dizzy_trials:[]}));
    const imported=await inspectPack(directory);
    assert.equal(imported.files.has('extended/charge-trials.json'),true);
    assert.equal(imported.files.has('extended/charge-trials.csv'),true);
    assert.equal(imported.files.has('extended/stun-research.json'),true);
    assert.equal(imported.files.has('extended/setup-coverage.json'),true);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('portable reference images and recovery research survive a standalone data pack',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-portable-pack-'));
  try {
    await fs.cp(new URL('../public/demo/',import.meta.url),directory,{recursive:true});
    const metricsFile=path.join(directory,'extended/metrics.json');
    const metrics=JSON.parse(await fs.readFile(metricsFile,'utf8'));
    metrics.recovery_trials_url='/data/extended/recovery-trials.json';
    metrics.recovery_trials_csv_url='/data/extended/recovery-trials.csv';
    metrics.landing_trials_url='/data/extended/landing-trials.json';
    metrics.landing_trials_csv_url='/data/extended/landing-trials.csv';
    await fs.writeFile(metricsFile,JSON.stringify(metrics));
    await fs.writeFile(path.join(directory,'extended/recovery-trials.json'),JSON.stringify({schema_version:1,groups:{}}));
    await fs.writeFile(path.join(directory,'extended/recovery-trials.csv'),'Move,RecoveryFrame0\n3C,0\n');
    await fs.writeFile(path.join(directory,'extended/landing-trials.json'),JSON.stringify({schema_version:1,groups:{}}));
    await fs.writeFile(path.join(directory,'extended/landing-trials.csv'),'Move,LandingFrame0\njB,0\n');
    const characterFile=path.join(directory,'characters/demo-fighter.json');
    const character=JSON.parse(await fs.readFile(characterFile,'utf8'));
    character.moves[0].captures=[{file:'/data/reference.json'}];
    await fs.writeFile(characterFile,JSON.stringify(character));
    await fs.writeFile(path.join(directory,'reference.json'),JSON.stringify({frames:[
      {image:'/data/assets/frames/recording.png'},
      {sprite:{image:'/data/assets/frames/sprite.png'}},
    ]}));
    await fs.mkdir(path.join(directory,'assets/frames'),{recursive:true});
    await fs.writeFile(path.join(directory,'assets/frames/recording.png'),'image fixture');
    await fs.writeFile(path.join(directory,'assets/frames/sprite.png'),'sprite fixture');
    await fs.writeFile(path.join(directory,'unreferenced.txt'),'not part of the pack');
    const imported=await inspectPack(directory);
    for(const name of ['extended/recovery-trials.json','extended/recovery-trials.csv','extended/landing-trials.json','extended/landing-trials.csv',
      'reference.json','assets/frames/recording.png','assets/frames/sprite.png']) {
      assert.ok(imported.files.has(name),`Missing portable reference: ${name}`);
    }
    assert.equal(imported.files.has('unreferenced.txt'),false);
    await fs.rm(path.join(directory,'extended/recovery-trials.csv'));
    await assert.rejects(inspectPack(directory),{code:'ENOENT'});
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
