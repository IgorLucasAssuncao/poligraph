import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { FONTES } from '../fontes';

/**
 * O texto de "Como calculamos". Os números entram como argumento: a página não escreve à mão
 * nenhum parâmetro do cálculo (ver `MetodologiaComponent`).
 */
export const TEXTOS_DA_METODOLOGIA = {
  titulo: 'Como calculamos',
  abertura:
    'O site compara o que você responde com o voto registrado de cada parlamentar. Os números desta página vêm do ' +
    'próprio cálculo: quando um parâmetro muda, ela muda junto.',
  erro: 'Não foi possível carregar os parâmetros agora.',
  carregando: 'Carregando a metodologia',

  dados: {
    titulo: 'De onde vêm os dados',
    votos: (legislatura: number | undefined): ReactNode => (
      <>
        Os votos são o <strong>registro nominal de plenário</strong>
        {legislatura !== undefined && <> da {legislatura}ª legislatura</>}: cada deputado e senador, cada votação, como a casa publicou.
      </>
    ),
    casa: (nome: string, votacoes: number, secretas: number): ReactNode => (
      <>
        {nome}: <strong>{votacoes}</strong> votações em plenário
        {secretas > 0 && (
          <>
            , das quais <strong>{secretas}</strong> secretas, sem voto individual publicado, elas ficam fora de toda
            comparação
          </>
        )}
        .{' '}
      </>
    ),
    dadosAbertos: 'dados abertos',
    dinheiro: (
      <>
        O dinheiro vem de outras fontes oficiais: a cota parlamentar, da Câmara e do Senado; as emendas, do{' '}
        <LinkDeFonteComponent href={FONTES.emendas.url}>Portal da Transparência</LinkDeFonteComponent>; o financiamento de
        campanha, do <LinkDeFonteComponent href={FONTES.prestacaoDeContas.url}>TSE</LinkDeFonteComponent>. Cada item no
        site tem um link <span aria-hidden="true">↗</span> para a página oficial onde pode ser conferido. Ele aparece na ficha de
        cada parlamentar e em <Link to="/emendas">Dinheiro público</Link>.
      </>
    ),
  },

  questionario: {
    titulo: 'O questionário',
    oferecidas: (oferecidas: number, camara: number, senado: number): ReactNode => (
      <>
        Cada pergunta é uma afirmação sobre uma votação que aconteceu em plenário. Você responde <strong>{oferecidas}</strong>
        : <strong>{camara}</strong> da Câmara e <strong>{senado}</strong> do Senado.{' '}
        <Link to="/resultado">Começar as perguntas</Link>
      </>
    ),
    abertura: (abertura: number, desempate: number): ReactNode => (
      <>
        Da Câmara, <strong>{abertura}</strong> são iguais para todos. As outras <strong>{desempate}</strong> são escolhidas
        depois, entre as votações que separam os parlamentares que ficaram empatados com você.
      </>
    ),
    polaridade: (
      <>
        A afirmação é escrita para que concordar corresponda a um voto definido. Em parte das votações, concordar é votar{' '}
        <strong>Não</strong>: em 14% das votações nominais, "Sim" significa rejeitar. O site trata isso pergunta a pergunta.
      </>
    ),
    minimo: (porcento: number, minimo: number, oferecidas: number): ReactNode => (
      <>
        "Não sei" tira a pergunta da comparação. Para haver resultado, é preciso opinar em {porcento}% das perguntas
        oferecidas:{' '}
        <strong>
          {minimo} de {oferecidas}
        </strong>
        .
      </>
    ),
    painel:
      'Entre uma pergunta e outra aparece quem compareceu à votação, nunca como votou: ver o placar faria a maioria ' +
      'pesar na sua próxima resposta.',
  },

  afinidade: {
    titulo: 'A afinidade',
    comparaveis: (
      <>
        Com cada parlamentar, contam só as perguntas <strong>comparáveis</strong>: em que você opinou e ele votou Sim ou
        Não. Abstenção, ausência e obstrução não entram.
      </>
    ),
    base: 'O resultado é em quantas delas vocês votaram igual, sempre com a base: "8 de 11", nunca um percentual solto.',
    casas: (exibidos: number): ReactNode => (
      <>
        Deputados e senadores são comparados separadamente, porque não votam as mesmas matérias. O{' '}
        <Link to="/resultado">resultado</Link> mostra os{' '}
        <strong>{exibidos}</strong> mais próximos e os mais distantes de cada casa.
      </>
    ),
    grafo: (vizinhos: number): ReactNode => (
      <>
        No grafo, você é colocado entre os <strong>{vizinhos}</strong> parlamentares com quem mais concordou, e pesa mais
        quem concordou mais.
      </>
    ),
    naoERecomendacao: (
      <>
        <strong>Não é recomendação de voto</strong>, e não resume tudo o que um parlamentar defende: mede só estas votações.
      </>
    ),
  },

  grafo: {
    titulo: 'O grafo',
    abertura: (
      <>
        No <Link to="/parlamentares?vista=grafo">grafo dos parlamentares</Link>, dois ficam perto quando votaram igual
        muitas vezes. A comparação entre eles usa a legislatura inteira, com estes pesos:
      </>
    ),
    rito: 'Voto de rito (requerimento, adiamento) pesa zero: ele mede tática de obstrução.',
    grupos:
      'Os grupos, que dão a cor aos pontos, são encontrados pelo algoritmo de Louvain sobre as ligações. Saem só do ' +
      'voto, e por isso um mesmo partido aparece em vários grupos.',
    solto: 'Um ponto solto na borda votou pouco demais para ser comparado com alguém.',
  },

  naoFaz: {
    titulo: 'O que o site não faz',
    itens: [
      'Não recomenda voto.',
      'Não classifica ninguém como esquerda ou direita, e nenhuma cor tem partido.',
      'Não dá nota a parlamentar, partido ou governo.',
    ],
  },

  limites: {
    titulo: 'Limites conhecidos',
    historico: (maisAntiga: { numero: number; anoInicial: number } | undefined): ReactNode =>
      maisAntiga ? (
        <>
          A comparação com o seu voto usa só votações de plenário da legislatura corrente. O grafo e a ficha de cada parlamentar
          mostram também as anteriores, da {maisAntiga.numero}ª legislatura ({maisAntiga.anoInicial}) em diante.
        </>
      ) : (
        'A comparação com o seu voto usa só votações de plenário da legislatura corrente.'
      ),
    itens: [
      'Sua posição vale sobre as perguntas que você respondeu; a de cada parlamentar, sobre a legislatura inteira. A sua é bem menos precisa.',
      'Emenda só aparece na ficha quando o código do autor foi ligado a um parlamentar: emenda de bancada e de comissão não tem autor pessoa.',
      <>
        Os dados de orçamento do <Link to="/governo">governo federal</Link> cobrem o Poder Executivo federal. Em 2025, a dotação
        publicada deixa de fora a parcela condicionada à regra de ouro.
      </>,
    ],
  },

  tabela: {
    legenda: 'Parâmetros do grafo por casa',
    parametro: 'Parâmetro',
    merito: 'Voto de mérito',
    destaque: 'Voto em destaque (um trecho)',
    autoridade: 'Voto em autoridade (em pessoa)',
    recencia: 'Cada ano a mais de distância multiplica o peso por',
    minimo: 'Mínimo de votações em comum para comparar dois',
    vizinhos: 'Ligações mantidas por parlamentar',
    concluida: 'Análise concluída em',
    semRegistro: '—',
  },
} as const;
