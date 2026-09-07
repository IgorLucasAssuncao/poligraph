import type { NoDoGrafo } from '../../api';

/**
 * Como rotular os eixos desenhados sobre a figura.
 *
 * 🔴 **Derivado do dado, ⛔ nunca escrito à mão.** O sinal do eixo é arbitrário: a
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
  /** ⚠️ O que a vertical mede — quase sempre, nada. */
  vertical: string;
};

export function rotulosDoEixo(
  nos: NoDoGrafo[],
  layout: 'molas' | 'componentes' | 'alinhamento',
): RotulosDoEixo | null {
  // ⭐ No layout de alinhamento a coordenada É a medida, e o sentido foi definido por
  //    nós: menos governismo à esquerda. ⛔ Não há o que derivar, e derivar aqui seria
  //    perguntar ao dado uma coisa que já sabemos.
  if (layout === 'alinhamento') {
    return {
      esquerda: 'quase nunca votou com o Governo',
      direita: 'quase sempre votou com o Governo',
      legenda: 'a posição horizontal é a própria medida, não resultado de algoritmo',
      vertical: 'a vertical não mede nada: é só espaço para os pontos não se sobreporem',
    };
  }

  const comAlinhamento = nos.filter(
    (n) => n.eixoX !== null && n.governismo !== null,
  );

  // ⛔ Senado: sem orientação de bancada publicada, o eixo ⛔ não tem nome. Desenhar a
  //    linha com rótulo inventado seria pior que ⛔ não desenhar.
  if (comAlinhamento.length < 20) return null;

  const mediaDe = (filtro: (x: number) => boolean) => {
    const grupo = comAlinhamento.filter((n) => filtro(n.eixoX!));
    return grupo.length
      ? grupo.reduce((s, n) => s + n.governismo!, 0) / grupo.length
      : 0;
  };

  const negativoEhGovernista = mediaDe((x) => x < 0) >= mediaDe((x) => x > 0);

  const maisGoverno = 'vota MAIS com o Governo';
  const menosGoverno = 'vota MENOS com o Governo';

  return {
    esquerda: negativoEhGovernista ? maisGoverno : menosGoverno,
    direita: negativoEhGovernista ? menosGoverno : maisGoverno,
    legenda: 'quanto o parlamentar votou como a bancada do Governo orientou',
    vertical:
      layout === 'molas'
        ? 'a vertical não mede nada: é só espaço para os pontos não se sobreporem'
        : 'a vertical é a segunda maior diferença, e explica bem menos que a horizontal',
  };
}
