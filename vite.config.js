import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/departures-app/',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
