import type { Cargo, MandatoNoTse, Nivel } from '../api';

/** O nome de cada cargo na tela. */
export const NOMES_DOS_CARGOS: Record<Cargo, string> = {
  PRESIDENTE: 'Presidente',
  VICE_PRESIDENTE: 'Vice-presidente',
  SENADOR: 'Senador',
  DEPUTADO_FEDERAL: 'Deputado federal',
  GOVERNADOR: 'Governador',
  VICE_GOVERNADOR: 'Vice-governador',
  DEPUTADO_ESTADUAL: 'Deputado estadual',
  DEPUTADO_DISTRITAL: 'Deputado distrital',
  PREFEITO: 'Prefeito',
  VICE_PREFEITO: 'Vice-prefeito',
};

/** Os cargos de cada nível, na ordem do filtro. */
export const CARGOS_DO_NIVEL: Record<Nivel, Cargo[]> = {
  FEDERAL: ['PRESIDENTE', 'VICE_PRESIDENTE', 'SENADOR', 'DEPUTADO_FEDERAL'],
  ESTADUAL: ['GOVERNADOR', 'VICE_GOVERNADOR', 'DEPUTADO_ESTADUAL', 'DEPUTADO_DISTRITAL'],
  MUNICIPAL: ['PREFEITO', 'VICE_PREFEITO'],
};

/**
 * "Prefeito, Campinas – SP, 2025–2028", "Governador de SP", "Deputado estadual por SP": o ente que o cargo tem.
 *
 * ATENÇÃO: a cidade vem depois da vírgula, sem preposição: "de" errava em "Prefeito de Rio de Janeiro", e acertar
 * "do Rio", "do Recife" e "de São Paulo" pede uma tabela que a base não tem.
 *
 * O mandato que ainda não começou diz quando começa: o eleito de 2026 toma posse em 2027, e "2027–2030" sozinho
 * parece mandato em curso.
 */
export function descricaoDoMandato(mandato: MandatoNoTse, nomeDoMunicipio: (nome: string) => string): string {
  const cargo = NOMES_DOS_CARGOS[mandato.cargo];
  const ente = mandato.municipio
    ? `, ${nomeDoMunicipio(mandato.municipio.nome)} – ${mandato.municipio.uf}`
    : !mandato.uf
      ? ''
      : mandato.cargo === 'GOVERNADOR' || mandato.cargo === 'VICE_GOVERNADOR' || mandato.nivel === 'MUNICIPAL'
        ? ` de ${mandato.uf}`
        : ` por ${mandato.uf}`;
  const periodo = `${mandato.primeiroAno}–${mandato.ultimoAno}`;
  return mandato.primeiroAno > new Date().getFullYear() ? `${cargo}${ente}, ${periodo}, posse em ${mandato.primeiroAno}` : `${cargo}${ente}, ${periodo}`;
}

/** O texto da lista de políticos de todos os cargos e da ficha de cada um (Pendência 90). */
export const TEXTOS_DOS_POLITICOS = {
  perfilDoCargo: {
    eleito: (ano: number, partido: string) => `Eleito em ${ano}${partido ? `, pelo ${partido}` : ''}.`,
    semVoto: 'Neste cargo não há voto nem cota de gabinete na base.',
    verOGoverno: (de: number, ate: number) => `Ver o governo federal de ${de} a ${ate}`,
    verACidade: (cidade: string) => `Ver a página de ${cidade}`,
    verOsOutros: 'Ver os outros eleitos para o cargo',
  },
  ficha: {
    titulo: 'Político',
    erro: 'Não foi possível carregar esta ficha agora. Tente de novo em instantes.',
    semMandato: 'Esta pessoa não tem mandato eleito na base do TSE.',
    verTodos: 'Ver todos os políticos',
    mandatos: 'Mandatos',
    quantosMandatos: (n: number) => (n === 1 ? '1 mandato eleito de 1998 a 2026' : `${n} mandatos eleitos de 1998 a 2026`),
    eleitoEm: (ano: number) => `eleito em ${ano}`,
    outrosDoCargo: 'ver os outros eleitos',
    semVotoAindaNoCongresso: (posse: number) =>
      `Eleito para o Congresso, com posse em ${posse}. Os votos e a afinidade aparecem aqui quando a Câmara ou o Senado publicarem os primeiros votos do mandato.`,
    fonte: 'Mandatos: candidaturas eleitas publicadas pelo TSE.',
    candidaturasNoTse: 'Candidaturas no TSE',
    rotuloDasAbas: 'Seções da ficha',
    abas: { campanha: 'Campanha', 'linha-do-tempo': 'Linha do tempo', cargos: 'Cargos' },
  },

  faltas: {
    titulo: 'O que esta ficha não tem',
    legislativo: {
      votos:
        'Votos e afinidade: cada assembleia publica as votações do seu jeito, e algumas não publicam o voto de cada deputado. Sem uma fonte nacional, a comparação com o seu voto não teria a mesma régua da Câmara e do Senado.',
      gastos:
        'Gastos do gabinete: a verba de cada deputado estadual sai no portal da assembleia, em 27 formatos diferentes. O site só usa fonte que recarrega igual todo mês, como a cota da Câmara e do Senado.',
      emendas:
        'Emendas: as emendas ao orçamento do estado não têm um portal nacional. O Portal da Transparência traz só as emendas ao orçamento federal.',
    },
    executivo: {
      votos:
        'Votos e afinidade: presidente, governador e prefeito não votam projetos; quem vota é o Congresso, a assembleia ou a câmara municipal.',
      contasDoGoverno: 'Contas: o que o governo federal arrecadou e gastou no mandato está em Governo federal.',
      verOGoverno: (de: number, ate: number) => `Ver o governo federal de ${de} a ${ate}`,
      contasDaCidade: 'Contas: o que a prefeitura arrecadou e gastou em cada gestão está na página da cidade.',
      verACidade: (cidade: string) => `Ver a página de ${cidade}`,
      contasDoEstado:
        'Contas: as contas do governo do estado ainda não estão na base. A base tem as das prefeituras, declaradas ao Tesouro.',
      emendas:
        'Emendas: quem apresenta emenda é o deputado ou o senador. O que chegou de emenda federal a cada cidade está na página da cidade.',
    },
  },

  lista: {
    buscar: 'Buscar político pelo nome',
    placeholder: 'Nome do político',
    nivel: 'Nível de governo',
    niveis: { todos: 'Todos', FEDERAL: 'Federal', ESTADUAL: 'Estadual', MUNICIPAL: 'Municipal' } as Record<Nivel | 'todos', string>,
    cargo: 'Cargo',
    todosOsCargos: 'Todos os cargos',
    uf: 'Estado',
    todasAsUfs: 'Todos os estados',
    municipio: 'Cidade',
    municipioPlaceholder: 'Nome da cidade',
    municipioPrecisaDeUf: 'Escolha o estado para filtrar por cidade',
    tirarMunicipio: (nome: string) => `Tirar o filtro de ${nome}`,
    carregando: 'Carregando os políticos',
    erro: 'Não foi possível carregar a lista agora. Tente de novo em instantes.',
    quantos: (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'político' : 'políticos'} com mandato nos filtros escolhidos`,
    nenhum: 'Ninguém com mandato nesses filtros. Tente outro cargo ou outro estado.',
    outrosMandatos: (n: number) => (n > 1 ? `${n} mandatos na base` : ''),
    fonte: 'Fonte: candidaturas eleitas publicadas pelo TSE, eleições de 1998 a 2026.',
    viceAntes:
      'Vice-prefeitos aparecem desde 2000 e vices de governador e de presidente, desde 2002. Até 2010 o TSE não marca o vice como eleito, e a base o acha pela chapa do titular. Em 2000, por exemplo, são 4.736 vice-prefeitos para 5.585 prefeitos.',
  },
};
