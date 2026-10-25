import { afterEach, describe, expect, it, vi } from 'vitest';
import { comTransicao } from '../../src/nucleo/transicao';

/**
 * ATENÇÃO: `lib.dom` já declara `startViewTransition` como sempre presente, mas o jsdom não
 * implementa. Este acesso frouxo é o que permite simular os dois mundos — o navegador
 * que tem a API e o que não tem — sem brigar com o tipo.
 */
const doc = document as unknown as Record<string, unknown>;

afterEach(() => {
  delete doc.startViewTransition;
  vi.unstubAllGlobals();
});

/** ATENÇÃO: jsdom não implementa `matchMedia` — sem isto, toda chamada estoura. */
function preferencia(reduzido: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduzido })),
  );
}

/**
 * RISCO: O ponto todo: sem a API (Safari < 18, jsdom), a mudança NÃO pode ser perdida.
 * Uma transição que não anima é aceitável; um clique que não faz nada, não.
 *
 * ATENÇÃO: Zerar a animação só no CSS deixaria a View Transition rodar assim mesmo e
 * bloquear a interação durante o retrato do DOM. Quem pediu menos movimento
 * não deve pagar essa latência.
 */
describe('comTransicao', () => {
  it('aplica a mudança mesmo sem suporte do navegador', () => {
    preferencia(false);
    const mudar = vi.fn();

    comTransicao(mudar);

    expect(mudar).toHaveBeenCalledOnce();
  });

  it('envolve a mudança na View Transition quando há suporte', () => {
    preferencia(false);
    const mudar = vi.fn();
    const iniciar = vi.fn((callback: () => void) => {
      callback();
      return {};
    });
    doc.startViewTransition = iniciar;

    comTransicao(mudar);

    expect(iniciar).toHaveBeenCalledOnce();
    expect(mudar).toHaveBeenCalledOnce();
  });

  it('RISCO: não inicia transição para quem pediu menos movimento', () => {
    preferencia(true);
    const mudar = vi.fn();
    const iniciar = vi.fn();
    doc.startViewTransition = iniciar;

    comTransicao(mudar);

    expect(iniciar).not.toHaveBeenCalled();
    expect(mudar).toHaveBeenCalledOnce();
  });
});
