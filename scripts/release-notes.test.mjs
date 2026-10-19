import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {readReleaseNotes} from './release-notes.mjs';
import {versionInfo} from './release-version.mjs';

test('release notes select the exact beta and preserve checked-in beta.1 text', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const notes = await readReleaseNotes(versionInfo('0.1.0-beta.1'), {root});
  assert.match(notes, /^# Last Blade 2 Frame Lab v0\.1\.0-beta\.1\n/);
  assert.match(notes, /newly drawn pixel-art Hibiki face icon/);
  assert.match(notes, /actual Windows WebView2 playback and dialogs remain unverified/);
});

test('an explicit new-beta note is accepted, while stale or missing notes fail', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-lab-release-notes-'));
  try {
    const release = versionInfo('0.1.0-beta.2');
    const filename = path.join(root, 'reviewed-notes.md');
    const notes = '# Last Blade 2 Frame Lab v0.1.0-beta.2\n\nVerified release changes.\n';
    await fs.writeFile(filename, notes);
    assert.equal(await readReleaseNotes(release, {filename}), notes);
    await assert.rejects(readReleaseNotes(versionInfo('0.1.0-beta.1'), {filename}), /must start with/);
    await assert.rejects(readReleaseNotes(release, {root}), {code: 'ENOENT'});
    await fs.writeFile(filename, '# Last Blade 2 Frame Lab v0.1.0-beta.2\n');
    await assert.rejects(readReleaseNotes(release, {filename}), /empty/);
  } finally {
    await fs.rm(root, {recursive: true, force: true});
  }
});
