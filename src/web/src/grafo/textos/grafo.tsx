import type { ReactNode } from 'react';
import { TermoComponent } from '../../comum/componentes/Termo';

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
  pagina: {
    erro: 'Não foi possível carregar o grafo agora.',
    carregando: 'Carregando o grafo',
    contagem: (pontos: number, plural: string, ligacoes: number) => `${pontos} ${plural} · ${ligacoes} ligações`,
    semGrafoNoPeriodo: (casa: string, periodo: string) =>
      `${casa} não tem grafo em ${periodo}: havia votações abertas de menos para comparar quem vota com quem. Há grafo em `,
    analiseNaoRodou: (casa: string) =>
      `A análise ainda não rodou para ${casa} nesta legislatura. O grafo aparece depois da próxima execução do ETL.`,
    tituloDoAmpliado: (casa: string) => `Quem vota com quem · ${casa}`,
    deOndeVem: 'De onde vem',
    origem: (legislatura: number, periodo: string, abertas: { desde: string; ate: string } | null, plural: string): ReactNode => (
      <>
        Só entram votações de <TermoComponent nome="plenario" /> da{' '}
        <TermoComponent nome="legislatura">{legislatura}ª legislatura</TermoComponent>, de {periodo}
        {abertas && (
          <>
            . As abertas vão de <strong>{abertas.desde}</strong> a <strong>{abertas.ate}</strong>
          </>
        )}
        . Dois {plural} só se ligam se votaram juntos vezes suficientes: com poucas votações em comum, votar igual seria
        coincidência.
      </>
    ),
    sigiloDoSenado: (votacoes: number, secretas: number): ReactNode => (
      <>
        <strong>O Senado vota em segredo com frequência.</strong> Das {votacoes} votações de plenário da legislatura,{' '}
        {secretas} são secretas, e nelas não há voto individual publicado. Este desenho se apoia nas {votacoes - secretas}{' '}
        abertas, e é por isso que ele tem menos ligações e mais pontos soltos que o da Câmara.
      </>
    ),
    osGrupos: 'Os grupos',
    gruposAjuda: (
      <>
        Cada <TermoComponent nome="comunidade" /> é formado pelo <strong>voto</strong>, não pelo{' '}
        <TermoComponent nome="partido" />, e é por isso que um mesmo partido aparece em vários.
      </>
    ),
    grupo: (numero: number, quantos: number, plural: string) => `Grupo ${numero} · ${quantos} ${plural}`,
    casaLegislativa: 'Casa legislativa',
    destacar: 'Destacar',
    destacarPartido: 'Destacar um partido',
    todosOsPartidos: 'todos os partidos',
    destacarEstado: 'Destacar um estado',
    todosOsEstados: 'todos os estados',
    emDestaque: (destacados: number, total: number) => `${destacados} de ${total} em destaque`,
    tirarDestaque: 'Tirar o destaque',
  },

  /**
   * Buracos da própria fonte, ditos onde o desenho é afetado (Pendência 58), por casa e legislatura.
   *
   * MEDIDO: Em 2026-10-02 (achado #37): os dados abertos do Senado não têm as votações de 2015 nem
   * as do começo de 2016, em nenhum dos três serviços.
   */
  lacunasDoAcervo: {
    'SENADO-55':
      'Os dados abertos do Senado não trazem as votações de 2015 nem as do começo de 2016, ' +
      'como a da MP 665 e a do julgamento do impeachment. Elas estão só no Diário do Senado, ' +
      'e este desenho fica sem elas.',
  } as Record<string, string>,
} as const;
