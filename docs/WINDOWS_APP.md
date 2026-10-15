# Windows local app

The native x64 launcher embeds the built viewer in Microsoft Edge WebView2. It runs independently of Node.js, Python, an emulator, or a development server. Game ROMs and private recordings are not included.

## Run

1. Extract the complete `LastBlade2-FrameLab-v0.1.0-beta.1-Windows-x64.zip` into a writable local folder.
2. Open `Last Blade 2 Frame Lab.exe`. Keep `WebView2Loader.dll` and `web/` beside it.
3. Use **File → Choose Data Folder** to select a recorded pack containing `manifest.json` and `extended/`. Alternatively place a complete `data/` folder beside the EXE before first launch.
4. **File → Use Demo** restores the procedural demo. `Ctrl+O` chooses data; `Ctrl+R` reloads. Export buttons open a native Windows Save dialog.

Requires Windows 10/11 x64 and the [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/#download-section). The launcher reports a missing runtime; it does not install software automatically. The Microsoft loader DLL is bundled, while the browser runtime is maintained separately. See Microsoft's [distribution guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).

This package is unsigned. Cross-compilation and host-side transport checks do not constitute Windows runtime acceptance. Before release, test actual Windows startup, frame playback/overlays, a path containing spaces or non-ASCII characters, folder selection, demo switching, and CSV/JSON downloads.

## Build

Install Node.js 22.18+ and MinGW-w64 with a C++17 compiler/resource compiler. On macOS the tools are `x86_64-w64-mingw32-g++` and `x86_64-w64-mingw32-windres`; on Windows use the MSYS2 UCRT64 toolchain (`g++` and `windres` on PATH). No Visual Studio or .NET runtime is required by the generated app.

From `Viewer/`:

```sh
npm ci
node scripts/package-windows.mjs --output ../Local/windows-v1
```

The build downloads Microsoft.Web.WebView2 **1.0.4258.31**, verifies its pinned SHA-256, and takes an immutable source/UI snapshot. It builds an x64 Windows GUI executable with the C++ runtime linked statically, copies Microsoft's loader/license notices, and archives the viewer plus procedural demo. Existing output is never overwritten. Choose a new output directory for each build.

To package an already built production UI, pass `--assets ./dist`. To use a previously downloaded SDK package, pass `--sdk-package /path/to/microsoft.web.webview2.1.0.4258.31.nupkg`; its checksum is still mandatory. `FRAME_LAB_WINDOWS_CXX` and `FRAME_LAB_WINDOWS_WINDRES` override the tool names. The assets directory must not contain private `data/` or symlinks.

The package manifest records SHA-256 and byte count for every payload file. The SDK package is obtained directly from Microsoft's [NuGet feed](https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4258.31/microsoft.web.webview2.1.0.4258.31.nupkg).

## Validate

macOS/Linux, without launching Wine or opening a window:

```sh
node scripts/test-windows.mjs
```

This compiles **the shipping transport source** for the host and tests exact file delivery, MIME types, HEAD, 4 MiB streaming, concurrent reads, Unicode paths, write rejection, traversal/symlink rejection, Host/Origin enforcement, oversized headers, and absence of access logs. It does not exercise Win32 dialogs, Winsock, or WebView2.

Check the built executable, all payload hashes, and exact ZIP contents on any Node.js build host:

```sh
node scripts/verify-windows.mjs --bundle ../Local/windows-v1/LastBlade2-FrameLab-Windows --zip ../Local/windows-v1/LastBlade2-FrameLab-v0.1.0-beta.1-Windows-x64.zip
```

This checks the x64 GUI PE header, absence of non-system C++/Node/Python DLL dependencies, embedded non-administrator manifest, production/demo payload boundary, and byte-for-byte archive agreement. It is a package integrity check, not a Windows execution test.

On actual Windows, after building the package:

```powershell
node scripts/test-windows.mjs --exe "..\Local\windows-v1\LastBlade2-FrameLab-Windows\Last Blade 2 Frame Lab.exe"
```

The explicit `--server-only` test mode launches no window or WebView2 and prints only its test endpoint. The test harness terminates the child afterwards. Normal app launches produce no access logs.

## Storage and lifecycle

- User-selected pack paths and demo selection are remembered under `HKCU\Software\LastBlade2FrameLab`.
- WebView2's browser profile/cache lives in `%LOCALAPPDATA%\LastBlade2FrameLab\WebView2`. This is browser state, not per-frame diagnostic logging.
- The read-only server binds only `127.0.0.1` on an automatically chosen port and stops with the window. Only the built UI/demo and explicitly selected pack are available.
- Host and Origin must match that endpoint. External HTTP(S) links open in the user's browser. Export downloads use a native Save dialog.
- Package updates can be extracted into a new folder. Recordings remain external and are selected again as needed; do not copy a developer's full working directory.

The native title bar, Windows product/file-version strings and `package-manifest.json` retain the full application version. Numeric PE/assembly version fields are generated by the package script from `package.json`; never edit the resource numbers independently. See [releasing](RELEASING.md).
