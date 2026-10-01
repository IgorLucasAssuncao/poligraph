/**
 * A navegação do site, organizada pelas três intenções de quem usa — ⛔ pelas fontes de dado.
 *
 * | Intenção | Destino |
 * |---|---|
 * | "Quem é e como vota fulano?" | Parlamentares |
 * | "Com quem eu concordo?" | Compare seu voto |
 * | "Para onde vai o dinheiro?" | Dinheiro público — as três abas abaixo |
 *
 * ⭐ Antes eram cinco destinos e seis controles de conta na mesma barra; "Entidades" seria o
 * décimo segundo elemento. Uma pergunta, uma porta — as abas dividem a pergunta por dentro.
 */
export const ABAS_DO_DINHEIRO = [
  { para: '/emendas', rotulo: 'Sua cidade' },
  { para: '/entidades', rotulo: 'Entidades' },
  { para: '/governo', rotulo: 'Governo federal' },
] as const;

/** Se o endereço é de uma das abas de Dinheiro público — para o item da barra acender. */
export function ehDinheiroPublico(caminho: string): boolean {
  return ABAS_DO_DINHEIRO.some((aba) => caminho === aba.para || caminho.startsWith(`${aba.para}/`));
}
