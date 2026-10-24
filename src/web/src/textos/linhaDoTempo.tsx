import type { ReactNode } from 'react';

/** O texto da linha do tempo (Pendência 92). */
export const TEXTOS_DA_LINHA_DO_TEMPO = {
  titulo: 'Linha do tempo',
  ajuda:
    'Do ano mais antigo, à esquerda, ao mais recente, à direita. As faixas são os mandatos, e cada ponto é um ano com dado: escolha um para ver o que a base tem dele.',
  ponto: (ano: number, marcos: number) => `${ano}, ${marcos} ${marcos === 1 ? 'registro' : 'registros'}`,
  anterior: '‹ Anterior',
  seguinte: 'Seguinte ›',
  inicio: 'Início · ',
  fim: 'Fim · ',
  carregando: 'Carregando a linha do tempo',
  erro: 'Não foi possível carregar a linha do tempo agora. Tente de novo em instantes.',
  vazio: 'Ainda não há nada desta pessoa com data na base.',
  eleito: (mandato: string, partido: string) => `Eleito: ${mandato}${partido ? ` (${partido})` : ''}`,
  trocou: (de: string, para: string) => `Passou a votar pelo ${para}; antes, ${de}`,
  votou: (n: number) => `Votou em ${n.toLocaleString('pt-BR')} ${n === 1 ? 'votação' : 'votações'}`,
  bens: (valor: ReactNode, n: number): ReactNode => (
    <>
      Declarou {valor} em {n.toLocaleString('pt-BR')} {n === 1 ? 'bem' : 'bens'} ao TSE
    </>
  ),
  bensForaDoPadrao: 'Valor fora do padrão, pode ser erro de digitação. O site não confere os valores declarados.',
  cota: (valor: string) => `Gastou ${valor} da cota parlamentar`,
  emendas: (empenhado: string, pago: string) => `Emendas apresentadas neste ano: ${empenhado} empenhados, ${pago} pagos até hoje`,
  fontes:
    'Fontes: eleição e bens, TSE; votos, Câmara e Senado; cota, Câmara e Senado; emendas, Portal da Transparência (pelo ano da emenda).',
};
