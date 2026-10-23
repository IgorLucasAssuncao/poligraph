import type { ReactNode } from 'react';
import { TermoComponent } from '../componentes/Termo';

/** Plural simples: "1 emenda", "2 emendas". */
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto das três abas de dinheiro da ficha: campanha, emendas e cota. */
export const TEXTOS_DAS_CONTAS = {
  faixa: {
    noMandato: (periodo: string) => `No mandato de ${periodo}: o ano mais recente de cada um dentro dele.`,
    maisRecente: 'Cada número é do ano mais recente com dado na base: a campanha é da última eleição, as emendas e a cota, do último ano com registro. Por isso os anos não coincidem.',
    rotulo: 'Contas do mandato',
    campanha: (anoDaEleicao?: number | null) => (anoDaEleicao ? `Campanha de ${anoDaEleicao}` : 'Campanha'),
    campanhaNota: 'arrecadado na eleição',
    emendas: (anoDaEmenda?: number | null) => (anoDaEmenda ? `Emendas de ${anoDaEmenda}` : 'Emendas'),
    emendasNota: 'empenhado no ano',
    cota: (anoDaDespesa?: number | null) => (anoDaDespesa ? `Cota de ${anoDaDespesa}` : 'Cota'),
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
    rotuloDaProcedencia: (anoDaEmenda: number) => `Emendas de ${anoDaEmenda}`,
    resposta: (pago: ReactNode, empenhado: string, quantidade: number, anoDaEmenda: number, porcento: string): ReactNode => (
      <>
        {pago} pagos de {empenhado} empenhados em <strong>{quantidade}</strong> {plural(quantidade, 'emenda', 'emendas')} de{' '}
        {anoDaEmenda}: {porcento}% saiu de fato
      </>
    ),
    verOGrafo: 'Ver o grafo do dinheiro',
    pagoNoAno: (anoDaEmenda: number, valor: string) => ` pago em ${anoDaEmenda}: ${valor}`,
    pagoDepois: (valor: string) => ` pago nos anos seguintes: ${valor}`,
    naoPago: (valor: string) => ` ainda não pago: ${valor}`,
    verDetalhes: 'Ver detalhes: áreas do orçamento, local declarado, mês a mês, convênios e emenda por emenda',
    emQue: (
      <>
        Em quê <TermoComponent nome="funcaoOrcamentaria">(área do orçamento)</TermoComponent>
      </>
    ),
    localDeclarado: 'Local declarado na emenda',
    outrosDestinos: 'outros lugares ou sem local',
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
    vazio: (anoDaDespesa: number | null) =>
      `Nenhuma despesa de cota registrada ${anoDaDespesa ? `em ${anoDaDespesa}` : 'para este parlamentar na base'}.`,
    rotuloDaProcedencia: (anoDaDespesa: number) => `Cota parlamentar de ${anoDaDespesa}`,
    resposta: (total: ReactNode, anoDaDespesa: number, notas: number, maiorParte: string | null): ReactNode => (
      <>
        Gastou {total} da <TermoComponent nome="cota">cota parlamentar</TermoComponent> em {anoDaDespesa}, em <strong>{notas}</strong>{' '}
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
    outrasCategorias: 'outras categorias',
    todasAsCategorias: (quantas: number) => `Ver as ${quantas} categorias`,
    rotuloDaCategoria: (anoDaDespesa: number, categoria: string) => `Cota de ${anoDaDespesa}: ${categoria}`,
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
    arquivo: (idPessoa: number, anoDaDespesa: number) => `cota-${idPessoa}-${anoDaDespesa}.csv`,
    colunas: ['Data', 'Mês', 'Categoria', 'Fornecedor', 'Valor', 'Documento fiscal'],
    fornecedorNaoInformado: 'Fornecedor não informado',
    mes: (mes: number) => `mês ${mes}`,
    notaFiscal: 'nota fiscal',
    verTodos: (total: number) => `Ver os ${total} lançamentos`,
  },

  campanha: {
    vazio: 'Nenhuma receita de campanha desta pessoa na base. A prestação de contas de uma eleição chega ao TSE depois do segundo turno.',
    rotulo: 'Campanha',
    rotuloDaProcedencia: (anoDaEleicao: number) => `Campanha de ${anoDaEleicao}`,
    resposta: (total: ReactNode, anoDaEleicao: number, publico: string, porcento: string): ReactNode => (
      <>
        Arrecadou {total} na eleição de {anoDaEleicao}. Juntos, os dois fundos somam <strong>{publico}</strong>, {porcento}% do que a
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
    outrasFontes: 'outras fontes',
    fonte: 'Prestação de contas eleitorais publicada pelo TSE.',
    conjuntoNoTse: 'Conjunto de dados no TSE',
  },

  patrimonio: {
    erro: 'Não foi possível carregar o patrimônio agora.',
    carregando: 'Carregando o patrimônio',
    rotulo: 'Patrimônio declarado',
    titulo: 'Patrimônio declarado ao TSE',
    vazio: 'Nenhuma declaração de bens desta pessoa ao TSE na base.',
    bens: (quantidade: number) => `${quantidade} bens`,
    rotuloDaProcedencia: (anoDaEleicao: number) => `Bens declarados em ${anoDaEleicao}`,
    resposta: (total: ReactNode, bens: number, anoDaEleicao: number, anterior: { anoDaEleicao: number; total: string } | null): ReactNode => (
      <>
        Declarou {total} em {bens} {plural(bens, 'bem', 'bens')} ao se candidatar em {anoDaEleicao}.
        {anterior && (
          <>
            {' '}
            Em {anterior.anoDaEleicao}, tinha declarado <strong>{anterior.total}</strong>.
          </>
        )}
      </>
    ),
    verOsOutros: (quantos: number) => `Ver os outros ${quantos} tipos de bem`,
    nota: 'O valor é o que o próprio candidato declarou ao TSE, sem avaliação de mercado.',
    declaracoesNoTse: 'Declarações no TSE',
  },

  /** As listas de "para onde foi" da aba Emendas: quem recebeu, quando, por qual convênio, emenda por emenda. */
  paraOndeFoi: {
    rotuloDosConvenios: 'Convênios das emendas',
    quemRecebeu: 'Quem recebeu',
    recebidos: (valor: string, anoDaEmenda: number, ultimoMesPago: string | null): ReactNode => (
      <>
        <strong>{valor}</strong> recebidos pelas emendas de {anoDaEmenda}
        {ultimoMesPago && <>, até {ultimoMesPago}</>}. Inclui o que foi pago nos anos seguintes.
      </>
    ),
    diferencaDoPago: (valor: string, aMais: boolean) =>
      `São ${valor} ${aMais ? 'a mais' : 'a menos'} que o pago registrado nas emendas. O Portal da Transparência publica as emendas e os pagamentos em arquivos separados, e para estas emendas os dois não batem.`,
    viaBanco: <TermoComponent nome="intermediario">Via Banco do Brasil, que repassa</TermoComponent>,
    aPessoas: <TermoComponent nome="favorecidoPessoa">A pessoas, sem identificação</TermoComponent>,
    semIdentificacao: 'Sem identificação na fonte',
    tambemNaCota: (valor: string, anos: string) => `A cota deste parlamentar também pagou ${valor} a este CNPJ em ${anos}`,
    quandoFoiPago: 'Quando foi pago',
    noProprioAno: (noAno: string, total: string, parcela: number, anoDaEmenda: number): ReactNode => (
      <>
        {noAno} de {total} (<strong>{parcela}%</strong>) saíram ainda em {anoDaEmenda}.
      </>
    ),
    verTabela: 'Ver os valores em tabela',
    mes: 'Mês',
    pago: 'Pago',
    convenios: <TermoComponent nome="convenio">Convênios</TermoComponent>,
    conveniosFinanciados: (quantos: number) =>
      `${quantos} ${plural(quantos, 'convênio financiado', 'convênios financiados')} por estas emendas. O valor é o do convênio inteiro.`,
    convenio: (numero: string, publicado: string) => `Convênio ${numero} · publicado em ${publicado}`,
    financiadoPor: (emendas: number) => ` · financiado por ${emendas} emendas, de um ou mais autores`,
    noPortal: 'no Portal',
    emendaPorEmenda: 'Emenda por emenda',
    baixarTodas: 'Baixar todas (CSV)',
    arquivo: (idPessoa: number, anoDaEmenda: number) => `emendas-${idPessoa}-${anoDaEmenda}.csv`,
    colunas: ['Código', 'Tipo', 'Localidade', 'Localidades', 'Função', 'Empenhado', 'Pago', 'Portal'],
    semLocalidade: 'Sem localidade',
    eMais: (quantas: number) => ` e mais ${quantas}`,
    semFuncao: 'sem função',
    pagos: (valor: string) => `${valor} pagos`,
    verTodas: (total: number) => `Ver as ${total} emendas`,
  },

  /** O modal do grafo do dinheiro (Pendência 83). */
  grafoDoDinheiro: {
    sobre: 'De onde veio e para onde foi',
    fechar: 'Fechar',
    campanha: (anoDaEleicao: number, total: string) => `Campanha de ${anoDaEleicao} · ${total} arrecadados`,
    emendas: (anoDaEmenda: number, total: string) => `Emendas de ${anoDaEmenda} · ${total} recebidos`,
    ajuda:
      'As setas da esquerda são as receitas da campanha, segundo a prestação de contas ao TSE; as da direita, quem ' +
      'recebeu o dinheiro das emendas daquele ano, segundo o Portal da Transparência, até o último pagamento. Os dois ' +
      'lados são de anos diferentes e não se somam.',
    abrirEntidade: (nome: string) => `${nome}: abrir a página da entidade`,
    pessoaFisica: 'pessoa física',
    outrasReceitas: 'Outras receitas',
    restoDoArrecadado: 'o resto do arrecadado',
    outrosRecebedores: 'Outros recebedores',
    repassePorBanco: 'Repasse por banco',
    destinoForaDoDado: 'o destino final não está no dado',
    pessoasESemIdentificacao: 'Pessoas e sem identificação',
    item: (nome: string, valor: string) => `${nome}, ${valor}`,
    leitorCampanha: (anoDaEleicao: number, nome: string, itens: string) => `Campanha de ${anoDaEleicao} de ${nome}: ${itens}. `,
    leitorEmendas: (anoDaEmenda: number, itens: string) => `Emendas de ${anoDaEmenda}: ${itens}.`,
  },
} as const;
