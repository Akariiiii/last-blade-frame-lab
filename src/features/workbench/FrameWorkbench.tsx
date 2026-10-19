import { useEffect, useMemo, useRef, useState } from "react";
import { loadNativeClip } from "../../lib/native/decoder.ts";
import { nativeRectangles } from "../../lib/native/geometry.ts";
import { nativeRange } from "../../lib/native/range.ts";
import { drawRange } from './drawRange.ts';
import RangeReadout from './RangeReadout';
import RangeLabel from './RangeLabel';
import type { ClipData, Entry, Index, Profiles } from "../../lib/native/types.ts";
import { fetchData, dataUrl } from "../../lib/data.ts";
import "./FrameWorkbench.css";
import GuardComparison, { type GuardSource } from "./GuardComparison";
import { numeric } from "../../lib/guard.ts";
import { timingText, comparisonReadout, type RepeatVerification, type SameCaptureVerification } from "../../lib/timing.ts";
import TimingStatus from "./TimingStatus";
import HitBreakdown, {type HitEvent,type Landing,type MovePhase} from './HitBreakdown';
import GuardTrials,{type GuardTrial} from './GuardTrials';
import AirTrials,{type AirTrial} from './AirTrials';
import ChargeTrials from './ChargeTrials';
import RecoveryTrials,{type RecoveryRegistry}from './RecoveryTrials';
import LandingTrials,{type LandingRegistry}from './LandingTrials';
import MovementReadout,{type MovementRegistry}from './MovementReadout';
import MoveProperties,{type MovePropertyManifest,type MovePropertyShard}from './MoveProperties';
import SetupMeasurements from './SetupMeasurements';
import MoveStats from './MoveStats';
import {outcomeFields,outcomeValues,recordingsForOutcome,selectedRecording,type MoveOutcome}from '../../lib/moveSelection.ts';
import {setupKey,trialsForState,type SetupRegistry}from '../../lib/setupCoverage.ts';
import StunResearch,{type StunResearchData}from './StunResearch';
import {chargeTrialKey,type ChargeRegistry}from '../../lib/charge.ts';

type Value = string | number | boolean | null;
interface Comparison { status: string; measured: number | null; wiki: number | null; raw: string[]; reason: string }
interface Measurement {
  values: Record<string, Value>; canonical_move: string; default_visible: boolean; primary_recording: boolean; alias: string | null;
  comparison: { fields: Record<string, Comparison>; reference: { url?: string; name?: string } };
  phase_ranges: { phase: string; start: number; end: number }[]; frozen_ranges: number[][];
  repeat_verification?:RepeatVerification;hit_events?:HitEvent[];landing?:Landing;
  same_capture_verification?:SameCaptureVerification;
  move_phase?:MovePhase|null;
  guard_trials?:GuardTrial[];
  air_trials?:AirTrial[];
}
interface Metrics { move_properties_url?:string; movement_trials_url?:string; landing_trials_url?:string; landing_trials_csv_url?:string; recovery_trials_url?:string; recovery_trials_csv_url?:string; setup_coverage_url?:string; stun_research_url?:string; charge_trials_url?:string; charge_trials_csv_url?:string; guard_trials_csv_url?:string; clips: Record<string, Measurement>; guard_sources?: Record<string, GuardSource>; guard_evidence_url?: string;hit_events_csv_url?:string }
const categories: Record<string, string> = { normal: "Normals", normal_input_probe: "Normals", normal_native_input: "Normals", command_normal: "Command normals", air_normal: "Air normals", air_command: "Air moves", dash: "Dash attacks", movement: "Movement", special: "Specials", dm: "DM", sdm: "SDM", followup: "Follow-ups", conditional_chain: "Chains", system_deflect: "Deflect", system_mode_switch: "Mode switch", speed_combo_activation: "Speed combos", system_attack: "System attacks", system_taunt: "Taunts", throw: "Throws" };
const categoryOrder=["Normals","Command normals","Dash attacks","Air normals","Air moves","Specials","Throws","DM","SDM","Chains","Follow-ups","Speed combos","Deflect","System attacks","Mode switch","Taunts","Movement","Other"];
const guardLabels:Record<string,string>={held:"Guard held",release:"Guard released after contact",switch:"Switch guard",switch4A:"Switch guard → 4A"};
const normalOrder=["5A","4A","5A (far)","5B","4B","5B (far)","6B","5C","5C (far)","6C","2A","2B","2C","3C","6A","3B"];
const phases: Record<string, string> = { input: "Input", parent: "Parent chain", startup: "Startup", active: "Captured hitbox", pre_response:"Verified pre-response hitbox", same_capture_pre_response:"Native pre-response hitbox · same capture", contact: "Contact observed", effect: "Effect / follow-through", later: "Later input", rebound: "Weapon rebound", recovery: "Recovery", ready: "Ready", gap: "Between hits", motion: "Move animation", unresolved: "Unresolved" };
const colors: Record<string, string> = { attack: "#ff635c", hurt: "#80c997", push: "#7db5df", unknown: "#d2b775" };
const labels: Record<string, string> = { HitAdvantage: "On hit", BlockAdvantage: "On block", MeterGain: "Meter", StunDamage: "Stun" };
const text = (value: Value | undefined, signed = false) => value === null || value === undefined || value === "" ? "—" : signed && typeof value === "number" && value > 0 ? `+${value}` : String(value);
const clean = (value: string) => value.replace("combo activation >", "Speed combo >").replace(/ @0x[0-9a-f]+/g, "");
const inputText = (mask: number) => [[1,"↑"],[2,"↓"],[4,"←"],[8,"→"],[16,"A"],[32,"B"],[64,"C"],[128,"D"]].filter(([bit]) => mask & Number(bit)).map(([,label]) => label).join(" ") || "Released";

export default function FrameWorkbench({ selectorId = 0, mode = "power" }: { selectorId?: number; mode?: string }) {
  const [index,setIndex]=useState<Index | null>(null), [metrics,setMetrics]=useState<Metrics | null>(null), [profiles,setProfiles]=useState<Profiles | null>(null);
  const [setupRegistry,setSetupRegistry]=useState<SetupRegistry|null>(null),[setupError,setSetupError]=useState("");
  const [chargeRegistry,setChargeRegistry]=useState<ChargeRegistry|null>(null),[chargeError,setChargeError]=useState("");
  const [stunResearch,setStunResearch]=useState<StunResearchData|null>(null),[stunError,setStunError]=useState("");
  const [recoveryRegistry,setRecoveryRegistry]=useState<RecoveryRegistry|null>(null),[recoveryError,setRecoveryError]=useState("");
  const [landingRegistry,setLandingRegistry]=useState<LandingRegistry|null>(null),[landingError,setLandingError]=useState("");
  const [movementRegistry,setMovementRegistry]=useState<MovementRegistry|null>(null),[movementError,setMovementError]=useState("");
  const [propertyManifest,setPropertyManifest]=useState<MovePropertyManifest|null>(null);
  const [propertyShard,setPropertyShard]=useState<MovePropertyShard|null>(null),[propertyError,setPropertyError]=useState("");
  const [requestedOutcome,setOutcome]=useState<MoveOutcome>("hit");
  const [move,setMove]=useState(""), [selected,setSelected]=useState(""), [search,setSearch]=useState(""), [allVariants,setAllVariants]=useState(false);
  const [loadedClip,setLoadedClip]=useState<{id:string;data:ClipData} | null>(null), [frame,setFrame]=useState(0), [loadedImage,setLoadedImage]=useState<{ id:string;frame:number; rgb:Uint8Array } | null>(null);
  const [playing,setPlaying]=useState(false), [rate,setRate]=useState(.25), [loop,setLoop]=useState(true), [error,setError]=useState("");
  const [layers,setLayers]=useState({attack:true,hurt:true,push:true,unknown:false,p2:true,objects:true,distance:true}); const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const abort=new AbortController();
    const get=async(url:string)=>{const r=await fetchData(url,{signal:abort.signal});if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();};
    void Promise.all([get("/data/extended/index.json"),get("/data/extended/metrics.json"),get("/data/extended/profiles.json")])
      .then(([i,m,p])=>{setIndex(i);setMetrics(m);setProfiles(p);}).catch(e=>{if(!abort.signal.aborted)setError(String(e));});
    return ()=>abort.abort();
  },[]);
  useEffect(()=>{
    const url=metrics?.setup_coverage_url;setSetupRegistry(null);setSetupError("");if(!url)return;
    const abort=new AbortController();
    void fetchData(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();})
      .then(data=>{if(!abort.signal.aborted)setSetupRegistry(data);}).catch(e=>{if(!abort.signal.aborted)setSetupError(String(e));});
    return ()=>abort.abort();
  },[metrics?.setup_coverage_url]);
  useEffect(()=>{
    const url=metrics?.charge_trials_url;setChargeRegistry(null);setChargeError("");if(!url)return;
    const abort=new AbortController();
    void fetchData(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();})
      .then(data=>{if(!abort.signal.aborted)setChargeRegistry(data);}).catch(e=>{if(!abort.signal.aborted)setChargeError(String(e));});
    return ()=>abort.abort();
  },[metrics?.charge_trials_url]);
  useEffect(()=>{
    const url=metrics?.stun_research_url;setStunResearch(null);setStunError("");if(!url)return;
    const abort=new AbortController();
    void fetchData(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();})
      .then(data=>{if(!abort.signal.aborted)setStunResearch(data);}).catch(e=>{if(!abort.signal.aborted)setStunError(String(e));});
    return ()=>abort.abort();
  },[metrics?.stun_research_url]);
  useEffect(()=>{
    const url=metrics?.recovery_trials_url;setRecoveryRegistry(null);setRecoveryError("");if(!url)return;
    const abort=new AbortController();
    void fetchData(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();})
      .then(data=>{if(!abort.signal.aborted)setRecoveryRegistry(data);}).catch(e=>{if(!abort.signal.aborted)setRecoveryError(String(e));});
    return ()=>abort.abort();
  },[metrics?.recovery_trials_url]);
  useEffect(()=>{
    const url=metrics?.landing_trials_url;setLandingRegistry(null);setLandingError("");if(!url)return;
    const abort=new AbortController();
    void fetchData(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();})
      .then(data=>{if(!abort.signal.aborted)setLandingRegistry(data);}).catch(e=>{if(!abort.signal.aborted)setLandingError(String(e));});
    return ()=>abort.abort();
  },[metrics?.landing_trials_url]);
  useEffect(()=>{
    const url=metrics?.movement_trials_url;setMovementRegistry(null);setMovementError("");if(!url)return;
    const abort=new AbortController();
    void fetchData(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();})
      .then(data=>{if(!abort.signal.aborted)setMovementRegistry(data);}).catch(e=>{if(!abort.signal.aborted)setMovementError(String(e));});
    return ()=>abort.abort();
  },[metrics?.movement_trials_url]);
  useEffect(()=>{
    const url=metrics?.move_properties_url;setPropertyManifest(null);setPropertyError("");if(!url)return;
    const abort=new AbortController();
    void fetchData(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();})
      .then(data=>{if(data.schema_version!==2||!data.shards)throw new Error("Unsupported move properties");if(!abort.signal.aborted)setPropertyManifest(data);})
      .catch(e=>{if(!abort.signal.aborted)setPropertyError(String(e));});
    return ()=>abort.abort();
  },[metrics?.move_properties_url]);
  useEffect(()=>{
    setPropertyShard(null);if(!propertyManifest)return;setPropertyError("");
    const reference=propertyManifest.shards[`${selectorId}|${mode}`];if(!reference)return;
    const abort=new AbortController();
    void fetchData(reference.url,{signal:abort.signal}).then(async response=>{
      if(!response.ok)throw new Error(`Cannot load ${reference.url}`);
      const bytes=await response.arrayBuffer();
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(bytes.byteLength!==reference.bytes||digest!==reference.sha256)throw new Error("Move properties checksum failed");
      const data=JSON.parse(new TextDecoder().decode(bytes)) as MovePropertyShard;
      if(data.schema_version!==2||data.selector!==selectorId||data.mode!==mode||Object.keys(data.groups).length!==reference.groups)throw new Error("Move properties context mismatch");
      if(!abort.signal.aborted)setPropertyShard(data);
    }).catch(e=>{if(!abort.signal.aborted)setPropertyError(String(e));});
    return ()=>abort.abort();
  },[propertyManifest,selectorId,mode]);
  useEffect(()=>{setMove("");setSelected("");setSearch("");},[selectorId]);
  useEffect(()=>{setSelected("");},[mode]);
  const available=useMemo(()=> (index?.clips || []).filter(e=>e.selector_id===selectorId && e.mode===mode && metrics?.clips[e.id]),[index,metrics,selectorId,mode]);
  const moves=useMemo(()=>{
    const result=new Map<string,Entry>();
    for(const e of available){const m=metrics!.clips[e.id];if(!m.default_visible)continue;const key=m.canonical_move;const old=result.get(key);if(!old || e.id.startsWith("ground01"))result.set(key,e);}
    return [...result].sort((a,b)=>categoryOrder.indexOf(categories[a[1].group] || "Other")-categoryOrder.indexOf(categories[b[1].group] || "Other") ||
      (normalOrder.includes(a[0]) && normalOrder.includes(b[0]) ? normalOrder.indexOf(a[0])-normalOrder.indexOf(b[0]) : a[0].localeCompare(b[0],undefined,{numeric:true})));
  },[available,metrics]);
  const currentMove=moves.some(([key])=>key===move)?move:(moves.some(([key])=>key==="5A")?"5A":moves[0]?.[0] || "");
  const moveRecordings=available.filter(e=>metrics!.clips[e.id].canonical_move===currentMove);
  const outcome=(requestedOutcome==='mixed'||requestedOutcome==='unresolved')&&!moveRecordings.some(e=>metrics!.clips[e.id].values.Setup===requestedOutcome)?'hit':requestedOutcome;
  const anchor=moveRecordings.find(e=>metrics!.clips[e.id].primary_recording)||moveRecordings[0];
  const anchorMetric=anchor&&metrics?.clips[anchor.id];
  const recordings=recordingsForOutcome(moveRecordings,metrics?.clips||{},outcome,allVariants);
  const entry=selectedRecording(recordings,selected);
  const measured=entry&&metrics?.clips[entry.id];
  const setupGroup=setupRegistry?.groups[setupKey(selectorId,mode,currentMove)];
  const trace=setupGroup&&(outcome==='hit'||outcome==='block'||outcome==='whiff')?trialsForState(setupGroup,outcome)[0]:undefined;
  const values=outcomeValues(measured?.values||trace?.values,outcome);
  const fields=outcomeFields(outcome);
  // A stale decoded image must never survive an outcome or recording switch.
  const clip=entry&&loadedClip?.id===entry.id?loadedClip.data:null;
  const image=entry&&loadedImage?.id===entry.id?loadedImage:null;
  const related=available.filter(e=>metrics!.clips[e.id].canonical_move===currentMove && metrics!.clips[e.id].default_visible && metrics!.clips[e.id].primary_recording);
  const block=related.find(e=>metrics!.clips[e.id].values.Setup==="block");
  const heldEntry=measured?.values.GuardPolicy==='held'&&measured.values.Setup==='block'?entry:block;
  const heldMetric=heldEntry&&metrics?.clips[heldEntry.id];
  const switchValue=numeric(measured?.values.SwitchGuardAdvantage ?? heldMetric?.values.SwitchGuardAdvantage);
  const switchId=String(measured?.values.SwitchGuardSource || heldMetric?.values.SwitchGuardSource || '');
  const switchSource=metrics?.guard_sources?.[switchId];
  const blockComparison=heldMetric?.comparison.fields.BlockAdvantage;
  const statSource=(_field:string)=>entry;
  const groups=new Map<string,[string,Entry][]>();
  for(const item of moves){if(!`${item[0]} ${metrics!.clips[item[1].id].values.Name}`.toLowerCase().includes(search.toLowerCase()))continue;const group=categories[item[1].group] || "Other";groups.set(group,[...(groups.get(group)||[]),item]);}
  useEffect(()=>{
    setPlaying(false);setFrame(0);setLoadedClip(null);setLoadedImage(null);setError("");if(!entry)return;
    const abort=new AbortController();void loadNativeClip(entry,abort.signal).then(c=>{if(!abort.signal.aborted)setLoadedClip({id:entry.id,data:c});}).catch(e=>{if(!abort.signal.aborted)setError(String(e));});
    return ()=>abort.abort();
  },[entry?.id]);
  useEffect(()=>{if(!clip||!entry)return;const id=entry.id;let alive=true;void clip.reader.frame(frame).then(rgb=>{if(alive)setLoadedImage({id,frame,rgb});}).catch(e=>{if(alive){setError(String(e));setPlaying(false);}});return ()=>{alive=false;};},[clip,frame,entry?.id]);
  useEffect(()=>{
    if(!playing||!clip||!entry)return;
    const timer=window.setInterval(()=>setFrame(f=>{if(f>=clip.rows.length-1){if(loop)return 0;setPlaying(false);return f;}return f+1;}),1000/(entry.fps*rate));return ()=>window.clearInterval(timer);
  },[playing,clip,entry,rate,loop]);
  const seek=(f:number)=>{setPlaying(false);setFrame(Math.max(0,Math.min((clip?.rows.length || 1)-1,f)));};
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(["INPUT","SELECT","TEXTAREA","BUTTON"].includes(target.tagName))return;
      if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();seek(frame+(e.key==="ArrowRight"?1:-1)*(e.shiftKey?10:1));}
      if(e.key===" "){e.preventDefault();if(clip)setPlaying(v=>!v);}if(e.key==="Home")seek(0);if(e.key==="End")seek((clip?.rows.length || 1)-1);};
    window.addEventListener("keydown",handler);return ()=>window.removeEventListener("keydown",handler);
  },[frame,clip]);
  const row=clip && image?clip.rows[image.frame]:undefined;
  const range=useMemo(()=>row&&entry?nativeRange(row,entry):null,[row,entry]);
  useEffect(()=>{
    const context=canvas.current?.getContext("2d");if(!context||!image||!row||!profiles||!clip)return;
    const paint=()=>{
    const rgba=new Uint8ClampedArray(320*224*4);for(let s=0,t=0;s<image.rgb.length;s+=3,t+=4){rgba[t]=image.rgb[s];rgba[t+1]=image.rgb[s+1];rgba[t+2]=image.rgb[s+2];rgba[t+3]=255;}
    context.putImageData(new ImageData(rgba,320,224),0,0);const boxes=[...nativeRectangles(row,profiles,"p1").boxes,...(layers.p2?nativeRectangles(row,profiles,"p2").boxes:[])];
    if(layers.objects)for(const obj of clip.objects.get(Number(row.relative_frame)) || [])boxes.push(...nativeRectangles(obj,profiles,"object").boxes);
    for(const box of boxes){if(!layers[box.role])continue;context.strokeStyle=colors[box.role];context.fillStyle=colors[box.role]+"24";context.lineWidth=.75;context.setLineDash(box.role==="push"?[3,2]:[]);context.fillRect(box.x,box.y,box.width,box.height);context.strokeRect(box.x+.25,box.y+.25,box.width,box.height);context.setLineDash([]);}
    if(layers.distance&&range)drawRange(context,row,range);
    };paint();const observer=new ResizeObserver(paint);observer.observe(canvas.current!);return ()=>observer.disconnect();
  },[image,row,profiles,clip,layers,range]);
  const phaseAt=(i:number)=>measured?.phase_ranges.find(r=>r.start<=i&&i<=r.end)?.phase || "unresolved";
  const frozen=(i:number)=>measured?.frozen_ranges.some(([a,b])=>a<=i&&i<=b) || false;
  const visibleFrame=image?.frame ?? 0;
  const phase=phaseAt(visibleFrame);
  const currentDamage=row&&clip&&visibleFrame>0?Math.max(0,Number(clip.rows[visibleFrame-1].p2_health)-Number(row.p2_health)):0;
  return <section className="frame-workbench" aria-label="Move frame workbench">
    <aside className="move-browser workbench-moves"><div className="sidebar-heading"><span>MOVES</span><b>{moves.length}</b></div>
      <input className="search-input" aria-label="Find move" placeholder="Find move…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="move-groups">{[...groups].map(([group,items])=><section key={group}><h2>{group}<span>{items.length}</span></h2>{items.map(([key,e])=><button className={`move-item ${key===currentMove?"selected":""}`} key={key} aria-pressed={key===currentMove} onClick={()=>{setMove(key);setSelected("");}}><div><strong>{clean(key)}</strong></div>{metrics!.clips[e.id].values.Name!==e.label&&<small>{text(metrics!.clips[e.id].values.Name)}</small>}</button>)}</section>)}</div>
      <p className="coverage-note">Inputs sharing the recorded move are grouped. Conditional variants remain available.</p>
    </aside>
    <div className="workbench-content">
      {error&&<p role="alert" className="error-banner">{error}</p>}
      {!anchor&&<p>{metrics?"No accepted recordings in this mode.":"Loading move data…"}</p>}
      {anchor&&anchorMetric&&<>
        <div className="move-heading"><div><div className="eyebrow">{anchor.character_name} / {categories[anchor.group] || anchor.group} / {mode.toUpperCase()}</div><h1><span className="command">{clean(currentMove)}</span>{anchorMetric.values.Name!==anchor.label&&<span className="move-name">{text(anchorMetric.values.Name)}</span>}</h1><div className="heading-meta"><span className={`badge ${entry?'badge-measured':''}`}>{entry?'Recorded clip':trace?'RAM measurement · no image':'Not recorded'}</span><span>{text(measured?.values.NominalFPS ?? anchorMetric.values.NominalFPS)} nominal fps</span></div></div><div className="csv-actions"><a className="export-button" href={dataUrl("/data/extended/moves.csv")} download>Export CSV ↗</a>{metrics?.hit_events_csv_url&&<a className="export-button" href={dataUrl(metrics.hit_events_csv_url)} download>Hit events CSV ↗</a>}</div></div>
        <label className="mobile-move-picker">Move<select aria-label="Move" value={currentMove} onChange={e=>{setMove(e.target.value);setSelected("");}}>{moves.map(([key])=><option key={key} value={key}>{clean(key)}</option>)}</select></label>
        <div className="outcome-picker"><label htmlFor="move-outcome">Outcome</label><select id="move-outcome" aria-label="Outcome" value={outcome} onChange={e=>{setOutcome(e.target.value as MoveOutcome);setSelected("");setPlaying(false);setFrame(0);}}>
          <option value="hit">Hit</option><option value="block">Block</option><option value="whiff">Whiff</option>
          {moveRecordings.some(e=>metrics!.clips[e.id].values.Setup==='mixed')&&<option value="mixed">Mixed contact</option>}
          {moveRecordings.some(e=>metrics!.clips[e.id].values.Setup==='unresolved')&&<option value="unresolved">Unresolved contact</option>}
        </select><span>{entry?'Statistics, clip and timeline use this recording.':trace?'Measured data available; image clip not recorded.':'No measurement or clip for this outcome yet.'}</span></div>
        <MoveStats values={values} comparisons={measured?.comparison.fields} outcome={outcome}/>
        {entry?.measurement_protocol?.opponent_state_policy&&<p className="measurement-note">Opponent setup: {entry.measurement_protocol.opponent_state_policy}. These values belong to this recorded setup.</p>}
        {!entry&&trace&&<p className="measurement-note">{trace.repeat_equal?'Normal / 2× / 4× RAM repeats match in this fixture.':'Single-pacing RAM measurement · provisional.'} These statistics belong to an independent {outcome} trial. No image frames are available for playback.</p>}
        {entry&&measured?<>
        <div className="workbench"><div className="stage-top"><span>Recorded game frames</span><span className={`phase-badge phase-${phase}`}>{phases[phase]}{frozen(visibleFrame)?" · hitpause":""}</span></div><div className="workbench-stage"><div className="clip-viewport"><canvas key={entry.id} ref={canvas} width={320} height={224} aria-label={`${entry.character_name} ${currentMove} frame ${visibleFrame+1}`}/>{layers.distance&&range&&row&&<RangeLabel row={row} range={range}/>}</div>{!image&&<span>Loading frames…</span>}</div>
          <div className="layer-controls"><div className="layer-toggles">{(["attack","hurt","push","p2","objects","distance"] as const).map(key=><button key={key} className={`layer-button ${key} ${layers[key]?"on":""}`} aria-pressed={layers[key]} onClick={()=>setLayers(v=>({...v,[key]:!v[key]}))}><i/>{key==="attack"?"Hitboxes":key==="hurt"?"Hurtboxes":key==="push"?"Push boxes":key==="p2"?"P2":key==="distance"?"Distance / grab range":"Projectiles"}</button>)}</div></div>
          {layers.distance&&range&&<RangeReadout range={range}/>}
          <div className="timeline"><div className="timeline-header"><span>Frame <strong>{visibleFrame+1}</strong> / {clip?.rows.length || 0}<small> · {text(measured.values.SourceAdvanceFrames)} counted · {text(measured.values.HitpauseFrames)} frozen</small></span><span>{phases[phase]}</span></div>
            <div className="timeline-track" role="group" aria-label="Recorded frame timeline">{clip?.rows.map((_,i)=><button key={i} className={`frame-tick phase-${phaseAt(i)} ${frozen(i)?"frozen":""} ${i===visibleFrame?"current":""}`} title={`Frame ${i+1} · ${phases[phaseAt(i)]}${frozen(i)?" · frozen":""}`} aria-label={`Go to frame ${i+1}`} onClick={()=>seek(i)}/>)}</div>
            <input className="scrubber" aria-label="Recorded frame" type="range" min={0} max={Math.max(0,(clip?.rows.length || 1)-1)} value={frame} disabled={!clip} onChange={e=>seek(Number(e.target.value))}/>
            <div className="transport"><div className="playback-buttons"><button aria-label="First frame" onClick={()=>seek(0)} disabled={!clip}>⏮</button><button aria-label="Previous frame" onClick={()=>seek(frame-1)} disabled={!clip||frame===0}>‹</button><button className="play-button" onClick={()=>setPlaying(v=>!v)} disabled={!clip}>{playing?"Ⅱ Pause":"▶ Play"}</button><button aria-label="Next frame" onClick={()=>seek(frame+1)} disabled={!clip||frame>=clip.rows.length-1}>›</button><button aria-label="Last frame" onClick={()=>seek((clip?.rows.length || 1)-1)} disabled={!clip}>⏭</button><select aria-label="Playback speed" value={rate} onChange={e=>setRate(Number(e.target.value))}>{[.1,.25,.5,1,2].map(r=><option key={r} value={r}>{r}×</option>)}</select><button aria-pressed={loop} onClick={()=>setLoop(v=>!v)}>↻ Loop</button></div></div>
            <div className="phase-legend">{["startup","active","pre_response",...(measured?.same_capture_verification?["same_capture_pre_response"]:[]),"contact","effect","recovery","rebound","ready"].map(p=><span key={p}><i className={`phase-${p}`}/>{phases[p]}</span>)}<span><i className="frozen"/>Hitpause · ← → step</span></div>
          </div>
        </div>
        <div className="frame-boundaries"><span>Entry <b>{measured.values.EntryFrame==null?"—":Number(measured.values.EntryFrame)+1}</b></span><span>First contact <b>{measured.values.ContactFrame==null?"—":Number(measured.values.ContactFrame)+1}</b></span><span>First captured hitbox <b>{measured.values.FirstActiveFrame==null?"—":Number(measured.values.FirstActiveFrame)+1}</b></span><span>Last captured hitbox <b>{measured.values.LastActiveFrame==null?"—":Number(measured.values.LastActiveFrame)+1}</b></span><span>Control ready <b>{measured.values.ActionableFrame==null?"—":Number(measured.values.ActionableFrame)+1}</b></span></div>
        {row&&<div className="frame-readout"><span>This frame <b>{currentDamage} damage</b></span><span>HP <b>{row.p1_health} / {row.p2_health}</b></span><span>Meter <b>{row.p1_meter} / {row.p2_meter}</b></span><span>Input <b>{inputText(Number(row.input_key_bits))}</b></span><span>Recording total <b>{text(measured.values.RecordingDamage ?? measured.values.Damage)}</b></span></div>}
        {measured.hit_events&&<HitBreakdown events={measured.hit_events} values={measured.values} landing={measured.landing} movePhase={measured.move_phase} defenderPacket={row?.p2_actor_packet} onSeek={seek}/>}
        </>:<div className="workbench missing-recording" role="status" aria-label="Missing outcome recording"><div className="stage-top"><span>{outcome[0].toUpperCase()+outcome.slice(1)} recording</span></div><div className="empty-recording"><strong>No {outcome} clip recorded yet</strong><p>{trace?'The measured values above come from a RAM-only trial.':'This outcome still needs to be measured and recorded.'}</p><span>Frame playback unavailable</span></div></div>}
        <details className="recording-options"><summary>Recording details and other measurements</summary>
          {measured&&<TimingStatus values={measured.values} repeatVerification={measured.repeat_verification} sameCaptureVerification={measured.same_capture_verification}/>}
          {entry&&<div className="capture-picker"><label>Variant<select aria-label="Recording variant" value={entry.id} onChange={e=>setSelected(e.target.value)}>{recordings.map(e=><option key={e.id} value={e.id}>{e.label}{e.metadata.opponent_air?' · airborne target':''}{metrics!.clips[e.id].values.GuardPolicy&&metrics!.clips[e.id].values.GuardPolicy!=='none'?` · ${guardLabels[String(metrics!.clips[e.id].values.GuardPolicy)]||'Guard'}`:''}{allVariants?` · ${e.id}`:''}</option>)}</select></label><label className="variant-toggle"><input type="checkbox" checked={allVariants} onChange={e=>setAllVariants(e.target.checked)}/>All input variants</label></div>}
          <SetupMeasurements group={setupGroup} state={outcome}/>
          {setupError&&<p role="status">Setup measurements unavailable: {setupError}</p>}
          {measured?.air_trials&&<AirTrials trials={measured.air_trials}/>}
          <ChargeTrials key={`${selectorId}|${mode}|${currentMove}`} trials={chargeRegistry?.groups[chargeTrialKey(selectorId,mode,anchor.action_id)]} csvUrl={metrics?.charge_trials_csv_url}/>
          {chargeError&&<p role="status">Charge trial data unavailable: {chargeError}</p>}
          {entry&&<p>{entry.id} · {text(measured?.values.TimingScope)} · {entry.native_missed_updates} unchanged native-counter ticks.</p>}
        </details>
        {outcome==='block'&&<details className="recording-options guard-options"><summary>Guard recovery · held / released / switch / rebound</summary>
          <GuardComparison values={heldMetric?.values} wiki={blockComparison?.wiki ?? null} wikiRaw={blockComparison?.raw.join(' / ')||''} switchValue={switchValue} source={switchSource} recording={heldEntry?.id} mode={mode} evidenceUrl={metrics?.guard_evidence_url} onViewHeld={heldEntry?()=>{setSelected(heldEntry.id);}:undefined}/>
          <GuardTrials trials={measured?.guard_trials||heldMetric?.guard_trials} csvUrl={metrics?.guard_trials_csv_url}/>
        </details>}
        <MoveProperties group={propertyShard?.selector===selectorId&&propertyShard.mode===mode?propertyShard.groups[`${selectorId}|${mode}|${currentMove}`]:undefined} outcome={outcome}/>
        {propertyError&&<p role="status">Move property data unavailable: {propertyError}</p>}
        <RecoveryTrials trials={recoveryRegistry?.groups[`${selectorId}|${mode}|${currentMove}`]} csvUrl={metrics?.recovery_trials_csv_url}/>
        {recoveryError&&<p role="status">Defender recovery data unavailable: {recoveryError}</p>}
        <LandingTrials data={landingRegistry?.groups[`${selectorId}|${mode}|${currentMove}`]?.[outcome]} csvUrl={metrics?.landing_trials_csv_url}/>
        {landingError&&<p role="status">Landing data unavailable: {landingError}</p>}
        <MovementReadout trial={movementRegistry?.clips[entry?.id??'']} recording={entry?.id} onSeek={clip?seek:undefined}/>
        {movementError&&<p role="status">Movement data unavailable: {movementError}</p>}
        {stunError&&<p role="alert" className="error-banner">{stunError}</p>}
        {stunResearch&&<StunResearch data={stunResearch} selectorId={selectorId}/>}
        {measured&&<details className="comparison-panel"><summary>Measured / wiki comparison</summary><table><thead><tr><th>Parameter</th><th>Measured</th><th>Wiki</th><th>Review</th></tr></thead><tbody>{fields.map(field=>{const source=statSource(field);const m=source&&metrics!.clips[source.id];const c=m?.comparison.fields[field];const differs=c?.wiki!=null&&c.measured!=null&&c.wiki!==c.measured;return <tr className={differs||c?.status==="different"?"difference":c?.status==="match"?"agreement":""} key={field}><th>{labels[field] || field}</th><td>{timingText(m?.values,field) ?? text(m?.values[field],field.includes("Advantage"))}{source&&source.id!==entry?.id&&<small>Other setup of this move</small>}</td><td>{c?.raw.join(" / ") || "—"}</td><td>{comparisonReadout(m?.values,field,c).label}{field==="Startup"&&m?.values.StartupInclusive!=null&&<small>Inclusive: {String(m.values.StartupInclusive)}f</small>}</td></tr>;})}</tbody></table>{measured?.comparison.reference.url&&<a href={measured.comparison.reference.url} target="_blank" rel="noreferrer">Saved wiki source ↗</a>}</details>}
        <p className="measurement-note">Startup is elapsed observed-entry to first active sample, excluding identified source hitpause; the first-active-inclusive count is shown beside it. Verified equivalent repeats can supply pre-response samples omitted by the original snapshots. Without that evidence, earlier contact leaves only an upper bound (≤) and unknown full active duration. Contact marks an observed reaction or HP loss, not an invented hitbox. Recovery belongs to the selected recording and includes the control-ready boundary. Block rebound uses its separate response-entry duration; missing block timing never borrows hit timing. Super/projectile timing requires phase review. Frame markers above are 1-based; CSV markers are 0-based. Frame advantage uses defender readiness after the last selected contact, without an earliest-retaliation test. Owned projectiles can remain active after their creator becomes ready.</p>
        {measured?.alias&&<p className="measurement-note">{measured.alias==="distinct_dash_attack"?"Verified dash attack, distinct from standing normals.":"This recording retains an input/context variant; it is not counted as a separate move."}</p>}

      </>}
    </div>
  </section>;
}
