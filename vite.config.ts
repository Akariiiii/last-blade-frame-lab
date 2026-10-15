import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cp } from 'node:fs/promises';
import path from 'node:path';
export default defineConfig({
  plugins: [react(), {
    name: 'publish-procedural-demo-only',
    async writeBundle(options) {
      // Production output always excludes the private recordings directory.
      await cp('public/demo', path.join(options.dir || 'dist', 'demo'), { recursive: true });
    },
  }],
  base: process.env.FRAME_LAB_BASE || '/',
  build: { copyPublicDir: false },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
