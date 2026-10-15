/** Retain verbatim installed licence texts for the components shipped in web builds. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'));
let text='# Third-party web component notices\n\nThese notices apply to third-party components, independently of the viewer\'s MIT licence. Versions below match package-lock.json. The Windows WebView2 loader has additional notices in THIRD_PARTY_NOTICES.txt in the Windows package.\n\n';
for(const [name,file,url] of [
  ['react','LICENSE','https://github.com/facebook/react'],
  ['react-dom','LICENSE','https://github.com/facebook/react'],
  ['scheduler','LICENSE','https://github.com/facebook/react'],
  ['vite','LICENSE.md','https://github.com/vitejs/vite'],
]) {
  const directory=path.join(root,'node_modules',name);
  const pkg=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));
  if(lock.packages[`node_modules/${name}`]?.version!==pkg.version)throw new Error(`Installed ${name} does not match the lockfile; run npm ci.`);
  text+=`## ${name} ${pkg.version}\n\nSource: ${url}\n\n`;
  if(name==='vite')text+='Vite is a build tool. Generated module-preload support is included in web builds. The complete licence file below also preserves notices for dependencies bundled with Vite itself; their presence here does not imply that every listed dependency ships in the viewer.\n\n';
  text+='```text\n'+(await fs.readFile(path.join(directory,file),'utf8')).trimEnd()+'\n```\n\n';
}
await fs.writeFile(path.join(root,'THIRD_PARTY_NOTICES.md'),text);
console.log('Updated notices for pinned React, React DOM, Scheduler and Vite.');
