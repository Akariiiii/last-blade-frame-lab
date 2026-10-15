import { useEffect, useMemo, useRef, useState } from "react";
import { loadNativeClip } from "../../lib/native/decoder.ts";
import { nativeRectangles } from "../../lib/native/geometry.ts";
import type { ClipData, Entry, Index, Profiles } from "../../lib/native/types.ts";
import { fetchData, dataUrl } from "../../lib/data.ts";
import "./FrameWorkbench.css";
import GuardComparison, { type GuardSource } from "./GuardComparison";
import { numeric } from "../../lib/guard.ts";
import { timingText, hasTimingValue } from "../../lib/timing.ts";
import TimingStatus from "./TimingStatus";

type Value = string | number | boolean | null;
interface Comparison { status: string; measured: number | null; wiki: number | null; raw: string[]; reason: string }
interface Measurement {
  values: Record<string, Value>; canonical_move: string; default_visible: boolean; primary_recording: boolean; alias: string | null;
  comparison: { fields: Record<string, Comparison>; reference: { url?: string; name?: string } };
  phase_ranges: { phase: string; start: number; end: number }[]; frozen_ranges: number[][];
}
interface Metrics { clips: Record<string, Measurement>; guard_sources?: Record<string, GuardSource>; guard_evidence_url?: string }
const categories: Record<string, string> = { normal: "Normals", normal_input_probe: "Normals", normal_native_input: "Normals", command_normal: "Command normals", air_normal: "Air normals", air_command: "Air moves", dash: "Dash attacks", movement: "Movement", special: "Specials", dm: "DM", sdm: "SDM", followup: "Follow-ups", conditional_chain: "Chains", system_deflect: "Deflect", system_mode_switch: "Mode switch", speed_combo_activation: "Speed combos", system_attack: "System attacks", throw: "Throws" };
const categoryOrder=["Normals","Command normals","Dash attacks","Air normals","Air moves","Specials","Throws","DM","SDM","Chains","Follow-ups","Speed combos","Deflect","System attacks","Mode switch","Movement","Other"];
const normalOrder=["5A","4A","5A (far)","5B","4B","5B (far)","6B","5C","5C (far)","6C","2A","2B","2C","3C","6A","3B"];
const phases: Record<string, string> = { input: "Input", parent: "Parent chain", startup: "Startup", active: "Captured hitbox", contact: "Contact observed", effect: "Effect / follow-through", later: "Later input", rebound: "Weapon rebound", recovery: "Recovery", ready: "Ready", gap: "Between hits", motion: "Move animation", unresolved: "Unresolved" };
const colors: Record<string, string> = { attack: "#ff635c", hurt: "#80c997", push: "#7db5df", unknown: "#d2b775" };
const fields = ["Startup", "Active", "Recovery", "Damage", "HitAdvantage", "MeterGain"];
const labels: Record<string, string> = { HitAdvantage: "On hit", BlockAdvantage: "On block", MeterGain: "Meter" };
const text = (value: Value | undefined, signed = false) => value === null || value === undefined || value === "" ? "—" : signed && typeof value === "number" && value > 0 ? `+${value}` : String(value);
const clean = (value: string) => value.replace("combo activation >", "Speed combo >").replace(/ @0x[0-9a-f]+/g, "");
const inputText = (mask: number) => [[1,"↑"],[2,"↓"],[4,"←"],[8,"→"],[16,"A"],[32,"B"],[64,"C"],[128,"D"]].filter(([bit]) => mask & Number(bit)).map(([,label]) => label).join(" ") || "Released";

export default function FrameWorkbench({ selectorId = 0, mode = "power" }: { selectorId?: number; mode?: string }) {
  const [index,setIndex]=useState<Index | null>(null), [metrics,setMetrics]=useState<Metrics | null>(null), [profiles,setProfiles]=useState<Profiles | null>(null);
  const [move,setMove]=useState(""), [selected,setSelected]=useState(""), [search,setSearch]=useState(""), [allVariants,setAllVariants]=useState(false);
  const [clip,setClip]=useState<ClipData | null>(null), [frame,setFrame]=useState(0), [image,setImage]=useState<{ frame:number; rgb:Uint8Array } | null>(null);
  const [playing,setPlaying]=useState(false), [rate,setRate]=useState(.25), [loop,setLoop]=useState(true), [error,setError]=useState("");
  const [layers,setLayers]=useState({attack:true,hurt:true,push:true,unknown:false,p2:true,objects:true}); const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const abort=new AbortController();
    const get=async(url:string)=>{const r=await fetchData(url,{signal:abort.signal});if(!r.ok)throw new Error(`Cannot load ${url}`);return r.json();};
    void Promise.all([get("/data/extended/index.json"),get("/data/extended/metrics.json"),get("/data/extended/profiles.json")])
      .then(([i,m,p])=>{setIndex(i);setMetrics(m);setProfiles(p);}).catch(e=>{if(!abort.signal.aborted)setError(String(e));});
    return ()=>abort.abort();
  },[]);
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
  const recordings=available.filter(e=>metrics!.clips[e.id].canonical_move===currentMove && (allVariants || metrics!.clips[e.id].primary_recording));
  const entry=recordings.find(e=>e.id===selected) || recordings.find(e=>metrics!.clips[e.id].values.Setup==="hit") || recordings[0];
  const measured=entry && metrics?.clips[entry.id];
  const related=available.filter(e=>metrics!.clips[e.id].canonical_move===currentMove && metrics!.clips[e.id].default_visible && metrics!.clips[e.id].primary_recording);
  const hit=related.find(e=>metrics!.clips[e.id].values.Setup==="hit" && metrics!.clips[e.id].values.Startup!==null);
  const block=related.find(e=>metrics!.clips[e.id].values.Setup==="block");
  const heldEntry=measured?.values.GuardPolicy==='held'&&measured.values.Setup==='block'?entry:block;
  const heldMetric=heldEntry&&metrics?.clips[heldEntry.id];
  const switchValue=numeric(measured?.values.SwitchGuardAdvantage ?? heldMetric?.values.SwitchGuardAdvantage);
  const switchId=String(measured?.values.SwitchGuardSource || heldMetric?.values.SwitchGuardSource || '');
  const switchSource=metrics?.guard_sources?.[switchId];
  const blockComparison=heldMetric?.comparison.fields.BlockAdvantage;
  const statSource=(field:string)=>field==='HitAdvantage'||field==='Damage'||field==='MeterGain'&&measured?.values.Setup!=='block'?hit||entry:entry;
  const groups=new Map<string,[string,Entry][]>();
  for(const item of moves){if(!`${item[0]} ${metrics!.clips[item[1].id].values.Name}`.toLowerCase().includes(search.toLowerCase()))continue;const group=categories[item[1].group] || "Other";groups.set(group,[...(groups.get(group)||[]),item]);}
  useEffect(()=>{
    setPlaying(false);setFrame(0);setClip(null);setImage(null);setError("");if(!entry)return;
    const abort=new AbortController();void loadNativeClip(entry,abort.signal).then(c=>{if(!abort.signal.aborted)setClip(c);}).catch(e=>{if(!abort.signal.aborted)setError(String(e));});
    return ()=>abort.abort();
  },[entry?.id]);
  useEffect(()=>{if(!clip)return;let alive=true;void clip.reader.frame(frame).then(rgb=>{if(alive)setImage({frame,rgb});}).catch(e=>{if(alive){setError(String(e));setPlaying(false);}});return ()=>{alive=false;};},[clip,frame]);
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
  useEffect(()=>{
    const context=canvas.current?.getContext("2d");if(!context||!image||!row||!profiles||!clip)return;
    const paint=()=>{
    const rgba=new Uint8ClampedArray(320*224*4);for(let s=0,t=0;s<image.rgb.length;s+=3,t+=4){rgba[t]=image.rgb[s];rgba[t+1]=image.rgb[s+1];rgba[t+2]=image.rgb[s+2];rgba[t+3]=255;}
    context.putImageData(new ImageData(rgba,320,224),0,0);const boxes=[...nativeRectangles(row,profiles,"p1").boxes,...(layers.p2?nativeRectangles(row,profiles,"p2").boxes:[])];
    if(layers.objects)for(const obj of clip.objects.get(Number(row.relative_frame)) || [])boxes.push(...nativeRectangles(obj,profiles,"object").boxes);
    context.font="6px monospace";for(const box of boxes){if(!layers[box.role])continue;context.strokeStyle=colors[box.role];context.fillStyle=colors[box.role]+"24";context.lineWidth=.75;context.setLineDash(box.role==="push"?[3,2]:[]);context.fillRect(box.x,box.y,box.width,box.height);context.strokeRect(box.x+.25,box.y+.25,box.width,box.height);context.setLineDash([]);}
    };paint();const observer=new ResizeObserver(paint);observer.observe(canvas.current!);return ()=>observer.disconnect();
  },[image,row,profiles,clip,layers]);
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
      {!entry&&<p>{metrics?"No accepted recordings in this mode.":"Loading move data…"}</p>}
      {entry&&measured&&<>
        <div className="move-heading"><div><div className="eyebrow">{entry.character_name} / {categories[entry.group] || entry.group} / {mode.toUpperCase()}</div><h1><span className="command">{clean(currentMove)}</span>{measured.values.Name!==entry.label&&<span className="move-name">{text(measured.values.Name)}</span>}</h1><div className="heading-meta"><span className="badge badge-measured">Recorded</span><span>{related.length} setups · {text(measured.values.NominalFPS)} nominal fps</span></div></div><a className="export-button" href={dataUrl("/data/extended/moves.csv")} download>Export CSV ↗</a></div>
        <label className="mobile-move-picker">Move<select aria-label="Move" value={currentMove} onChange={e=>{setMove(e.target.value);setSelected("");}}>{moves.map(([key])=><option key={key} value={key}>{clean(key)}</option>)}</select></label>
        <div className="stats-row measured-stats">{fields.map(field=>{const source=statSource(field);const m=source&&metrics!.clips[source.id];const comparison=m?.comparison.fields[field];const different=comparison?.wiki!=null&&comparison.measured!=null&&comparison.wiki!==comparison.measured;return <div className={`stat ${different||comparison?.status==="different"?"stat-different":comparison?.status==="match"?"stat-match":""}`} key={field}><span>{labels[field] || field}</span><strong>{timingText(m?.values,field) ?? text(m?.values[field],field.includes("Advantage"))}{hasTimingValue(m?.values,field)&&["Startup","Active","Recovery"].includes(field)&&<em>f</em>}</strong><small>Wiki: {comparison?.raw.join(" / ") || "—"}</small><small>{comparison?.status==="match"?"✓ Numbers match":different?"⚠ Different — review":comparison?.status==="needs_review"?"Review conditions":"No comparable reference"}</small></div>;})}</div>
        <TimingStatus values={measured.values}/>
        <GuardComparison values={heldMetric?.values} wiki={blockComparison?.wiki ?? null} wikiRaw={blockComparison?.raw.join(' / ') || ''} switchValue={switchValue} source={switchSource} recording={heldEntry?.id} mode={mode} evidenceUrl={metrics?.guard_evidence_url} onViewHeld={heldEntry?()=>{setSelected(heldEntry.id);}:undefined}/>
        <div className="capture-picker"><label>Recording<select aria-label="Recording" value={entry.id} onChange={e=>setSelected(e.target.value)}>{recordings.map(e=>{const m=metrics!.clips[e.id];const opponent=e.metadata.opponent_attack as {delay:number}|undefined;return <option key={e.id} value={e.id}>{m.values.Setup=== "block"?"Guard held":m.values.Setup==="hit"?"Hit":m.values.Setup==="mixed"?"Mixed contact":m.values.Setup==="unresolved"?"Unresolved contact":"Whiff"}{e.metadata.opponent_air?" · airborne target":""}{opponent?` · opponent 5B +${opponent.delay}f`:""}{allVariants?` · ${e.label} · ${e.id}`:""}</option>;})}</select></label><label className="variant-toggle"><input type="checkbox" checked={allVariants} onChange={e=>setAllVariants(e.target.checked)}/>All input variants</label></div>
        <div className="workbench"><div className="stage-top"><span>Recorded game frames</span><span className={`phase-badge phase-${phase}`}>{phases[phase]}{frozen(visibleFrame)?" · hitpause":""}</span></div><div className="workbench-stage"><canvas ref={canvas} width={320} height={224} aria-label={`${entry.character_name} ${currentMove} frame ${visibleFrame+1}`}/>{!image&&<span>Loading frames…</span>}</div>
          <div className="layer-controls"><div className="layer-toggles">{(["attack","hurt","push","p2","objects"] as const).map(key=><button key={key} className={`layer-button ${key} ${layers[key]?"on":""}`} aria-pressed={layers[key]} onClick={()=>setLayers(v=>({...v,[key]:!v[key]}))}><i/>{key==="attack"?"Hitboxes":key==="hurt"?"Hurtboxes":key==="push"?"Push boxes":key==="p2"?"P2":"Projectiles"}</button>)}</div></div>
          <div className="timeline"><div className="timeline-header"><span>Frame <strong>{visibleFrame+1}</strong> / {clip?.rows.length || 0}<small> · {text(measured.values.SourceAdvanceFrames)} counted · {text(measured.values.HitpauseFrames)} frozen</small></span><span>{phases[phase]}</span></div>
            <div className="timeline-track" role="group" aria-label="Recorded frame timeline">{clip?.rows.map((_,i)=><button key={i} className={`frame-tick phase-${phaseAt(i)} ${frozen(i)?"frozen":""} ${i===visibleFrame?"current":""}`} title={`Frame ${i+1} · ${phases[phaseAt(i)]}${frozen(i)?" · frozen":""}`} aria-label={`Go to frame ${i+1}`} onClick={()=>seek(i)}/>)}</div>
            <input className="scrubber" aria-label="Recorded frame" type="range" min={0} max={Math.max(0,(clip?.rows.length || 1)-1)} value={frame} disabled={!clip} onChange={e=>seek(Number(e.target.value))}/>
            <div className="transport"><div className="playback-buttons"><button aria-label="First frame" onClick={()=>seek(0)} disabled={!clip}>⏮</button><button aria-label="Previous frame" onClick={()=>seek(frame-1)} disabled={!clip||frame===0}>‹</button><button className="play-button" onClick={()=>setPlaying(v=>!v)} disabled={!clip}>{playing?"Ⅱ Pause":"▶ Play"}</button><button aria-label="Next frame" onClick={()=>seek(frame+1)} disabled={!clip||frame>=clip.rows.length-1}>›</button><button aria-label="Last frame" onClick={()=>seek((clip?.rows.length || 1)-1)} disabled={!clip}>⏭</button><select aria-label="Playback speed" value={rate} onChange={e=>setRate(Number(e.target.value))}>{[.1,.25,.5,1,2].map(r=><option key={r} value={r}>{r}×</option>)}</select><button aria-pressed={loop} onClick={()=>setLoop(v=>!v)}>↻ Loop</button></div></div>
            <div className="phase-legend">{["startup","active","contact","effect","recovery","rebound","ready"].map(p=><span key={p}><i className={`phase-${p}`}/>{phases[p]}</span>)}<span><i className="frozen"/>Hitpause · ← → step</span></div>
          </div>
        </div>
        <div className="frame-boundaries"><span>Entry <b>{measured.values.EntryFrame==null?"—":Number(measured.values.EntryFrame)+1}</b></span><span>First contact <b>{measured.values.ContactFrame==null?"—":Number(measured.values.ContactFrame)+1}</b></span><span>First captured hitbox <b>{measured.values.FirstActiveFrame==null?"—":Number(measured.values.FirstActiveFrame)+1}</b></span><span>Last captured hitbox <b>{measured.values.LastActiveFrame==null?"—":Number(measured.values.LastActiveFrame)+1}</b></span><span>Control ready <b>{measured.values.ActionableFrame==null?"—":Number(measured.values.ActionableFrame)+1}</b></span></div>
        {row&&<div className="frame-readout"><span>This frame <b>{currentDamage} damage</b></span><span>HP <b>{row.p1_health} / {row.p2_health}</b></span><span>Meter <b>{row.p1_meter} / {row.p2_meter}</b></span><span>Input <b>{inputText(Number(row.input_key_bits))}</b></span><span>Recording total <b>{text(measured.values.RecordingDamage ?? measured.values.Damage)}</b></span></div>}
        <details className="comparison-panel" open><summary>Measured / wiki comparison</summary><table><thead><tr><th>Parameter</th><th>Measured</th><th>Wiki</th><th>Review</th></tr></thead><tbody>{fields.map(field=>{const source=statSource(field);const m=source&&metrics!.clips[source.id];const c=m?.comparison.fields[field];const differs=c?.wiki!=null&&c.measured!=null&&c.wiki!==c.measured;return <tr className={differs||c?.status==="different"?"difference":c?.status==="match"?"agreement":""} key={field}><th>{labels[field] || field}</th><td>{timingText(m?.values,field) ?? text(m?.values[field],field.includes("Advantage"))}{source&&source.id!==entry.id&&<small>Other setup of this move</small>}</td><td>{c?.raw.join(" / ") || "—"}</td><td>{c?.status==="match"?"✓ Match":c?.reason || "No reference"}</td></tr>;})}</tbody></table>{measured.comparison.reference.url&&<a href={measured.comparison.reference.url} target="_blank" rel="noreferrer">Saved wiki source ↗</a>}</details>
        <p className="measurement-note">Startup counts from observed move entry to the first captured hitbox, excluding identified source hitpause. If contact occurs earlier, only an upper bound (≤) is shown and full active duration stays unknown. Contact marks an observed reaction or HP loss, not an invented hitbox. Recovery belongs to the selected recording and includes the control-ready boundary. Block rebound uses its separate response-entry duration; missing block timing never borrows hit timing. Super/projectile timing requires phase review. Frame markers above are 1-based; CSV markers are 0-based. Frame advantage uses defender readiness after the last selected contact, without an earliest-retaliation test. Owned projectiles can remain active after their creator becomes ready.</p>
        {measured.alias&&<p className="measurement-note">{measured.alias==="distinct_dash_attack"?"Verified dash attack, distinct from standing normals.":"This recording retains an input/context variant; it is not counted as a separate move."}</p>}
        <details className="diagnostics"><summary>Recording details</summary><p>{entry.id} · {text(measured.values.TimingScope)}</p><p>Nominal emulated cadence {entry.fps}; measured host FPS unavailable. {entry.native_missed_updates} unchanged native-counter ticks do not prove whole-game skips.</p><p>Accepted recordings remain archived; input aliases are grouped rather than deleted.</p></details>
      </>}
    </div>
  </section>;
}
