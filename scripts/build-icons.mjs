/** Resize/transcode the finished artwork into desktop/web icon formats. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const icons=path.join(root,'desktop/icons'),master=path.join(icons,'hibiki.png');
const run=(command,args)=>{const r=spawnSync(command,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${command} failed (${r.status})`);};
if(process.platform!=='darwin')throw new Error('Regenerate icons on macOS with ImageMagick and iconutil. Prebuilt icons are included for normal builds.');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'frame-lab-icons-'));
try {
  const iconset=path.join(temporary,'FrameLab.iconset');await fs.mkdir(iconset);
  for(const size of [16,32,128,256,512])for(const scale of [1,2]) {
    const suffix=scale===2?'@2x':'';
    run('magick',[master,'-filter','point','-resize',`${size*scale}x${size*scale}`,'-strip',path.join(iconset,`icon_${size}x${size}${suffix}.png`)]);
  }
  run('/usr/bin/iconutil',['-c','icns',iconset,'-o',path.join(icons,'FrameLab.icns')]);
  run('magick',[master,'-filter','point','-define','icon:auto-resize=256,128,64,48,32,24,16','-strip',path.join(icons,'FrameLab.ico')]);
  run('magick',[master,'-filter','point','-resize','32x32','-strip',path.join(root,'public/app-icon.png')]);
} finally {await fs.rm(temporary,{recursive:true,force:true});}
console.log('Created macOS ICNS, multi-size Windows ICO and browser favicon from hibiki.png.');
