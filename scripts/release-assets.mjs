/** Prepare local upload artifacts; never creates a Git tag or publishes a release. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {releaseVersion} from './release-version.mjs';
import {fileURLToPath} from 'node:url';
import {readReleaseNotes} from './release-notes.mjs';
const release=releaseVersion();
const args=process.argv.slice(2);
let output,notesFile;
for(let i=0;i<args.length;i++) {
  if(args[i]==='--directory'&&args[i+1]&&!output)output=args[++i];
  else if(args[i]==='--notes'&&args[i+1]&&!notesFile)notesFile=path.resolve(args[++i]);
  else throw new Error('Usage: npm run release:assets -- --directory /built/release-folder [--notes /reviewed/release-notes.md]');
}
if(!output)throw new Error('A built release directory is required.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Resolve notes before touching outputs; a missing beta.2 entry is a release gate.
const notes=await readReleaseNotes(release,{root,filename:notesFile});
const directory=path.resolve(output),entries=[];
for(const filename of [release.macZip,release.windowsZip]) {
  const bytes=await fs.readFile(path.join(directory,filename));
  entries.push({file:filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
// Both binaries must come from this release; a renamed old ZIP is not sufficient.
const macPlist=await fs.readFile(path.join(directory,'Last Blade 2 Frame Lab.app/Contents/Info.plist'),'utf8');
if(!macPlist.includes(`<key>FrameLabVersion</key><string>${release.version}</string>`))throw new Error('macOS app version mismatch.');
if(!macPlist.includes('<key>CFBundleIconFile</key><string>FrameLab.icns</string>'))throw new Error('macOS app icon is not configured.');
await fs.access(path.join(directory,'Last Blade 2 Frame Lab.app/Contents/Resources/FrameLab.icns'));
const windowsManifest=JSON.parse(await fs.readFile(path.join(directory,'LastBlade2-FrameLab-Windows/package-manifest.json'),'utf8'));
if(windowsManifest.version!==release.version)throw new Error('Windows app version mismatch.');
if(windowsManifest.applicationIcon?.resourceId!==101)throw new Error('Windows app icon is missing.');
for(const folder of ['Last Blade 2 Frame Lab.app/Contents/Resources','LastBlade2-FrameLab-Windows']) {
  for(const file of ['LICENSE','NOTICE.md','THIRD_PARTY_NOTICES.md']) {
    const source=await fs.readFile(new URL(`../${file}`,import.meta.url));
    const packaged=await fs.readFile(path.join(directory,folder,file));
    if(!source.equals(packaged))throw new Error(`Packaged licence notice differs: ${folder}/${file}`);
  }
}
for(const web of ['Last Blade 2 Frame Lab.app/Contents/Resources/web','LastBlade2-FrameLab-Windows/web']) {
  const version=JSON.parse(await fs.readFile(path.join(directory,web,'version.json'),'utf8'));
  if(version.version!==release.version)throw new Error('Packaged viewer version mismatch.');
}
const manifest={version:release.version,tag:release.tag,prerelease:release.prerelease,license:'MIT',files:entries,recordingsIncluded:false,windowsNativeRuntimeTested:false,releaseNotes:{file:'RELEASE_NOTES.md',sha256:createHash('sha256').update(notes).digest('hex')}};
await fs.writeFile(path.join(directory,'SHA256SUMS.txt'),entries.map(e=>`${e.sha256}  ${e.file}`).join('\n')+'\n');
await fs.writeFile(path.join(directory,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(directory,'RELEASE_NOTES.md'),notes);
console.log(JSON.stringify({version:release.version,directory,assets:entries.map(e=>e.file),published:false}));
