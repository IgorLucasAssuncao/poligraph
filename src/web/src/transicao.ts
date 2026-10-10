import { useEffect, useRef, type RefObject } from 'react';
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

/** Quanto dura a entrada de uma tela: o `--t-medio` do CSS. */
const DURACAO_DA_ENTRADA = 260;

/** A curva `--curva-entrada` do CSS: algo que chega acelera rápido e freia longo. */
const CURVA_DA_ENTRADA = 'cubic-bezier(.05, .7, .1, 1)';

/**
 * Anima a chegada do conteúdo a cada troca de endereço: sobe 8 px e aparece em 260 ms.
 *
 * DECISÃO (2026-10-10): o site usa `BrowserRouter`, o modo declarativo do React Router 7, e nele o
 * `viewTransition` do link não tem efeito; a troca de tela era instantânea. A animação vai no
 * miolo da página, com a Web Animations API, sem desmontar nada: cabeçalho, faixa e rodapé ficam
 * parados. A primeira tela, a da carga, não anima.
 *
 * ATENÇÃO: quem pediu menos movimento vê só a fusão, sem deslocamento. É o caso de todo Windows
 * com "Efeitos de animação" desligado; a fusão começava em 60% e não se via.
 *
 * A `chave` pode ser qualquer coisa que mude quando o conteúdo muda: o endereço, ou o dado que
 * acabou de chegar.
 */
export function useEntradaAoNavegar(elemento: RefObject<HTMLElement | null>, chave: string): void {
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const alvo = elemento.current;
    if (!alvo?.animate) return;
    const quadros = preferemMenosMovimento()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }];
    alvo.animate(quadros, { duration: DURACAO_DA_ENTRADA, easing: CURVA_DA_ENTRADA });
  }, [elemento, chave]);
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
