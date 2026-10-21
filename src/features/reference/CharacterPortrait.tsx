import {useState} from 'react';
import type {CharacterSummary} from '../../types/reference.ts';
import {dataUrl} from '../../lib/data.ts';

/** Supports both individual portraits and unchanged roster-sheet assets in a pack. */
export default function CharacterPortrait({character,name}:{character?:CharacterSummary;name?:string}) {
 const [failed,setFailed]=useState<string|null>(null);
 const source=character?.portrait;
 const label=name||character?.name||'Character';
 const r=character?.portraitRegion;
 const region=r&&[r.x,r.y,r.width,r.height,r.imageWidth,r.imageHeight].every(Number.isFinite)&&
   r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=r.imageWidth&&r.y+r.height<=r.imageHeight?r:undefined;
 if(!source||failed===source||(r&&!region))return <span className="character-portrait portrait-fallback" role="img" aria-label={`${label} · portrait unavailable`} title="Portrait unavailable in this data pack">{label.split(/\s+/).map(word=>word[0]).slice(0,2).join('')}</span>;
 return <span className="character-portrait" title={character?.portraitSource?`${label} · ${character.portraitSource}`:label}>
  {region?<svg viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`} role="img" aria-label={`${label} portrait`}>
    <image href={dataUrl(source)} width={region.imageWidth} height={region.imageHeight} onError={()=>setFailed(source)}/>
  </svg>:<img src={dataUrl(source)} alt={`${label} portrait`} onError={()=>setFailed(source)}/>}
 </span>;
}
