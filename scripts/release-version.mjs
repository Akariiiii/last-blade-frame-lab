import {readFileSync} from 'node:fs';

/** package.json owns the release identity; OS resources also need numeric fields. */
export function versionInfo(version) {
  const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.([1-9]\d*))?$/.exec(version);
  if(!match || match[0]!==version)throw new Error('Use MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-beta.N (alpha/rc also supported).');
  const numbers=match.slice(1,4).map(Number),serial=Number(match[5]||0);
  if([...numbers,serial].some(n=>n>65535))throw new Error('Native version components must fit unsigned 16-bit fields.');
  const core=numbers.join('.');
  return {version,tag:`v${version}`,core,prerelease:!!match[4],native:[...numbers,serial],
    macZip:`LastBlade2-FrameLab-v${version}-macOS-universal.zip`,
    windowsZip:`LastBlade2-FrameLab-v${version}-Windows-x64.zip`};
}
export function releaseVersion() {
  return versionInfo(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);
}
export function windowsVersionHeader(release) {
  return `#pragma once\n#define FRAME_LAB_FILE_VERSION ${release.native.join(',')}\n#define FRAME_LAB_VERSION "${release.version}"\n#define FRAME_LAB_VERSION_W L"${release.version}"\n#define FRAME_LAB_PRERELEASE ${release.prerelease?'0x2L':'0x0L'}\n`;
}
