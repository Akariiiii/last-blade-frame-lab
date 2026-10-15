/** Build a universal native launcher; publish only built UI/demo, with external data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {releaseVersion} from './release-version.mjs';
const release=releaseVersion();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args=process.argv.slice(2);let out=path.resolve(root,'../Local'),data;
for(let i=0;i<args.length;i++){if(args[i]==='--output'&&args[i+1])out=path.resolve(args[++i]);else if(args[i]==='--data'&&args[i+1])data=path.resolve(args[++i]);else throw new Error('Usage: npm run package:mac -- [--output /directory] [--data /local/pack]');}
if(process.platform!=='darwin')throw new Error('Build this package on macOS with Xcode Command Line Tools.');
const name='Last Blade 2 Frame Lab.app',destination=path.join(out,name),zip=path.join(out,release.macZip);
for(const target of [destination,zip,...(data?[path.join(out,'data')]:[])]){try{await fs.lstat(target);throw new Error(`Output already exists: ${path.basename(target)}. Choose a new output folder.`);}catch(e){if(e.code!=='ENOENT')throw e;}}
if(data)for(const name of ['manifest.json','extended/index.json','extended/metrics.json','extended/profiles.json'])await fs.access(path.join(data,name));
const run=(command,argv,options={})=>{const r=spawnSync(command,argv,{cwd:root,stdio:'inherit',...options});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${command} failed (${r.status})`);};
run(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--build']);
run(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],{env:{...process.env,FRAME_LAB_BASE:'/'}});
await fs.mkdir(out,{recursive:true});const temporary=await fs.mkdtemp(path.join(out,'.mac-build-')),app=path.join(temporary,name);
try {
  await fs.mkdir(path.join(app,'Contents/MacOS'),{recursive:true});await fs.mkdir(path.join(app,'Contents/Resources'),{recursive:true});
  await fs.copyFile(path.join(root,'desktop/icons/FrameLab.icns'),path.join(app,'Contents/Resources/FrameLab.icns'));
  for(const file of ['LICENSE','NOTICE.md','THIRD_PARTY_NOTICES.md'])await fs.copyFile(path.join(root,file),path.join(app,'Contents/Resources',file));
  await fs.cp(path.join(root,'dist'),path.join(app,'Contents/Resources/web'),{recursive:true});
  // Compile an immutable snapshot, so both architectures use identical source.
  const sources=[];for(const name of ['LocalServer.swift','main.swift']){const target=path.join(temporary,name);await fs.copyFile(path.join(root,'desktop/macos',name),target);sources.push(target);}
  for(const arch of ['arm64','x86_64'])run('xcrun',['swiftc','-O','-swift-version','5','-target',`${arch}-apple-macosx12.0`,...sources,'-o',path.join(temporary,arch)]);
  run('xcrun',['lipo','-create',path.join(temporary,'arm64'),path.join(temporary,'x86_64'),'-output',path.join(app,'Contents/MacOS/FrameLab')]);
  const plist=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>local.lastblade2.framelab</string><key>CFBundleName</key><string>Last Blade 2 Frame Lab</string><key>CFBundleExecutable</key><string>FrameLab</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleIconFile</key><string>FrameLab.icns</string><key>CFBundleShortVersionString</key><string>${release.core}</string><key>CFBundleVersion</key><string>${release.core}</string><key>FrameLabVersion</key><string>${release.version}</string><key>LSMinimumSystemVersion</key><string>12.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>\n`;
  await fs.writeFile(path.join(app,'Contents/Info.plist'),plist);
  run('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',app]);
  const tempZip=path.join(temporary,'app.zip');run('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',app,tempZip]);
  await fs.rename(app,destination);await fs.rename(tempZip,zip);
  if(data)await fs.symlink(data,path.join(out,'data'),'dir');
} finally {await fs.rm(temporary,{recursive:true,force:true});}
console.log(JSON.stringify({version:release.version,app:destination,zip,architectures:['arm64','x86_64'],data:'external; not in archive',requiresNodeToRun:false,requiresPythonToRun:false,notarized:false}));
