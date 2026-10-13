import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // The web app calls the API on its own origin (`/api/v1`, FU7); in
    // development the API runs on its default port (apps/api PORT).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
