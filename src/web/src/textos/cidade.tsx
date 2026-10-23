/** O texto da página da cidade (Pendência 90, fase 4). */
export const TEXTOS_DA_CIDADE = {
  lista: {
    titulo: 'Cidades',
    subtitulo: 'Quem foi eleito para governar cada cidade e quanto de emenda chegou em cada gestão',
    suaCidade: 'Abrir de novo a última que você escolheu:',
    oQueTem:
      'A página de cada cidade mostra os prefeitos, vices e governadores eleitos em cada gestão, o que chegou de emenda, as contas da prefeitura declaradas ao Tesouro e quem mandou e quem recebeu o dinheiro.',
  },
  titulo: 'Cidade',
  erro: 'Não foi possível carregar esta cidade agora. Tente de novo em instantes.',
  naoEncontrada: 'Este código não é de um município brasileiro.',
  verOMapa: 'Ver o mapa das emendas',
  habitantes: (n: number) => `${n.toLocaleString('pt-BR')} habitantes`,
  chegou: (desde: number | null) =>
    desde ? `em emendas chegaram a quem tem sede aqui, de ${desde} até hoje` : 'Nenhum pagamento de emenda na base',
  naPrefeitura: (valor: string) => `${valor} à prefeitura ou a órgão municipal`,
  noGovernoDoEstado: (valor: string) => `${valor} a órgãos do governo do estado, que têm sede na capital`,
  emEntidades: (valor: string) => `${valor} a entidades e empresas com sede aqui`,
  verNoMapa: 'Ver no mapa das emendas',
  quemMandou: 'Quem mandou e quem recebeu',
  caminhos: {
    ajuda: (total: string) =>
      `${total} chegaram a quem tem sede aqui. Cada fita é dinheiro pago: de quem mandou a emenda, pela área do gasto, até quem recebeu. A largura é o valor.`,
    rotulo: (total: string) => `Gráfico de fitas: ${total} em emendas, de quem mandou até quem recebeu na cidade`,
    colunas: ['Quem mandou', 'Área do gasto', 'Quem recebeu'] as const,
    outrosAutores: (n: number) => `Outros ${n} autores`,
    outrasAreas: (n: number) => `Outras ${n} áreas`,
    semAutor: 'Autor não identificado',
    semArea: 'Sem área',
    erro: 'Não foi possível carregar os caminhos do dinheiro agora.',
    carregando: 'Carregando os caminhos do dinheiro',
  },
  quemMandouAjuda: 'Todos os anos carregados, pelo ano da emenda. Para outro período, escolha no mapa das emendas.',
  quemMandouNoPeriodo: (de: number, ate: number) =>
    `Emendas de ${de === ate ? de : `${de} a ${ate}`}, o período escolhido no mapa. Os blocos de gestão acima usam todos os anos.`,
  gestoes: 'Quem foi eleito para governar',
  gestoesAjuda:
    'Cada bloco é um mandato municipal: quem o TSE registra como eleito, o governador eleito nos mesmos anos e o que chegou de emenda nesse período, pela data do pagamento.',
  comoLer: 'Como ler estes números',
  emAndamento: 'em andamento',
  prefeito: 'Prefeito eleito',
  prefeitos: 'Prefeitos eleitos',
  doisEleitos: 'Mais de um eleito para o mesmo período: houve eleição suplementar.',
  vice: 'Vice',
  governador: 'Governador eleito',
  viceGovernador: 'Vice-governador',
  semGovernador: 'Governador eleito antes de 1998, fora da base',
  chegouNaGestao: (valor: string) => `${valor} chegaram nesses anos`,
  partes: (prefeitura: string, entidades: string, estado: string | null) =>
    `${prefeitura} à prefeitura · ${estado ? `${estado} ao governo do estado · ` : ''}${entidades} a entidades`,
  contas: (receita: string, despesa: string) => `A prefeitura arrecadou ${receita} e pagou ${despesa} em despesas`,
  anosDeclarados: (n: number, de: number) =>
    n === de ? 'nos anos da gestão, pelo que declarou ao Tesouro' : `em ${n} dos ${de} anos; os outros ainda não têm declaração na base`,
  foraDoPadrao: (ano: number, valor: string) =>
    `${ano} ficou fora da soma: a prefeitura declarou ${valor} de receita, longe dos outros anos dela. Pode ser erro de digitação; confira no Siconfi.`,
  semPagamento: 'Sem pagamento de emenda na base nesses anos (a base começa em agosto de 2015).',
  desdeAgosto: 'só de agosto de 2015 em diante, quando a base começa',
  anteriores: (n: number, de: number, ate: number) =>
    `${n === 1 ? 'Gestão' : `${n} gestões`} de ${de} a ${ate}, sem pagamento de emenda na base`,
  avisos: [
    'O TSE registra quem foi eleito. Se o prefeito ou o governador saiu no meio do mandato, por cassação, impeachment, morte ou renúncia, a troca não aparece aqui. Quem assume é o vice, que está em cada bloco.',
    'A emenda é do deputado ou do senador que a apresentou. O valor de cada bloco é o que chegou à cidade durante aquela gestão.',
    'A cidade é a da sede de quem recebeu: entidade com sede aqui pode ter aplicado o dinheiro em outra cidade.',
  ],
  fonte:
    'Fontes: candidaturas eleitas do TSE, de 1998 a 2026; pagamentos de emendas do Portal da Transparência; contas da prefeitura declaradas ao Tesouro Nacional (Siconfi, DCA).',
};
