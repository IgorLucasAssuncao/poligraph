import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { FONTES } from '../fontes';

/**
 * O texto de "Como calculamos". Os números entram como argumento: a página não escreve à mão
 * nenhum parâmetro do cálculo (ver `MetodologiaComponent`).
 *
 * DECISÃO (autor, 2026-10-24): frase direta, termo técnico explicado onde aparece (regra de ouro, dotação, votação nominal),
 * e sem a fila de "não é isto, é aquilo".
 */
export const TEXTOS_DA_METODOLOGIA = {
  titulo: 'Como calculamos',
  abertura:
    'O site compara as suas respostas com o voto que cada deputado e senador registrou no plenário. Os números desta página ' +
    'saem do mesmo cálculo que monta o seu resultado, então mudam junto com ele.',
  erro: 'Não foi possível carregar os parâmetros agora.',
  carregando: 'Carregando a metodologia',

  dados: {
    titulo: 'De onde vêm os dados',
    votos: (legislatura: number | undefined): ReactNode => (
      <>
        Os votos vêm das <strong>votações nominais de plenário</strong>
        {legislatura !== undefined && <> da {legislatura}ª legislatura</>}, aquelas em que a Câmara e o Senado publicam como
        cada parlamentar votou.
      </>
    ),
    casa: (nome: string, votacoes: number, secretas: number): ReactNode => (
      <>
        {nome}: <strong>{votacoes.toLocaleString('pt-BR')}</strong> votações em plenário
        {secretas > 0 && (
          <>
            . Em <strong>{secretas.toLocaleString('pt-BR')}</strong> delas o voto foi secreto e a casa não publica quem votou o quê, então elas ficam
            de fora
          </>
        )}
        .{' '}
      </>
    ),
    dadosAbertos: 'dados abertos',
    dinheiro: (
      <>
        Os gastos vêm de outras fontes oficiais. A cota parlamentar sai da Câmara e do Senado, as emendas saem do{' '}
        <LinkDeFonteComponent href={FONTES.emendas.url}>Portal da Transparência</LinkDeFonteComponent> e o dinheiro de campanha
        sai do <LinkDeFonteComponent href={FONTES.prestacaoDeContas.url}>TSE</LinkDeFonteComponent>. Perto de cada número há um
        link <span aria-hidden="true">↗</span> para a página oficial, onde dá para conferir. Esses gastos estão na ficha de cada
        parlamentar e em <Link to="/emendas">Dinheiro público</Link>.
      </>
    ),
  },

  questionario: {
    titulo: 'O questionário',
    oferecidas: (oferecidas: number, camara: number, senado: number): ReactNode => (
      <>
        Cada pergunta descreve uma votação que aconteceu no plenário. São <strong>{oferecidas}</strong> perguntas:{' '}
        <strong>{camara}</strong> da Câmara e <strong>{senado}</strong> do Senado. <Link to="/resultado">Começar as perguntas</Link>
      </>
    ),
    abertura: (abertura: number, desempate: number): ReactNode => (
      <>
        Na Câmara, as <strong>{abertura}</strong> primeiras são as mesmas para todo mundo. As outras <strong>{desempate}</strong>{' '}
        dependem das suas respostas: o site escolhe as votações que mais separam os deputados que ficaram empatados com você.
      </>
    ),
    polaridade: (
      <>
        Concordar com a frase corresponde sempre a um voto certo, Sim ou Não. Às vezes esse voto é <strong>Não</strong>: em 14%
        das votações nominais, votar Sim quer dizer rejeitar a proposta. Cada pergunta foi conferida com isso em mente.
      </>
    ),
    minimo: (porcento: number, minimo: number, oferecidas: number): ReactNode => (
      <>
        Quem responde "Não sei" tira aquela pergunta da conta. Para sair um resultado, é preciso opinar em {porcento}% das
        perguntas, ou seja,{' '}
        <strong>
          {minimo} de {oferecidas}
        </strong>
        .
      </>
    ),
    painel:
      'Entre uma pergunta e outra, o site mostra quantos parlamentares estavam na votação, e não o placar. Saber como a ' +
      'maioria votou poderia puxar a sua próxima resposta.',
  },

  afinidade: {
    titulo: 'A afinidade',
    comparaveis: (
      <>
        Com cada parlamentar, contam as perguntas em que vocês dois têm posição: você respondeu e ele votou Sim ou Não. Se ele
        se absteve, faltou ou obstruiu a votação, a pergunta não entra na conta com ele.
      </>
    ),
    base: 'O resultado diz em quantas dessas perguntas vocês votaram igual, sempre junto com o total, como "8 de 11".',
    casas: (exibidos: number): ReactNode => (
      <>
        Deputados e senadores ficam em listas separadas, porque cada casa vota matérias diferentes. O{' '}
        <Link to="/resultado">resultado</Link> mostra os <strong>{exibidos}</strong> mais próximos e os mais distantes de cada
        casa.
      </>
    ),
    grafo: (vizinhos: number): ReactNode => (
      <>
        No grafo, o seu ponto fica perto dos <strong>{vizinhos}</strong> parlamentares com quem você mais concordou, e mais
        perto de quem concordou mais.
      </>
    ),
    naoERecomendacao: (
      <>
        A afinidade mede só estas votações. Ela não indica em quem votar e não resume tudo o que um parlamentar pensa.
      </>
    ),
  },

  grafo: {
    titulo: 'O grafo',
    abertura: (
      <>
        No <Link to="/parlamentares?vista=grafo">grafo dos parlamentares</Link>, dois parlamentares ficam perto quando votaram
        igual muitas vezes ao longo da legislatura. Os pesos de cada tipo de voto estão na tabela:
      </>
    ),
    rito: 'Votos de procedimento, como pedido de urgência ou de adiamento, não contam: eles medem a estratégia do dia, e não a opinião sobre a proposta.',
    grupos:
      'As cores mostram grupos de parlamentares que votam parecido, encontrados pelo método de Louvain, que procura grupos ' +
      'muito ligados entre si. Os grupos saem só dos votos, por isso um mesmo partido pode aparecer espalhado em vários.',
    solto: 'Um ponto sozinho na borda é de alguém que votou poucas vezes para ser comparado com os outros.',
  },

  naoFaz: {
    titulo: 'O que o site não faz',
    itens: [
      'Indicar em quem votar.',
      'Dizer quem é de esquerda ou de direita. As cores do grafo são grupos de voto, e nenhuma cor representa partido.',
      'Dar nota a parlamentar, partido ou governo.',
    ],
  },

  limites: {
    titulo: 'Limites conhecidos',
    historico: (maisAntiga: { numero: number; anoInicial: number } | undefined): ReactNode =>
      maisAntiga ? (
        <>
          A comparação com o seu voto usa as votações de plenário da legislatura atual. O grafo e a ficha de cada parlamentar
          também mostram as anteriores, desde a {maisAntiga.numero}ª legislatura, que começou em {maisAntiga.anoInicial}.
        </>
      ) : (
        'A comparação com o seu voto usa as votações de plenário da legislatura atual.'
      ),
    itens: [
      'A posição de cada parlamentar vem da legislatura inteira. A sua vem só das perguntas que você respondeu, então é bem menos precisa.',
      'Uma emenda só aparece na ficha quando o Portal diz qual parlamentar a apresentou. Emenda de bancada e de comissão é assinada pelo grupo, e fica na página de Dinheiro público.',
      <>
        Os números do <Link to="/governo">governo federal</Link> são os do Poder Executivo: Congresso e Justiça aparecem só em
        linhas pequenas. Em 2025, o orçamento publicado deixou de fora R$ 228,5 bi que dependiam da regra de ouro, a regra da
        Constituição que proíbe pegar empréstimo para pagar despesa do dia a dia sem autorização do Congresso. Depois de
        autorizado, esse dinheiro foi gasto, e por isso o gasto de 2025 passa do orçamento publicado.
      </>,
    ],
  },

  tabela: {
    legenda: 'Parâmetros do grafo por casa',
    parametro: 'Parâmetro',
    merito: 'Voto sobre a proposta',
    destaque: 'Voto em destaque (um trecho da proposta)',
    autoridade: 'Voto em autoridade (escolha de uma pessoa)',
    recencia: 'Cada ano a mais de distância multiplica o peso por',
    minimo: 'Mínimo de votações em comum para comparar dois parlamentares',
    vizinhos: 'Ligações mantidas por parlamentar',
    concluida: 'Análise concluída em',
    semRegistro: '—',
  },
} as const;
