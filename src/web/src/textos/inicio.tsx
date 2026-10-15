import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TermoComponent } from '../componentes/Termo';

/** O texto da página inicial: a abertura, a base por casa, o grafo e quem a pessoa segue. */
export const TEXTOS_DO_INICIO = {
  titulo: 'Quem vota como você',
  abertura: (perguntas: number | null, ativas: number, corrente: number | undefined): ReactNode => (
    <>
      A afinidade sai do <strong>voto registrado em plenário</strong> de cada parlamentar.
      {perguntas ? (
        <>
          {' '}Você responde <strong>{perguntas} perguntas</strong>, escolhidas entre {ativas} votações nominais reais
          {corrente ? ` da ${corrente}ª legislatura` : ''}.
        </>
      ) : (
        ' Cada pergunta do questionário vem de uma votação nominal real.'
      )}
    </>
  ),
  compare: 'Compare seu voto',
  verParlamentares: 'Ver os parlamentares',
  carregandoABase: 'Carregando o tamanho da base',
  quemVoceSegue: 'Quem você segue',
  privacidade: (
    <>
      Esta lista indica sua posição política e é tratada como dado sensível. Ela não é compartilhada com ninguém.{' '}
      <Link to="/conta">Como apagar tudo</Link>
    </>
  ),

  grafo: {
    titulo: 'Quem vota com quem na Câmara',
    semGrafo: (periodo: string) =>
      `Não há grafo da Câmara em ${periodo}: as votações abertas eram poucas para comparar quem vota com quem.`,
    abrir: 'Abrir o grafo completo',
  },

  base: {
    vazio: 'A base ainda não foi ingerida. Os números aparecem depois da primeira execução do ETL.',
    titulo: 'A base',
    votacoes: 'votações de plenário',
    rotuloDaProcedencia: (casa: string) => `Votações · ${casa}`,
    votosComPosicao: 'votos com posição',
    grupos: <TermoComponent nome="comunidade">grupos de voto</TermoComponent>,
    semVotoNominal: (quantas: string) =>
      `Outras ${quantas} votações ficaram fora da conta: a casa as registrou sem a lista de quem votou como.`,
    secretas: (secretas: number, total: string, abertas: string, secretasTexto: string): ReactNode => (
      <>
        <strong>
          {secretasTexto} de {total} {secretas === 1 ? 'votação é secreta' : 'votações são secretas'}
        </strong>{' '}
        e não têm voto individual publicado. A comparação se apoia nas {abertas} abertas.
      </>
    ),
    ultima: (data: string, materia: string | null) => `Última votação aberta, ${data}${materia ? ` · ${materia}` : ''}`,
  },

  comoDecidiu: {
    titulo: 'Como o plenário decidiu',
    rotulo: (nominais: number, simbolicas: number) => `${nominais} nominais e ${simbolicas} simbólicas`,
    nominais: (quantas: string): ReactNode => (
      <>
        {' '}
        {quantas} por <TermoComponent nome="votacaoNominal" />
      </>
    ),
    simbolicas: (quantas: string): ReactNode => (
      <>
        {' '}
        {quantas} por <TermoComponent nome="votacaoSimbolica" />
      </>
    ),
    ressalva: 'Só a nominal registra o voto de cada um, e só ela entra na comparação.',
  },
} as const;
