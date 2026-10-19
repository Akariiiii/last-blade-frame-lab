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
  hits.csv                    Selected-move contact damage and stun per event
  guard-trials.json            Optional real guard/retaliation trials
  air-trials.json              Optional independent height/landing trials
  repeats/<id>.json            Optional pinned repeat collision evidence
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

The **Distance / grab range** layer reads each displayed RAM row. Position gap is
the absolute signed world-X difference. Native distance is the source actor's
big-endian word at `+0x178`; the two can differ within an update. Camera scaling
is applied only to the on-screen ruler, not the reported game units.

Verified original-program ground-grab routes also show the CPU030436 adjusted
distance, mode-dependent limit and target-character/pose allowances. Profiles in
`src/lib/native/rangeProfiles.ts` are pinned to the recorded original-program
SHA256. Missing/different identities, unmapped predicates and incomplete packets
never borrow a range from another move. Target height and no-throw byte are shown
separately; distance passing does not prove admission or an active grab window.

The dashed range band is a reference using that frame's target allowances.
The reference is drawn as one full-reach span from P1 toward the target, rather
than a centered box. A limit72 means origin-to-target72 before allowances;
it is not a total width72 or a reach36. The distance predicate has no facing
test, while earlier command admission/turning is separate. This overlay does
not certify practical rear-grab eligibility.

RAM is sampled after the update; a successful grab may already have repositioned
both actors. Actual rejected-check markers come only from
`entry.measurement_protocol.native_grab_whiff.rejected_gate_frames0`, independently
aligned to the native-event ledger. They do not manufacture check results on
other frames. Existing image manifests and raw data are not modified.

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

`FirstActiveFrame` / `LastActiveFrame` describe the original captured geometry. `ActiveWindows` may also include independently verified pre-response samples. `ContactFrame` is the first selected-target contact; `FirstEffectFrame` is the earliest of that contact and measured geometry. A transient box cleared before sampling cannot be reconstructed from HP loss alone. When contact precedes measured geometry, exact `Startup` / `StartupInclusive` are null and `StartupUpperBound` is the source-counted contact bound. UI displays `≤`, not an exact number. `Active` is null if contact lacks complete sampled geometry; `CapturedActive` preserves the original measurable subset. `GeometryCoverage` and `TimingReview` expose this scope. Recovery is null if a later contact makes the captured last-active boundary incomplete.

`damage_events` retains every HP loss in the recording. `TargetDamage` counts the selected entry onward; `Damage` includes parent-chain damage where explicitly labelled, but excludes a proven later repeated input. `RecordingDamage` preserves the untrimmed total. Owner actor windows stop at first control-ready; registered owned projectile lifetimes remain independent. Defender readiness is found after the final selected-target contact. `inter_hit_ready` warns of readiness between hits; final advantage is not proof of an unbroken combo.

Additional phases are `parent`, `contact`, `effect` and `later`. Contact means observed reaction/HP loss, not a fabricated active rectangle. Every selected-target HP-loss sample must be active/contact rather than startup/recovery. JSON/CSV retain the unknowns instead of borrowing wiki values. Existing older packs without the optional fields continue to render.

### Repeats, contacts and stun

`repeat_verification` supplements an original clip only after the complete declared RAM/object schemas and values agree through the required boundary. Three distinct host pacings 1/2/4 must agree in full RAM, object streams and collision samples. Proofs pin original and repeated files, harness, spec and fixture hashes. An older recording missing required fields stays unverified even when its common columns agree. The original images and manifests remain immutable.

`hit_events` lists selected-entry contacts with recorded frame, damage, gap, cumulative damage, stun loss, target stun remaining/capacity, heights and observed defender readiness before the next contact. A zero-chip native guard response remains a block event. Multiple native hits within one snapshot can merge into one HP-loss event. `hits.csv` exports these events for representative move/setup rows.

Separate guard trials can include `verification_status: "provisional"`, initial
`guard_direction` (`1` crouching, `4` standing), observed `outcome`, and raw trace
hashes. A provisional trial is shown with its own frame indices and evidence
label; it never fills verified scalar move statistics. Three distinct pacings
1/2/4 are required for the existing repeat-checked scalar path. Mixed contacts
have no pure block advantage. `guard_trials_csv_url` optionally references the
readable 13-column guard CSV; all `Frame0` columns are zero-based. These are
observed neutral-readiness boundaries, not earliest counterattack eligibility.

`StunDamage` is the observed decrease in the target's remaining stun resource, not an attack's universal base stun. Capacity and remaining come from target packet offsets 189/188 hex; defense is retained separately. Disabled or underflow/reset cases stay unknown unless paired native instruction samples resolve them. A byte borrow primes the follow-up window; exactly zero remaining alone does not prove dizzy. Runtime threshold/mash/defender-variation coverage remains incomplete.

`LandingRecovery` measures physical touchdown to the observed control-ready flag. It does not prove the earliest attack, guard or jump input admission. Held-jump/input-height trials and isolated landing button tests remain separate evidence. Throw/counter `move_phase` separates successful grab sequencing, whiff duration and counter response from ordinary startup. The first cinematic damage is never used as a grab-startup value.

Optional `landing_trials_url` and `landing_trials_csv_url` reference the separate
landing registry and CSV. The importer retains both. Registry groups use
`selector|mode|canonical move`, then actual `hit`, `block` or `whiff`. Each outcome
contains a no-follow-up baseline, isolated B/BCD pulse trials and earliest tested
boundaries. Physical touchdown, landing animation, no-input neutral, requested
pulse, observed button and actual grounded attack admission have distinct
zero-based fields. A failed interval is a tested inclusive range, not an assumed
universal recovery restriction. Three full RAM/object/collision/native-event
bundles at distinct host pacings1/2/4 must agree. UI adds1 to displayed markers
but leaves elapsed frame differences unchanged. Current data covers only Power
jB for Yuki/Amano at one recorded height against grounded Kaede.

Conditional target evasions may use
`measurement_protocol.native_target_evasion.validation: "free_input_v2"`.
This requires an exact real-input waveform (+1 snapshot delay), freely controlled
target motion, no target damage/hitpause and no native capture/stun response.
Forward-jump script0A is distinct from vertical09 for the recorded Kaede target;
cinematic target height alone never proves evasion. The target setup remains a
condition on that image's whiff outcome, not a standing-target miss.

Entries can carry a separate `measurement_protocol` for recipe details omitted from immutable image manifests. It pins the producer ledger, fixture and harness. Only whitelisted protocol labels such as `guard_policy` can augment measurement; native entry/contact/readiness frames cannot be overridden. Taunt recordings use `system_taunt`; requested hit/block setups may actually whiff and are displayed by observed result.

## Public demo

The bundled demo has no ROM or external-art inputs. Its shapes and example measurements are generated by `scripts/generate-demo.mjs`; every entry is marked synthetic, and the app shows a persistent demo notice. The example red startup difference demonstrates the comparison UI and is not a factual wiki claim.

### Conditional charge / held-input trials

Optional `metrics.charge_trials_url` references `/data/extended/charge-trials.json`.
Its `groups` key is `selector|mode|source catalog request ID`; it contains separate
conditional trial rows rather than replacing the selected clip or scalar values.
The actual `input_label` is retained: Kojiroh6BC uses a related BC source recipe
but does not relabel the BC image recording. `charge_trials_csv_url` can reference
the optional readable CSV, included by the data-pack importer.

Each row retains initial/held buttons and physical hold ticks, requested versus
observed outcome, guard stance/input checks, HP loss and observed stun depletion,
wait initialization/exit markers and native iteration calls, physical release,
first sampled activity/contact and source controller-ready markers. Stored frame
indices are zero-based **video trace rows local to that trial**; the UI adds1.
A signed release-to-activity delta can be negative after native automatic release.
Wait operands, native calls, video ticks and source-animation startup are separate
clocks. Null first activity stays unknown even when a projectile contacts.

`repeat_verified_fixture` requires three distinct host pacings1/2/4 and complete
RAM/object schema+value/native-event equality, with per-repeat raw, hook, harness,
fixture and ROM hashes. It does not establish image equivalence with older clips,
all-defender guard levels, deflect behavior, an exact charge boundary between
sparse hold samples, universal base damage/stun, or earliest actionable recovery.
Normal guard controls remain in the private review summary rather than crowding
the charge table. Whiff setups which actually contact retain their actual result.

### Actual outcome coverage

Optional `metrics.setup_coverage_url` references `setup-coverage.json`. Its group
key is `selector|mode|canonical_move`, matching the visible move browser. Every
image entry points to a real indexed clip; every independent trial retains its
source recipe, actual outcome, requested setup, guard policy, evidence identity
and per-trial values. Trial frames never become image frames.

Coverage counts actual `hit`, `block`, `whiff` only. Requested whiffs that hit
belong to Hit, and mixed contact does not qualify as pure Block. The Outcome dropdown selects statistics and image playback together. Independent
RAM trials are used only when no image recording exists for that outcome, with an
explicit RAM-only label and no playable timeline. Image and trace-only observations
remain separate; absent images show an empty recording placeholder. Different spacing,
height and follow-up recipes may share a move group, so a group with three observed
outcomes is not proof of a matched three-state experiment for every variant.
Throw/counter phases suppress generic startup/active/recovery. Main statistics
continue to belong to the selected image; independent trials cannot overwrite
them. Pack import retains this optional registry, and older packs still work.


The primary statistics now include `StunDamage` (observed defender resource loss).
`BlockAdvantage` replaces `HitAdvantage` for Block. Whiff has no contact advantage;
zero damage, meter or stun remain visible as measured zeroes. Diagnostic coverage
rows retain optional `StartupInclusive` and `MeterGain` for the RAM-only view.
Selecting an outcome resets playback to its first frame, and decoded image data is
scoped by recording ID to prevent a previous outcome's frames from remaining on screen.


### Throw-whiff phase preservation

New recordings can retain `metadata.measurement_phase_family: "throw"` to preserve
a source's native throw semantics under a new capture ID. `WhiffAttemptDuration`
is the advancing-frame interval from observed entry to control readiness. The UI
labels it **Whiff duration**, not ordinary post-active Recovery. Generic
Startup/Active/Recovery are left unknown until their specific phase is established.
Command-grab backfills retain native rejected-gate frame/count observations and
raw/native-event hashes in the index measurement protocol; one gate evaluation is
not automatically a conventional one-frame active window.
