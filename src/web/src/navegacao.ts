import { TEXTOS_DO_SITE } from './textos/site';
/**
 * A navegação do site, organizada pelas três intenções de quem usa — não pelas fontes de dado.
 *
 * | Intenção | Destino |
 * |---|---|
 * | "Quem é e como vota fulano?" | Parlamentares |
 * | "Com quem eu concordo?" | Compare seu voto |
 * | "Para onde vai o dinheiro?" | Dinheiro público — as três abas abaixo |
 *
 * DECISÃO: Antes eram cinco destinos e seis controles de conta na mesma barra; "Entidades" seria o
 * décimo segundo elemento. Uma pergunta, uma porta — as abas dividem a pergunta por dentro.
 */
export const ABAS_DO_DINHEIRO = [
  { para: '/emendas', rotulo: TEXTOS_DO_SITE.abasDoDinheiro.emendas },
  { para: '/entidades', rotulo: TEXTOS_DO_SITE.abasDoDinheiro.entidades },
  { para: '/governo', rotulo: TEXTOS_DO_SITE.abasDoDinheiro.governo },
] as const;

/**
 * As abas dentro de Governo federal: o orçamento inteiro primeiro, depois cada gasto específico na
 * sua página (decisão do autor, 2026-10-09). `fim` faz a aba do orçamento acender só em `/governo`.
 */
export const ABAS_DO_GOVERNO = [
  { para: '/governo', rotulo: TEXTOS_DO_SITE.abasDoGoverno.orcamento, fim: true },
  { para: '/governo/cartoes', rotulo: TEXTOS_DO_SITE.abasDoGoverno.cartoes, fim: false },
  { para: '/governo/viagens', rotulo: TEXTOS_DO_SITE.abasDoGoverno.viagens, fim: false },
  { para: '/governo/compras', rotulo: TEXTOS_DO_SITE.abasDoGoverno.compras, fim: false },
] as const;

/** Se o endereço é de uma das abas de Dinheiro público — para o item da barra acender. */
export function ehDinheiroPublico(caminho: string): boolean {
  return ABAS_DO_DINHEIRO.some((aba) => caminho === aba.para || caminho.startsWith(`${aba.para}/`));
}
