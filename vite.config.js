import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  base: '/',
  server: {
    // Dev-only reverse proxy: the browser makes same-origin requests and the
    // dev server forwards them to AWS, so API Gateway CORS never comes into play.
    proxy: {
      // Authenticated REST API (save / groups / cook / share / plan / import)
      '/awsapi': {
        target: 'https://e2h43o5aje.execute-api.us-east-2.amazonaws.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/awsapi/, ''),
      },
      // Public HTTP API (nutrition / kroger)
      '/pubapi': {
        target: 'https://dmtezcygeb.execute-api.us-east-2.amazonaws.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/pubapi/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        callback: resolve(__dirname, 'callback.html'),
      },
    },
  },
});
