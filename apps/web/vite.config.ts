import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  server: {
    // 5173 is Vite's default and collides with other projects; a fixed port
    // also keeps the login cookie tied to one origin between restarts.
    port: 5180,
    strictPort: true,
    proxy: {
      // Keeps the browser on one origin, so the refresh cookie just works.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
