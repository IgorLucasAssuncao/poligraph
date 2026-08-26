import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ⚠️ O Aspire injeta VITE_API_URL com o endereço real da API, que muda a cada subida.
//    O fallback é para quem roda `npm run dev` sozinho, sem o AppHost.
const API = process.env.VITE_API_URL ?? 'http://localhost:5010';

export default defineConfig({
  plugins: [react()],
  server: {
    // ⭐ mesma origem em dev: sem CORS, e o cookie SameSite=Lax funciona
    port: Number(process.env.PORT) || 5173,
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
});
