/** O texto da página da cidade (Pendência 90, fase 4). */
export const TEXTOS_DA_CIDADE = {
  titulo: 'Cidade',
  erro: 'Não foi possível carregar esta cidade agora. Tente de novo em instantes.',
  naoEncontrada: 'Este código não é de um município brasileiro.',
  verOMapa: 'Ver o mapa das emendas',
  habitantes: (n: number) => `${n.toLocaleString('pt-BR')} habitantes`,
  chegou: (desde: number | null) =>
    desde ? `em emendas chegaram a quem tem sede aqui, de ${desde} até hoje` : 'Nenhum pagamento de emenda na base',
  naPrefeitura: (valor: string) => `${valor} à prefeitura ou a órgão municipal`,
  emEntidades: (valor: string) => `${valor} a entidades e empresas com sede aqui`,
  verNoMapa: 'Ver no mapa das emendas',
  quemMandou: 'Quem mandou e quem recebeu',
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
  semGovernador: 'Governador eleito antes de 2002, fora da base',
  chegouNaGestao: (valor: string) => `${valor} chegaram nesses anos`,
  partes: (prefeitura: string, entidades: string) => `${prefeitura} à prefeitura · ${entidades} a entidades`,
  contas: (receita: string, despesa: string) => `A prefeitura arrecadou ${receita} e pagou ${despesa} em despesas`,
  anosDeclarados: (n: number, de: number) =>
    n === de ? 'nos anos da gestão, pelo que declarou ao Tesouro' : `em ${n} dos ${de} anos, os que estão declarados ao Tesouro na base`,
  semPagamento: 'Sem pagamento de emenda na base nesses anos (a base começa em agosto de 2015).',
  desdeAgosto: 'só de agosto de 2015 em diante, quando a base começa',
  anteriores: (n: number, de: number, ate: number) =>
    `${n === 1 ? 'Gestão' : `${n} gestões`} de ${de} a ${ate}, sem pagamento de emenda na base`,
  avisos: [
    'O TSE informa quem foi eleito, não quem governou de fato: cassação, morte ou renúncia no meio do mandato não aparecem aqui.',
    'A emenda é do deputado ou senador que a apresentou. O valor mostra o que chegou durante cada gestão, não o que o prefeito conseguiu.',
    'A cidade é a da sede de quem recebeu: entidade com sede aqui pode ter aplicado o dinheiro em outra cidade.',
  ],
  fonte:
    'Fontes: candidaturas eleitas do TSE, de 2000 a 2024; pagamentos de emendas do Portal da Transparência; contas da prefeitura declaradas ao Tesouro Nacional (Siconfi, DCA).',
};
