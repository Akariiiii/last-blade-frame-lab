/** Verify x64 PE structure, runtime dependencies, manifest hashes and ZIP bytes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const args=process.argv.slice(2);let bundle,zip;
for(let i=0;i<args.length;i++) {
  if(args[i]==='--bundle'&&args[i+1])bundle=path.resolve(args[++i]);
  else if(args[i]==='--zip'&&args[i+1])zip=path.resolve(args[++i]);
  else throw new Error('Usage: node scripts/verify-windows.mjs --bundle /bundle [--zip /package.zip]');
}
if(!bundle)throw new Error('A Windows bundle path is required.');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(bundle,'package-manifest.json'),'utf8'));
assert.equal(manifest.platform,'win32');assert.equal(manifest.architecture,'x64');assert.equal(manifest.privateDataIncluded,false);
const expected=new Map();
for(const entry of manifest.files) {
  assert.equal(path.posix.isAbsolute(entry.path),false);
  assert(!entry.path.includes('\\')&&!entry.path.split('/').some(part=>part==='..'||part==='data'),'Invalid or private payload path.');
  assert(!expected.has(entry.path),'Duplicate manifest payload path.');
  const bytes=await fs.readFile(path.join(bundle,...entry.path.split('/')));
  assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(sha(bytes),entry.sha256,entry.path);
  expected.set(entry.path,bytes);
}
expected.set('package-manifest.json',await fs.readFile(path.join(bundle,'package-manifest.json')));
const actual=[];
async function walk(folder) {
  for(const entry of await fs.readdir(folder,{withFileTypes:true})) {
    const file=path.join(folder,entry.name);assert(!entry.isSymbolicLink(),'Bundle must not contain symlinks.');
    if(entry.isDirectory())await walk(file);else {assert(entry.isFile());actual.push(path.relative(bundle,file).split(path.sep).join('/'));}
  }
}
await walk(bundle);assert.deepEqual(actual.sort(),[...expected.keys()].sort());
const executable=expected.get(manifest.app);assert(executable,'Executable is missing from manifest.');
assert.equal(executable.readUInt16LE(0),0x5a4d);
const pe=executable.readUInt32LE(0x3c);assert.equal(executable.toString('ascii',pe,pe+4),'PE\0\0');
assert.equal(executable.readUInt16LE(pe+4),0x8664,'Executable must be x86-64.');
const optional=pe+24;assert.equal(executable.readUInt16LE(optional),0x20b,'Executable must be PE32+.');
assert.equal(executable.readUInt16LE(optional+68),2,'Executable must use the Windows GUI subsystem.');
const sectionCount=executable.readUInt16LE(pe+6),sectionStart=optional+executable.readUInt16LE(pe+20);
function offset(rva) {
  for(let i=0;i<sectionCount;i++) {
    const section=sectionStart+i*40,base=executable.readUInt32LE(section+12);
    const size=Math.max(executable.readUInt32LE(section+8),executable.readUInt32LE(section+16));
    if(rva>=base&&rva<base+size)return executable.readUInt32LE(section+20)+(rva-base);
  }
  throw new Error('PE data directory does not map to a section.');
}
function cstring(start) {const end=executable.indexOf(0,start);assert(end>start);return executable.toString('ascii',start,end);}
const imports=[];
for(let cursor=offset(executable.readUInt32LE(optional+112+8));executable.readUInt32LE(cursor)||executable.readUInt32LE(cursor+12);cursor+=20)imports.push(cstring(offset(executable.readUInt32LE(cursor+12))));
const systemDlls=new Set(['advapi32.dll','kernel32.dll','ole32.dll','oleaut32.dll','shell32.dll','shlwapi.dll','comdlg32.dll','user32.dll','ws2_32.dll','gdi32.dll','msvcrt.dll','ucrtbase.dll']);
for(const name of imports)assert(systemDlls.has(name.toLowerCase())||/^api-ms-win-crt-[a-z0-9-]+\.dll$/i.test(name),`Unexpected non-system runtime dependency: ${name}`);
assert(executable.includes(Buffer.from('asInvoker')),'Executable must embed its non-admin manifest.');
assert(expected.has('WebView2Loader.dll'));assert(expected.has('web/index.html'));assert(expected.has('web/demo/manifest.json'));
let zipBytes,zipEntries;
if(zip) {
  zipBytes=await fs.readFile(zip);let end=-1;
  for(let i=zipBytes.length-22;i>=Math.max(0,zipBytes.length-65557);i--)if(zipBytes.readUInt32LE(i)===0x06054b50){end=i;break;}
  assert(end>=0,'ZIP end directory is missing.');
  const count=zipBytes.readUInt16LE(end+10);assert(count<65535,'ZIP64 is not supported by this verifier.');
  let cursor=zipBytes.readUInt32LE(end+16);const seen=new Set();
  for(let i=0;i<count;i++) {
    assert.equal(zipBytes.readUInt32LE(cursor),0x02014b50);
    const method=zipBytes.readUInt16LE(cursor+10),compressed=zipBytes.readUInt32LE(cursor+20),size=zipBytes.readUInt32LE(cursor+24);
    const nameLength=zipBytes.readUInt16LE(cursor+28),extraLength=zipBytes.readUInt16LE(cursor+30),commentLength=zipBytes.readUInt16LE(cursor+32),local=zipBytes.readUInt32LE(cursor+42);
    const name=zipBytes.toString('utf8',cursor+46,cursor+46+nameLength),prefix=path.basename(bundle)+'/';
    assert(name.startsWith(prefix)&&!name.split('/').includes('..')&&!name.includes('\\'),'Unexpected ZIP root/path.');
    const relative=name.slice(prefix.length);
    if(!name.endsWith('/')) {
      assert(expected.has(relative),`Unexpected ZIP payload: ${relative}`);assert(!seen.has(relative),'Duplicate ZIP payload.');
      assert.equal(zipBytes.readUInt32LE(local),0x04034b50);
      const start=local+30+zipBytes.readUInt16LE(local+26)+zipBytes.readUInt16LE(local+28),payload=zipBytes.subarray(start,start+compressed);
      assert(method===0||method===8,'ZIP compression method is unsupported.');
      const content=method===0?payload:inflateRawSync(payload);assert.equal(content.length,size);assert.deepEqual(content,expected.get(relative),relative);seen.add(relative);
    }
    cursor+=46+nameLength+extraLength+commentLength;
  }
  assert.deepEqual([...seen].sort(),[...expected.keys()].sort());zipEntries=seen.size;
}
console.log(JSON.stringify({platform:'Windows x64',guiSubsystem:true,filesVerified:expected.size,exeSha256:sha(executable),exeBytes:executable.length,imports,privateDataIncluded:false,zipEntriesVerified:zipEntries,zipSha256:zipBytes?sha(zipBytes):undefined,windowsRuntimeTested:false},null,2));
