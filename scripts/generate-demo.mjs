/** Original procedural shapes; no game artwork, ROM bytes or wiki snapshot. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync, gzipSync } from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/demo');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = async (name, value) => { const target = path.join(out, name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, value); };
const json = (name, value) => write(name, JSON.stringify(value) + '\n');
const width=320, height=224, frameCount=30;
const csvCell = value => {const s=String(value??'');return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
const csv = rows => {const fields=Object.keys(rows[0]);return [fields.join(','),...rows.map(r=>fields.map(f=>csvCell(r[f])).join(','))].join('\n')+'\n';};
const profile = Array(256).fill(0); profile[2]=1;
const box = (attack) => Buffer.from(attack ? [1,1,0,0,48,216,236,16,0,0] : [2,2,0,246,10,196,0,0,0,0]).toString('hex');
function rgbFrame(frame, contact) {
  const rgb=Buffer.alloc(width*height*3);
  function rect(x,y,w,h,color) {for(let yy=Math.max(0,y);yy<Math.min(height,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(width,x+w);xx++){const i=(yy*width+xx)*3;rgb[i]=color[0];rgb[i+1]=color[1];rgb[i+2]=color[2];}}
  rect(0,0,width,height,[18,27,25]); rect(0,184,width,40,[37,47,40]);
  for(let x=0;x<width;x+=16)rect(x,184,1,40,[56,64,51]);
  rect(84,124,24,60,[91,169,191]);rect(89,106,14,18,[147,211,218]);
  const active=frame>=6&&frame<=9;
  if(active)rect(100,144,44,14,[129,213,231]);
  const recoil=contact==='whiff'?64:0;
  rect(136+recoil,124,24,60,[181,145,100]);rect(141+recoil,106,14,18,[222,190,130]);
  if(contact==='block'&&frame>=6&&frame<17)rect(130,135,6,36,[239,202,106]);
  if(active&&contact!=='whiff')rect(138,139,5,5,[255,243,153]);
  rect(12,14,130,8,[98,173,148]);rect(178,14,Math.round(130*(contact==='hit'&&frame>=6?240:256)/256),8,[206,147,110]);
  return rgb;
}
const clips=[],metrics={},roster={id:0,key:'demo-fighter',name:'Demo fighter',file:'/data/characters/demo-fighter.json',moveCount:1,capturedMoves:1,coverage:'Synthetic example only'};
for(const mode of ['power','speed','ex'])for(const contact of ['hit','block','whiff']){
  const id=`demo-${mode}-${contact}`,directory=`extended/clips/${id}/`,damage=contact==='hit'?16:contact==='block'?1:0;
  const rows=Array.from({length:frameCount},(_,i)=>({relative_frame:i,p1_char:0,p2_char:0,p1_actor:4096,p2_actor:8192,p1_x:96,p1_y:0,p1_facing:0,p2_x:contact==='whiff'?210:146,p2_y:0,p2_facing:1,p1_health:256,p2_health:i>=6?256-damage:256,p1_meter:i>=6&&contact!=='whiff'?3:0,p2_meter:0,p1_state:i<2||i>=20?0:49,p2_state:contact==='hit'&&i>=6&&i<24?256:contact==='block'&&i>=6&&i<17?288:0,p1_control:i<2||i>=20?1:0,p2_control:contact==='hit'&&i>=6&&i<24||contact==='block'&&i>=6&&i<17?2:1,hitpause:i===7||i===8?1:0,p2_hitpause:i===7||i===8?1:0,boxes:box(i>=6&&i<=9)+box(false),p2_boxes:box(false),scale_x_byte:255,scale_y_byte:255,origin_x_word:0,origin_y_word:200,p2_scale_x_byte:255,p2_scale_y_byte:255,p2_origin_x_word:0,p2_origin_y_word:200,input_key_bits:i===2?16:0,native_frame:i,stage_left:0,stage_right:320}));
  const frames=rows.map((_,i)=>rgbFrame(i,contact));let prev;
  const encoded=deflateSync(Buffer.concat(frames.map(rgb=>{const delta=Buffer.from(rgb);if(prev)for(let i=0;i<delta.length;i++)delta[i]^=prev[i];prev=rgb;return delta;})));
  const ram=gzipSync(csv(rows));
  await write(directory+'frames.rgbx.zlib',encoded);await write(directory+'ram.csv.gz.bin',ram);
  const manifest={schema:'lastblade2-native-clip-v1',accepted:true,width,height,rgb_size:width*height*3,frame_count:frameCount,frames:frames.map((rgb,index)=>({index,rgb_sha256:sha(rgb)})),encoding:'first-rgb-then-xor-previous-single-zlib',csv_fields:Object.keys(rows[0]),files:{'frames.rgbx.zlib':{bytes:encoded.length,sha256:sha(encoded)},'ram.csv.gz':{bytes:ram.length,sha256:sha(ram)}},synthetic:true};
  const bytes=Buffer.from(JSON.stringify(manifest)+'\n');await write(directory+'manifest.json',bytes);
  clips.push({id,selector_id:0,character_name:'Demo fighter',mode,group:'normal',action_id:'5A',label:'5A',condition:contact,outcome:contact,recovered:true,frames:frameCount,fps:60,clip_url:'/data/'+directory,manifest_sha256:sha(bytes),measured_hp_loss:damage,native_missed_updates:0,metadata:{synthetic:true}});
  const values={Character:'Demo fighter',Mode:mode,Move:'5A',Name:'Example strike',Category:'normal',Setup:contact,Damage:damage,Startup:4,Active:2,Recovery:11,HitAdvantage:contact==='hit'?4:null,BlockAdvantage:contact==='block'?-3:null,HeldGuardAdvantage:contact==='block'?-3:null,SwitchGuardAdvantage:null,ReboundRecovery:null,ReboundStatus:'not_observed',GuardPolicy:contact==='block'?'held':'none',MeterGain:contact==='whiff'?0:3,HitCount:contact==='hit'?1:0,EntryFrame:2,FirstActiveFrame:6,LastActiveFrame:9,ActionableFrame:20,ContactFrame:contact==='whiff'?null:6,DefenderReadyFrame:contact==='hit'?24:contact==='block'?17:null,NominalFPS:60,PlaybackFrames:30,SourceAdvanceFrames:28,HitpauseFrames:2,TimingScope:'synthetic example',Recording:id};
  const comparison={};for(const field of ['Startup','Active','Recovery','Damage','HitAdvantage','BlockAdvantage','MeterGain'])comparison[field]={status:field==='Startup'?'different':'unavailable',measured:values[field],wiki:field==='Startup'?5:null,raw:field==='Startup'?['5']:[],reason:field==='Startup'?'Synthetic difference for demonstrating review colours; not a real wiki claim.':'Synthetic demo, not measured game data.'};
  metrics[id]={values,canonical_move:'5A',default_visible:true,primary_recording:true,alias:null,comparison:{fields:comparison,reference:{name:'Example strike'}},phase_ranges:[{phase:'input',start:0,end:1},{phase:'startup',start:2,end:5},{phase:'active',start:6,end:9},{phase:'recovery',start:10,end:19},{phase:'ready',start:20,end:29}],frozen_ranges:[[7,8]]};
}
await json('manifest.json',{schemaVersion:1,game:'Last Blade 2 Frame Lab · synthetic demo',generatedAt:'synthetic',romSha256:'none',characters:[roster],defaultCharacter:roster.key});
await json('characters/demo-fighter.json',{schemaVersion:1,character:roster,defenseQ8:256,attackQ8:{power:256,speed:256,ex:256},moves:[{id:'example',label:'5A',name:'Example strike',category:'Normals',input:'5A',states:[],scriptStates:[],evidence:'unresolved',note:'Procedural demo; import local recordings to inspect actual moves.',wiki:[],timing:{},commands:[],captures:[]}]});
await json('extended/index.json',{schema_version:2,synthetic:true,clips,failures:[],excluded:[],profiles_url:'/data/extended/profiles.json'});
await json('extended/metrics.json',{schema_version:2,synthetic:true,clips:metrics});
await json('extended/profiles.json',{synthetic:true,flags_by_character:{'0':profile}});
await write('extended/moves.csv',csv(Object.values(metrics).map(m=>m.values)));
console.log(`Generated ${clips.length} synthetic clips with original geometric images.`);
