import fs from 'node:fs/promises';
import path from 'node:path';

/** Require notes for the exact release; never reuse a previous beta's text. */
export async function readReleaseNotes(release, {root, filename} = {}) {
  const source = filename || path.join(root, 'docs', 'releases', `${release.tag}.md`);
  const notes = await fs.readFile(source, 'utf8');
  const heading = `# Last Blade 2 Frame Lab ${release.tag}`;
  if (notes.split(/\r?\n/, 1)[0] !== heading) {
    throw new Error(`Release notes must start with: ${heading}`);
  }
  if (notes.trim().split(/\r?\n/).length < 3) throw new Error('Release notes are empty.');
  return notes;
}
