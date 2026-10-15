/** Black-box checks against the exact compiled app server. Development only. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
const app=process.argv[2];if(!app)throw new Error('Usage: npm run test:mac -- /path/to/FrameLab.app');
const binary=path.resolve(app,'Contents/MacOS/FrameLab');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-native-'));let child;
try {
  const web=path.join(tmp,'web'),data=path.join(tmp,'data');await fs.mkdir(web);await fs.mkdir(data);
  await fs.writeFile(path.join(web,'index.html'),'<h1>Local Frame Lab</h1>');await fs.writeFile(path.join(data,'manifest.json'),'{}\n');
  const large=Buffer.alloc(4*1024*1024,0x51);await fs.writeFile(path.join(web,'large.bin'),large);
  const compressed=gzipSync('a,b\n1,2\n');await fs.writeFile(path.join(data,'ram.csv.gz.bin'),compressed);
  await fs.writeFile(path.join(tmp,'private.txt'),'private sentinel');await fs.symlink(path.join(tmp,'private.txt'),path.join(web,'escape.txt'));
  child=spawn(binary,['--server-only','--web-root',web,'--data-root',data],{stdio:['ignore','pipe','pipe']});
  const url=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(new Error('Native server startup timed out')),10000);child.stdout.on('data',b=>{output+=b;const line=output.split('\n')[0];if(line.startsWith('http://')&&output.includes('\n')){clearTimeout(timer);resolve(new URL(line));}});child.stderr.on('data',b=>{errors+=b;});child.on('exit',code=>{clearTimeout(timer);reject(new Error(`Native server exited (${code}): ${errors}`));});});
  const raw=(target,method='GET',headers={})=>new Promise((resolve,reject)=>{const chunks=[];const socket=net.connect(Number(url.port),'127.0.0.1');socket.setTimeout(5000,()=>socket.destroy(new Error('Request timed out')));socket.on('error',reject);socket.on('connect',()=>socket.write(`${method} ${target} HTTP/1.1\r\n${Object.entries({Host:url.host,...headers}).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`));socket.on('data',b=>chunks.push(b));socket.on('end',()=>{const bytes=Buffer.concat(chunks),split=bytes.indexOf('\r\n\r\n');assert.ok(split>=0);const header=bytes.subarray(0,split).toString();resolve({status:Number(header.split(' ')[1]),header,body:bytes.subarray(split+4)});});});
  let checks=0;const check=(condition,message)=>{assert.ok(condition,message);checks++;};
  let result=await raw('/large.bin');check(result.status===200&&result.body.equals(large),'complete 4MiB binary response');
  result=await raw('/');check(result.status===200&&result.body.toString()==='<h1>Local Frame Lab</h1>','root html');check(result.header.includes('text/html'),'html MIME');
  result=await raw('/data/manifest.json');check(result.status===200&&result.body.toString()==='{}\n','external local pack');
  result=await raw('/data/ram.csv.gz.bin');check(result.body.equals(compressed),'opaque gzip bytes unchanged');check(!result.header.toLowerCase().includes('content-encoding'),'no transport decompression');
  result=await raw('/data/ram.csv.gz.bin','HEAD');check(result.status===200&&result.body.length===0&&result.header.includes(`Content-Length: ${compressed.length}`),'HEAD length');
  for(const target of ['/../private.txt','/%2e%2e/private.txt','/data/%2e%2e/private.txt','/escape.txt'])check((await raw(target)).status===403,`restricted path ${target}`);
  check((await raw('/missing')).status===404,'missing file');result=await raw('/data/');check([403,404].includes(result.status)&&result.body.length===0,'no directory listing');
  check((await raw('/','POST')).status===405,'read only');check((await raw('/','GET',{Host:'other.example'})).status===403,'host filter');check((await raw('/','GET',{Origin:'https://other.example'})).status===403,'origin filter');
  check((await raw('/','GET',{'X-Long':'x'.repeat(17000)})).status===431,'header bound');
  const concurrent=await Promise.all(Array.from({length:12},()=>raw('/data/manifest.json')));check(concurrent.every(r=>r.status===200),'concurrent requests');
  console.log(JSON.stringify({compiledNativeHttpChecks:checks,status:'PASS',loopbackHost:url.hostname}));
} finally {if(child&&child.exitCode===null&&child.signalCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await stopped;}await fs.rm(tmp,{recursive:true,force:true});}
