import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cp } from 'node:fs/promises';
import path from 'node:path';
import {readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).version as string;
export default defineConfig({
  define: {__APP_VERSION__:JSON.stringify(version)},
  plugins: [react(), {
    name: 'publish-procedural-demo-only',
    transformIndexHtml(html) {return html.replace('<title>Last Blade 2 · Frame Lab</title>',`<title>Last Blade 2 · Frame Lab v${version}</title>`);},
    async writeBundle(options) {
      // Production output always excludes the private recordings directory.
      await cp('public/demo', path.join(options.dir || 'dist', 'demo'), { recursive: true });
      await cp('public/app-icon.png',path.join(options.dir || 'dist','app-icon.png'));
      for(const file of ['LICENSE','NOTICE.md','THIRD_PARTY_NOTICES.md'])await cp(file,path.join(options.dir || 'dist',file));
      const {writeFile}=await import('node:fs/promises');
      await writeFile(path.join(options.dir || 'dist','version.json'),JSON.stringify({version,tag:`v${version}`})+'\n');
    },
  }],
  base: process.env.FRAME_LAB_BASE || '/',
  build: { copyPublicDir: false },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
