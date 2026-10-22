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

/** "Prefeito de Campinas – SP, 2025–2028", "Governador de SP", "Deputado estadual por SP": o ente que o cargo tem. */
export function descricaoDoMandato(mandato: MandatoNoTse, nomeDoMunicipio: (nome: string) => string): string {
  const cargo = NOMES_DOS_CARGOS[mandato.cargo];
  const ente = mandato.municipio
    ? ` de ${nomeDoMunicipio(mandato.municipio.nome)} – ${mandato.municipio.uf}`
    : !mandato.uf
      ? ''
      : mandato.cargo === 'GOVERNADOR' || mandato.cargo === 'VICE_GOVERNADOR' || mandato.nivel === 'MUNICIPAL'
        ? ` de ${mandato.uf}`
        : ` por ${mandato.uf}`;
  return `${cargo}${ente}, ${mandato.primeiroAno}–${mandato.ultimoAno}`;
}

/** O texto da lista de políticos de todos os cargos (Pendência 90). */
export const TEXTOS_DOS_POLITICOS = {
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
    fonte: 'Fonte: candidaturas eleitas publicadas pelo TSE, eleições de 2000 a 2024.',
    viceAntes:
      'Vices aparecem a partir de 2012 (prefeitura) e 2014 (governo): antes disso, o TSE não marca o vice como eleito.',
  },
};
