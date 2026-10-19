/** Validate referenced files, then install a local pack without copying unrelated files. */
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function inspectPack(source) {
  const directory=await fs.realpath(source),files=new Map();
  async function add(relative,expected) {
    if(!relative || relative.split(/[\\/]/).some(p=>p==='..'||p==='') || path.isAbsolute(relative))throw new Error(`Unsafe pack path: ${relative}`);
    const filename=path.join(directory,relative),real=await fs.realpath(filename);
    if(!real.startsWith(directory+path.sep))throw new Error(`Pack reference escapes its directory: ${relative}`);
    const info=await fs.stat(filename);if(!info.isFile())throw new Error(`Not a file: ${relative}`);
    if(expected){if(info.size!==expected.bytes)throw new Error(`Wrong file length: ${relative}`);const hash=createHash('sha256');for await(const block of createReadStream(filename))hash.update(block);if(hash.digest('hex')!==expected.sha256)throw new Error(`Checksum failed: ${relative}`);}
    files.set(relative,info.size);return filename;
  }
  function local(url) {if(typeof url!=='string'||!url.startsWith('/data/'))throw new Error(`Expected a local /data reference: ${url}`);return url.slice(6);}
  async function json(relative,expected) {return JSON.parse(await fs.readFile(await add(relative,expected),'utf8'));}
  const manifest=await json('manifest.json');if(manifest.schemaVersion!==1||!Array.isArray(manifest.characters)||!manifest.characters.length)throw new Error('Unsupported roster manifest');
  for(const character of manifest.characters){if(character.portrait)await add(local(character.portrait));const data=await json(local(character.file));for(const move of data.moves??[])for(const capture of move.captures??[]){const trace=await json(local(capture.file));for(const frame of trace.frames??[]){if(frame.image)await add(local(frame.image));if(frame.sprite?.image)await add(local(frame.sprite.image));}}}
  const index=await json('extended/index.json'),metrics=await json('extended/metrics.json');if(metrics.guard_evidence_url)await json(local(metrics.guard_evidence_url));await json(local(index.profiles_url));await add('extended/moves.csv');
  if(metrics.hit_events_csv_url)await add(local(metrics.hit_events_csv_url));
  if(metrics.guard_trials_url)await json(local(metrics.guard_trials_url));
  if(metrics.guard_trials_csv_url)await add(local(metrics.guard_trials_csv_url));
  if(metrics.air_trials_url)await json(local(metrics.air_trials_url));
  if(metrics.movement_trials_url)await json(local(metrics.movement_trials_url));
  if(metrics.move_properties_url){const properties=await json(local(metrics.move_properties_url));if(properties.schema_version!==2||!properties.shards)throw new Error('Unsupported move properties');for(const shard of Object.values(properties.shards))await json(local(shard.url),shard);}

  if(metrics.setup_coverage_url)await json(local(metrics.setup_coverage_url));
  if(metrics.recovery_trials_url)await json(local(metrics.recovery_trials_url));
  if(metrics.recovery_trials_csv_url)await add(local(metrics.recovery_trials_csv_url));
  if(metrics.landing_trials_url)await json(local(metrics.landing_trials_url));
  if(metrics.landing_trials_csv_url)await add(local(metrics.landing_trials_csv_url));
  if(metrics.stun_research_url)await json(local(metrics.stun_research_url));
  if(metrics.charge_trials_url)await json(local(metrics.charge_trials_url));
  if(metrics.charge_trials_csv_url)await add(local(metrics.charge_trials_csv_url));
  for(const metric of Object.values(metrics.clips||{}))if(metric.repeat_verification?.evidence_url)await json(local(metric.repeat_verification.evidence_url));
  if(!Array.isArray(index.clips)||!index.clips.length)throw new Error('Missing native clips');
  const ids=new Set();for(const clip of index.clips){if(ids.has(clip.id)||!metrics.clips?.[clip.id])throw new Error(`Duplicate or unmeasured clip: ${clip.id}`);ids.add(clip.id);const prefix=local(clip.clip_url);if(!prefix.endsWith('/'))throw new Error('clip_url must end with /');const name=prefix+'manifest.json';const filename=await add(name);const bytes=await fs.readFile(filename);if(createHash('sha256').update(bytes).digest('hex')!==clip.manifest_sha256)throw new Error(`Manifest checksum failed: ${clip.id}`);const native=JSON.parse(bytes);if(!native.accepted||!['lastblade2-native-clip-v1','lastblade2-native-clip-v2'].includes(native.schema))throw new Error(`Unsupported clip: ${clip.id}`);for(const [file,expected]of Object.entries(native.files))await add(prefix+file+(file.endsWith('.gz')?'.bin':''),expected);}
  return {directory,files,clips:ids.size,bytes:[...files.values()].reduce((a,b)=>a+b,0)};
}
async function main(){const args=process.argv.slice(2),source=args.find(a=>!a.startsWith('--'));if(!source||args.some(a=>a.startsWith('--')&&a!=='--check-only'))throw new Error('Usage: npm run data:import -- /path/to/pack [--check-only]');const pack=await inspectPack(source);console.log(JSON.stringify({clips:pack.clips,referencedFiles:pack.files.size,bytes:pack.bytes,validated:true}));if(args.includes('--check-only'))return;
  const destination=path.join(root,'public/data');try{await fs.stat(destination);throw new Error('public/data already exists. Preserve it or choose a clean checkout before importing.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const space=await fs.statfs(path.join(root,'public'));if(Number(space.bavail)*Number(space.bsize)<pack.bytes+256*1024*1024)throw new Error('Insufficient disk space for this data pack plus a 256 MiB reserve.');
  const staging=await fs.mkdtemp(path.join(root,'public/.data-import-'));try{for(const name of pack.files.keys()){const target=path.join(staging,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(pack.directory,name),target);}await fs.rename(staging,destination);}catch(e){await fs.rm(staging,{recursive:true,force:true});throw e;}console.log('Local pack installed. Reload the viewer. public/data is excluded from Git.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
