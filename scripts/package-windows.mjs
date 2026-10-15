/** Cross-build a native x64 Windows/WebView2 shell; ship built UI/demo only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {releaseVersion,windowsVersionHeader} from './release-version.mjs';
const release=releaseVersion();

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sdkVersion='1.0.4258.31';
const sdkSha256='56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9';
const sdkUrl=`https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${sdkVersion}/microsoft.web.webview2.${sdkVersion}.nupkg`;
const args=process.argv.slice(2);let out=path.resolve(root,'../Local/windows-v1'),assets,sdkPackage;
for(let i=0;i<args.length;i++) {
  if(args[i]==='--output'&&args[i+1])out=path.resolve(args[++i]);
  else if(args[i]==='--assets'&&args[i+1])assets=path.resolve(args[++i]);
  else if(args[i]==='--sdk-package'&&args[i+1])sdkPackage=path.resolve(args[++i]);
  else throw new Error('Usage: node scripts/package-windows.mjs [--output /new/directory] [--assets /built/UI] [--sdk-package /pinned.nupkg]');
}
const folder='LastBlade2-FrameLab-Windows',destination=path.join(out,folder),zip=path.join(out,release.windowsZip);
for(const target of [destination,zip])try {await fs.lstat(target);throw new Error(`Output already exists: ${target}. Choose a new output directory.`);}catch(e){if(e.code!=='ENOENT')throw e;}
const run=(command,argv,options={})=>{
  const r=spawnSync(command,argv,{cwd:root,stdio:'inherit',...options});
  if(r.error)throw r.error;if(r.status!==0)throw new Error(`${command} failed (${r.status}).`);
};
const powershell=(code,variables)=>run('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{env:{...process.env,...variables}});
const cxx=process.env.FRAME_LAB_WINDOWS_CXX||(process.platform==='win32'?'g++':'x86_64-w64-mingw32-g++');
const windres=process.env.FRAME_LAB_WINDOWS_WINDRES||(process.platform==='win32'?'windres':'x86_64-w64-mingw32-windres');
// Fail fast before building UI or downloading when the cross toolchain is missing.
run(cxx,['--version']);run(windres,['--version']);
if(!assets) {
  run(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--build']);
  run(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],{env:{...process.env,FRAME_LAB_BASE:'/'}});
  assets=path.join(root,'dist');
}
for(const file of ['index.html','demo/manifest.json'])await fs.access(path.join(assets,file));
const builtVersion=JSON.parse(await fs.readFile(path.join(assets,'version.json'),'utf8'));
if(builtVersion.version!==release.version)throw new Error('Built UI version differs from package.json. Rebuild the viewer before packaging.');
// Explicit assets also obey the production boundary: never package private /data.
try {await fs.lstat(path.join(assets,'data'));throw new Error('Refusing assets containing a private data directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.mkdir(out,{recursive:true});const temporary=await fs.mkdtemp(path.join(out,'.windows-build-'));
try {
  const sdk=path.join(temporary,'sdk'),sources=path.join(temporary,'source'),bundle=path.join(temporary,folder);
  await fs.mkdir(sdk);await fs.mkdir(sources);await fs.mkdir(bundle);
  const archive=path.join(temporary,'sdk.zip');
  if(sdkPackage)await fs.copyFile(sdkPackage,archive);
  else {
    const response=await fetch(sdkUrl);if(!response.ok)throw new Error(`Microsoft SDK download failed (${response.status}).`);
    await fs.writeFile(archive,new Uint8Array(await response.arrayBuffer()));
  }
  const actual=crypto.createHash('sha256').update(await fs.readFile(archive)).digest('hex');
  if(actual!==sdkSha256)throw new Error('Microsoft WebView2 SDK checksum does not match the pinned package.');
  if(process.platform==='win32')powershell('Expand-Archive -LiteralPath $env:FRAME_LAB_SDK_ARCHIVE -DestinationPath $env:FRAME_LAB_SDK_TARGET',{FRAME_LAB_SDK_ARCHIVE:archive,FRAME_LAB_SDK_TARGET:sdk});
  else run('unzip',['-q',archive,'-d',sdk]);
  for(const file of ['main.cpp','LocalServer.cpp','LocalServer.hpp','app.rc','app.manifest'])await fs.copyFile(path.join(root,'desktop/windows',file),path.join(sources,file));
  await fs.copyFile(path.join(root,'desktop/icons/FrameLab.ico'),path.join(sources,'FrameLab.ico'));
  await fs.writeFile(path.join(sources,'version.h'),windowsVersionHeader(release));
  const appManifest=path.join(sources,'app.manifest');
  await fs.writeFile(appManifest,(await fs.readFile(appManifest,'utf8')).replace('@NATIVE_VERSION@',release.native.join('.')));
  await fs.cp(assets,path.join(bundle,'web'),{recursive:true,dereference:false});
  // Symlinks are not a portable application asset and may escape the explicit UI snapshot.
  async function files(directory) {
    let result=[];
    for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
      const file=path.join(directory,entry.name);
      if(entry.isSymbolicLink())throw new Error(`Refusing symlink in Windows bundle: ${file}`);
      if(entry.isDirectory())result.push(...await files(file));
      else if(entry.isFile())result.push(file);
      else throw new Error(`Unsupported bundle asset: ${file}`);
    }
    return result.sort();
  }
  await files(path.join(bundle,'web'));
  const object=path.join(temporary,'resources.o');
  run(windres,['-I',sources,path.join(sources,'app.rc'),object]);
  run(cxx,['-std=c++17','-O2','-Wall','-Wextra','-Wno-unknown-pragmas','-Wno-cast-function-type',
    '-I',path.join(sdk,'build/native/include'),'-municode','-mwindows','-static','-static-libgcc','-static-libstdc++','-s',
    path.join(sources,'main.cpp'),path.join(sources,'LocalServer.cpp'),object,'-o',path.join(bundle,'Last Blade 2 Frame Lab.exe'),
    '-lole32','-loleaut32','-lshell32','-lcomdlg32','-ladvapi32','-luuid','-lws2_32']);
  await fs.copyFile(path.join(sdk,'build/native/x64/WebView2Loader.dll'),path.join(bundle,'WebView2Loader.dll'));
  for(const file of ['LICENSE','NOTICE.md','THIRD_PARTY_NOTICES.md'])await fs.copyFile(path.join(root,file),path.join(bundle,file));
  await fs.copyFile(path.join(root,'desktop/windows/TOOLCHAIN_NOTICES.txt'),path.join(bundle,'TOOLCHAIN_NOTICES.txt'));
  const license=await fs.readFile(path.join(sdk,'LICENSE.txt'),'utf8'),notice=await fs.readFile(path.join(sdk,'NOTICE.txt'),'utf8');
  await fs.writeFile(path.join(bundle,'THIRD_PARTY_NOTICES.txt'),`Microsoft.Web.WebView2 ${sdkVersion}\nSource: ${sdkUrl}\nSHA-256: ${sdkSha256}\n\n${license}\n\n${notice}`);
  await fs.writeFile(path.join(bundle,'README.txt'),`Last Blade 2 Frame Lab v${release.version} - Windows x64\n\nExtract this entire ZIP into a writable local folder. Open Last Blade 2 Frame Lab.exe.\nKeep WebView2Loader.dll and the web folder beside the EXE.\nRequires Windows 10/11 x64 and Microsoft Edge WebView2 Evergreen Runtime:\nhttps://developer.microsoft.com/microsoft-edge/webview2/#download-section\nNo Node.js, Python, emulator, administrator access or normal access logs.\n\nThe bundled demo is procedural. No game ROMs or recorded game art are included.\nFor real recordings use File > Choose Data Folder and choose a pack containing manifest.json and extended.\nAlternatively put a complete data folder beside the EXE before first launch.\nUse File > Use Demo to return to the demo. Ctrl+O chooses data; Ctrl+R reloads.\nExport buttons open a native Windows Save dialog.\n\nThis build is unsigned. Cross-compilation and host-side HTTP checks are not Windows runtime acceptance.\nNative Windows playback, folder selection and downloads still require a Windows smoke test.\n`);
  const entries=[];
  for(const file of await files(bundle))entries.push({path:path.relative(bundle,file).split(path.sep).join('/'),bytes:(await fs.stat(file)).size,sha256:crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')});
  await fs.writeFile(path.join(bundle,'package-manifest.json'),JSON.stringify({format:1,version:release.version,tag:release.tag,nativeVersion:release.native,applicationIcon:{resourceId:101,sizes:[16,24,32,48,64,128,256],sourceSha256:crypto.createHash('sha256').update(await fs.readFile(path.join(sources,'FrameLab.ico'))).digest('hex')},platform:'win32',architecture:'x64',app:'Last Blade 2 Frame Lab.exe',sdk:{version:sdkVersion,url:sdkUrl,sha256:sdkSha256},runtime:'Microsoft Edge WebView2 Evergreen Runtime',privateDataIncluded:false,requiresNodeToRun:false,requiresPythonToRun:false,signed:false,files:entries},null,2)+'\n');
  const temporaryZip=path.join(temporary,'windows.zip');
  if(process.platform==='win32')powershell('Compress-Archive -LiteralPath $env:FRAME_LAB_ZIP_SOURCE -DestinationPath $env:FRAME_LAB_ZIP_TARGET -CompressionLevel Optimal',{FRAME_LAB_ZIP_SOURCE:bundle,FRAME_LAB_ZIP_TARGET:temporaryZip});
  else run('zip',['-q','-r',temporaryZip,folder],{cwd:temporary});
  await fs.rename(bundle,destination);await fs.rename(temporaryZip,zip);
} finally {await fs.rm(temporary,{recursive:true,force:true});}
console.log(JSON.stringify({version:release.version,app:path.join(destination,'Last Blade 2 Frame Lab.exe'),zip,architecture:'x64',privateDataIncluded:false,requiresNodeToRun:false,requiresPythonToRun:false,signed:false,windowsRuntimeTested:false}));
