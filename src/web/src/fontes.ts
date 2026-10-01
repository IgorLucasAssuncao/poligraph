/**
 * Os conjuntos de dados oficiais de onde a base sai — para a tela dizer "fonte" com link.
 *
 * ⭐ Cada endereço foi aberto e conferido em 2026-09-25. Os links de ITEM (um voto, uma
 * emenda, uma nota fiscal) vêm da API, que os monta em `FontesOficiais`; aqui ficam só os
 * de conjunto, que ⛔ dependem de identificador.
 */
export const FONTES = {
  camara: {
    nome: 'Dados abertos da Câmara dos Deputados',
    url: 'https://dadosabertos.camara.leg.br/swagger/api.html',
  },
  senado: {
    nome: 'Dados abertos do Senado Federal',
    url: 'https://www12.senado.leg.br/dados-abertos',
  },
  emendas: {
    nome: 'Portal da Transparência — emendas parlamentares',
    url: 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares',
  },
  orcamento: {
    nome: 'Portal da Transparência — orçamento da despesa',
    url: 'https://portaldatransparencia.gov.br/download-de-dados/orcamento-despesa',
  },
  execucao: {
    nome: 'Portal da Transparência — execução da despesa, mês a mês',
    url: 'https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao',
  },
  receitas: {
    nome: 'Portal da Transparência — receitas',
    url: 'https://portaldatransparencia.gov.br/download-de-dados/receitas',
  },
  prestacaoDeContas: {
    nome: 'TSE — prestação de contas eleitorais de 2022',
    url: 'https://dadosabertos.tse.jus.br/dataset/dadosabertos-tse-jus-br-dataset-prestacao-de-contas-eleitorais-2022',
  },
  candidatos: {
    nome: 'TSE — candidatos de 2022',
    url: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2022',
  },
  cartao: {
    nome: 'Portal da Transparência — cartão de pagamento do governo federal',
    url: 'https://portaldatransparencia.gov.br/download-de-dados/cpgf',
  },
  cnpj: {
    nome: 'Receita Federal — cadastro nacional da pessoa jurídica',
    url: 'https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj',
  },
  malhas: {
    nome: 'IBGE — malhas territoriais',
    url: 'https://servicodados.ibge.gov.br/api/docs/malhas?versao=3',
  },
} as const;

export type Fonte = keyof typeof FONTES;
