import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// ⚠️ Separado do vite.config para o `tsc -b` do build não reclamar da chave `test`,
// que não existe no tipo de configuração do Vite.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      globals: true,
    },
  }),
);
