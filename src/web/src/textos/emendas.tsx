import type { ReactNode } from 'react';
import { TermoComponent } from '../componentes/Termo';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto da página Emendas por cidade: filtros, números, mapas e o painel da cidade. */
export const TEXTOS_DAS_EMENDAS = {
  titulo: 'Emendas por cidade',
  subtitulo: 'Para onde foi o dinheiro de emenda parlamentar',
  erro: 'Não foi possível carregar o mapa das emendas agora.',
  carregando: 'Carregando o mapa das emendas',
  semDados: 'As emendas ainda não foram carregadas. Elas aparecem depois da próxima execução do ETL.',
  periodo: 'Período',
  periodoDasEmendas: 'Período das emendas',
  escopo: (periodo: string): ReactNode => (
    <>
      Emendas de <strong>{periodo}</strong>, pagas até hoje. A cidade é a <TermoComponent nome="sedeDoFavorecido" />.
    </>
  ),
  fontes: 'Fontes:',
  paraASede: ', para a sede;',

  numeros: {
    rotulo: 'O dinheiro das emendas do período',
    pago: 'Pago em emendas',
    pagoDefinicao: 'das emendas do período, pago até hoje',
    noMapa: 'No mapa',
    noMapaDefinicao: 'sabemos em que cidade fica quem recebeu',
    porBanco: 'Repassado por banco',
    porBancoDefinicao: 'foi ao Banco do Brasil, que paga adiante; o destino final não está no dado',
    semCidade: 'Sem cidade',
    semCidadeDefinicao: 'pago a pessoas ou a quem não foi identificado',
    rotuloDaProcedencia: (periodo: string) => `Pago nas emendas de ${periodo}`,
  },

  leitura: {
    rotulo: 'Leitura do mapa',
    total: 'Total recebido',
    porHabitante: 'Por habitante',
    porPessoa: (valor: string) => `R$ ${valor}`,
    sufixoPorHabitante: ', por habitante',
  },

  pais: {
    titulo: 'Por estado',
    ajuda: 'Escolha um estado para ver as cidades.',
    populacao: (ano: number) => `Reais por habitante, com a população estimada pelo IBGE para ${ano}.`,
    rotuloDoMapa: (periodo: string, porHabitante: boolean) =>
      `Mapa do Brasil: dinheiro de emenda de ${periodo} por estado${porHabitante ? ', por habitante' : ''}`,
    legenda: 'Dinheiro de emenda por estado, pela sede de quem recebeu',
    estado: 'Estado',
    recebido: 'Recebido',
    porHabitante: 'Por habitante',
    cidades: 'Cidades',
    rotuloDaProcedencia: (periodo: string, uf: string) => `Emendas de ${periodo} com sede em ${uf}`,
    verTodos: (quantos: number) => `Ver os ${quantos} estados`,
    baixar: 'Baixar por estado (CSV)',
    arquivo: (periodo: string) => `emendas-por-estado-${periodo}.csv`,
    colunas: ['UF', 'Código IBGE', 'Recebido', 'População', 'Cidades'],
  },

  estado: {
    verOBrasil: 'Ver o Brasil',
    erro: (uf: string) => `Não foi possível carregar as cidades de ${uf}.`,
    ajuda: (recebido: string, receberam: number, cidades: number, uf: string) =>
      `${recebido} a quem tem sede em ${receberam} das ${cidades} cidades de ${uf}. Escolha uma cidade no mapa ou na lista.`,
    porHabitante: 'Reais por habitante. Cidade pequena com uma emenda grande sobe muito.',
    rotuloDoMapa: (uf: string, porHabitante: boolean) =>
      `Mapa de ${uf}: dinheiro de emenda por cidade${porHabitante ? ', por habitante' : ''}`,
    carregando: 'Carregando as cidades',
    porHabitanteNaLista: (valor: string) => `${valor} por habitante`,
    baixar: (uf: string) => `Baixar as cidades de ${uf} (CSV)`,
    arquivo: (uf: string, periodo: string) => `emendas-${uf}-${periodo}.csv`,
    colunas: ['Código IBGE', 'Cidade', 'Recebido'],
  },

  cidade: {
    erro: 'Não foi possível carregar essa cidade.',
    carregando: 'Carregando a cidade',
    fechar: 'Fechar',
    vazio: (periodo: string, nome: string) =>
      `Nenhum pagamento das emendas de ${periodo} chegou a quem tem sede em ${nome}.`,
    rotuloDaProcedencia: (periodo: string, nome: string) => `Emendas de ${periodo} com sede em ${nome}`,
    total: (valor: ReactNode, periodo: string, nome: string): ReactNode => (
      <>
        {valor} das emendas de {periodo} chegaram a quem tem sede em {nome}.
      </>
    ),
    naPrefeitura: ' à prefeitura ou a órgão municipal',
    emEntidades: ' a entidades e empresas com sede aqui, que podem ter aplicado em outra cidade',
    rotuloDasAbas: (nome: string) => `O dinheiro de ${nome}`,
    abaParlamentares: 'Deputados e senadores',
    abaColetivos: 'Bancadas e comissões',
    abaConvenios: 'Convênios',
    abaRecebedores: 'Quem recebeu',
  },

  convenios: {
    resumo: (quantidade: number, combinado: string, liberado: string, emExecucao: number, aLiberar: string): ReactNode => (
      <>
        {quantidade} {plural(quantidade, 'convênio', 'convênios')}: {combinado} combinados, {liberado} já liberados. São os
        convênios com quem tem sede na cidade: na capital entram órgãos do estado, e a obra pode ser em outro município.
        {emExecucao > 0 && (
          <>
            {' '}
            {emExecucao} em execução, com <strong>{aLiberar} ainda a liberar</strong>.
          </>
        )}
      </>
    ),
    objetoNaoInformado: 'Objeto não informado',
    convenio: (numero: string) => `convênio ${numero}`,
    combinados: (valor: string) => `${valor} combinados`,
    liberados: (valor: string) => `${valor} liberados`,
  },

  quemMandou: {
    resumo: (quantos: number, valor: string): ReactNode => (
      <>
        {quantos} parlamentares, {valor} em <TermoComponent nome="emendaIndividual">emendas individuais</TermoComponent>. O
        nome leva à página de cada um.
      </>
    ),
    baixar: 'Baixar a lista (CSV)',
    arquivo: (codigo: string, periodo: string) => `emendas-${codigo}-${periodo}-parlamentares.csv`,
    colunas: ['Parlamentar', 'Partido', 'UF', 'Casa', 'Emendas', 'Recebido na cidade'],
  },

  quemRecebeu: {
    ajuda: (cidade: string) => `Quem recebeu o dinheiro e tem sede em ${cidade}, do maior valor ao menor.`,
  },

  suaCidade: {
    titulo: 'Sua cidade',
    placeholder: 'Digite o nome da cidade',
    usarLocalizacao: 'Usar minha localização',
    semLocalizacao: 'Este navegador não informa a localização. Busque a cidade pelo nome.',
    localizando: 'Localizando…',
    foraDoBrasil: 'A localização ficou fora do Brasil. Busque a cidade pelo nome.',
    naoPermitida: 'A localização não foi permitida. Busque a cidade pelo nome.',
    encontradas: 'Cidades encontradas',
    nota: 'A cidade fica guardada só neste navegador.',
  },
} as const;
