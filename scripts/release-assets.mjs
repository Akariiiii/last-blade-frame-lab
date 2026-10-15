/** Prepare local upload artifacts; never creates a Git tag or publishes a release. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {releaseVersion} from './release-version.mjs';
const release=releaseVersion();
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--directory')throw new Error('Usage: npm run release:assets -- --directory /built/release-folder');
const directory=path.resolve(args[1]),entries=[];
for(const filename of [release.macZip,release.windowsZip]) {
  const bytes=await fs.readFile(path.join(directory,filename));
  entries.push({file:filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
// Both binaries must come from this release; a renamed old ZIP is not sufficient.
const macPlist=await fs.readFile(path.join(directory,'Last Blade 2 Frame Lab.app/Contents/Info.plist'),'utf8');
if(!macPlist.includes(`<key>FrameLabVersion</key><string>${release.version}</string>`))throw new Error('macOS app version mismatch.');
const windowsManifest=JSON.parse(await fs.readFile(path.join(directory,'LastBlade2-FrameLab-Windows/package-manifest.json'),'utf8'));
if(windowsManifest.version!==release.version)throw new Error('Windows app version mismatch.');
for(const web of ['Last Blade 2 Frame Lab.app/Contents/Resources/web','LastBlade2-FrameLab-Windows/web']) {
  const version=JSON.parse(await fs.readFile(path.join(directory,web,'version.json'),'utf8'));
  if(version.version!==release.version)throw new Error('Packaged viewer version mismatch.');
}
const notes=`# Last Blade 2 Frame Lab ${release.tag}\n\nLocal frame viewer for saved Last Blade 2 recordings.\n\n- Recorded frame playback, stepping and collision overlays.\n- Move timing, damage and independent reference comparisons.\n- Separate held guard, switch guard and weapon rebound measurements.\n- Contact markers and explicit unknown/upper-bound timing when collision snapshots are incomplete.\n- Native macOS universal app and Windows x64 viewer.\n\n## Downloads\n\n- **macOS:** \`${release.macZip}\` — Apple Silicon and Intel, macOS12+.\n- **Windows:** \`${release.windowsZip}\` — Windows10/11 x64; requires Microsoft Edge WebView2 Runtime. Extract the entire ZIP and keep the DLL/web folder beside the EXE.\n\nThe apps include a procedural demo. Real game recordings are a separate download: extract the pack and choose its folder containing manifest.json and extended/. No game ROM, BIOS, emulator, Node or Python is required for viewing saved recordings.\n\n## Validation and requirements\n\nThe Mac app is ad-hoc signed and not notarized; the Windows executable is unsigned. Windows was cross-compiled and its shipping transport tested on the build host; actual Windows WebView2 playback and dialogs remain unverified. Recording coverage and transient hitbox evidence are incomplete; unknown values are kept visible.\n\nVerify downloaded ZIPs against SHA256SUMS.txt.\n`;
const manifest={version:release.version,tag:release.tag,prerelease:release.prerelease,files:entries,recordingsIncluded:false,windowsNativeRuntimeTested:false};
await fs.writeFile(path.join(directory,'SHA256SUMS.txt'),entries.map(e=>`${e.sha256}  ${e.file}`).join('\n')+'\n');
await fs.writeFile(path.join(directory,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(directory,'RELEASE_NOTES.md'),notes);
console.log(JSON.stringify({version:release.version,directory,assets:entries.map(e=>e.file),published:false}));
