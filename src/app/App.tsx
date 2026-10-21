import { fetchData, dataUrl } from '../lib/data.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Capture,
  CharacterData,
  Manifest,
  Mode,
  Move,
  Timing,
  Box,
} from "../types/reference.ts";
import DamagePreview from "../features/reference/DamagePreview";
import CharacterPortrait from '../features/reference/CharacterPortrait';
import FrameWorkbench from "../features/workbench/FrameWorkbench";
import FrameCanvas, { type Layers } from "../features/reference/FrameCanvas";
import {
  advanceFrame,
  damageAt,
  fmt,
  frameKind,
  hex,
  signed,
} from "../lib/playback";

const modeNames: Record<Mode, string> = {
  power: "Power",
  speed: "Speed",
  ex: "EX",
};
const categories = [
  "Normals",
  "Command normals",
  "Air normals",
  "Chains",
  "Specials",
  "Supers",
  "Throws",
  "Unmapped states",
];
const initialLayers: Layers = {
  attack: true,
  hurt: true,
  push: true,
  unknown: false,
  origins: true,
  grid: true,
  opponent: true,
};
const categorySort = (a: string, b: string) => {
  const ia = categories.findIndex((c) => c.toLowerCase() === a.toLowerCase()),
    ib = categories.findIndex((c) => c.toLowerCase() === b.toLowerCase());
  return (ia < 0 ? 20 : ia) - (ib < 0 ? 20 : ib) || a.localeCompare(b);
};
function wikiModeValue(value: string, mode: Mode): string {
  const letter = mode === "power" ? "P" : mode === "speed" ? "S" : "EX";
  const escaped = letter === "EX" ? "EX" : letter;
  const match = value.match(
    new RegExp(`(?:^|\\s)${escaped}\\s+(.+?)(?=\\s+(?:P|S|EX)\\s|$)`),
  );
  if (match) return match[1];
  return /(?:^|\s)(?:P|S|EX)\s/.test(value) ? "—" : value;
}
function evidenceName(value: string) {
  return (
    (
      {
        measured: "Recorded",
        rom: "ROM data",
        wiki: "Wiki",
        unresolved: "Unresolved",
      } as Record<string, string>
    )[value] || value
  );
}
function Badge({ evidence }: { evidence: string }) {
  return (
    <span className={`badge badge-${evidence}`}>{evidenceName(evidence)}</span>
  );
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const el = document.createElement("a");
  el.href = url;
  el.download = name;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Stat({
  label,
  value,
  evidence,
  detail,
}: {
  label: string;
  value: string;
  evidence?: string;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
      {evidence && <Badge evidence={evidence} />}
    </div>
  );
}
function BoxTable({ boxes }: { boxes: Box[] }) {
  return (
    <div className="table-scroll">
      <table className="box-table">
        <thead>
          <tr>
            <th>Slot / type</th>
            <th>Bounds X</th>
            <th>Bounds Y</th>
            <th>Base damage</th>
            <th>Profile</th>
          </tr>
        </thead>
        <tbody>
          {boxes
            .filter((b) => b.profile !== 0)
            .map((box, i) => (
              <tr key={`${box.slot}-${i}`}>
                <td>
                  <i className={`box-dot ${box.role}`} />
                  {box.slot} · {box.role}
                  {box.special && " · unresolved shape"}
                </td>
                <td>
                  {box.x1} … {box.x2}
                </td>
                <td>
                  {box.y1} … {box.y2}
                </td>
                <td>{box.role === "attack" ? box.damage : "—"}</td>
                <td>{hex(box.profile, 2)}</td>
              </tr>
            ))}
          {boxes.every((b) => b.profile === 0) && (
            <tr>
              <td colSpan={5}>No live collision records on this frame.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function TimingStats({
  timing,
  move,
  mode,
}: {
  timing?: Timing;
  move: Move;
  mode: Mode;
}) {
  const wiki =
    move.wiki.find((row) => row.version?.toLowerCase().includes(mode)) ||
    move.wiki.find((row) => !row.version) ||
    (mode === "ex" ? undefined : move.wiki[0]);
  const wikiDamage = wiki ? wikiModeValue(wiki.damage, mode).split("/") : [];
  const fieldEvidence = (value?: number) =>
    value !== undefined
      ? timing?.evidence || "unresolved"
      : wiki
        ? "wiki"
        : "unresolved";
  return (
    <div className="stats-row">
      <Stat
        label="Startup"
        value={
          timing?.startup === undefined
            ? wiki
              ? wikiModeValue(wiki.startup, mode)
              : "—"
            : fmt(timing.startup)
        }
        detail="to first active frame"
        evidence={fieldEvidence(timing?.startup)}
      />
      <Stat
        label="Active"
        value={
          timing?.active === undefined
            ? wiki
              ? wikiModeValue(wiki.active, mode)
              : "—"
            : fmt(timing.active)
        }
        detail="advancing ticks"
        evidence={fieldEvidence(timing?.active)}
      />
      <Stat
        label="Recovery"
        value={
          timing?.recovery === undefined
            ? wiki
              ? wikiModeValue(wiki.recovery, mode)
              : "—"
            : fmt(timing.recovery)
        }
        detail={
          move.input.startsWith("J") || move.input.startsWith("j")
            ? "fixture landing / boundary"
            : "last active → neutral"
        }
        evidence={fieldEvidence(timing?.recovery)}
      />
      <Stat
        label="Damage"
        value={timing?.damage?.join(" / ") || wikiDamage[0] || "—"}
        detail={
          timing?.damage?.length
            ? "neutral-defense target"
            : wikiDamage[1]
              ? `wiki chip ${wikiDamage[1]}`
              : "wiki reference"
        }
        evidence={
          timing?.damage?.length
            ? timing.evidence
            : wiki
              ? "wiki"
              : "unresolved"
        }
      />
      <Stat
        label="On hit"
        value={signed(timing?.hitAdvantage)}
        evidence={
          timing?.hitAdvantage === undefined ? "unresolved" : timing.evidence
        }
      />
      <Stat
        label="Switch guard"
        value={signed(timing?.switchGuardAdvantage)}
        evidence={
          timing?.switchGuardAdvantage === undefined
            ? "unresolved"
            : timing.evidence
        }
      />
    </div>
  );
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest>();
  const [characterKey, setCharacterKey] = useState("");
  const [character, setCharacter] = useState<CharacterData>();
  const [moveId, setMoveId] = useState("");
  const [mode, setMode] = useState<Mode>("power");
  const [search, setSearch] = useState("");
  const [captureId, setCaptureId] = useState("");
  const [capture, setCapture] = useState<Capture>();
  const [frameIndex, setFrameIndex] = useState(0);
  const [commandIndex, setCommandIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.25);
  const [loop, setLoop] = useState(true);
  const [layers, setLayers] = useState<Layers>(initialLayers);
  const [zoom, setZoom] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [view, setView] = useState<"recorded" | "rom">("recorded");
  const [showMoveBrowser, setShowMoveBrowser] = useState(false);
  const [extendedView, setExtendedView] = useState(true);
  const move = character?.moves.find((m) => m.id === moveId);
  const refs = useMemo(
    () => move?.captures.filter((c) => c.mode === mode) || [],
    [move, mode],
  );
  const captureRef = refs.find((c) => c.id === captureId);
  const commands = useMemo(
    () => move?.commands.filter((c) => c.mode === mode) || [],
    [move, mode],
  );
  const frame = view === "recorded" ? capture?.frames[frameIndex] : undefined;
  const command =
    commands[Math.min(commandIndex, Math.max(0, commands.length - 1))];
  const count = capture?.frames.length || 0;
  const seek = useCallback(
    (delta: number) => {
      setPlaying(false);
      setFrameIndex((i) => advanceFrame(i, count, delta));
    },
    [count],
  );
  const togglePlay = useCallback(() => {
    if (count > 0) setPlaying((p) => !p);
  }, [count]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading("Loading roster");
    fetchData("/data/manifest.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok)
          throw new Error(
            "Data pack is missing. Generate the viewer data pack, then reload.",
          );
        return r.json();
      })
      .then((data: Manifest) => {
        if (data.schemaVersion !== 1)
          throw new Error("Unsupported data pack version");
        setManifest(data);
        setCharacterKey(data.defaultCharacter);
        setError("");
        setLoading("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading("");
        }
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const summary = manifest?.characters.find((c) => c.key === characterKey);
    if (!summary) return;
    const abort = new AbortController();
    setLoading(`Loading ${summary.name}`);
    setCharacter(undefined);
    setCapture(undefined);
    setPlaying(false);
    fetchData(summary.file, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${summary.name}'s data`);
        return r.json();
      })
      .then((data: CharacterData) => {
        setCharacter(data);
        const preferred =
          data.moves.find(
            (m) => m.input.includes("646") && m.input.includes("214A"),
          ) ||
          data.moves.find((m) => m.captures.length) ||
          data.moves[0];
        setMoveId(preferred?.id || "");
        setError("");
        setLoading("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading("");
        }
      });
    return () => abort.abort();
  }, [manifest, characterKey]);
  useEffect(() => {
    setPlaying(false);
    setFrameIndex(0);
    setCaptureId((refs.find((ref) => ref.hasImages) || refs[0])?.id || "");
    setShowMoveBrowser(false);
  }, [refs]);
  useEffect(() => {
    setCommandIndex(
      Math.max(
        0,
        commands.findIndex((command) => command.box.role === "attack"),
      ),
    );
  }, [commands]);
  useEffect(() => {
    setCapture(undefined);
    setFrameIndex(0);
    setPlaying(false);
    if (!captureRef) {
      setView("rom");
      return;
    }
    const abort = new AbortController();
    setView("recorded");
    setLoading("Loading recorded frames");
    fetchData(captureRef.file, { signal: abort.signal })
      .then((r) => {
        if (!r.ok)
          throw new Error(
            "This recording could not be loaded. ROM records are still available.",
          );
        return r.json();
      })
      .then((data: Capture) => {
        setCapture(data);
        setError("");
        setLoading("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setView("rom");
          setLoading("");
        }
      });
    return () => abort.abort();
  }, [captureRef]);
  const animationFrame = useRef(0);
  useEffect(() => {
    if (!playing || !capture || view !== "recorded") return;
    let previous = performance.now(),
      accumulated = 0;
    const period = 1000 / (capture.fps * speed);
    const tick = (now: number) => {
      accumulated += Math.min(250, now - previous);
      previous = now;
      if (accumulated >= period) {
        const steps = Math.floor(accumulated / period);
        accumulated -= steps * period;
        setFrameIndex((i) => {
          if (!loop && i + steps >= count - 1) {
            setPlaying(false);
            return count - 1;
          }
          return advanceFrame(i, count, steps, loop);
        });
      }
      animationFrame.current = requestAnimationFrame(tick);
    };
    animationFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame.current);
  }, [playing, capture, speed, loop, count, view]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (extendedView) return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches("input,select,textarea") ||
          event.target.isContentEditable)
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seek(event.shiftKey ? -10 : -1);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seek(event.shiftKey ? 10 : 1);
      } else if (event.code === "Home") {
        event.preventDefault();
        setPlaying(false);
        setFrameIndex(0);
      } else if (event.code === "End") {
        event.preventDefault();
        setPlaying(false);
        setFrameIndex(Math.max(0, count - 1));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [count, seek, togglePlay, extendedView]);
  const groupedMoves = useMemo(() => {
    const groups = new Map<string, Move[]>();
    (character?.moves || [])
      .filter((m) =>
        `${m.label} ${m.name} ${m.input} ${m.states.map((s) => hex(s)).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .forEach((m) =>
        groups.set(m.category, [...(groups.get(m.category) || []), m]),
      );
    return [...groups.entries()].sort(([a], [b]) => categorySort(a, b));
  }, [character, search]);
  const boxes = frame?.boxes || (command ? [command.box] : []);
  const technicalNote = /0x|CPU|object\+|script|matcher|input-state|input state|ROM stream/i.test(move?.note || "");
  const totalDamage =
    capture && frame
      ? Math.max(0, capture.frames[0].opponent.health - frame.opponent.health)
      : undefined;
  const activeBoxes = boxes.filter(
    (b) => b.profile !== 0 && b.role === "attack",
  );
  const toggleLayer = (key: keyof Layers) =>
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  const currentRoster = manifest?.characters.find(
    (c) => c.key === characterKey,
  );
  const body =
    move && character ? (
      <>
        <div className="move-heading">
          <div>
            <div className="eyebrow">
              {character.character.name} <span> / </span> {move.category}
            </div>
            <h1>
              <span className="command">{move.label}</span>
              {move.name !== move.label && (
                <span className="move-name">{move.name}</span>
              )}
            </h1>
            <div className="heading-meta">
              <Badge
                evidence={
                  refs.length
                    ? "measured"
                    : move.evidence === "measured"
                      ? "rom"
                      : move.evidence
                }
              />
              <span>{move.input || "Input not mapped"}</span>
              {move.captures.length > 0 && (
                <span className="small-dot">
                  {move.captures.length} recordings
                </span>
              )}
            </div>
          </div>
          <button
            className="export-button"
            onClick={() =>
              download(
                `${character.character.key}-${move.id}-${mode}${capture ? "-capture" : ""}.json`,
                capture || move,
              )
            }
          >
            <span>↗</span> Export {capture ? "recording" : "move data"}
          </button>
        </div>
        <TimingStats timing={move.timing[mode]} move={move} mode={mode} />
        <div className="workbench">
          <div className="stage-top">
            <div className="view-tabs">
              <button
                className={view === "recorded" ? "selected" : ""}
                disabled={!capture}
                onClick={() => setView("recorded")}
              >
                Recorded frames <span>{count || "—"}</span>
              </button>
              <button
                className={view === "rom" ? "selected" : ""}
                onClick={() => {
                  setPlaying(false);
                  setView("rom");
                }}
              >
                ROM records <span>{commands.length}</span>
              </button>
            </div>
            <span className={`alignment ${frame?.camera ? "verified" : ""}`}>
              {frame?.camera
                ? frame.camera.evidence === "measured"
                  ? "● Aligned game frame"
                  : "● ROM-calibrated overlay"
                : frame?.sprite
                  ? "● Mapped sprite pose"
                  : "◇ Collision schematic"}
            </span>
          </div>
          <div
            className={`stage-grid ${frame?.image && !frame.camera ? "with-image" : ""}`}
          >
            <FrameCanvas
              frame={frame}
              command={view === "rom" ? command : undefined}
              layers={layers}
              zoom={zoom}
              mirror={mirror}
              startX={capture?.frames[0]?.x || 0}
              character={character.character.name}
            />
            {frame?.image && !frame.camera && (
              <figure className="unaligned-frame">
                <img
                  src={dataUrl(frame.image)}
                  alt={`Game screenshot for frame ${frame.frame}`}
                />
                <figcaption>Recorded game image · alignment pending</figcaption>
              </figure>
            )}
          </div>
          <div className="layer-controls">
            <div className="layer-toggles">
              {(["attack", "hurt", "push", "unknown"] as const).map((key) => (
                <button
                  key={key}
                  aria-pressed={layers[key]}
                  className={`layer-button ${key} ${layers[key] ? "on" : ""}`}
                  onClick={() => toggleLayer(key)}
                >
                  <i />
                  {key === "attack"
                    ? "Hitboxes"
                    : key === "hurt"
                      ? "Hurtboxes"
                      : key === "push"
                        ? "Push boxes"
                        : "Unknown"}
                </button>
              ))}
              <button
                aria-pressed={layers.origins}
                className={`layer-button ${layers.origins ? "on" : ""}`}
                onClick={() => toggleLayer("origins")}
              >
                ＋ Origins
              </button>
              <button
                aria-pressed={layers.opponent}
                className={`layer-button ${layers.opponent ? "on" : ""}`}
                onClick={() => toggleLayer("opponent")}
              >
                P2
              </button>
            </div>
            <div className="scale-controls">
              <label title="Schematic zoom">
                Scale{" "}
                <select
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  disabled={!!frame?.camera}
                >
                  <option value={0.6}>0.6×</option>
                  <option value={1}>1×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2}>2×</option>
                </select>
              </label>
              {view === "rom" && (
                <button
                  aria-pressed={mirror}
                  onClick={() => setMirror((v) => !v)}
                >
                  ⇄ Facing
                </button>
              )}
              <button
                className={layers.grid ? "on" : ""}
                onClick={() => toggleLayer("grid")}
                aria-pressed={layers.grid}
              >
                Grid
              </button>
            </div>
          </div>
          {view === "recorded" && capture ? (
            <>
              <div className="timeline">
                <div className="timeline-header">
                  <span>
                    {capture.scenario} <small>{capture.fps} fps playback</small>
                  </span>
                  <span>
                    Frame <strong>{frameIndex + 1}</strong> / {count}
                  </span>
                </div>
                <div
                  className="timeline-track"
                  role="group"
                  aria-label="Recorded frame timeline"
                >
                  {capture.frames.map((f, i) => (
                    <button
                      key={i}
                      className={`frame-tick ${frameKind(f)} ${i === frameIndex ? "current" : ""}`}
                      title={`Frame ${i + 1} · ${frameKind(f)}`}
                      aria-label={`Go to frame ${i + 1}`}
                      onClick={() => {
                        setPlaying(false);
                        setFrameIndex(i);
                      }}
                    />
                  ))}
                </div>
                <input
                  className="scrubber"
                  type="range"
                  min={0}
                  max={Math.max(0, count - 1)}
                  value={frameIndex}
                  aria-label="Frame"
                  onChange={(e) => {
                    setPlaying(false);
                    setFrameIndex(Number(e.target.value));
                  }}
                />
                <div className="transport">
                  <div className="playback-buttons">
                    <button
                      title="First frame (Home)"
                      onClick={() => {
                        setPlaying(false);
                        setFrameIndex(0);
                      }}
                    >
                      ⏮
                    </button>
                    <button
                      title="Previous frame (Left arrow)"
                      onClick={() => seek(-1)}
                    >
                      ‹
                    </button>
                    <button
                      className="play-button"
                      onClick={togglePlay}
                      title="Play or pause (Space)"
                    >
                      {playing ? "Ⅱ" : "▶"}{" "}
                      <span>{playing ? "Pause" : "Play"}</span>
                    </button>
                    <button
                      title="Next frame (Right arrow)"
                      onClick={() => seek(1)}
                    >
                      ›
                    </button>
                    <button
                      title="Last frame (End)"
                      onClick={() => {
                        setPlaying(false);
                        setFrameIndex(count - 1);
                      }}
                    >
                      ⏭
                    </button>
                    <select
                      aria-label="Playback speed"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    >
                      {[0.1, 0.25, 0.5, 1].map((v) => (
                        <option value={v} key={v}>
                          {v}× speed
                        </option>
                      ))}
                    </select>
                    <button
                      className={`loop-button ${loop ? "on" : ""}`}
                      aria-pressed={loop}
                      onClick={() => setLoop((v) => !v)}
                    >
                      ↻ Loop
                    </button>
                  </div>
                  <div className="timeline-legend">
                    <i className="active" />
                    Active
                    <i className="pause" />
                    Hitpause<span>← → step · Shift = 10</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="static-selector">
              <label>
                Collision record{" "}
                <select
                  value={Math.min(
                    commandIndex,
                    Math.max(0, commands.length - 1),
                  )}
                  onChange={(e) => setCommandIndex(Number(e.target.value))}
                >
                  {commands.map((cmd, i) => (
                    <option key={`${cmd.cpu}-${i}`} value={i}>
                      {i + 1}. {cmd.box.role} · state{" "}
                      {cmd.states.map((s) => hex(s)).join(", ")} · {cmd.cpu}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                ROM records describe individual collision commands. They do not
                establish a full animation or frame duration.
              </p>
            </div>
          )}
        </div>
        <div className="detail-grid">
          <section className="detail-card">
            <div className="card-heading">
              <h2>Current frame</h2>
              {frame ? <Badge evidence="measured" /> : <Badge evidence="rom" />}
            </div>
            <div className="frame-readout">
              <Stat
                label="Observed damage"
                value={
                  frame && capture
                    ? String(damageAt(capture.frames, frameIndex))
                    : "—"
                }
                detail="HP lost this tick"
              />
              <Stat label="Sequence damage" value={fmt(totalDamage)} />
              <Stat
                label="Live base damage"
                value={
                  activeBoxes.length
                    ? activeBoxes.map((b) => b.damage).join(" / ")
                    : "—"
                }
              />
              <Stat
                label="Hitpause"
                value={frame ? (frame.hitpause ? "Yes" : "No") : "—"}
              />
            </div>
            {frame ? (
              <>
              {frame.opponent.combo !== undefined && <p className="combo-readout">Recorded combo · <b>{frame.opponent.combo}</b> hits</p>}
              <div className="vitals">
                <div>
                  <span>
                    P1 health <b>{frame.health} / 256</b>
                  </span>
                  <meter min={0} max={256} value={frame.health} />
                  <small>Meter {fmt(frame.meter)} / 64</small>
                </div>
                <div>
                  <span>
                    P2 health <b>{frame.opponent.health} / 256</b>
                  </span>
                  <meter min={0} max={256} value={frame.opponent.health} />
                  <small>Meter {fmt(frame.opponent.meter)} / 64</small>
                </div>
              </div>
              </>
            ) : (
              <p className="muted">
                Choose a recorded scenario to inspect live HP, meter and contact
                events.
              </p>
            )}
            <BoxTable boxes={boxes} />
            {boxes.some((b) => b.special) && (
              <p className="inline-notice">
                Special shape records are listed but not drawn until their
                geometry is resolved.
              </p>
            )}
            {!boxes.some((b) => b.role === "push") && (
              <p className="quiet-note">
                Separate push-box geometry is not present in this record.
                Hurtboxes are not substituted for it.
              </p>
            )}
          </section>
          <section className="detail-card">
            <div className="card-heading">
              <h2>Recording & references</h2>
              {captureRef && (
                <span className="subtle">
                  {captureRef.hasImages ? "With game images" : "Memory trace"}
                </span>
              )}
            </div>
            <label className="scenario-label">
              Scenario
              <select
                value={captureId}
                onChange={(e) => setCaptureId(e.target.value)}
                disabled={!refs.length}
              >
                {refs.length ? (
                  refs.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.label}
                    </option>
                  ))
                ) : (
                  <option value="">No {modeNames[mode]} recording</option>
                )}
              </select>
            </label>
            {capture && (
              <div className="capture-note">
                <span className="recorded-dot" />
                <div>
                  <strong>{capture.scenario}</strong>
                  <p>
                    {captureRef?.actualWhiff
                      ? "No contact recorded."
                      : captureRef?.scenario.toLowerCase().includes("whiff")
                        ? "The intended whiff trial made contact; HP and hitpause reflect the actual event."
                        : "Actual emulation recording."}
                  </p>
                </div>
              </div>
            )}
            {move.note && !technicalNote && <p className="move-note">{move.note}</p>}
            {capture?.notes.map((note, i) => (
              <p className="quiet-note" key={i}>
                {note}
              </p>
            ))}
            {move.wikiUrl && (
              <a
                className="source-link"
                href={move.wikiUrl}
                target="_blank"
                rel="noreferrer"
              >
                Dream Cancel reference ↗
              </a>
            )}
            <details className="notation-details">
              <summary>Directional inputs</summary>
              <p>
                Notation is relative to facing. 5 = neutral, 2 = down, 4 = back,
                6 = forward, 3 = down-forward, 7 = up-back. A+C means both
                buttons together. For 646C → 214A, complete the dash, then enter
                the follow-up.
              </p>
              <div className="notation-grid">
                <span>7 ↖</span>
                <span>8 ↑</span>
                <span>9 ↗</span>
                <span>4 ←</span>
                <span>5 ·</span>
                <span>6 →</span>
                <span>1 ↙</span>
                <span>2 ↓</span>
                <span>3 ↘</span>
              </div>
            </details>
            <details className="reference-details">
              <summary>Wiki data & counting convention</summary>
              <p>
                {move.timing[mode]?.blockAdvantage !== undefined && (
                  <>
                    <strong>
                      Ordinary guard:{" "}
                      {signed(move.timing[mode]?.blockAdvantage)}
                    </strong>{" "}
                    · switch guard:{" "}
                    {signed(move.timing[mode]?.switchGuardAdvantage)}
                    <br />
                  </>
                )}
                {move.timing[mode]?.convention ||
                  "Wiki numbers remain a reference until matched to recorded game frames. Startup and recovery use explicit boundaries in measured traces; hitpause is counted separately."}
              </p>
              {move.wiki.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Part</th>
                        <th>Damage</th>
                        <th>Start</th>
                        <th>Active</th>
                        <th>Recovery</th>
                        <th>Advantage</th>
                        <th>Meter</th>
                        <th>Guard</th>
                        <th>Cancels</th>
                      </tr>
                    </thead>
                    <tbody>
                      {move.wiki.map((row, i) => (
                        <tr key={i}>
                          <td>
                            {row.part}
                            {row.version && ` · ${row.version}`}
                          </td>
                          <td>{row.damage}</td>
                          <td>{row.startup}</td>
                          <td>{row.active}</td>
                          <td>{row.recovery}</td>
                          <td>{row.advantage}</td>
                          <td>{row.meter}</td>
                          <td>{row.guard}</td>
                          <td>{row.cancel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No named wiki row is mapped to this state.</p>
              )}
            </details>
          </section>
        </div>
        <DamagePreview
          character={character}
          move={move}
          mode={mode}
          commands={commands}
        />
        <details className="diagnostics">
          <summary>
            ROM & capture diagnostics <span>states, offsets, provenance</span>
          </summary>
          {move.note && technicalNote && <p className="dispatch-note">Dispatch notes: {move.note}</p>}
          <div className="diagnostic-grid">
            <div>
              <dt>Animation states</dt>
              <dd>{move.states.map((s) => hex(s)).join(", ") || "Unmapped"}</dd>
              <dt>Script states</dt>
              <dd>
                {move.scriptStates.map((s) => hex(s)).join(", ") || "Unmapped"}
              </dd>
              <dt>Character attack / defense Q8</dt>
              <dd>
                {character.attackQ8[mode] ?? "—"} / {character.defenseQ8}
              </dd>
            </div>
            <div>
              <dt>Current animation / script</dt>
              <dd>
                {frame ? `${hex(frame.state)} / ${hex(frame.script)}` : "—"}
              </dd>
              <dt>Input state / mask</dt>
              <dd>
                {frame
                  ? `${hex(frame.inputState)} / ${frame.inputMask === undefined ? "not captured" : hex(frame.inputMask, 4)}`
                  : "—"}
              </dd>
              <dt>Capture tick / engine frame / pose</dt>
              <dd>
                {frame
                  ? `${frame.frame} / ${frame.engineFrame} / ${frame.pose === undefined ? "not captured" : hex(frame.pose, 4)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Selected ROM collision command</dt>
              <dd>{command ? `Bank ${command.bank} · ${command.cpu}` : "—"}</dd>
              <dt>Selected base damage byte offset</dt>
              <dd>{command?.rawDamageOffset || "—"}</dd>
              <dt>Trace source</dt>
              <dd>{capture?.source || "ROM-derived collision corpus"}</dd>
            </div>
          </div>
          <p>
            ROM SHA-256 <code>{manifest?.romSha256}</code>
          </p>
        </details>
      </>
    ) : (
      <div className="empty-screen">
        <span className="empty-emblem">月</span>
        <h1>{loading || "Frame Lab"}</h1>
        <p>{error || "Loading character and move evidence…"}</p>
        {error && (
          <button onClick={() => window.location.reload()}>Reload data</button>
        )}
      </div>
    );
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-emblem">月</span>
          <div>
            <strong>
              THE LAST BLADE <b>2</b>
            </strong>
            <small>FRAME LAB</small>
          </div>
        </a>
        <div className="topbar-center">
          <span className="edition">Neo Geo</span>
          <span className="build-label">Stock ROM · offline evidence</span>
        </div>
        <div className="topbar-right">
          <button onClick={() => { setExtendedView((value) => !value); setPlaying(false); }}>
            {extendedView ? "Reference library" : "Full recordings"}
          </button>
          <label className="character-picker">Character
            <CharacterPortrait character={currentRoster}/>
            <select aria-label="Character" value={characterKey} onChange={e=>{setCharacterKey(e.target.value);setSearch("");}}>
              {manifest?.characters.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
        </div>
      </header>
      {!extendedView && <div className="mobile-nav"><button onClick={()=>setShowMoveBrowser(v=>!v)}>Move list</button></div>}
      <div className={`workspace compact-workspace ${extendedView ? "extended-workspace" : ""}`}>
        {!extendedView && <aside className={`move-browser ${showMoveBrowser ? "open" : ""}`}>
          <div className="sidebar-heading">
            <span>{currentRoster?.name.toUpperCase() || "MOVES"}</span>
            <b>{character?.moves.length || "—"}</b>
          </div>
          <input
            className="search-input"
            placeholder="Find move or input…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Find move"
          />
          <div className="move-groups">
            {groupedMoves.map(([category, moves]) => (
              <section key={category}>
                <h2>
                  {category}
                  <span>{moves.length}</span>
                </h2>
                {moves.map((m) => (
                  <button
                    className={`move-item ${m.id === moveId ? "selected" : ""}`}
                    key={m.id}
                    onClick={() => setMoveId(m.id)}
                  >
                    <div>
                      <strong>{m.label}</strong>
                      {m.captures.some((c) => c.mode === mode) && (
                        <i className="recorded-dot" />
                      )}
                    </div>
                    {m.name !== m.label && <span>{m.name}</span>}
                    <small>
                      {m.input ||
                        `${m.states.length} animation state${m.states.length === 1 ? "" : "s"}`}
                    </small>
                  </button>
                ))}
              </section>
            ))}
            {!groupedMoves.length && (
              <p className="no-results">No moves match this search.</p>
            )}
          </div>
          <p className="coverage-note">{currentRoster?.coverage}</p>
        </aside>}
        <main className="main-content">
          {!extendedView && error && move && <div className="error-banner">{error}</div>}
          {!extendedView && loading && move && <div className="loading-line">{loading}…</div>}
          {extendedView ? <FrameWorkbench selectorId={currentRoster?.id} mode={mode} onModeChange={m=>setMode(m)} character={character?.character.key===characterKey?character:undefined} characterName={currentRoster?.name} /> : <><div className="reference-mode"><span>Reference mode</span><div className="mode-switch" aria-label="Reference sword mode">{(["power","speed","ex"] as Mode[]).map(m=><button key={m} aria-pressed={mode===m} className={mode===m?"selected":""} onClick={()=>setMode(m)}>{modeNames[m]}</button>)}</div></div>{body}</>}
          <footer className="main-footer">
            <span>LAST BLADE 2 / FRAME LAB · <b aria-label="Application version">v{__APP_VERSION__}</b></span>
            <span>
              Recordings and reference values remain distinct · original ROM
              unchanged
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
