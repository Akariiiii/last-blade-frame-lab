import test from 'node:test';
import assert from 'node:assert/strict';
import { configureDataSource, dataUrl } from './data.ts';
test('pack references work at a GitHub Pages subpath without rewriting evidence', () => {
  configureDataSource('demo', '/frame-lab/');
  assert.equal(dataUrl('/data/extended/clips/example/ram.csv.gz.bin'), '/frame-lab/demo/extended/clips/example/ram.csv.gz.bin');
  assert.equal(dataUrl('https://example.org/wiki'), 'https://example.org/wiki');
  configureDataSource('data', '/');
  assert.equal(dataUrl('/data/manifest.json'), '/data/manifest.json');
  assert.throws(() => configureDataSource('data', '/../'));
});
