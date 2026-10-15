# Versioned releases

`package.json` is the authoritative application version. The UI footer, browser title, native window titles, Mac bundle metadata, Windows version resources, package manifests and ZIP filenames derive from it. `package-lock.json` must agree. Prereleases use `MAJOR.MINOR.PATCH-beta.N` (alpha/rc also supported).

To prepare the next version without creating a Git tag automatically:

```sh
npm version 0.1.0-beta.2 --no-git-tag-version
npm run check
```

On macOS with Xcode Command Line Tools and MinGW-w64, build both platforms into one new directory. The Windows build can reuse the exact UI built by the Mac package:

```sh
npm run package:mac -- --output ../Releases/v0.1.0-beta.2
npm run package:windows -- --output ../Releases/v0.1.0-beta.2 --assets ./dist
npm run test:mac -- '../Releases/v0.1.0-beta.2/Last Blade 2 Frame Lab.app'
npm run verify:windows -- --bundle ../Releases/v0.1.0-beta.2/LastBlade2-FrameLab-Windows --zip ../Releases/v0.1.0-beta.2/LastBlade2-FrameLab-v0.1.0-beta.2-Windows-x64.zip
npm run release:assets -- --directory ../Releases/v0.1.0-beta.2
```

The output contains versioned Mac/Windows ZIPs, `SHA256SUMS.txt`, `release-manifest.json` and editable `RELEASE_NOTES.md`. Both ZIPs include the procedural demo only; recordings stay separate. Old packages are preserved. Mac build metadata uses the numeric core version; the full prerelease label is retained in `FrameLabVersion`, the About panel and window title. Windows stores numeric file-version fields and the full release label as product/file version strings.

Commit/push the matching source before creating the corresponding GitHub tag/release. Use the generated `v…` tag/name, mark beta/alpha/rc builds as prereleases, paste the release notes and upload the two app ZIPs plus checksum/manifest files. Build/asset preparation scripts never create tags, publish a GitHub Release or upload recordings automatically. Native Windows runtime testing and public signing/notarization remain separate acceptance steps.

## Application artwork

The app uses the Hibiki pixel portrait in `desktop/icons/hibiki.png`. Prebuilt `FrameLab.icns` / `FrameLab.ico` are included in source, so normal app builds need no image tools. The browser favicon is `public/app-icon.png`. To regenerate icon sizes from a changed master, run `npm run icons:build` on macOS with ImageMagick and iconutil. This only resizes/transcodes the finished artwork using nearest-neighbor sampling; it does not redraw it. Mac bundles declare CFBundleIconFile; Windows embeds the multi-size ICO and loads it for both window-icon sizes.
