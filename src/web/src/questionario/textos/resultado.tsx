import type { ReactNode } from 'react';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto da tela de resultado do questionário. */
export const TEXTOS_DO_RESULTADO = {
  titulo: 'Quem vota como você',
  respondidas: (quantas: number) => `${quantas} perguntas respondidas`,
  explicacao:
    'A comparação usa apenas as votações em que o parlamentar esteve presente e se posicionou. Deputados e senadores ' +
    'votam matérias diferentes, então cada grupo é comparado separadamente.',
  compararCom: 'Comparar com',
  todoOPais: 'parlamentares de todo o país',
  soOsDe: (uf: string) => `só os de ${uf}`,
  recalculando: 'Recalculando…',
  falhou: 'Não foi possível recalcular agora. Tente de novo.',
  soDoEstado: (uf: string) => `A lista e a régua contam só quem votou por ${uf}. O ponto no grafo continua o da casa inteira.`,
  escolhaUmEstado: 'Escolha um estado para ver só quem votou por ele.',
  ninguemDoEstado: (singular: string, uf: string) => `Nenhum ${singular} de ${uf} votou nas perguntas que você respondeu.`,
  aviso: (
    <>
      Esta é uma ferramenta acadêmica de comparação de votos. <strong>Não é recomendação de voto</strong>, e não representa
      o programa completo de nenhum parlamentar.
    </>
  ),
  refazer: 'Refazer o questionário',

  casa: {
    titulo: (nomeNoPlural: string) => `Os ${nomeNoPlural} mais próximos de você`,
    perguntasDaCasa: (quantas: number) => `${quantas} ${plural(quantas, 'pergunta', 'perguntas')} desta casa`,
    daLegislatura: (numero: number, periodo: string) => `Votações da ${numero}ª legislatura (${periodo})`,
    foraDoMandato: 'fora do mandato hoje',
    escala: (comparados: number, nomeNoPlural: string, acordos: number, comparaveis: number): ReactNode => (
      <>
        Entre os <strong>{comparados}</strong> {nomeNoPlural} comparados com você, o do meio da lista votou como você em{' '}
        <strong>
          {acordos} de {comparaveis}
        </strong>
        .
      </>
    ),
    fonte: (doNome: string) =>
      `Fonte: registro nominal de votação ${doNome}. Cada pergunta corresponde a uma votação em plenário.`,
    dadosAbertos: 'Dados abertos da casa',
    comoCalculamos: 'Como calculamos',
    ondeVoceCaiu: 'Onde você caiu',
    losango: (vizinhos: number, nomeNoPlural: string, base: number, singular: string): ReactNode => (
      <>
        O losango é você, posicionado entre os <strong>{vizinhos}</strong> {nomeNoPlural} com quem você mais concordou.{' '}
        <strong>Sua posição vale sobre {base} perguntas</strong>; a de cada {singular}, sobre a legislatura inteira.
      </>
    ),
    tambemProximos: 'Também próximos de você',
    maisDistantes: 'Mais distantes',
  },

  detalhe: {
    verEmQuais: 'Ver em quais perguntas',
    concordaram: 'Concordaram: ',
    discordaram: 'Discordaram: ',
    foraDaConta: (quantas: number, primeiroNome: string): ReactNode => (
      <>
        Outras <strong>{quantas}</strong> {plural(quantas, 'pergunta ficou', 'perguntas ficaram')} de fora da conta:
        {plural(quantas, ' ela', ' elas')} tratam de votações em que {primeiroNome} não votou, ou em que você respondeu
        “Não sei”.
      </>
    ),
  },

  destaque: {
    rotulo: 'Quem mais votou como você',
    placar: (acordos: number, comparaveis: number) => `${acordos} de ${comparaveis}`,
    placarTexto: 'perguntas comparáveis em que vocês votaram igual',
  },

  linha: {
    concordaram: (acordos: number, comparaveis: number, respondidas: number): ReactNode => (
      <>
        concordaram em <strong>{acordos}</strong> de <strong>{comparaveis}</strong> perguntas
        {comparaveis < respondidas && (
          <span className="base-da-conta"> (das {respondidas} que você respondeu nesta casa)</span>
        )}
      </>
    ),
  },
} as const;
