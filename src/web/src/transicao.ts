import { flushSync } from 'react-dom';

/**
 * Envolve uma mudança de estado numa View Transition.
 *
 * A View Transition API tira um retrato do DOM antes e depois da mudança e anima entre
 * os dois. É o que permite a pergunta que sai deslizar enquanto a que entra chega —
 * sem manter os dois cartões montados ao mesmo tempo.
 *
 * ATENÇÃO: `flushSync` é obrigatório: o React agenda o `setState` para depois, e sem forçar a
 * renderização ali dentro o navegador tira o segundo retrato antes de a tela mudar —
 * os dois retratos ficam iguais e não há animação nenhuma.
 *
 * DECISÃO: Degrada em silêncio. Sem suporte no navegador (Safari < 18) e no jsdom dos testes,
 * `startViewTransition` não existe e a mudança acontece direto, sem animação. É por
 * isso que os testes continuam determinísticos.
 *
 * Suporte: Chrome/Edge 111+, Firefox 133+, Safari 18+ — Baseline desde out/2025.
 */
export function comTransicao(mudar: () => void): void {
    if (!document.startViewTransition || preferemMenosMovimento()) {
        mudar();
        return;
    }

    document.startViewTransition(() => flushSync(mudar));
}

/**
 * RISCO: Respeitado no JS, não só no CSS.
 *
 * Zerar a animação no CSS ainda deixaria a View Transition rodar e bloquear a interação
 * durante o retrato. Quem pediu menos movimento não deve pagar essa latência.
 */
function preferemMenosMovimento(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
