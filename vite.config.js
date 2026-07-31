import { defineConfig } from 'vite';
import { cmwLog } from './vite-plugin-cmw-log.js';

export default defineConfig({
  root: '.',
  publicDir: false,
  plugins: [cmwLog()],
  server: {
    host: '127.0.0.1',
    port: 18765,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 18765,
    strictPort: true,
  },
});
