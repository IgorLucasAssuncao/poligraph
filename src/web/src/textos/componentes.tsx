import type { ReactNode } from 'react';
import { TermoComponent } from '../componentes/Termo';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto dos componentes reaproveitados em várias telas: botões, listas, mapa, legendas. */
export const TEXTOS_DOS_COMPONENTES = {
  mostrarMais: {
    carregando: 'Carregando…',
    rotulo: (proximos: number) => `Mostrar mais ${proximos}`,
    restantes: (quantos: string) => `${quantos} ainda não mostrados`,
    erro: 'Não foi possível carregar. Tente de novo.',
  },
  seguir: {
    entreParaSeguir: 'Entre com o Google para seguir',
    seguir: 'Seguir',
    privacidade: 'Política de privacidade',
  },
  baixarCsv: {
    rotulo: 'Baixar CSV',
    preparando: 'Preparando…',
    erro: 'Não foi possível baixar. Tente de novo.',
  },
  linkDeFonte: ' (abre o site oficial em nova aba)',
  novaAba: ' (abre em nova aba)',
  abasDoDinheiro: 'Dinheiro público',
  privacidade: 'Política de privacidade',

  painel: {
    rotulo: (posicionados: number, total: number) => `${posicionados} de ${total} parlamentares se posicionaram nesta votação`,
    legenda: (posicionados: number, total: number): ReactNode => (
      <>
        <strong>{posicionados}</strong> de {total} se posicionaram
      </>
    ),
  },

  periodo: {
    emAndamento: (ano: number) => `${ano} (em andamento)`,
    todosOsAnos: 'Todos os anos',
    de: 'De',
    ate: 'até',
  },

  legislatura: {
    rotulo: 'Período',
    todos: 'Todos os períodos',
    numero: (numero: number) => `${numero}ª legislatura`,
    atual: ' · atual',
  },

  sugestoes: {
    titulo: 'Quem seguir',
    dica: (nome: string, partido: string, uf: string | null) => `${nome} · ${partido}${uf ? ` · ${uf}` : ''}`,
    criterio: 'Ordenado por número de votações registradas.',
    verTodos: 'Ver todos',
  },

  vistas: {
    rotulo: 'Como ver os parlamentares',
    lista: 'Lista',
    listaAjuda: 'Procurar por nome, partido ou estado',
    grafo: 'Grafo',
    grafoAjuda: 'Quem vota com quem',
    cargos: 'Todos os cargos',
    cargosAjuda: 'Governadores, prefeitos, deputados estaduais e vices, pelo TSE',
  },

  grafoAmpliado: {
    titulo: 'Quem vota com quem',
    resumo: (titulo: string, pontos: number, plural: string, ligacoes: number) =>
      `${titulo} — ${pontos} ${plural}, ${ligacoes} ligações`,
    parlamentares: 'parlamentares',
    voltar: ' Voltar',
  },

  legendaDoGrafo: (
    <>
      <strong>A posição não indica orientação política</strong>: quem vota junto se atrai, e é só isso que o desenho mostra.
      Nas bordas ficam os que votaram pouco demais para serem comparados com alguém.
    </>
  ),

  listaDoGrafo: {
    resumo: 'Ver o grafo como lista',
    ajuda:
      'A mesma informação do desenho, em texto: cada parlamentar seguido de quem mais votou junto com ele. A ordem desta ' +
      'lista não é política: quem aparece primeiro é apenas quem tem mais ligações.',
    comparaveis: (votacoes: number) => ` · ${votacoes} votações comparáveis`,
    semLigacoes: 'sem ligações: precisa de ao menos 20 votações em comum com alguém',
    votaJuntoCom: (nomes: string) => `vota junto com ${nomes}`,
  },

  /** Os rótulos do eixo do grafo. Sem caixa alta de ênfase: o sentido está nas palavras. */
  eixos: {
    alinhamento: {
      esquerda: 'quase nunca votou com o Governo',
      direita: 'quase sempre votou com o Governo',
      legenda: 'a posição horizontal é a própria medida de alinhamento',
    },
    maisGoverno: 'vota mais com o Governo',
    menosGoverno: 'vota menos com o Governo',
    legenda: 'quanto o parlamentar votou como a bancada do Governo orientou',
    verticalSemMedida: 'a vertical não mede nada: é só espaço para os pontos não se sobreporem',
    verticalSegunda: 'a vertical é a segunda maior diferença, e explica bem menos que a horizontal',
    voce: 'você',
  },

  graficos: {
    dica: 'Passe o mouse ou use Tab para ver o valor de cada ano.',
    dicaComEscolha: 'Passe o mouse para ver o valor. Clique num ano para ver só ele.',
    verTabela: 'Ver como tabela',
    ano: 'Ano',
    deCadaCem: (parte: number) => `${parte} de cada R$ 100`,
  },

  compartilhar: {
    rotulo: 'Compartilhar',
    texto: (nome: string) => `${nome} no Registro Aberto`,
    copiado: 'Link copiado',
    semCopiar: (url: string) => `Copie o link: ${url}`,
  },

  mandatos: {
    verOsOutros: (n: number) => (n === 1 ? 'Ver o outro mandato' : `Ver os outros ${n} mandatos`),
    votouDe: 'Votou de ',
    ate: ' a ',
    naLegislatura: ' · legislatura ',
    rotulo: 'Legislaturas em que votou',
    senadoCobreDuas: ' · no Senado, um mandato cobre duas',
    senado: 'Senado',
    camara: 'Câmara',
  },

  redes: {
    daCamara: 'Redes',
    doTse: 'Redes declaradas ao TSE',
    nomes: {
      INSTAGRAM: 'Instagram',
      FACEBOOK: 'Facebook',
      X: 'X (Twitter)',
      YOUTUBE: 'YouTube',
      TIKTOK: 'TikTok',
    },
  },

  mapa: {
    erro: 'Não foi possível carregar o mapa.',
    descricao: (nome: string, valor: string | null) => `${nome}: ${valor ?? 'nenhum pagamento'}`,
    faixa: (de: string, ate: string) => `${de} a ${ate}`,
    ouMais: (de: string) => `${de} ou mais`,
    ate: (ate: string) => `até ${ate}`,
    semPagamento: ' sem pagamento',
  },

  autores: {
    senado: 'Senado',
    camara: 'Câmara',
    semPagina: 'Sem página neste site',
    emendas: (quantas: number) => `${quantas} ${plural(quantas, 'emenda', 'emendas')}`,
    coletivos: {
      BANCADA: 'Bancada estadual',
      COMISSAO: 'Comissão',
      OUTRO: 'Autor coletivo',
    },
    grupos: (total: string): ReactNode => (
      <>
        {total} vieram de grupos de parlamentares: a <TermoComponent nome="emendaDeBancada">bancada</TermoComponent> reúne
        os parlamentares de um estado, e a <TermoComponent nome="emendaDeComissao">comissão</TermoComponent> é um grupo de
        trabalho do Congresso.
      </>
    ),
  },

  privacidadePagina: {
    escolhas: 'Suas escolhas',
    versao: (versao: string): ReactNode => (
      <>
        Você aceitou a versão <code>{versao}</code> deste texto. Se mudar de ideia sobre a medição de uso, pode refazer a
        escolha:
      </>
    ),
    rever: 'Rever meu consentimento',
    contato: 'Para pedir seus dados ou a exclusão da conta, escreva para',
  },
} as const;
