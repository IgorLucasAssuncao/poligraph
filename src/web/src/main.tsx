import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppComponent from './App.tsx';
import { clienteDeConsultas } from './nucleo/consultas';
import { aplicarTema, temaGuardado } from './nucleo/tema';

/**
 * RISCO: ANTES do primeiro render, nunca dentro de um efeito.
 * Aplicado no componente, o tema só é carimbado depois que o React pinta — e quem
 * escolheu escuro vê a página branca por um quadro. O clarão é curto e é exatamente o
 * tipo de detalhe que faz uma interface parecer improvisada.
 */
aplicarTema(temaGuardado());

/**
 * DECISÃO: O service worker guarda no navegador as fotos dos parlamentares, que a Câmara manda
 * buscar de novo a cada visita (`no-cache`), e mostra os avisos sobre quem a pessoa segue
 * (Pendência 89). Depois do `load`: registrar antes disputaria a banda com a própria página. Sem
 * suporte, as fotos seguem vindo da casa, como antes, e os avisos não aparecem.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <AppComponent />
    </QueryClientProvider>
  </StrictMode>,
);
