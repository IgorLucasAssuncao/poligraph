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

export function montarLegenda(
  nos: NoDoGrafo[],
  arestas: ArestaDoGrafo[],
): Legenda | null {
  const posicionados = nos.filter((n) => n.eixoX !== null);
  if (posicionados.length < 20) return null;

  // 🔴 O grupo das pontas é definido por NÃO TER LIGAÇÃO, ⛔ não por estar longe do
  //    centro. É o que o achado #27 mediu: os 10 mais afastados têm todos zero
  //    arestas, e a posição extrema deles é consequência disso, ⛔ não causa. Separar
  //    por distância acertaria hoje e erraria no dia em que um nó conectado chegasse
  //    à borda — e erraria dizendo que ele "votou pouco", o que seria falso.
  const ligados = new Set<number>();
  for (const a of arestas) {
    ligados.add(a.de);
    ligados.add(a.para);
  }

  const isolados = posicionados.filter((n) => !ligados.has(n.id));
  const comLigacao = posicionados.filter((n) => ligados.has(n.id));

  // ⚠️ Sem limite externo: com os isolados fora, um nó conectado distante do centro
  //    continua sendo daquele lado. Um teto de 0,6 o deixaria em faixa nenhuma, e ele
  //    sumiria da soma sem nada avisar.
  const ladoNegativo = comLigacao.filter((n) => n.eixoX! < -CORTE_CENTRO);
  const centro = comLigacao.filter((n) => Math.abs(n.eixoX!) <= CORTE_CENTRO);
  const ladoPositivo = comLigacao.filter((n) => n.eixoX! > CORTE_CENTRO);
  const bordas = isolados;

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
      faixa('bordas', 'Sem nenhuma ligação', bordas),
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
