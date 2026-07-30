import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: false,
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
