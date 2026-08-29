import type { NoDoGrafo } from '../../api';

/**
 * O que a figura mostra, lido do próprio dado.
 *
 * ## 🔴 Por que isto é calculado e ⛔ não escrito à mão
 *
 * O sinal do eixo horizontal é **arbitrário**. A semente do layout é fixa, então a
 * figura é reproduzível — mas uma reexecução com dado novo pode espelhá-la. Uma legenda
 * que afirmasse *"à esquerda ficam os governistas"* ficaria errada em silêncio no dia em
 * que isso acontecesse, e silêncio é exatamente o modo de falha que este projeto
 * persegue.
 *
 * Aqui a legenda olha onde os governistas efetivamente caíram e descreve o que vê.
 *
 * ## ⚠️ Os cortes
 *
 * `0,2` separa o miolo das laterais e `0,6` separa as laterais das bordas. ⛔ Não são
 * arbitrários: com eles as faixas ficam com 357, 127, 149 e 10 nós — um miolo denso,
 * dois lados com massa comparável, e uma borda que é só quem não tem ligação.
 */

const CORTE_CENTRO = 0.2;
const CORTE_BORDA = 0.6;

export type FaixaDaLegenda = {
  chave: 'lado-a' | 'centro' | 'lado-b' | 'bordas';
  /** Descrição da posição na tela, ⛔ nunca "esquerda política". */
  onde: string;
  quantos: number;
  /** Governismo médio, de 0 a 1. Nulo quando a casa não tem orientação. */
  governismo: number | null;
  /** Mediana de votações — é o que denuncia a borda. */
  votacoes: number;
};

export type Legenda = {
  faixas: FaixaDaLegenda[];
  /** ⛔ Falso no Senado: sem orientação de bancada, o eixo continua sem nome. */
  temAlinhamento: boolean;
};

/**
 * Como rotular os eixos desenhados sobre a figura.
 *
 * 🔴 Derivado, pelo mesmo motivo da legenda: o sinal do eixo é arbitrário. Rótulo
 * escrito à mão passa a mentir no dia em que uma reexecução espelhar o desenho — e
 * mentiria em cima do próprio desenho, que é o pior lugar possível.
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
  layout: 'molas' | 'componentes',
): RotulosDoEixo | null {
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
    legenda: 'quanto o parlamentar votou como o Governo pediu — medido, não programado',
    vertical:
      layout === 'molas'
        ? 'a vertical não mede nada: é só espaço para os pontos não se sobreporem'
        : 'a vertical é a segunda maior diferença, e explica bem menos que a horizontal',
  };
}

export function montarLegenda(nos: NoDoGrafo[]): Legenda | null {
  const posicionados = nos.filter((n) => n.eixoX !== null);
  if (posicionados.length < 20) return null;

  const dentro = (min: number, max: number) =>
    posicionados.filter((n) => {
      const x = n.eixoX!;
      return x >= min && x < max;
    });

  const ladoNegativo = dentro(-CORTE_BORDA, -CORTE_CENTRO);
  const centro = dentro(-CORTE_CENTRO, CORTE_CENTRO);
  const ladoPositivo = dentro(CORTE_CENTRO, CORTE_BORDA);
  const bordas = posicionados.filter((n) => Math.abs(n.eixoX!) >= CORTE_BORDA);

  const temAlinhamento = posicionados.some((n) => n.governismo !== null);

  // ⭐ Quem descreve o lado é o DADO: o de maior governismo médio vira "lado A".
  const [primeiro, segundo] =
    media(ladoNegativo) >= media(ladoPositivo)
      ? [ladoNegativo, ladoPositivo]
      : [ladoPositivo, ladoNegativo];

  const ondeFica = (grupo: NoDoGrafo[]) =>
    grupo.length === 0 ? '' : media0(grupo) < 0 ? 'à esquerda' : 'à direita';

  return {
    temAlinhamento,
    faixas: [
      faixa('lado-a', `Do lado ${ondeFica(primeiro)}`, primeiro),
      faixa('centro', 'No meio', centro),
      faixa('lado-b', `Do lado ${ondeFica(segundo)}`, segundo),
      faixa('bordas', 'Nas pontas', bordas),
    ].filter((f) => f.quantos > 0),
  };
}

// ═══════════════════════════════════════════════════════════════════

function faixa(
  chave: FaixaDaLegenda['chave'],
  onde: string,
  grupo: NoDoGrafo[],
): FaixaDaLegenda {
  return {
    chave,
    onde,
    quantos: grupo.length,
    governismo: grupo.some((n) => n.governismo !== null) ? media(grupo) : null,
    votacoes: mediana(grupo.map((n) => n.nVotacoes)),
  };
}

/** ⚠️ Média só de quem TEM o valor: incluir nulo como zero afundaria a faixa. */
function media(grupo: NoDoGrafo[]): number {
  const valores = grupo
    .map((n) => n.governismo)
    .filter((g): g is number => g !== null);

  return valores.length
    ? valores.reduce((soma, v) => soma + v, 0) / valores.length
    : 0;
}

function media0(grupo: NoDoGrafo[]): number {
  return grupo.length
    ? grupo.reduce((soma, n) => soma + n.eixoX!, 0) / grupo.length
    : 0;
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);

  return ordenados[Math.floor(ordenados.length / 2)];
}
