import type { NoDoGrafo } from '../../../nucleo/api';
import { TEXTOS_DOS_COMPONENTES as T } from '../../../comum/textos/componentes';

/**
 * Como rotular os eixos desenhados sobre a figura.
 *
 * RISCO: **Derivado do dado, nunca escrito à mão.** O sinal do eixo é arbitrário: a
 * semente do layout é fixa, então a figura é reproduzível — mas uma reexecução com dado
 * novo pode espelhá-la. Um rótulo fixo dizendo *"à esquerda ficam os governistas"*
 * passaria a mentir em cima do próprio desenho, que é o pior lugar possível.
 */
export type RotulosDoEixo = {
  /** O que fica na ponta esquerda da tela. */
  esquerda: string;
  /** O que fica na ponta direita. */
  direita: string;
  /** A frase que explica o eixo horizontal, embaixo dele. */
  legenda: string;
  /** ATENÇÃO: O que a vertical mede — quase sempre, nada. */
  vertical: string;
};

export function rotulosDoEixo(
  nos: NoDoGrafo[],
  layout: 'molas' | 'componentes' | 'alinhamento',
): RotulosDoEixo | null {
  if (layout === 'alinhamento') {
    return {
      esquerda: T.eixos.alinhamento.esquerda,
      direita: T.eixos.alinhamento.direita,
      legenda: T.eixos.alinhamento.legenda,
      vertical: T.eixos.verticalSemMedida,
    };
  }

  const comAlinhamento = nos.filter(
    (n) => n.eixoX !== null && n.governismo !== null,
  );

  if (comAlinhamento.length < 20) return null;

  const mediaDe = (filtro: (x: number) => boolean) => {
    const grupo = comAlinhamento.filter((n) => filtro(n.eixoX!));
    return grupo.length
      ? grupo.reduce((s, n) => s + n.governismo!, 0) / grupo.length
      : 0;
  };

  const negativoEhGovernista = mediaDe((x) => x < 0) >= mediaDe((x) => x > 0);

  const maisGoverno = T.eixos.maisGoverno;
  const menosGoverno = T.eixos.menosGoverno;

  return {
    esquerda: negativoEhGovernista ? maisGoverno : menosGoverno,
    direita: negativoEhGovernista ? menosGoverno : maisGoverno,
    legenda: T.eixos.legenda,
    vertical: layout === 'molas' ? T.eixos.verticalSemMedida : T.eixos.verticalSegunda,
  };
}
