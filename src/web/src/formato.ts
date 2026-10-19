import { NOMES_DAS_CATEGORIAS_DA_COTA } from './textos/categoriasDaCota';
/**
 * Formatos de número e data usados em mais de uma tela.
 *
 * ATENÇÃO: `bilhoes` arredonda para uma casa: serve para comparar ordem de grandeza numa
 * tabela, não para citar valor exato — onde o valor exato importa, use `reais`.
 */
export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * `185_512_000_000` → `"R$ 185,5 bi"`; trilhão com duas casas; milhar como `"R$ 55 mil"`; abaixo de mil,
 * o valor inteiro.
 *
 * DECISÃO (2026-10-03): O milhar entrou porque a mesma coluna mostrava "R$ 144,4 mi" e
 * "R$ 55.038,11": a escala mudava no meio da tabela.
 */
export function reaisCompacto(valor: number): string {
  const absoluto = Math.abs(valor);
  const casa = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const escala = absoluto >= 999_950_000_000 ? 1e12 : absoluto >= 999_950_000 ? 1e9 : absoluto >= 999_950 ? 1e6 : absoluto >= 1e3 ? 1e3 : 1;
  if (escala === 1e12) {
    return `R$ ${(valor / 1e12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tri`;
  }
  if (escala === 1e9) return `R$ ${casa(valor / 1e9)} bi`;
  if (escala === 1e6) return `R$ ${casa(valor / 1e6)} mi`;
  if (escala === 1e3) return `R$ ${casa(valor / 1e3)} mil`;
  return reais(valor);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** `"2025-03-01"` → `"mar/2025"`. Lê o texto, não `Date`: o fuso deslocaria o dia 1 para o mês anterior. */
export function mesCurto(iso: string): string {
  const [ano, mes] = iso.split('-');
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

/** `"2025-01-16"` → `"16/01/2025"`, pelo mesmo motivo de `mesCurto`. */
export function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Preenche com zero os meses sem pagamento: pular o mês esconderia a espera. */
export function mesesContinuos<T extends { mes: string; valor: number }>(
  meses: T[],
): { mes: string; valor: number }[] {
  const valores = new Map(meses.map((m) => [m.mes, m.valor]));
  const [anoInicial, mesInicial] = meses[0].mes.split('-').map(Number);
  const [anoFinal, mesFinal] = meses[meses.length - 1].mes.split('-').map(Number);

  const serie: { mes: string; valor: number }[] = [];
  for (let a = anoInicial, m = mesInicial; a < anoFinal || (a === anoFinal && m <= mesFinal); ) {
    const mes = `${a}-${String(m).padStart(2, '0')}-01`;
    serie.push({ mes, valor: valores.get(mes) ?? 0 });
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }

  return serie;
}

const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** `"LUIZ INÁCIO LULA DA SILVA"` → `"Luiz Inácio Lula da Silva"`. O TSE publica em caixa alta. */
export function nomeProprio(texto: string): string {
  return texto
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((palavra, i) =>
      i > 0 && PARTICULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1),
    )
    .join(' ');
}

/**
 * Reparte 100 entre os valores, em inteiros que somam exatamente 100.
 *
 * DECISÃO: Pelo maior resto: arredondar cada parte sozinha dá 99 ou 101, e a tela diria "de
 * cada R$ 100" com uma conta que não fecha.
 */
export function partesDeCem(valores: number[]): number[] {
  const total = valores.reduce((soma, v) => soma + Math.max(v, 0), 0);
  if (total <= 0) return valores.map(() => 0);

  const exatas = valores.map((v) => (Math.max(v, 0) / total) * 100);
  const partes = exatas.map(Math.floor);
  const faltam = 100 - partes.reduce((soma, p) => soma + p, 0);

  exatas
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .sort((a, b) => b.resto - a.resto)
    .slice(0, faltam)
    .forEach(({ i }) => (partes[i] += 1));

  return partes;
}

/** `"PASSAGEM AÉREA"` → `"Passagem aérea"`. ATENÇÃO: Os arquivos oficiais vêm em CAIXA ALTA, ilegível em bloco. */
/** O texto sem os pontos do fim, num laço e não numa expressão regular: `/\.+$/` volta atrás em texto com muitos pontos no meio. */
export function semPontosNoFim(texto: string): string {
  let fim = texto.length;
  while (fim > 0 && texto[fim - 1] === '.') fim--;
  return texto.slice(0, fim);
}

export function minusculas(texto: string): string {
  const min = texto.toLocaleLowerCase('pt-BR');
  return min.charAt(0).toLocaleUpperCase('pt-BR') + min.slice(1);
}

/**
 * O nome que a tela mostra para uma categoria da cota (`textos/categoriasDaCota`). Categoria que
 * ainda não está lá sai do nome oficial arrumado: minúsculas, sem ponto no fim, vírgula e espaço.
 */
export function nomeDaCategoriaDaCota(oficial: string): string {
  const limpo = semPontosNoFim(oficial.trim()).trim();
  return NOMES_DAS_CATEGORIAS_DA_COTA[limpo.toLocaleUpperCase('pt-BR')] ?? minusculas(limpo).replace(/ *, */g, ', ');
}

/** Para o meio da frase: só a primeira letra vira minúscula, e "Brasília" continua com maiúscula. */
export function noMeioDaFrase(texto: string): string {
  return texto.charAt(0).toLocaleLowerCase('pt-BR') + texto.slice(1);
}

/**
 * `56` → `"2019–2023"`. A 57ª tomou posse em 2023, e cada legislatura dura quatro anos.
 *
 * DECISÃO: É o que o cidadão reconhece: "56ª legislatura" Não diz nada a quem não acompanha o
 * Congresso, e o ano diz. O número ordinal vai junto só onde ajuda a conferir.
 */
export function periodoDaLegislatura(legislatura: number): string {
  const posse = 2023 + (legislatura - 57) * 4;
  return `${posse}–${posse + 4}`;
}

/**
 * `2025` → `"2023–2026"`: os anos de cota do mandato que apresentou a emenda daquele ano.
 *
 * A emenda de um ano é votada no ano anterior (achado #24), então a de 2023 é do mandato
 * que tomou posse em 2019. Mesma conta de `Legislaturas.DoAnoDeEmenda` na API.
 */
export function anosDeCotaDaEmenda(anoDaEmenda: number): string {
  const posse = 2023 + Math.floor((anoDaEmenda - 2024) / 4) * 4;
  return `${posse}–${posse + 3}`;
}
