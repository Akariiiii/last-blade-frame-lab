/** Black-box tests for the shipping Windows transport, without opening a GUI.
 * Default: compile the same C++ transport for this host (macOS/Linux).
 * On Windows: --exe /path/FrameLab.exe tests the actual PE in --server-only mode.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let exe;
if(process.platform==='win32'&&process.argv.length===2)throw new Error('On Windows pass --exe /path/to/FrameLab.exe to test the actual Windows transport.');
if(process.argv.length>2) {
  if(process.argv.length!==4||process.argv[2]!=='--exe')throw new Error('Usage: node scripts/test-windows.mjs [--exe /Windows/app.exe]');
  if(process.platform!=='win32')throw new Error('--exe tests require native Windows. Default transport tests do not launch Wine.');
  exe=path.resolve(process.argv[3]);
}
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-windows-http-'));
let child;
try {
  const web=path.join(temporary,'web'),data=path.join(temporary,'data');
  await fs.mkdir(web);await fs.mkdir(data);
  const html='<!doctype html><title>Native transport fixture</title>';
  const csv='Move,Damage\n2B,42\nGlacial Sequoia,0\n';
  const large=Buffer.alloc(4*1024*1024);for(let i=0;i<large.length;i++)large[i]=i%251;
  await Promise.all([
    fs.writeFile(path.join(web,'index.html'),html),fs.writeFile(path.join(web,'fixture.js'),'export const answer=42;'),
    fs.writeFile(path.join(data,'moves.csv'),csv),fs.writeFile(path.join(data,'large.bin'),large),
    fs.writeFile(path.join(data,'space file.json'),'[1,2,3]'),fs.writeFile(path.join(data,'雪.json'),'[4,5,6]'),
    fs.writeFile(path.join(temporary,'outside.txt'),'must not be served'),fs.mkdir(path.join(data,'directory')),
  ]);
  let symlink=true;try{await fs.symlink(path.join(temporary,'outside.txt'),path.join(data,'escape.txt'),'file');}catch{symlink=false;}
  if(!exe) {
    exe=path.join(temporary,'server-test');
    const compiler=process.env.FRAME_LAB_HOST_CXX||(process.platform==='darwin'?'clang++':'g++');
    const result=spawnSync(compiler,['-std=c++17','-O2','-Wall','-Wextra','-pthread',path.join(root,'desktop/windows/LocalServer.cpp'),path.join(root,'desktop/windows/server-test.cpp'),'-o',exe],{stdio:'inherit'});
    if(result.error)throw result.error;if(result.status!==0)throw new Error('Transport test runner compilation failed.');
  }
  child=spawn(exe,process.platform==='win32'?['--server-only','--web-root',web,'--data-root',data]:[web,data],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
  const address=await new Promise((resolve,reject)=>{
    let text='';const timer=setTimeout(()=>reject(new Error('Server startup timed out. '+errors)),10000);
    child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited (${code}). ${errors}`));});
    child.stdout.on('data',chunk=>{text+=chunk;const line=text.split(/\r?\n/)[0];if(/^http:\/\/127\.0\.0\.1:\d+\/$/.test(line)){clearTimeout(timer);resolve(line);}});
  });
  const origin=address.slice(0,-1),host=new URL(address).host;
  const raw=request=>new Promise((resolve,reject)=>{
    const socket=net.connect({host:'127.0.0.1',port:Number(new URL(address).port)});let response='';
    socket.setTimeout(7000,()=>socket.destroy(new Error('HTTP fixture timed out.')));
    socket.on('connect',()=>socket.write(request));socket.on('data',chunk=>{response+=chunk;});
    socket.on('error',reject);socket.on('end',()=>resolve(response));
  });
  const status=text=>Number(text.match(/^HTTP\/1\.1 (\d+)/)?.[1]);
  await test('Windows transport: loopback root serves exact HTML',async()=>{
    const response=await fetch(address);assert.equal(response.status,200);assert.equal(await response.text(),html);
    assert.match(response.headers.get('content-type'),/^text\/html/);assert.equal(response.headers.get('cache-control'),'no-store');
  });
  await test('Windows transport: CSV bytes and MIME are preserved',async()=>{
    const response=await fetch(address+'data/moves.csv');assert.equal(response.status,200);assert.equal(await response.text(),csv);assert.match(response.headers.get('content-type'),/^text\/csv/);
  });
  await test('Windows transport: JavaScript MIME is executable by the embedded view',async()=>{
    const response=await fetch(address+'fixture.js');assert.match(response.headers.get('content-type'),/^text\/javascript/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  });
  await test('Windows transport: HEAD advertises real size without a body',async()=>{
    const response=await fetch(address+'data/large.bin',{method:'HEAD'});assert.equal(response.status,200);assert.equal(Number(response.headers.get('content-length')),large.length);assert.equal((await response.arrayBuffer()).byteLength,0);
  });
  await test('Windows transport: 4 MiB is streamed without truncation',async()=>{
    const response=await fetch(address+'data/large.bin');assert.deepEqual(Buffer.from(await response.arrayBuffer()),large);
  });
  await test('Windows transport: concurrent independent reads remain exact',async()=>{
    await Promise.all(Array.from({length:8},async()=>{const response=await fetch(address+'data/large.bin');assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),large);}));
  });
  await test('Windows transport: percent-encoded spaces and Unicode resolve',async()=>{
    assert.equal(await(await fetch(address+'data/space%20file.json')).text(),'[1,2,3]');
    assert.equal(await(await fetch(address+'data/'+encodeURIComponent('雪.json'))).text(),'[4,5,6]');
  });
  await test('Windows transport: query strings do not change the selected file',async()=>{
    assert.equal(await(await fetch(address+'data/moves.csv?cache=1')).text(),csv);
  });
  await test('Windows transport: missing files and directories are not served',async()=>{
    assert.equal((await fetch(address+'absent')).status,404);assert.equal((await fetch(address+'data/directory')).status,404);
  });
  await test('Windows transport: write methods are rejected',async()=>{
    assert.equal((await fetch(address+'data/moves.csv',{method:'POST',body:'replace'})).status,405);
    assert.equal(await fs.readFile(path.join(data,'moves.csv'),'utf8'),csv);
  });
  await test('Windows transport: foreign Host is rejected',async()=>{
    assert.equal(status(await raw('GET / HTTP/1.1\r\nHost: foreign.test\r\n\r\n')),403);
  });
  await test('Windows transport: foreign Origin is rejected',async()=>{
    assert.equal((await fetch(address,{headers:{Origin:'https://foreign.test'}})).status,403);
  });
  await test('Windows transport: same Origin is accepted',async()=>{
    assert.equal((await fetch(address,{headers:{Origin:origin}})).status,200);
  });
  await test('Windows transport: cross-site browser requests are rejected',async()=>{
    assert.equal(status(await raw(`GET / HTTP/1.1\r\nHost: ${host}\r\nSec-Fetch-Site: cross-site\r\n\r\n`)),403);
  });
  await test('Windows transport: duplicate and malformed headers are rejected',async()=>{
    assert.equal(status(await raw(`GET / HTTP/1.1\r\nHost: ${host}\r\nHost: ${host}\r\n\r\n`)),400);
    assert.equal(status(await raw(`GET / HTTP/1.1\r\nHost: ${host}\r\nnot-a-header\r\n\r\n`)),400);
  });
  await test('Windows transport: raw and encoded traversal are rejected',async()=>{
    for(const target of ['/data/../outside.txt','/data/%2e%2e/outside.txt','/data/%2E%2E%2foutside.txt','/data/%5c..%5coutside.txt','//outside.txt'])
      assert.equal(status(await raw(`GET ${target} HTTP/1.1\r\nHost: ${host}\r\n\r\n`)),403,target);
  });
  await test('Windows transport: invalid encodings, NUL and alternate streams are rejected',async()=>{
    for(const target of ['/data/%00moves.csv','/data/%ZZ','/data/moves.csv:secret','/data/%01moves.csv'])
      assert.equal(status(await raw(`GET ${target} HTTP/1.1\r\nHost: ${host}\r\n\r\n`)),403,target);
  });
  await test('Windows transport: symlink escape cannot expose an external file',{skip:!symlink},async()=>{
    assert.equal((await fetch(address+'data/escape.txt')).status,403);
  });
  await test('Windows transport: oversized request headers are rejected',async()=>{
    assert.equal(status(await raw(`GET / HTTP/1.1\r\nHost: ${host}\r\nX-Padding: ${'x'.repeat(17000)}\r\n\r\n`)),431);
  });
  await test('Windows transport: requests produce no normal access logs',async()=>{
    assert.equal(errors,'');
  });
  console.log(process.platform==='win32'?'Evidence: actual Windows executable, headless HTTP only. Embedded UI still requires a Windows smoke test.':'Evidence: shipping C++ transport compiled and exercised on this host. Windows PE/UI runtime acceptance remains unverified.');
} finally {
  if(child&&child.exitCode===null) {
    if(process.platform==='win32')child.kill();else child.stdin.end('\n');
    const closed=once(child,'exit');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);timer.unref();
    await closed;clearTimeout(timer);
  }
  await fs.rm(temporary,{recursive:true,force:true});
}
