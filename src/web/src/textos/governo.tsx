import type { ReactNode } from 'react';
import type { GrupoDeEncargo } from '../api';
import { TermoComponent } from '../componentes/Termo';

/**
 * O texto da página do Governo federal. Frase fixa é constante; frase com valor é função, e o
 * valor chega pronto (já formatado, ou já embrulhado no modo auditoria) para a frase não
 * depender de como a tela o desenha.
 */
export const TEXTOS_DO_GOVERNO = {
  titulo: 'Governo federal',
  subtitulo: 'Quanto entrou, onde foi parar e o que foi gasto em segredo',
  erro: 'Não foi possível carregar os dados do governo agora.',
  carregando: 'Carregando o governo',
  semDados: 'Os dados do governo ainda não foram carregados. Eles aparecem depois da próxima execução do ETL.',
  rotuloDoPeriodo: 'Período',
  escopo: (periodo: string, emAndamento: number | null, geradoEm: string): ReactNode => (
    <>
      O dinheiro do <strong>Poder Executivo federal</strong> em <strong>{periodo}</strong>.
      Congresso e Justiça não entram.
      {emAndamento && (
        <>
          {' '}
          {emAndamento} vai até {geradoEm}.
        </>
      )}
    </>
  ),
  arquivosGeradosAte: (data: string) => `Arquivos gerados até ${data}. Fontes:`,
  fonteTse: 'TSE',
  fonteOrcamento: 'orçamento',
  fonteExecucao: 'execução mês a mês',
  fonteReceitas: 'receitas',
  fonteCartao: 'cartão de pagamento',
  portalDaTransparencia: '(Portal da Transparência).',
  semGestao: '—',

  resumo: {
    rotuloDaSecao: (periodo: string) => `${periodo} em números`,
    entrou: 'Entrou',
    entrouDefinicao: 'impostos e contribuições',
    gastou: 'Gastou',
    gastouDefinicao: 'serviços, repasses e juros',
    pegouEmprestado: 'Pegou emprestado',
    pegouEmprestadoDefinicao: 'em títulos da dívida',
    rotuloDaProcedencia: (numero: string, periodo: string) => `${numero}, ${periodo}`,
  },

  anoAAno: {
    titulo: 'Ano a ano',
    nota: 'Em reais de cada ano, sem correção pela inflação: anos mais recentes parecem maiores só por isso.',
    legenda: 'Entrou, gastou e pegou emprestado, por ano',
    ano: 'Ano',
    gestao: 'Gestão',
    entrou: 'Entrou',
    gastou: 'Gastou',
    pegouEmprestado: 'Pegou emprestado',
    emAndamento: ' em andamento',
  },

  cadaCem: {
    titulo: 'De cada R$ 100 gastos',
    repasses: 'Repasses a estados e municípios',
    juros: 'Juros e pagamento da dívida',
    outras: 'Outras áreas e despesas',
    parte: (parte: number) => `R$ ${parte}`,
    foraDaConta: (rolagem: string): ReactNode => (
      <>
        Fora da conta: {rolagem} de <TermoComponent nome="rolagem">rolagem da dívida</TermoComponent>.
      </>
    ),
  },

  deOndeVeio: {
    titulo: 'De onde veio o dinheiro',
    origemDosImpostos: 'Impostos, Taxas e Contribuições de Melhoria',
    origemDasContribuicoes: 'Contribuições',
    impostos: 'Impostos',
    contribuicoes: 'Contribuições (como a do INSS)',
    outras: 'Outras receitas',
    foraDaConta: (emprestado: string) => `Fora da conta: ${emprestado} pegos emprestados, que voltam com juros.`,
  },

  sigilo: {
    titulo: 'Gasto sigiloso',
    vazio: 'Os gastos sigilosos deste período ainda não foram carregados.',
    resposta: (periodo: string, total: ReactNode, parteSigilosa: number, ateOMes: string | null): ReactNode => (
      <>
        No <TermoComponent nome="cartaoCorporativo">cartão corporativo</TermoComponent>, {periodo}: {total}. Desses,{' '}
        <strong>{parteSigilosa} de cada R$ 100</strong> são sigilosos.
        {ateOMes}
      </>
    ),
    ateOMes: (ano: number, mes: number) => ` ${ano} até o mês ${mes}.`,
    rotuloDaProcedencia: (periodo: string) => `Cartão corporativo, ${periodo}`,
    rotuloDaBarra: (aberto: string, sigiloso: string) => `${aberto} com detalhe; ${sigiloso} sigilosos`,
    comDetalhe: (valor: string) => ` com detalhe, compra por compra: ${valor}`,
    sigiloso: (valor: string) => ` sigiloso, só o valor: ${valor}`,
    porOrgao: 'Por órgão',
    explicacao:
      'Há dois jeitos de gastar sem dizer em quê, e a tabela mostra os dois para cada órgão. O primeiro ' +
      'é a compra no cartão corporativo marcada como sigilosa; ao lado, quanto isso representa de ' +
      'tudo o que o órgão gastou no cartão. O segundo é o pagamento numa linha do orçamento ' +
      'chamada "ações de caráter sigiloso", que não passa pelo cartão.',
    exemplo: (orgao: string, valor: string, parte: number) =>
      ` Na primeira linha: ${orgao} gastou ${valor} em compras sigilosas no cartão, que são ${parte}% do cartão dele no período.`,
    legenda: 'Gasto sigiloso por órgão',
    orgao: 'Órgão',
    comprasSigilosas: 'Compras sigilosas no cartão',
    parteSigilosa: 'Parte sigilosa do cartão do órgão',
    pagoEmAcaoSigilosa: (
      <>
        Pago em <TermoComponent nome="acaoSigilosa">ação sigilosa</TermoComponent> do orçamento
      </>
    ),
    vazioNaCelula: '—',
    menosDeUmPorcento: 'menos de 1%',
    nota: 'Só o que o Portal marca como sigiloso. Gasto de inteligência em linhas de nome comum não aparece aqui.',
    baixar: 'Baixar o gasto sigiloso (CSV)',
    arquivo: (de: number, ate: number) => `governo-sigiloso-${de}-${ate}.csv`,
    colunas: ['Órgão', 'Cartão sigiloso', 'Cartão total', 'Ação sigilosa'],
  },

  gestao: {
    titulo: (de: number, ate: number) => `Quem governou de ${de} a ${ate}`,
    presidente: 'Presidente',
    vice: 'Vice-presidente',
    eleitosEm: (ano: number) => `Eleitos em ${ano}`,
    coligacao: 'coligação',
  },

  nomeDoGrupo: {
    TRANSFERENCIAS: 'Transferências a estados e municípios',
    SERVICO_DA_DIVIDA: 'Juros e amortização da dívida',
    REFINANCIAMENTO: 'Rolagem da dívida',
    OUTROS: 'Outros encargos',
  } satisfies Record<GrupoDeEncargo, string>,

  detalhes: {
    resumo: (
      <>
        <strong>Ver os detalhes</strong>: todas as áreas, a dívida e o orçamento aprovado
      </>
    ),
    todasAsAreas: 'Todas as áreas',
    doProprioAno: ' do próprio ano',
    deAnosAnteriores: <TermoComponent nome="restosAPagar">de anos anteriores</TermoComponent>,
    divida: (
      <>
        Dívida e transferências <TermoComponent nome="encargosEspeciais">(encargos especiais)</TermoComponent>
      </>
    ),
    orcamento: 'Orçamento aprovado e executado',
    baixarAreas: 'Baixar as áreas (CSV)',
    arquivoDasAreas: (periodo: string) => `governo-areas-${periodo}.csv`,
    colunasDasAreas: ['Código', 'Área', 'Dotação atualizada', 'Empenhado', 'Pago no ano', 'Pago de anos anteriores', 'Dotação completa'],
    baixarAnoAAno: 'Baixar ano a ano (CSV)',
    arquivoDoAnoAAno: (periodo: string) => `governo-ano-a-ano-${periodo}.csv`,
    colunasDoAnoAAno: ['Ano', 'Entrou', 'Gastou (sem rolagem)', 'Pegou emprestado', 'Ano fechado'],
    sim: 'sim',
    nao: 'não',
  },

  area: {
    deAnosAnteriores: (valor: string) => `${valor} de anos anteriores`,
    rotuloDaBarra: (doAno: string, anteriores: string) => `${doAno} do próprio ano e ${anteriores} de anos anteriores`,
  },

  tabelaDasAreas: {
    aviso: (incompletas: number, acima: string): ReactNode => (
      <>
        Em {incompletas} áreas o empenhado passou da dotação publicada, {acima} no total. Nelas a coluna “pago da
        dotação” fica em branco. <TermoComponent nome="dotacaoIncompleta">Por quê?</TermoComponent>
      </>
    ),
    legenda: 'Dotação, empenho e pago por área',
    area: 'Área',
    dotacao: <TermoComponent nome="dotacao">Dotação</TermoComponent>,
    empenhado: 'Empenhado',
    pago: 'Pago',
    pagoDaDotacao: 'Pago da dotação',
    dotacaoIncompleta: 'dotação incompleta',
    semDotacao: '—',
  },
} as const;
