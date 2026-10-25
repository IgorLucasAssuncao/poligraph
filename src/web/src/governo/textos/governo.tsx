import type { ReactNode } from 'react';
import type { GrupoDeEncargo } from '../../nucleo/api';
import { TermoComponent } from '../../comum/componentes/Termo';

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

  divida: {
    titulo: 'Juros da dívida e a Selic',
    ajuda:
      'Quanto o governo federal pagou de juros da dívida em cada ano, e a taxa Selic do mesmo ano. O fundo de cada coluna diz quem governava.',
    jurosTitulo: 'Juros pagos por ano',
    jurosRotulo: 'Juros e encargos da dívida pagos pelo governo federal, por ano',
    juros: 'Juros pagos',
    selicTitulo: 'Selic no ano',
    selicRotulo: 'Taxa Selic acumulada em cada ano',
    selic: 'Selic',
    porcento: (valor: number) => `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    emAndamento: 'em andamento',
    meses: (n: number) => `${n} meses`,
    legenda: 'Juros, amortização, refinanciamento e empréstimo de cada ano, com a Selic',
    colunas: ['Ano', 'Governo', 'Selic', 'Juros pagos', 'Amortização', 'Refinanciamento', 'Pegou emprestado'],
    ressalva:
      'O juro pago num ano não acompanha a Selic daquele ano: parte da dívida tem juro fixo ou corrigido pela inflação, e cada título paga o juro quando vence. Por isso os dois gráficos ficam lado a lado, sem conta entre eles. Refinanciamento é a rolagem: título novo que paga o velho.',
    fontes: 'Fontes:',
    fonteOrcamento: 'orçamento da despesa (grupos 2 e 6)',
    fonteSelic: 'Selic do Banco Central',
  },

  conferencia: {
    titulo: 'Confere com o Portal da Transparência:',
    resumo: (valor: string, ano: number, deCadaMil: string) =>
      `o Portal publica o pago do ano em dois arquivos que não batem. A maior diferença do período é de ${valor} em ${ano}, ${deCadaMil} a cada R$ 1.000.`,
    verDetalhe: 'Ver o detalhe',
    explicacao:
      'O pago sai do arquivo anual do orçamento, que diz a área de cada gasto. Os 12 arquivos mensais de execução somam um pouco diferente, e o Portal não explica a diferença. Ela fica aqui, ano a ano, sem correção.',
    ano: (ano: number, anual: string) => `${ano}, de ${anual} no anual`,
    diferenca: (diferenca: number, valor: string) =>
      diferenca === 0 ? 'igual nos mensais' : `${valor} a ${diferenca > 0 ? 'mais' : 'menos'} nos mensais`,
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

  fitas: {
    titulo: 'O caminho do dinheiro, em fitas',
    ajuda:
      'Dois desenhos separados, porque o imposto não tem destino marcado: ele se mistura no caixa do Tesouro. Em cada um, a largura da fita é o valor, e as colunas somam o mesmo total.',
    paraOndeFoi: 'Para onde foi',
    deOndeVeio: 'De onde veio',
    gastou: 'Gastou',
    areasDoGoverno: 'Áreas do governo',
    arrecadou: 'Arrecadou',
    outrosEncargos: 'Outros encargos',
    demais: 'Demais receitas correntes',
    negativas: (valor: string) => `As origens com valor negativo no ano, ${valor} em estornos e ajustes, não cabem em fita e ficam fora do desenho; o total arrecadado já as desconta.`,
    outrasAreas: (n: number) => `Outras ${n} áreas`,
    outrasOrigens: (n: number) => `Outras ${n} origens`,
    colunasDoGasto: ['Gastou', 'Nas áreas do governo', 'Para onde foi'] as const,
    colunasDaArrecadacao: ['De onde', 'Arrecadou'] as const,
    rotuloDoGasto: (total: string) => `Gráfico de fitas: ${total} gastos, pelas áreas do governo, os repasses e os juros da dívida`,
    rotuloDaArrecadacao: (total: string) => `Gráfico de fitas: ${total} arrecadados, por origem`,
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

  cartoes: {
    abertura: 'São três cartões diferentes. Cada um tem quem compra e regras próprias, e os valores não se somam.',
    porAno: 'Por ano',
    rotulo: 'Cartão',
  },

  comprasCentralizadas: {
    titulo: 'Cartão de compras centralizadas',
    oQueE: (
      <>
        Paga as <TermoComponent nome="compraCentralizada">compras centralizadas</TermoComponent> do governo federal.
      </>
    ),
    resposta: (periodo: string, total: ReactNode, transacoes: string): ReactNode => (
      <>
        {periodo}, foram <strong>{total}</strong> em {transacoes} compras.
      </>
    ),
    valor: 'Valor',
    quaseTudoEm2019:
      'Quase tudo foi passagem aérea paga direto às companhias, de maio a agosto de 2019. Depois disso, o cartão ' +
      'quase não foi usado.',
    semArquivo: (meses: string) => `O Portal não publicou ${meses}. O total é só dos outros meses.`,
    rotuloDaProcedencia: (periodo: string) => `Cartão de compras centralizadas, ${periodo}`,
    porOrgao: 'Por órgão',
    outrosOrgaos: 'os demais órgãos',
    meses: (meses: number) => (meses < 12 ? `${meses} meses publicados` : ''),
  },

  defesaCivil: {
    titulo: 'Cartão da Defesa Civil',
    oQueE: (
      <>
        Usado por estados e prefeituras depois de um desastre, com dinheiro federal. Veja o que é o{' '}
        <TermoComponent nome="cartaoDaDefesaCivil">cartão da Defesa Civil</TermoComponent>.
      </>
    ),
    resposta: (periodo: string, total: ReactNode, executores: number): ReactNode => (
      <>
        {periodo}, foram <strong>{total}</strong>, gastos por {executores.toLocaleString('pt-BR')} prefeituras e governos
        estaduais.
      </>
    ),
    prefeituras: 'Prefeituras',
    estados: 'Governos estaduais',
    semQuem: 'Sem dizer quem gastou',
    semArquivo: (meses: string) => `O Portal não publicou ${meses}. O total desses anos é menor do que o gasto foi.`,
    rotuloDaProcedencia: (periodo: string) => `Cartão da Defesa Civil, ${periodo}`,
    porAno: 'Por ano',
    porUf: 'Por estado',
    valor: 'Valor',
    meses: (meses: number) => (meses < 12 ? `${meses} meses publicados` : ''),
  },

  sigilo: {
    titulo: 'Cartão corporativo',
    oQueE: (
      <>
        O <TermoComponent nome="cartaoCorporativo">cartão corporativo</TermoComponent> é o de servidores federais, para
        compras pequenas e urgentes. Parte delas é sigilosa.
      </>
    ),
    vazio: 'Os gastos sigilosos deste período ainda não foram carregados.',
    resposta: (periodo: string, total: ReactNode, parteSigilosa: number, ateOMes: string | null): ReactNode => (
      <>
        {periodo}, foram {total}. Desses, <strong>{parteSigilosa} de cada R$ 100</strong> são sigilosos.
        {ateOMes}
      </>
    ),
    comDetalheNaBarra: 'Com detalhe',
    comDetalheDefinicao: 'O Portal mostra quem comprou, de quem e quando',
    sigilosoNaBarra: 'Sigiloso',
    sigilosoDefinicao: 'O Portal mostra só o valor',
    acaoForaDoCartao: (valor: string): ReactNode => (
      <>
        Fora do cartão, mais {valor} foram pagos em <TermoComponent nome="acaoSigilosa">ações sigilosas</TermoComponent>{' '}
        do orçamento.
      </>
    ),
    ateOMes: (ano: number, mes: number) => ` ${ano} até o mês ${mes}.`,
    rotuloDaProcedencia: (periodo: string) => `Cartão corporativo, ${periodo}`,
    rotuloDaBarra: (aberto: string, sigiloso: string) => `${aberto} com detalhe; ${sigiloso} sigilosos`,
    comDetalhe: (valor: string) => ` com detalhe, compra por compra: ${valor}`,
    sigiloso: (valor: string) => ` sigiloso, só o valor: ${valor}`,
    porAno: 'Por ano',
    noCartao: 'Sigiloso no cartão',
    naAcao: 'Ações de caráter sigiloso',
    porOrgao: 'Por órgão',
    explicacao: (orgao: string, valor: string, parte: number) =>
      `Na primeira linha, ${orgao} gastou ${valor} em compras sigilosas, ${parte}% do que gastou no cartão.`,
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
    titulo: (de: number, ate: number) => `Eleitos para governar de ${de} a ${ate}`,
    tituloAte: (de: number, ate: string) => `Governou de ${de} a ${ate}`,
    tituloDesde: (desde: string, ate: number) => `Governou de ${desde} a ${ate}`,
    saiu: (afastamento: string, posse: string) =>
      `Saiu da Presidência em ${afastamento}, com a abertura do processo de impeachment no Senado, e perdeu o mandato em ${posse}.`,
    assumiu: (afastamento: string, posse: string) =>
      `Era vice na chapa eleita. Assumiu a Presidência de forma interina em ${afastamento} e tomou posse em ${posse}, com o impeachment.`,
    anoDividido: (ano: number) =>
      `O orçamento é anual: os números de ${ano} contam para as duas gestões, porque o dado do Portal não separa o antes e o depois da troca.`,
    fonteDaTroca: 'Resolução nº 35/2016 do Senado',
    aviso:
      'O TSE informa a chapa eleita. Se o presidente sai no meio do mandato, por impeachment, renúncia ou morte, quem assume é o vice, e a troca não aparece aqui.',
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
