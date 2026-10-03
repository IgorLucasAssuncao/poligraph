import type { ReactNode } from 'react';
import { TermoComponent } from '../componentes/Termo';

/** Plural simples: "1 emenda", "2 emendas". */
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto das três abas de dinheiro da ficha: campanha, emendas e cota. */
export const TEXTOS_DAS_CONTAS = {
  faixa: {
    noMandato: (periodo: string) => `No mandato de ${periodo}: o ano mais recente de cada um dentro dele.`,
    maisRecente: 'O valor mais recente de cada um. Os anos são diferentes.',
    rotulo: 'Contas do mandato',
    campanha: (ano?: number | null) => (ano ? `Campanha de ${ano}` : 'Campanha'),
    campanhaNota: 'arrecadado na eleição',
    emendas: (ano?: number | null) => (ano ? `Emendas de ${ano}` : 'Emendas'),
    emendasNota: 'empenhado no ano',
    cota: (ano?: number | null) => (ano ? `Cota de ${ano}` : 'Cota'),
    cotaNota: 'gasto no ano',
    seta: ' →',
    ausente: '—',
    semRegistro: 'sem registro na base',
  },

  carregando: {
    erro: 'Não foi possível carregar as contas agora.',
    rotulo: 'Carregando as contas',
  },

  emendas: {
    vazio: 'Nenhuma emenda atribuída a este parlamentar na base.',
    rotulo: 'Emendas',
    rotuloDaProcedencia: (ano: number) => `Emendas de ${ano}`,
    resposta: (pago: ReactNode, empenhado: string, quantidade: number, ano: number, porcento: string): ReactNode => (
      <>
        {pago} pagos de {empenhado} empenhados em <strong>{quantidade}</strong> {plural(quantidade, 'emenda', 'emendas')} de{' '}
        {ano}: {porcento}% saiu de fato
      </>
    ),
    verOGrafo: 'Ver o grafo do dinheiro',
    pagoNoAno: (ano: number, valor: string) => ` pago em ${ano}: ${valor}`,
    pagoDepois: (valor: string) => ` pago nos anos seguintes: ${valor}`,
    naoPago: (valor: string) => ` ainda não pago: ${valor}`,
    verDetalhes: 'Ver detalhes: áreas do orçamento, local declarado, mês a mês, convênios e emenda por emenda',
    emQue: (
      <>
        Em quê <TermoComponent nome="funcaoOrcamentaria">(área do orçamento)</TermoComponent>
      </>
    ),
    localDeclarado: 'Local declarado na emenda',
    localDeclaradoAjuda:
      'O que o autor escreveu ao apresentar a emenda. Em boa parte diz “vários lugares” ou o estado inteiro, e a ' +
      'cidade de verdade está em “Cidades que receberam”.',
    fonte: (
      <>
        <TermoComponent nome="emenda">Emendas parlamentares</TermoComponent> publicadas pelo Portal da Transparência. A
        diferença entre <TermoComponent nome="empenho">empenhado e pago</TermoComponent> é o que a barra acima mostra.
      </>
    ),
  },

  cidades: {
    titulo: 'Cidades que receberam',
    quantas: (quantidade: number, mostradas: number): ReactNode => (
      <>
        {quantidade} {plural(quantidade, 'cidade', 'cidades')}, pela{' '}
        <TermoComponent nome="sedeDoFavorecido">sede de quem recebeu</TermoComponent>
        {quantidade > mostradas && <>; aqui, as {mostradas} que mais receberam</>}.
      </>
    ),
    verAsMaiores: (quantas: number) => `Ver as ${quantas} que mais receberam`,
  },

  destino: {
    multiplo: <TermoComponent nome="multiplo">Vários lugares</TermoComponent>,
    multiploNota: ' · o Portal não detalha quais',
    nacional: <TermoComponent nome="nacional">Alcance nacional</TermoComponent>,
    nacionalNota: ' · sem destino territorial',
    estadoInteiro: ' · estado inteiro',
  },

  cota: {
    rotulo: 'Cota parlamentar',
    carregandoOAno: 'Carregando a cota do ano',
    vazio: (ano: number | null) =>
      `Nenhuma despesa de cota registrada ${ano ? `em ${ano}` : 'para este parlamentar na base'}.`,
    rotuloDaProcedencia: (ano: number) => `Cota parlamentar de ${ano}`,
    resposta: (total: ReactNode, ano: number, notas: number, maiorParte: string | null): ReactNode => (
      <>
        Gastou {total} da <TermoComponent nome="cota">cota parlamentar</TermoComponent> em {ano}, em <strong>{notas}</strong>{' '}
        notas
        {maiorParte && (
          <>
            . A maior parte em <strong>{maiorParte}</strong>
          </>
        )}
        .
      </>
    ),
    emQue: 'Em quê',
    rotuloDaCategoria: (ano: number, categoria: string) => `Cota de ${ano}: ${categoria}`,
    quemRecebeu: 'Quem recebeu',
    pessoaFisica: 'pessoa física',
    verDetalhes: 'Ver detalhes: nota por nota, com o documento fiscal',
    fonte:
      'Cota para o Exercício da Atividade Parlamentar, publicada pela Câmara dos Deputados e pelo Senado Federal. ' +
      'Valores já descontada a glosa.',
    anoDaCota: 'Ano da cota',
    emAndamento: ' em andamento',
  },

  lancamentos: {
    titulo: 'Nota por nota',
    baixar: 'Baixar todas (CSV)',
    arquivo: (pessoa: number, ano: number) => `cota-${pessoa}-${ano}.csv`,
    colunas: ['Data', 'Mês', 'Categoria', 'Fornecedor', 'Valor', 'Documento fiscal'],
    fornecedorNaoInformado: 'Fornecedor não informado',
    mes: (mes: number) => `mês ${mes}`,
    notaFiscal: 'nota fiscal',
    verTodos: (total: number) => `Ver os ${total} lançamentos`,
  },

  campanha: {
    vazio: 'Nenhuma receita de campanha registrada para este parlamentar na base.',
    rotulo: 'Campanha',
    rotuloDaProcedencia: (ano: number) => `Campanha de ${ano}`,
    resposta: (total: ReactNode, ano: number, publico: string, porcento: string): ReactNode => (
      <>
        Arrecadou {total} na eleição de {ano}. Juntos, os dois fundos somam <strong>{publico}</strong>, {porcento}% do que a
        campanha arrecadou. São fundos <strong>distintos</strong>: o Fundo Especial é eleitoral; o Partidário custeia o
        partido o ano inteiro.
      </>
    ),
    osDoisFundos: 'Os dois fundos',
    fundoEspecial: <TermoComponent nome="fundao">Fundo Especial</TermoComponent>,
    fundoPartidario: 'Fundo Partidário',
    maioresDoadores: 'Maiores doadores',
    pessoaFisica: 'pessoa física',
    verDetalhes: 'Ver detalhes: todas as fontes de receita',
    deOndeVeio: 'De onde veio',
    fonte: 'Prestação de contas eleitorais publicada pelo TSE.',
    conjuntoNoTse: 'Conjunto de dados no TSE',
  },

  patrimonio: {
    erro: 'Não foi possível carregar o patrimônio agora.',
    carregando: 'Carregando o patrimônio',
    rotulo: 'Patrimônio declarado',
    titulo: 'Patrimônio declarado ao TSE',
    vazio: 'Nenhuma declaração de bens deste parlamentar ao TSE na base.',
    bens: (quantidade: number) => `${quantidade} bens`,
    rotuloDaProcedencia: (ano: number) => `Bens declarados em ${ano}`,
    resposta: (total: ReactNode, bens: number, ano: number, anterior: { ano: number; total: string } | null): ReactNode => (
      <>
        Declarou {total} em {bens} {plural(bens, 'bem', 'bens')} ao se candidatar em {ano}.
        {anterior && (
          <>
            {' '}
            Em {anterior.ano}, tinha declarado <strong>{anterior.total}</strong>.
          </>
        )}
      </>
    ),
    verOsOutros: (quantos: number) => `Ver os outros ${quantos} tipos de bem`,
    nota: 'O valor é o que o próprio candidato declarou ao TSE, sem avaliação de mercado.',
    declaracoesNoTse: 'Declarações no TSE',
  },
} as const;
