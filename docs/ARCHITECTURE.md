# Architecture

```text
bootstrap → select local pack or procedural demo → App
                                            ├─ reference JSON → Reference canvas / damage proposal
                                            └─ native index + metrics + profiles → Frame workbench
                                                  └─ verified manifest + compressed files
                                                        → decoder → RGB + RAM rows
                                                        → native geometry → box overlays
```

## Boundaries

- **App shell** owns character/mode selection and the reference-library toggle. Workbench owns the selected move/setup, frame and playback controls.
- **Data mount** resolves the pack's `/data/` references against the Vite base. Pack contents are not rewritten for deployment. Missing local manifest falls back to demo; other HTTP failures are surfaced.
- **Decoder** parses quoted CSV, checks manifests/file SHA-256 hashes and lengths, decompresses framebuffer/RAM data and verifies decoded RGB hashes. V1 is first RGB then XOR against the previous frame in one zlib stream. V2 is palette-indexed tile32 data using u8 or big-endian u16 indices. Seeking is serialized; the RGB cache holds at most 24 frames. Indexed decompression retains the current clip's index stream; RAM/object tables remain loaded for that clip.
- **Geometry** projects captured native rectangles using facing, scale, camera origins and special dispatch. Only registered collision objects are eligible; stale original-profile-zero slots are excluded. Hurt and push roles stay distinct. The renderer does not infer missing boxes from sprites.
- **Metrics** are precomputed evidence supplied by the pack, independent of rendering. The viewer does not generate authoritative startup or advantage values by guessing from animation images. Comparison fields retain measured/reference numbers, condition scope and reasons.
- **Reference preview** exports a damage request; there is no ROM writer in this repository.

## Extension points

A new recording exporter should emit the documented contracts and hash exact bytes. Validate the pack with the importer before viewing. Preserve provenance and observed contacts; leave unknown scalar metrics null. Do not turn aliases or failed input recipes into invented authored moves.

Add source/model tests in `src/lib/` or `src/lib/native/`. Add pack-tool tests in `scripts/`. Use generated geometric fixtures rather than copyrighted game assets in public tests. A change to decoding/projection must preserve hashes and coordinate conventions. Recording and emulator validation belongs in the private producer pipeline.

## Native local shell

`desktop/macos/` wraps the built app in WKWebView. Its read-only server binds127.0.0.1 on a random port; requests resolve only within built web assets or the chosen data pack. Native menus select data without copying it; CSV/JSON download destinations use Save panels. The server has a16KiB header limit,15-second connection lifetime, host/origin checks and no directory listings. Opaque `.gz.bin` transport preserves byte hashes. Closing the app ends the server. The `--server-only` mode is a developer black-box test entrypoint; normal launches produce no access/frame logs.

`desktop/windows/` provides an independent Win32/WebView2 window with the same prebuilt viewer and data contract. The C++ read-only loopback transport is compiled for host-side tests and can be tested as the actual PE on Windows. End users need WebView2 Runtime, not Node/Python. Windows GUI/runtime acceptance is separate from cross-compilation and host transport checks; see [Windows app](WINDOWS_APP.md).

Timing UI keeps observed contact, sampled hitboxes, parent chains and later actions separate. Optional contact bounds use `≤`; unknown full durations remain blank. Metrics are supplied by the recording pack; rendering never fabricates a hitbox to fill a missing sample.
