import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { NativeClipReader, parseNativeCSV, nativeSHA } from './decoder.ts';
import type { NativeManifest } from './types.ts';
const directory=new URL('../../../public/demo/extended/clips/demo-power-hit/',import.meta.url);
test('native decoder verifies synthetic v1 frames across forward/backward seeks',async()=>{
  const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8')) as NativeManifest;
  const reader=new NativeClipReader(manifest,await readFile(new URL('frames.rgbx.zlib',directory)));
  for(const i of [0,17,6,29,1])assert.equal(await nativeSHA(await reader.frame(i)),manifest.frames[i].rgb_sha256);
  await assert.rejects(reader.frame(-1),/out of range/);
});
test('indexed tile reader uses big-endian u16 palette IDs and verifies RGB integrity',async()=>{
  const pixels=320*224,palette=new Uint8Array(257*3);palette.set([21,43,65],256*3);
  const tiles=new Uint8Array(pixels*2);for(let i=0;i<pixels;i++)tiles[i*2]=1;
  const rgb=new Uint8Array(pixels*3);for(let i=0;i<pixels;i++)rgb.set([21,43,65],i*3);
  const manifest:NativeManifest={schema:'lastblade2-native-clip-v2',accepted:true,width:320,height:224,rgb_size:rgb.length,frame_count:1,frames:[{index:0,rgb_sha256:await nativeSHA(rgb)}],encoding:'indexed-tile32-single-zlib',csv_fields:[],files:{},tile_size:32,index_bytes:2,palette_count:257};
  assert.deepEqual(await new NativeClipReader(manifest,deflateSync(tiles),palette).frame(0),rgb);
  const corrupt={...manifest,frames:[{index:0,rgb_sha256:'0'.repeat(64)}]};await assert.rejects(new NativeClipReader(corrupt,deflateSync(tiles),palette).frame(0),/checksum/);
});
test('CSV parser retains escaped cells/newlines and rejects malformed schemas',()=>{
  assert.deepEqual(parseNativeCSV('name,note\r\n"A,B","line 1\n""line 2"""\r\n'),[{name:'A,B',note:'line 1\n"line 2"'}]);
  assert.throws(()=>parseNativeCSV('a,a\n1,2'),/Duplicate/);
  assert.throws(()=>parseNativeCSV('a,b\n1'),/column count/);
  assert.throws(()=>parseNativeCSV('a\n"unterminated'),/Truncated/);
});
