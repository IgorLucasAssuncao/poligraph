/** Uma caixa já desenhada pelo d3-sankey, com o que o rótulo precisa: onde ela está, a coluna e o texto. */
export type CaixaComRotulo = { id: string; coluna: number; x0: number; x1: number; y0: number; y1: number; nome: string; valor: string };

/** De que lado da caixa o rótulo fica, e se o valor vai junto. */
export type LugarDoRotulo = { lado: 'direita' | 'esquerda'; comValor: boolean };

type Retangulo = { x0: number; x1: number; y0: number; y1: number };

const AFASTAMENTO = 6;
const MEIA_ALTURA = 9;

/**
 * O lado de cada rótulo, sem um cair em cima do outro.
 *
 * A primeira coluna escreve à direita da caixa e a última à esquerda, sempre. Uma coluna do meio escreve à direita; se ali o
 * rótulo bate num da coluna seguinte, passa para a esquerda, e se lá bate num da anterior, fica à direita só com o nome.
 *
 * MEDIDO (2026-10-23): em Recife, "Educação R$ 130,9 mi" caía sobre "Entidades sem fins lucrativos R$ 231 mi", e no Rio
 * "Outras 19 áreas" sobre "Governos estaduais".
 *
 * `largura` mede o texto na tela; o teste passa uma conta fixa.
 */
export function lugaresDosRotulos(
  caixas: CaixaComRotulo[],
  largura: (nome: string, valor: string | null) => number,
): Map<string, LugarDoRotulo> {
  const ultima = Math.max(...caixas.map((c) => c.coluna));
  const lugares = new Map<string, LugarDoRotulo>();
  const ocupados: Retangulo[] = [];
  const retangulo = (c: CaixaComRotulo, lugar: LugarDoRotulo): Retangulo => {
    const w = largura(c.nome, lugar.comValor ? c.valor : null);
    const meio = (c.y0 + c.y1) / 2;
    return lugar.lado === 'direita'
      ? { x0: c.x1 + AFASTAMENTO, x1: c.x1 + AFASTAMENTO + w, y0: meio - MEIA_ALTURA, y1: meio + MEIA_ALTURA }
      : { x0: c.x0 - AFASTAMENTO - w, x1: c.x0 - AFASTAMENTO, y0: meio - MEIA_ALTURA, y1: meio + MEIA_ALTURA };
  };
  const livre = (r: Retangulo) => !ocupados.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
  const fixar = (c: CaixaComRotulo, lugar: LugarDoRotulo) => {
    lugares.set(c.id, lugar);
    ocupados.push(retangulo(c, lugar));
  };

  for (const c of caixas.filter((c) => c.coluna === 0)) fixar(c, { lado: 'direita', comValor: true });
  for (const c of caixas.filter((c) => c.coluna === ultima && ultima > 0)) fixar(c, { lado: 'esquerda', comValor: true });

  for (const c of caixas.filter((c) => c.coluna > 0 && c.coluna < ultima)) {
    const tentativas: LugarDoRotulo[] = [
      { lado: 'direita', comValor: true },
      { lado: 'esquerda', comValor: true },
      { lado: 'direita', comValor: false },
    ];
    fixar(c, tentativas.find((t) => livre(retangulo(c, t))) ?? tentativas[2]);
  }

  return lugares;
}

/** Mede o nome e o valor com as fontes dos rótulos (o valor é monoespaçado); sem canvas, nos testes, conta 7 px por letra. */
export function medidorDeRotulo(): (nome: string, valor: string | null) => number {
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!ctx) return (nome, valor) => (valor ? `${nome} ${valor}` : nome).length * 7;
  const estilo = getComputedStyle(document.documentElement);
  const corpo = estilo.getPropertyValue('--corpo') || 'sans-serif';
  const dado = estilo.getPropertyValue('--dado') || 'monospace';
  return (nome, valor) => {
    ctx.font = `600 13px ${corpo}`;
    const doNome = ctx.measureText(valor ? `${nome} ` : nome).width;
    if (!valor) return doNome;
    ctx.font = `400 13px ${dado}`;
    return doNome + ctx.measureText(valor).width;
  };
}

/** Um pedaço de uma faixa no desenho vertical: onde começa e acaba na horizontal, e o texto. */
export type PedacoComRotulo = { id: string; inicio: number; fim: number; nome: string; valor: string };

/**
 * As linhas de rótulo embaixo de uma faixa, no desenho vertical do celular: cada nome centrado no seu pedaço, e o que não cabe
 * ao lado de outro desce uma linha. Nenhum some, porque três dos quatro gráficos de fitas não têm tabela.
 *
 * Os maiores escolhem primeiro e ficam na primeira linha, colados ao pedaço.
 */
export function linhasDosRotulos(
  pedacos: PedacoComRotulo[],
  largura: (nome: string, valor: string | null) => number,
  larguraTotal: number,
): { lugares: Map<string, { linha: number; x: number }>; linhas: number } {
  const FOLGA = 8;
  const ocupadas: { x0: number; x1: number }[][] = [];
  const lugares = new Map<string, { linha: number; x: number }>();

  for (const p of [...pedacos].sort((a, b) => b.fim - b.inicio - (a.fim - a.inicio))) {
    const w = largura(p.nome, p.valor);
    const x0 = Math.max(2, Math.min((p.inicio + p.fim) / 2 - w / 2, larguraTotal - 2 - w));
    const intervalo = { x0, x1: x0 + w };
    let linha = ocupadas.findIndex((l) => l.every((o) => intervalo.x1 + FOLGA <= o.x0 || intervalo.x0 >= o.x1 + FOLGA));
    if (linha === -1) {
      linha = ocupadas.length;
      ocupadas.push([]);
    }
    ocupadas[linha].push(intervalo);
    lugares.set(p.id, { linha, x: x0 });
  }

  return { lugares, linhas: ocupadas.length };
}
