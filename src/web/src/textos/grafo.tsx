import type { ReactNode } from 'react';

/** O texto do desenho do grafo: controles, ajustes, busca, dicas e a explicação de cada layout. */
export const TEXTOS_DO_GRAFO = {
  /**
   * ATENÇÃO: A explicação de cada layout vive JUNTO do seletor, não num rodapé. No de alinhamento a
   * coordenada É a medida, e o texto diz que o meio do eixo não é moderação.
   */
  layouts: {
    molas: {
      rotulo: 'Molas',
      titulo: 'Ligações como molas',
      texto:
        'Os pontos se atraem quando votam junto e se afastam quando votam diferente. ' +
        'É a vista que mostra os grupos. Aqui os eixos não significam nada: girar ou ' +
        'espelhar a figura não muda o que ela diz.',
    },
    alinhamento: {
      rotulo: 'Alinhamento',
      titulo: 'Alinhamento com o Governo',
      texto:
        'Cada ponto é colocado conforme votou como o Governo pediu: à esquerda quem ' +
        'quase nunca seguiu, à direita quem quase sempre seguiu. A posição horizontal é ' +
        'a própria medida desse alinhamento e nada diz sobre esquerda ou direita. O meio do ' +
        'eixo mostra onde está a maioria, sem indicar moderação.',
    },
  },

  tela: {
    dicaDasLigacoes: 'Aproxime, ou passe o mouse sobre um ponto, para ver as ligações',
    avisoDaRoda: 'Use Ctrl + roda do mouse para aproximar',
    rotulo: (pontos: number, ligacoes: number, aVista: number) =>
      `Grafo de ${pontos} parlamentares e ${ligacoes} ligações, ${aVista} à vista. ` +
      'Use as setas para mover, mais e menos para aproximar, zero para enquadrar. ' +
      'A lista logo abaixo traz a mesma informação em texto.',
    aproximar: 'Aproximar',
    afastar: 'Afastar',
    enquadrar: 'Enquadrar tudo',
    desfazer: 'Desfazer tudo e voltar ao desenho original',
    desfazerTitulo: 'Voltar ao desenho original do ETL',
    telaCheia: ' Abrir em tela cheia',
    ajustes: 'Ajustes do desenho',
    comoPosicionar: 'Como posicionar os pontos',
    explicacaoDoLayout: (titulo: string, texto: string): ReactNode => (
      <>
        <strong>{titulo}.</strong> {texto}
      </>
    ),
    soAsFortes: 'Só ligações mais fortes',
    deTotal: (aVista: number, total: number) => `${aVista} de ${total}`,
    rostos: 'Rostos ao aproximar',
    eixos: 'Mostrar os eixos',
    semEixo:
      'Esta casa não tem eixo com nome: o Senado não publica a orientação das bancadas, então não há como dizer o que ' +
      'separa um lado do outro.',
    comoUsar:
      'Rolar aproxima · arrastar o fundo move o plano · arrastar um ponto reposiciona ele · clicar destaca · clicar ' +
      'duas vezes abre o perfil',
    ligacoes: (quantas: number) => ` · ${quantas} ligações`,
    soAsConexoes: 'Só as conexões dele',
    voltar: 'Voltar ao grafo',
    abrirPerfil: 'Abrir perfil',
    limpar: 'Limpar',
  },

  busca: {
    rotulo: 'Procurar parlamentar no grafo',
    titulo: 'Procurar parlamentar',
    placeholder: 'Procurar pelo nome',
    fechar: 'Fechar busca',
    nenhum: 'Nenhum parlamentar com esse nome.',
  },

  dica: {
    aresta: (porcento: number, comuns: number) =>
      `votaram igual em ${porcento}% das ${comuns} votações em que os dois se posicionaram`,
    cosseno: (valor: string) => `cosseno ${valor}`,
    no: (votacoes: number, grupo: number) => `${votacoes} votações comparáveis · grupo ${grupo}`,
  },
} as const;
