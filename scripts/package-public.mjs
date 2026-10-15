/** Source-only export with an explicit allowlist; never walks public/data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {releaseVersion} from './release-version.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args=process.argv.slice(2);const refresh=args.includes('--refresh');const rest=args.filter(a=>a!=='--refresh');if(rest.length&&!(rest.length===2&&rest[0]==='--output'))throw new Error('Usage: npm run package:public -- [--output /directory] [--refresh]');
const destination=path.resolve(rest[1]??path.join(root,'../Public/last-blade-frame-lab'));
if(destination===root||destination.startsWith(root+path.sep))throw new Error('Output must be outside the source viewer.');
let previous;
try{await fs.stat(destination);if(!refresh)throw new Error('Output already exists; use a new directory or --refresh for an unchanged generated export.');previous=JSON.parse(await fs.readFile(path.join(destination,'PUBLIC_EXPORT.json'),'utf8'));if(previous.scope!=='source + original procedural demo only')throw new Error('Unrecognized previous export.');for(const entry of previous.files){const bytes=await fs.readFile(path.join(destination,entry.file));if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error(`Export source was edited: ${entry.file}. Preserve it and choose a new output directory.`);}}catch(e){if(e.code!=='ENOENT'||previous)throw e;if(refresh)throw new Error('No complete generated export to refresh.');}
const files=[];
async function collect(relative){const target=path.join(root,relative),stat=await fs.lstat(target);if(stat.isSymbolicLink())throw new Error(`Symlink in public source: ${relative}`);if(stat.isDirectory()){for(const name of(await fs.readdir(target)).sort()){if(name==='.DS_Store')continue;await collect(path.join(relative,name));}}else if(stat.isFile())files.push(relative);}
for(const item of ['src','desktop','scripts','docs','.github','public/demo','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','README.md','NOTICE.md'])await collect(item);
const payload=[];for(const name of files){const bytes=await fs.readFile(path.join(root,name));if(/\/Users\/[^/]+\/|\/home\/[^/]+\/|codex[-]runtimes/.test(bytes.toString('utf8')))throw new Error(`Local machine path in public source: ${name}`);payload.push([name,bytes]);}
await fs.mkdir(destination,{recursive:true});const entries=[];
for(const [name,bytes] of payload){const target=path.join(destination,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);entries.push({file:name.split(path.sep).join('/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await fs.writeFile(path.join(destination,'PUBLIC_EXPORT.json'),JSON.stringify({schemaVersion:1,version:releaseVersion().version,scope:'source + original procedural demo only',files:entries},null,2)+'\n');
console.log(JSON.stringify({destination,files:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0),gameAssetsIncluded:false}));
