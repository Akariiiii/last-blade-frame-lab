# Local macOS application

The native **Last Blade 2 Frame Lab.app** embeds the built viewer in a macOS WebKit window. Double-click it to run offline. End users do not need Node, Python, an emulator or a web-development server. Closing the last window quits the application and its private loopback server.

## Requirements

- macOS 12 or later; one universal binary contains Apple Silicon and Intel code.
- A compatible local data pack for real game recordings. The app includes only original geometric demo images.

The native launcher is a small AppKit/WebKit shell. A read-only server binds only to127.0.0.1 on an automatically allocated port, serving built UI/demo and the selected pack. No frame/access logs, telemetry or online API are used by the launcher. Local data requests do not leave the machine. Wiki links open the system browser when clicked.

## Open real data

Use **Frame Lab → Choose Data Folder…** or **⌘O** and select the pack directory containing `manifest.json` and `extended/`. The app reads files in place; it does not copy several gigabytes into the bundle. The choice is remembered in local app preferences. **Use Demo** switches to the bundled example; **⌘R** reloads. All existing frame, collision, mode and CSV controls remain in the viewer. CSV/JSON downloads use a native Save dialog.

A `data/` directory beside the app is detected automatically. In the private checkout the package command can create a local symlink to existing recordings with `--data`. That link is outside the app and never included in the distributable ZIP. If you move the app away from that directory, choose the data folder again.

## Build from source

Development requires Node22.18+, npm and Xcode Command Line Tools on macOS. Running the built app does not require them.

```sh
npm ci
npm run package:mac
```

The output is `../Local/Last Blade 2 Frame Lab.app` and `../Local/LastBlade2-FrameLab-v<version>-macOS-universal.zip`. Existing outputs are preserved; use a new folder for another build:

```sh
npm run package:mac -- --output /path/to/new-package
npm run package:mac -- --output /path/to/private-package --data /path/to/local-pack
npm run test:mac -- '/path/to/private-package/Last Blade 2 Frame Lab.app'
```

Both architectures compile from the same source snapshot. The app is assembled in temporary staging, then published after compilation and signing. The package uses only built assets and the procedural demo; no game data, Node modules or Python runtime is embedded.

## Distribution

Send the macOS ZIP containing the `.app`. Real game recordings are a separate local pack. The source exporter also includes `desktop/macos/` and these build/test scripts so the public project can reproduce the app.

The current build is locally ad-hoc signed and **not notarized with an Apple Developer ID**. Downloaded copies may be subject to Gatekeeper. Public release signing/notarization is a separate owner-controlled step; this build does not alter security settings or remove quarantine. Do not claim Intel runtime acceptance solely because both architectures compile: the current machine is Apple Silicon.

A Windows x64 `.exe` package is now available; see [Windows local app](WINDOWS_APP.md). It requires Microsoft Edge WebView2 Runtime. Linux can use the portable web/source project.
