import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // ⭐ mesma origem em dev: sem CORS, e o cookie SameSite=Lax funciona
    proxy: { '/api': 'http://localhost:5000' },
  },
});
