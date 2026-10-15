import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const icon=name=>readFile(new URL(`../desktop/icons/${name}`,import.meta.url));
test('Windows icon contains all required small/large images with valid data bounds',async()=>{
  const b=await icon('FrameLab.ico');assert.equal(b.readUInt16LE(0),0);assert.equal(b.readUInt16LE(2),1);
  const sizes=[];
  for(let i=0;i<b.readUInt16LE(4);i++) {
    const entry=6+i*16,w=b[entry]||256,h=b[entry+1]||256,size=b.readUInt32LE(entry+8),offset=b.readUInt32LE(entry+12);
    assert.equal(w,h);assert(size>0&&offset>=6+b.readUInt16LE(4)*16&&offset+size<=b.length);sizes.push(w);
  }
  assert.deepEqual(sizes.sort((a,b)=>a-b),[16,24,32,48,64,128,256]);
});
test('macOS icon container includes high-density 1024px and smaller representations',async()=>{
  const b=await icon('FrameLab.icns');assert.equal(b.toString('ascii',0,4),'icns');assert.equal(b.readUInt32BE(4),b.length);
  let offset=8;const chunks=[];
  while(offset<b.length) {const size=b.readUInt32BE(offset+4);assert(size>=8&&offset+size<=b.length);chunks.push(b.toString('ascii',offset,offset+4));offset+=size;}
  assert.equal(offset,b.length);assert(chunks.includes('ic10'));assert(chunks.includes('ic04'));assert(chunks.includes('ic09'));
});
test('master portrait and browser favicon are square RGBA PNG assets',async()=>{
  const master=await icon('hibiki.png'),favicon=await readFile(new URL('../public/app-icon.png',import.meta.url));
  for(const b of [master,favicon]) {assert.equal(b.toString('ascii',1,4),'PNG');assert.equal(b.readUInt32BE(16),b.readUInt32BE(20));assert.equal(b[25],6);}
  assert(master.readUInt32BE(16)>=1024);assert.equal(favicon.readUInt32BE(16),32);
});
