import { useEffect, useMemo, useState } from "react";
import type {
  CharacterData,
  Mode,
  Move,
  StaticCommand,
} from "../../types/reference.ts";

export default function DamagePreview({
  character,
  move,
  mode,
  commands,
}: {
  character: CharacterData;
  move: Move;
  mode: Mode;
  commands: StaticCommand[];
}) {
  const [proposed, setProposed] = useState("");
  useEffect(() => setProposed(""), [move.id, mode, character.character.key]);
  const targets = useMemo(
    () => [
      ...new Map(
        commands
          .filter(
            (c) =>
              c.box.role === "attack" &&
              c.rawDamageOffset &&
              c.box.damage > 0 &&
              !c.box.special,
          )
          .map((c) => [c.rawDamageOffset, c]),
      ).values(),
    ],
    [commands],
  );
  const oldValues = [...new Set(targets.map((c) => c.box.damage))];
  const allowed =
    mode !== "ex" && move.evidence !== "unresolved" && targets.length > 0;
  const value = Number(proposed);
  const valid =
    allowed &&
    proposed.trim() !== "" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 127;
  const multiplier = character.attackQ8[mode];
  const projection =
    valid && multiplier !== undefined
      ? Math.floor((value * multiplier) / 256)
      : undefined;
  const offsetSet = new Set(targets.map((c) => c.rawDamageOffset));
  const aliases = character.moves.filter(
    (m) =>
      m.id !== move.id &&
      m.commands.some(
        (c) => c.rawDamageOffset && offsetSet.has(c.rawDamageOffset),
      ),
  );
  const exportRequest = () => {
    if (!valid) return;
    const request = {
      character: character.character.key,
      move: move.id,
      mode,
      newBaseDamage: value,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(request, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${character.character.key}-${move.id}-${mode}-damage-request.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="balance-preview">
      <div className="card-heading">
        <h2>Balance preview</h2>
        <span className="preview-badge">Preview only · not applied</span>
      </div>
      <p>
        Preview damage against a full-health, neutral-defense Kaede. Export
        saves a request for review; it does not change the game.
      </p>
      <div className="balance-fields">
        <div>
          <label>Current base damage</label>
          <strong>{oldValues.length ? oldValues.join(" / ") : "—"}</strong>
          <small>
            {multiplier && oldValues.length
              ? `Expected HP loss ${oldValues.map((d) => Math.floor((d * multiplier) / 256)).join(" / ")}`
              : "Move data unresolved"}
          </small>
        </div>
        <label>
          New base damage
          <input
            type="number"
            min={0}
            max={127}
            step={1}
            placeholder={allowed ? "Enter value" : "Unavailable"}
            disabled={!allowed}
            value={proposed}
            onChange={(e) => setProposed(e.target.value)}
            aria-label="New base damage"
          />
        </label>
        <div className="projection">
          <label>Projected HP loss</label>
          <strong>{projection === undefined ? "—" : projection}</strong>
          <small>No combo or health scaling</small>
        </div>
        <button onClick={exportRequest} disabled={!valid}>
          ↗ Export damage request
        </button>
      </div>
      {!allowed ? (
        <p className="quiet-note">
          {mode === "ex"
            ? "EX damage byte selection is not validated yet."
            : "Map a named move with understood damage commands before making a request."}
        </p>
      ) : (
        <>
          <p className="quiet-note">
            {targets.length > 1
              ? `This request assigns the same base damage to all ${targets.length} mapped attack bytes for this move and mode; review multi-hit phases before patching.`
              : `One mapped attack byte is selected for ${mode}.`}
            {aliases.length > 0 &&
              ` Shared with ${aliases.length} other catalog ${aliases.length === 1 ? "entry" : "entries"} in this character: ${aliases.map((m) => m.label).join(", ")}.`}{" "}
            Roster-wide aliases and live gameplay still require validation.
          </p>
          {proposed !== "" && !valid && (
            <p className="inline-notice">Use a whole number from 0 to 127.</p>
          )}
          <details className="balance-offsets">
            <summary>Selected damage bytes</summary>
            <ul>
              {targets.map((c) => (
                <li key={c.rawDamageOffset}>
                  CPU {c.cpu} · raw offset {c.rawDamageOffset} · current base{" "}
                  {c.box.damage}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
