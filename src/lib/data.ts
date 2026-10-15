/** One selected local pack, shared by JSON, images and the binary frame reader. */
let mount = 'data';
let appBase = '/';
export function configureDataSource(directory: 'data' | 'demo', base = '/') {
  if (!base.startsWith('/') || !base.endsWith('/') || base.includes('..')) throw new Error('Invalid app base');
  mount = directory; appBase = base;
}
export function dataUrl(url: string): string {
  // References inside a pack use a stable /data namespace, including on GitHub Pages.
  if (url.startsWith('/data/')) return `${appBase}${mount}/${url.slice(6)}`;
  return url;
}
export function fetchData(url: string, options?: RequestInit) {
  return fetch(dataUrl(url), options);
}
export async function selectDataSource(base: string): Promise<'data' | 'demo'> {
  configureDataSource('data', base);
  const response = await fetchData('/data/manifest.json');
  // A server returning its HTML index for a missing JSON file is also absent data.
  const absent = response.status === 404 || response.ok && response.headers.get('content-type')?.includes('text/html');
  if (!absent && !response.ok) throw new Error(`Data pack request failed (${response.status})`);
  if (!absent) return 'data';
  configureDataSource('demo', base);
  const demo = await fetchData('/data/manifest.json');
  if (!demo.ok || demo.headers.get('content-type')?.includes('text/html')) throw new Error('No local data pack or demo found. Run npm run demo:generate.');
  return 'demo';
}
