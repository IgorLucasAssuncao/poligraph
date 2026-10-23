import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TermoComponent } from '../componentes/Termo';

/** O texto da página inicial: a abertura, a base por casa, o grafo e quem a pessoa segue. */
export const TEXTOS_DO_INICIO = {
  titulo: 'Quem vota como você e o que chega à sua cidade',
  subtitulo: 'Os votos da Câmara e do Senado, os eleitos do TSE e o dinheiro público, cada número com a fonte.',
  entradas: {
    voto: { titulo: 'Compare seu voto', comecar: 'Começar as perguntas' },
    cidade: {
      titulo: 'Sua cidade',
      texto: 'Quem foi eleito para governar, o que chegou de emenda e o que a prefeitura arrecadou e gastou. A cidade escolhida fica guardada só neste navegador.',
      abrirGuardada: (nome: string, uf: string) => `Abrir ${nome} – ${uf}`,
    },
    busca: 'Ou procure pelo nome um político, uma cidade ou uma entidade:',
  },
  suaCidade: {
    prefeito: (varios: boolean) => (varios ? 'Prefeitos eleitos' : 'Prefeito eleito'),
    gestao: (de: number, ate: number) => `${de}–${ate}`,
    chegou: (valor: string, ano: number) => `${valor} em emendas chegaram a quem tem sede aqui em ${ano}`,
    semPagamento: (ano: number) => `Nenhum pagamento de emenda a quem tem sede aqui em ${ano}`,
  },
  ultimas: {
    titulo: 'As últimas votações abertas',
    ajuda: 'Cada traço é uma cadeira: cheio é quem se posicionou, vazado é quem faltou. O painel não mostra como cada um votou.',
    legenda: (casa: string, data: string, materia: string | null) => `${casa} · ${data}${materia ? ` · ${materia}` : ''}`,
  },
  numeros: (periodo: string, votos: string, cota: string | null, emendas: string | null) =>
    `Na legislatura de ${periodo}: ${votos} votos com posição na Câmara e no Senado` +
    (cota && emendas ? `, ${cota} gastos da cota parlamentar e ${emendas} pagos em emendas.` : '.'),
  comoMedimos: 'Como cada número foi medido',
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

  verParlamentares: 'Ver os políticos',
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
