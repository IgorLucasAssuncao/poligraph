import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { aplicarTema, temaGuardado } from './tema';

// 🔴 ANTES do primeiro render, ⛔ nunca dentro de um efeito.
//
// Aplicado no componente, o tema só é carimbado depois que o React pinta — e quem
// escolheu escuro vê a página branca por um quadro. O clarão é curto e é exatamente o
// tipo de detalhe que faz uma interface parecer improvisada.
aplicarTema(temaGuardado());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
