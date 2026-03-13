import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main:   resolve(__dirname, 'index.html'),
        login:  resolve(__dirname, 'login.html'),
      },
    },
  },
});
