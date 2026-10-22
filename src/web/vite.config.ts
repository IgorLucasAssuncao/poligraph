import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ATENÇÃO: O Aspire injeta VITE_API_URL com o endereço real da API, que muda a cada subida.
 * O fallback é para quem roda `npm run dev` sozinho, sem o AppHost.
 */
const API = process.env.VITE_API_URL ?? 'http://localhost:5010';

/**
 * DECISÃO: o proxy dá a mesma origem em dev — sem CORS, e o cookie SameSite=Lax funciona.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '^/p/[0-9]+$': { target: API, changeOrigin: false, rewrite: (caminho) => caminho.replace(/^\/p\//, '/api/compartilhar/') },
      '^/c/[0-9]{7}$': { target: API, changeOrigin: false, rewrite: (caminho) => caminho.replace(/^\/c\//, '/api/compartilhar/cidade/') },
      '^/e/[0-9]{14}$': { target: API, changeOrigin: false, rewrite: (caminho) => caminho.replace(/^\/e\//, '/api/compartilhar/entidade/') },
    },
  },
});
