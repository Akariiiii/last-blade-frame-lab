# Last Blade 2 Frame Lab

A browser tool for inspecting saved fighting-game frames, collision boxes, damage and move timing. Built with React, TypeScript and Canvas. It plays exported recordings; it does not run an emulator or modify a ROM.

The public repository includes **original geometric demo images and example values**, plus a newly drawn Hibiki pixel portrait used as the app icon. Real Last Blade 2 sprites, ROMs, BIOS, emulator binaries, recordings and wiki snapshots are supplied separately and are not included. See [NOTICE.md](NOTICE.md).

## Local app (macOS)

A native Mac package opens the same viewer in its own window and runs offline. Double-click **Last Blade 2 Frame Lab.app**; end users need neither Node nor Python. Choose your real recordings with **⌘O**, or use the bundled procedural demo. The universal build targets Apple Silicon/Intel on macOS12+. Read [local application instructions](docs/LOCAL_APP.md) for packaging, data selection, native tests and signing status.

Developers can build it with `npm run package:mac`. This writes an app and ZIP outside the source folder. Large game data stays external and is excluded from the archive.

## Versions and release ZIPs

The app displays its release version in the footer and native window title. Ready-to-run archives include it in their filenames, for example `LastBlade2-FrameLab-v0.1.0-beta.1-macOS-universal.zip` and `LastBlade2-FrameLab-v0.1.0-beta.1-Windows-x64.zip`. See [release preparation](docs/RELEASING.md) for updating the version, building both ZIPs and generating checksums/release notes.

## Run

Requires **Node.js 22.18+** and npm. Use a current browser with Canvas, Web Crypto and DecompressionStream support.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. With no local data pack, the synthetic demo loads automatically. Power, Speed and EX examples demonstrate the same controls; they are not game measurements.

```sh
npm run check       # Tests, TypeScript and production build
npm run preview     # Serve the built app at http://127.0.0.1:4173/
```

The development and preview servers bind to this computer only. No backend, account, API key or emulator is required for playback. After npm installs dependencies, playback uses local assets and does not fetch a wiki. Source links open only when clicked.

## Use your recordings

A pack contains `manifest.json`, reference character/capture JSON and `extended/` native clips, profiles, metrics and move CSV. References use `/data/…`; the app maps them to the selected pack and hosting base. See [the data contract](docs/DATA_FORMAT.md).

```sh
# Validate without copying:
npm run data:import -- /path/to/exported-data --check-only
# Import into a clean checkout:
npm run data:import -- /path/to/exported-data
```

For the existing research workspace, the source pack is its `Viewer/public/data` directory. Quote paths containing spaces. Import verifies local references, lengths and SHA-256 checksums, then copies only referenced files into ignored `public/data/`. It refuses to replace existing data and checks available disk space. Reload the page after importing. Large packs can require many gigabytes and take time to verify/copy.

The public project does not include the Mac/Wine capture runners or ROM patching pipeline. They depend on a separate private research workspace. Importing an existing pack is the supported public workflow; dropping a game ZIP into the browser does not extract its data.

## Windows local app

Extract the full Windows ZIP and open **Last Blade 2 Frame Lab.exe**. Keep the included loader DLL and `web/` folder together. Use **File → Choose Data Folder** for saved game recordings; the package contains only the procedural demo. Requires Windows10/11 x64 and Microsoft WebView2 Runtime. See [Windows setup and builds](docs/WINDOWS_APP.md). The executable is cross-compiled; actual Windows UI/playback acceptance remains pending.

## Controls

- Select a character, Power/Speed/EX mode and move. Narrow windows use the Move dropdown.
- Select a saved hit, guard, whiff or conditional setup. **All input variants** reveals grouped aliases without duplicating primary move rows.
- Click the timeline or use **← / →** to step, **Shift + arrow** for ten frames, **Space** to play/pause and **Home / End** for boundaries. Shortcuts leave form controls alone.
- Toggle hitboxes, hurtboxes, push boxes, the opponent and registered projectile objects. Player and object geometry comes from captured native collision data.
- Read startup, active, recovery, damage, on-hit advantage and meter beside independent saved reference values. **Guard and rebound** shows held-guard advantage, switch-guard advantage and attacker rebound duration separately. Open **Guard measurement sources** to inspect their boundaries and provenance. Comparable matches are green; differences red; uncertain conditions carry review notes.
- **Export CSV** downloads the current pack's representative move table. **Reference library** retains the earlier reference/ROM view. Damage preview exports a proposal only; it does not patch a game.

## Interpreting frames

UI frame markers are **one-based**; CSV markers **zero-based**. Startup counts from observed move entry to first active collision. Source hitpause is excluded from source-active timing. Recovery includes the observed native control-ready boundary; crouching readiness does not wait for standing animation.

Advantage is observed defender readiness minus attacker readiness, not an earliest-retaliation test. Nominal FPS is the emulated cadence, not host performance. Air, knockdown, super freeze, projectile clocks, combo scaling and guard policy may require separate interpretation. CSV `Comparison`, `MatchedFields`, `DifferenceFields` and `ReviewNotes` preserve review state because CSV cannot store colours. A numeric match validates that comparable field, not every part of a move or the wiki as a whole.

Guard advantage is signed; rebound duration is positive elapsed attacker recovery. Held guard keeps the same stance; switch guard changes standing/crouching after a block reaction. Switch results may come from a separate retained RAM trial using legacy normal-dispatch readiness, explicitly labelled in the panel. Missing results stay blank. Normal recovery belongs to the selected recording and is blank on confirmed weapon recoil; it is never replaced by hit-recording timing. Wiki on-block agreement identifies a possible guard condition for that tested move, not a universal wiki measurement policy.

Contact and captured geometry are separate evidence. Some hitboxes are cleared by the game before a saved RAM snapshot. If contact precedes the first captured hitbox, startup shows only an upper bound (`≤`) and full active duration stays unknown. The timeline marks contact and follow-through separately; it does not invent a continuous active window. First contact / captured-hitbox boundaries and timing-review notes expose the limitation. Parent chains and later repeated inputs remain distinct; final-contact advantage does not prove a true combo.

In the current private recorded pack, native dash identity checks distinguish real `66~A` from ordinary `5A`, group observed `66~B` as a variant, and group recorded `66~C` under ordinary `5C` after dash. Conditional variants and distinct recovery tails are retained. Recorded clip counts are not a claim of complete authored-move coverage.

## Project layout

```text
src/
  app/                 App shell, character/mode navigation and theme
  features/
    workbench/         Move table, statistics, timeline and native frame canvas
    reference/         Reference frame canvas and damage proposal UI
  lib/
    data.ts            Local/demo pack selection and hosting-path resolution
    playback.ts        Shared frame stepping and reference geometry helpers
    native/
      decoder.ts       CSV parsing, compressed frame loading and SHA verification
      geometry.ts      Native collision projection and object filtering
      types.ts         Native recording contracts
  types/reference.ts   Reference JSON and capture contracts
desktop/macos/         Native WebKit app and read-only local server
scripts/               Demo/import/export and native app build/test tools
docs/                  Architecture and data contract
public/demo/           Procedural demo; safe to include with the source
public/data/           User-supplied game data; ignored by Git
.github/workflows/     Tests/build checks; no automatic deployment
```

See [architecture](docs/ARCHITECTURE.md) for data flow and extension points. Shared decoders have no React dependency. The app has no imports from the private research workspace.

## Build for a hosting subpath

For GitHub Pages at `/your-repository/`, set the Vite base before building:

```sh
# macOS/Linux:
FRAME_LAB_BASE=/your-repository/ npm run build
```

For local preview of this build, use the same base: `FRAME_LAB_BASE=/your-repository/ npm run preview`, then open that subpath.

On PowerShell: `$env:FRAME_LAB_BASE='/your-repository/'; npm run build`. Production builds include only the procedural demo, even when private recordings exist locally. Deploy `dist/` using your chosen hosting workflow. The included CI only validates the project; it does not publish it. Keep real game data out of public deployments: use a clean source export that contains only the demo.

## Prepare the public repository

From the private workspace's Viewer directory:

```sh
npm run package:public
```

This creates a new `Public/last-blade-frame-lab/` folder beside Viewer using an explicit source allowlist. Use that folder as your GitHub repository root. It includes this README, docs, tests, pinned dependencies and the procedural demo. It excludes `public/data`, original ROMs, BIOS, emulator executables, research traces, screenshots, dependencies, builds and machine-specific paths. `PUBLIC_EXPORT.json` records file hashes and size. The command refuses to overwrite an existing export; pass `-- --output /new/folder` for a separate revision, or `-- --refresh` to update an unchanged generated export. Refresh refuses to overwrite any source file edited in the export.

Select an application licence and add `LICENSE` before inviting reuse. None has been chosen automatically. See the third-party asset boundary in [NOTICE.md](NOTICE.md).

## Validation and limits

Focused tests cover frame stepping, facing/camera transforms, frozen versus active samples, actual HP changes, CSV parsing, native v1/v2 decompression and checksum failures, u16 palette indices, registered object filtering, subpath resolution and data-import boundaries. The synthetic fixture tests work in a clean clone. Original-game runtime acceptance and exhaustive roster coverage are separate from application tests.
