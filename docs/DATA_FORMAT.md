# Data pack contract

```text
manifest.json                 Reference roster (schemaVersion 1)
characters/*.json             CharacterData / Move contracts
captures/*.json               Optional reference recordings and image references
extended/
  index.json                  Accepted native entries and clip locations
  metrics.json                Per-entry timing, comparison and phase ranges
  profiles.json               flags_by_character for native collision roles
  moves.csv                   Representative move/setup rows
  guard-evidence.json         Optional separately measured switch RAM/provenance
  clips/<id>/
    manifest.json             Exact dimensions, hashes, encoding and file list
    frames.rgbx.zlib           Compressed frame stream (both native versions)
    ram.csv.gz.bin            Gzip RAM CSV served as opaque bytes
    objects.csv.gz.bin        Optional registered collision-object snapshots
    palette.rgb               Required by indexed v2 clips
```

Reference contracts are in `src/types/reference.ts`; native contracts in `src/lib/native/types.ts`. Existing raw `.gz` aliases may also exist privately; browser transport uses `.gz.bin` to avoid automatic HTTP gzip decoding before byte/hash verification.

All internal asset references must start with `/data/`. Paths must stay inside the pack. The importer checks reference traversal, duplicates, required metrics, clip manifests and declared binary file lengths/hashes; frame-level decode validation occurs in the browser. It does not trust arbitrary external URLs as pack files. Hardlinked files are ordinary files; escaping symlinks are rejected.

## Native frames

V1: `lastblade2-native-clip-v1`, 320×224 RGB, `first-rgb-then-xor-previous-single-zlib`. The first frame is RGB; each following frame is XOR with the preceding decoded RGB.

V2: `lastblade2-native-clip-v2`, same dimensions, `indexed-tile32-single-zlib`, tile_size32, index_bytes1 or2, palette_count with exactly count×3 palette bytes. Data is tile-major, then frame-major within each tile. The image has10×7tiles. U16 palette indices are big-endian. Every decoded RGB frame must match `frames[index].rgb_sha256`.

File SHA checks apply to compressed bytes; RGB SHA checks to decoded frames. `manifest_sha256` in the index pins the exact manifest bytes, including its newline.

## Metrics

`metrics.clips[id]` contains `values`, `canonical_move`, `default_visible`, `primary_recording`, `alias`, `comparison`, `phase_ranges` and `frozen_ranges`. `values` carries numbers or nulls; `comparison.fields` retains independent measured/wiki values, raw references, status and reason. Statuses include `match`, `different`, `needs_review` and `unavailable`.

Measured timing must document its clock and boundaries. Source/projectile clocks, native VBlank commits and host FPS are distinct. Damage may be total observed HP loss, chip or scaled combo damage; meter may include execution/contact gain or saturation. Held guard and switch guard can produce different advantage. A numeric mismatch does not automatically establish a bug or a wrong wiki.

CSV has readable core fields first (character/mode/move/name/setup, damage/startup/active/recovery/advantage/meter), followed by raw boundaries, cadence/frozen counts, scope, independent Wiki fields, comparison and review notes. Not every pack must contain every wiki field; do not substitute an absent reference for a measurement.

### Guard fields

`HeldGuardAdvantage` and `SwitchGuardAdvantage` are signed defender-ready minus attacker-ready values. `ReboundRecovery` is a positive attacker response-entry to control-ready duration, excluding verified source freeze; it is not a third signed advantage. `BlockAdvantage` retains the held-result compatibility alias. `Recovery` is null for confirmed recoil; do not fall back to a hit recording. `ReboundEntryFrame`, `ReboundAnimationFrame` and `ReboundAnimationDuration` retain distinct boundaries. `ReboundStatus` distinguishes measured, incomplete, not-observed and attacker-hit review.

Optional top-level `guard_sources` maps provenance IDs to metadata; `guard_evidence_url` references a separate validated `/data/` JSON file, with retained RAM rows and source hashes/lines. Per-clip `switch_guard_source` and `SwitchGuardSource` identify the separate trial. Historical switch evidence uses normal-dispatch eligibility / attacker animation exit, not native control flags that those legacy sources do not contain. Its result is never represented as part of the selected image recording. Missing character/mode/conditional coverage is null. `GuardWikiBasis` distinguishes held, switch, both, neither and unresolved numeric agreement; it does not prove a universal wiki policy.

### Contact and sampled geometry

`FirstActiveFrame` / `LastActiveFrame` / `ActiveWindows` describe captured geometry only. `ContactFrame` is the first selected-target contact; `FirstEffectFrame` is the earliest of that contact and captured geometry. A transient box cleared before sampling cannot be reconstructed from HP loss alone. When contact precedes geometry, exact `Startup` / `StartupInclusive` are null and `StartupUpperBound` is the source-counted contact bound. UI displays `≤`, not an exact number. `Active` is null if target damage lacks captured geometry; `CapturedActive` preserves the measurable subset. `GeometryCoverage` and `TimingReview` expose this scope. Recovery is null if a later contact makes the captured last-active boundary incomplete.

`damage_events` retains every HP loss in the recording. `TargetDamage` counts the selected entry onward; `Damage` includes parent-chain damage where explicitly labelled, but excludes a proven later repeated input. `RecordingDamage` preserves the untrimmed total. Owner actor windows stop at first control-ready; registered owned projectile lifetimes remain independent. Defender readiness is found after the final selected-target contact. `inter_hit_ready` warns of readiness between hits; final advantage is not proof of an unbroken combo.

Additional phases are `parent`, `contact`, `effect` and `later`. Contact means observed reaction/HP loss, not a fabricated active rectangle. Every selected-target HP-loss sample must be active/contact rather than startup/recovery. JSON/CSV retain the unknowns instead of borrowing wiki values. Existing older packs without the optional fields continue to render.

## Public demo

The bundled demo has no ROM or external-art inputs. Its shapes and example measurements are generated by `scripts/generate-demo.mjs`; every entry is marked synthetic, and the app shows a persistent demo notice. The example red startup difference demonstrates the comparison UI and is not a factual wiki claim.
