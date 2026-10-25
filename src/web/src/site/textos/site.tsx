import type { ReactNode } from 'react';

/**
 * O texto que aparece em toda tela: cabeçalho, rodapé, menu da conta, busca do cabeçalho, faixa de
 * procedência, barra de período, tema, entrada com o Google e os controles do tour.
 */
export const TEXTOS_DO_SITE = {
  marca: 'Registro Aberto',
  marcaInicio: 'Registro Aberto — início',
  carregando: 'carregando…',
  carregandoAPagina: 'Carregando a página',
  carregandoOPerfil: 'Carregando o perfil',
  voltar: 'Voltar',
  navegacao: 'Navegação principal',
  destinos: {
    parlamentares: 'Políticos',
    compare: 'Compare seu voto',
    dinheiro: 'Dinheiro público',
  },
  menuDoDinheiro: {
    abrir: 'Ver as seções de Dinheiro público',
    doGoverno: (aba: string) => `${aba} do governo federal`,
  },
  abasDoDinheiro: {
    emendas: 'Emendas por cidade',
    cidades: 'Cidades',
    entidades: 'Entidades',
    governo: 'Governo federal',
  },
  abasDoGoverno: {
    rotulo: 'Gastos do governo federal',
    orcamento: 'Orçamento',
    cartoes: 'Cartões',
    viagens: 'Viagens',
    compras: 'Compras e contratos',
  },

  rodape: {
    oQueE: 'O que é',
    oQueETexto:
      'Mostra como cada deputado e senador votou, quem vota parecido com quem e com quem você concorda, a partir do ' +
      'voto registrado. Mostra também o dinheiro do mandato: a cota parlamentar, as emendas e a cidade de quem as ' +
      'recebeu, o financiamento de campanha, o patrimônio declarado e o orçamento do governo federal.',
    procedencia: 'Procedência',
    procedenciaTexto: (maisAntiga: number | undefined, corrente: number | undefined) =>
      'Votos dos Dados Abertos da Câmara dos Deputados e do Senado Federal' +
      (maisAntiga && corrente
        ? maisAntiga === corrente
          ? `, ${corrente}ª legislatura`
          : `, da ${maisAntiga}ª à ${corrente}ª legislatura`
        : '') +
      '. Emendas, pagamentos e orçamento do Portal da Transparência; campanha e patrimônio do TSE; sede das ' +
      'entidades da Receita Federal; população do IBGE. Nenhum voto é editado: a curadoria reescreve a ementa e ' +
      'registra a polaridade da votação. No modo auditoria, cada número mostra o arquivo de onde veio.',
    seusDados: 'Seus dados',
    comoCalculamos: 'Como calculamos',
    privacidade: 'Política de privacidade',
    apagarConta: 'Apagar minha conta',
    aviso: (
      <>
        <strong>Não é recomendação de voto</strong> e não representa o programa completo de nenhum parlamentar.
      </>
    ),
  },

  menu: {
    conta: 'Conta',
    entrar: 'Entrar',
    menu: 'Menu',
    minhaConta: 'Minha conta',
    comoFunciona: 'Como funciona o site',
    auditoria: (ligado: boolean) => `Modo auditoria: ${ligado ? 'ligado' : 'desligado'}`,
    tema: 'Tema',
    sair: 'Sair',
  },

  busca: {
    abrir: 'Abrir a busca',
    rotulo: 'Buscar político, cidade ou entidade',
    placeholder: 'Nome ou cidade',
    resultados: 'Resultados da busca',
    nada: (termo: string) => `Nada encontrado para “${termo}”.`,
    grupos: { parlamentar: 'Parlamentares', politico: 'Outros cargos', cidade: 'Cidades', entidade: 'Entidades' },
    senado: 'Senado',
    camara: 'Câmara',
    ate: (ano: string) => `até ${ano}`,
    emendasDaCidade: 'prefeitos, governadores e emendas da cidade',
  },

  faixa: {
    dadosPublicos: 'Dados públicos',
    longa: 'Votos da Câmara e do Senado, eleitos do TSE e dinheiro público',
    curta: 'Votos, eleitos e dinheiro',
    perguntasDa: (legislatura: number) => `Perguntas da ${legislatura}ª legislatura`,
    todos: 'Todos os períodos',
    legislatura: (numero: number, periodo: string) => `${numero}ª legislatura · ${periodo}`,
  },

  periodo: {
    rotulo: 'Período',
    legislatura: 'Legislatura',
    seletor: 'Período de quatro anos do Congresso',
    todas: 'Cada parlamentar com o último mandato',
    mesmoPeriodo: (numero: number) => `${numero}ª legislatura · Câmara e Senado no mesmo período`,
    anterior: (periodo: string): ReactNode => (
      <>
        Você está vendo <strong>{periodo}</strong>, um período anterior.
      </>
    ),
    voltarPara: (periodo: string) => `Voltar para ${periodo}`,
  },

  tema: {
    rotulo: 'Tema da interface',
    nomes: { claro: 'Claro', sistema: 'Sistema', escuro: 'Escuro' },
    opcao: (nome: string) => `Tema ${nome.toLowerCase()}`,
  },

  google: {
    erro: 'Não foi possível entrar agora. Tente de novo.',
    semConfiguracao: (
      <>
        Login indisponível: falta <code>VITE_GOOGLE_CLIENT_ID</code> no ambiente. Sem ele não há como entrar; o resto do
        site funciona.
      </>
    ),
    falhou: (status: number) => `Login falhou (${status}).`,
    scriptFalhou: 'Falha ao carregar o Google.',
  },

  ajuda: {
    rotulo: 'Como o site funciona',
    rotuloComTela: 'Ajuda: como ler esta tela',
  },

  tour: {
    passo: (numero: number, total: number) => `Passo ${numero} de ${total}`,
    pular: 'Pular',
    anterior: 'Anterior',
    concluir: 'Concluir',
    proximo: 'Próximo',
  },
} as const;
