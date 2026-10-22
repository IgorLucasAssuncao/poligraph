/**
 * Os tours guiados e a memória de quem já viu cada um.
 *
 * Há um tour do site, aberto pelo botão "Como funciona" do cabeçalho, e um por tela,
 * aberto pelo botão "Entenda esta tela". O do site é curto de propósito: mostra onde
 * cada coisa fica. Explicar como ler o grafo cabe no tour do grafo, que a pessoa abre
 * quando está olhando para ele.
 *
 * Cada passo aponta para um elemento marcado com `data-tour="<alvo>"`. Se o elemento
 * não aparece na tela, o passo é pulado: `opcional` só registra que isso é esperado.
 *
 * Os tours de tela são montados por função, com o dado da tela: o número de ligações
 * de cada ponto vem da execução que desenhou o grafo, e não de um texto fixo que
 * ficaria errado em silêncio quando o ETL mudasse.
 */
export type PassoDoTour = {
  /** Rota onde o alvo vive; `null` mantém a página atual. */
  rota: string | null;
  alvo: string;
  titulo: string;
  texto: string;
  opcional?: boolean;
};

export type NomeDoTour = 'site' | 'auditoria' | 'grafo' | 'ficha' | 'questionario' | 'resultado' | 'emendas' | 'governo';

/** Como o menu de ajuda (o "?" do cabeçalho) apresenta cada tour. */
export const APRESENTACAO_DO_TOUR: Record<NomeDoTour, { titulo: string; texto: string }> = {
  site: {
    titulo: 'Como o site funciona',
    texto: 'Um minuto: de onde vêm os dados e como o resultado é calculado.',
  },
  auditoria: {
    titulo: 'O modo auditoria',
    texto: 'Como abrir a origem de um número: a regra da conta e os arquivos oficiais de onde ele saiu.',
  },
  grafo: {
    titulo: 'Como ler o grafo',
    texto: 'O que cada ponto, linha e cor quer dizer, e dois cuidados ao ler a figura.',
  },
  ficha: {
    titulo: 'Como ler a ficha',
    texto: 'De onde vem cada número desta página e sobre qual base ele foi contado.',
  },
  questionario: {
    titulo: 'Antes de responder',
    texto: 'O que cada pergunta é, o que o "Não sei" faz e por que o placar não aparece.',
  },
  governo: {
    titulo: 'Como ler esta página',
    texto: 'O que cada número conta, o que fica de fora e onde estão os detalhes técnicos.',
  },
  emendas: {
    titulo: 'Como ler o mapa',
    texto: 'De onde vem a cidade de cada pagamento, quem são os autores e o que fica fora do mapa.',
  },
  resultado: {
    titulo: 'Como ler o resultado',
    texto: 'O que o número conta, o que o losango no grafo significa e como usar o resultado.',
  },
};

export const PASSOS_DO_SITE: PassoDoTour[] = [
  {
    rota: '/',
    alvo: 'procedencia',
    titulo: 'De onde vêm os dados',
    texto:
      'Tudo o que o site mostra sai do registro nominal de votação que a Câmara e o ' +
      'Senado publicam. Nenhum voto é editado.',
  },
  {
    rota: '/',
    alvo: 'comecar',
    titulo: 'Comece pelo questionário',
    texto:
      'Cada pergunta corresponde a uma votação que aconteceu em plenário. Você diz se ' +
      'concorda, e o site compara sua resposta com o voto de cada parlamentar.',
  },
  {
    rota: null,
    alvo: 'busca-global',
    titulo: 'Busque por nome',
    texto:
      'Um deputado, um senador, a sua cidade ou uma entidade que recebeu dinheiro público: ' +
      'a busca procura nos três e mostra cada resposta no seu grupo.',
  },
  {
    rota: null,
    alvo: 'modo-auditoria',
    titulo: 'Confira de onde veio cada número',
    texto:
      'Ligue o modo auditoria e os números ganham um sublinhado pontilhado. Clicando em um, ' +
      'você vê a regra da conta e o arquivo oficial de onde ele saiu.',
  },
  {
    rota: '/parlamentares',
    alvo: 'busca',
    titulo: 'Procure qualquer parlamentar',
    texto:
      'A ficha de cada deputado e senador mostra como ele votou, quanto gastou da cota, ' +
      'as emendas que destinou e quem financiou a campanha.',
  },
  {
    rota: '/parlamentares',
    alvo: 'vistas',
    titulo: 'Lista ou grafo',
    texto:
      'No grafo, cada ponto é um parlamentar, e quem vota parecido fica perto. A posição ' +
      'sai dos votos, não do partido.',
  },
  {
    rota: '/resultado',
    alvo: 'pergunta',
    titulo: 'Responda no seu ritmo',
    texto:
      'Depois de cada resposta aparece o painel da votação: quem compareceu, nunca como ' +
      'votou. Assim a maioria não influencia a sua próxima resposta.',
    opcional: true,
  },
  {
    rota: null,
    alvo: 'como-funciona',
    titulo: 'Veja de novo quando quiser',
    texto:
      'Este menu abre o tour outra vez e guarda o tema e a sua conta. Cada tela tem o seu ' +
      '"Entenda esta tela". O resultado mostra com quem você concorda, e não é uma ' +
      'recomendação de voto.',
  },
];

/**
 * O tour do modo auditoria, aberto na primeira vez que a pessoa liga o interruptor.
 *
 * DECISÃO: Abre sozinho, sem oferta: ligar o modo já é o pedido. São três passos, e o do meio
 * é opcional porque nem toda tela tem número com procedência.
 */
export const PASSOS_DA_AUDITORIA: PassoDoTour[] = [
  {
    rota: null,
    alvo: 'modo-auditoria',
    titulo: 'Modo auditoria ligado',
    texto:
      'Agora os números que têm origem registrada aparecem com sublinhado pontilhado, nesta ' +
      'tela e nas outras.',
  },
  {
    rota: null,
    alvo: 'numero-com-procedencia',
    titulo: 'Clique num número sublinhado',
    texto:
      'Abre um painel com a regra da conta, quantas linhas entraram e cada arquivo oficial ' +
      'usado: endereço, data da coleta e o código SHA-256, que permite conferir se o arquivo ' +
      'é o mesmo publicado pela fonte.',
    opcional: true,
  },
  {
    rota: null,
    alvo: 'modo-auditoria',
    titulo: 'Desligue quando quiser',
    texto:
      'A escolha fica guardada neste navegador, e vale sem conta. Desligado, o site volta a ' +
      'mostrar só os números.',
  },
];

/**
 * O tour do grafo.
 *
 * Os passos seguem a ordem de leitura da figura: o que é o ponto, o que é a linha, o
 * que é a cor, e então as duas conclusões que o desenho convida a tirar e que o dado
 * desmente (achado #27). Os controles vêm por último: só servem a quem já sabe ler.
 */
export function passosDoGrafo({
  singular,
  plural,
  vizinhosPorNo,
  temAlinhamento,
}: {
  singular: string;
  plural: string;
  vizinhosPorNo: number;
  /** Só existe onde há orientação do Governo registrada: a Câmara. */
  temAlinhamento: boolean;
}): PassoDoTour[] {
  const ligacoes =
    vizinhosPorNo > 0
      ? `Cada ${singular} mantém as ${vizinhosPorNo} ligações mais fortes que tem, e pode ` +
        'ganhar outras de quem o escolheu entre as suas. '
      : '';

  return [
    {
      rota: null,
      alvo: 'grafo-casas',
      titulo: 'Uma figura por casa',
      texto:
        'Deputados e senadores não votam as mesmas matérias, então cada casa tem o seu ' +
        'grafo. Nenhuma linha liga as duas, e as duas figuras não se comparam ponto a ponto.',
    },
    {
      rota: null,
      alvo: 'grafo-desenho',
      titulo: `Cada ponto é um ${singular}`,
      texto:
        `Estão aqui os ${plural} que votaram nesta legislatura. Passe o mouse sobre um ` +
        'ponto para ver nome, partido e quantas votações ele tem; clique para destacá-lo ' +
        'e dê um duplo clique para abrir a ficha.',
    },
    {
      rota: null,
      alvo: 'grafo-desenho',
      titulo: 'A linha liga quem vota igual',
      texto:
        ligacoes +
        'Só se ligam pares com votações em comum suficientes para que votar igual não ' +
        'seja coincidência. Quanto mais grossa a linha, mais vezes votaram igual; passe ' +
        'o mouse sobre ela para ver em quantas de quantas votações.',
    },
    {
      rota: null,
      alvo: 'grafo-grupos',
      titulo: 'A cor mostra o grupo de voto',
      texto:
        'Os grupos são encontrados a partir dos próprios votos: quem vota junto com ' +
        'frequência cai no mesmo grupo. Por isso um partido aparece em vários grupos. ' +
        'Os pontos cinza ficaram sem grupo.',
    },
    {
      rota: null,
      alvo: 'grafo-legenda',
      titulo: 'A borda e o centro',
      texto:
        'Os pontos soltos na borda votaram pouco demais para serem comparados com alguém ' +
        'e ficaram sem ligação. O centro reúne quem vota como a maioria.',
    },
    {
      rota: null,
      alvo: 'grafo-ajustes',
      titulo: 'Duas maneiras de posicionar os pontos',
      texto: temAlinhamento
        ? 'Nas molas, quem vota junto se atrai, e os eixos não significam nada. No ' +
          'alinhamento, a posição horizontal é quanto o parlamentar votou como o Governo ' +
          'orientou, e nada diz sobre esquerda ou direita.'
        : 'Aqui os pontos se atraem quando votam junto, e os eixos não significam nada. ' +
          'Os dados desta casa não trazem a orientação do Governo, então só existe esta vista.',
    },
    {
      rota: null,
      alvo: 'grafo-zoom',
      titulo: 'Aproximar e voltar',
      texto:
        'Aproxime, afaste, enquadre tudo ou volte ao desenho original. Pelo teclado, as ' +
        'setas movem, + e − aproximam e 0 enquadra. Arrastar um ponto muda só a sua tela.',
    },
    {
      rota: null,
      alvo: 'grafo-busca',
      titulo: `Ache um ${singular}`,
      texto: 'Procure pelo nome: o grafo aproxima e destaca o ponto.',
    },
    {
      rota: null,
      alvo: 'grafo-lista',
      titulo: 'A mesma figura, em texto',
      texto:
        'A lista traz cada ponto e as ligações dele por escrito, para quem usa leitor de ' +
        'tela ou prefere ler a olhar.',
    },
  ];
}

export function passosDaFicha(): PassoDoTour[] {
  return [
    {
      rota: null,
      alvo: 'ficha-votacoes',
      titulo: 'A base de tudo',
      texto:
        'São os votos Sim ou Não desta pessoa na legislatura, em plenário e em comissões. ' +
        'Abstenção e ausência ficam fora. Quanto menor o número, menos firme é a comparação.',
    },
    {
      rota: null,
      alvo: 'ficha-alinhamento',
      titulo: 'Presença, Governo e partido',
      texto:
        'A presença conta as votações de plenário em que a pessoa registrou voto. Os outros ' +
        'dois contam só as votações em que houve orientação de bancada: em quantas ela seguiu ' +
        'a orientação. Com menos de 20, a tela avisa que é pouco para concluir.',
      opcional: true,
    },
    {
      rota: null,
      alvo: 'ficha-contas',
      titulo: 'Três dinheiros que não se somam',
      texto:
        'Campanha é o que recebeu na eleição, segundo o TSE. Emendas é o que destinou do ' +
        'Orçamento, segundo o Portal da Transparência. Cota é o que gastou para exercer o ' +
        'mandato, segundo a própria casa. Cada número leva à aba com o detalhe.',
      opcional: true,
    },
    {
      rota: null,
      alvo: 'ficha-votos',
      titulo: 'Cada voto, do mais recente',
      texto:
        'O selo é o voto. Quando a votação foi de rito, como um requerimento, a linha diz ' +
        'isso: esses votos aparecem, mas não entram na afinidade. Quando o Governo ' +
        'orientou, a linha mostra o que ele pediu ao lado do voto.',
      opcional: true,
    },
    {
      rota: null,
      alvo: 'ficha-similares',
      titulo: 'Quem vota parecido',
      texto:
        'A mesma medida que desenha as linhas do grafo, sempre com a base: votaram igual ' +
        'em tantas de tantas votações.',
      opcional: true,
    },
  ];
}

export function passosDoQuestionario(): PassoDoTour[] {
  return [
    {
      rota: null,
      alvo: 'pergunta',
      titulo: 'Cada afirmação é uma votação real',
      texto:
        'O texto resume uma votação do plenário. Você responde à afirmação, e o site sabe ' +
        'qual voto corresponde a concordar com ela. Em algumas votações, é o Não.',
    },
    {
      rota: null,
      alvo: 'opcoes',
      titulo: '"Não sei" tira a pergunta da conta',
      texto:
        'Responder "Não sei" não pesa contra ninguém. Para haver resultado, é preciso ' +
        'opinar em boa parte das perguntas.',
    },
    {
      rota: null,
      alvo: 'pergunta',
      titulo: 'Depois de responder, o painel',
      texto:
        'Aparece quem compareceu à votação, nunca como votou. Ver o placar antes de ' +
        'responder a próxima faria a maioria pesar na sua escolha.',
    },
    {
      rota: null,
      alvo: 'progresso',
      titulo: 'Algumas perguntas chegam no caminho',
      texto:
        'Quando as suas respostas deixam parlamentares empatados, entram votações que os ' +
        'separam. O total já conta com elas.',
    },
  ];
}

export function passosDoResultado(): PassoDoTour[] {
  return [
    {
      rota: null,
      alvo: 'resultado-destaque',
      titulo: 'Um número com a base junto',
      texto:
        'Comparáveis são as perguntas em que você opinou e o parlamentar votou. O detalhe ' +
        'logo abaixo mostra em quais vocês concordaram e em quais não.',
    },
    {
      rota: null,
      alvo: 'resultado-grafo',
      titulo: 'Você no grafo',
      texto:
        'O losango é você, colocado entre os parlamentares com quem mais concordou. A sua ' +
        'posição vale sobre as perguntas que respondeu; a deles, sobre a legislatura inteira.',
      opcional: true,
    },
    {
      rota: null,
      alvo: 'resultado-distantes',
      titulo: 'Próximos e distantes',
      texto: 'A mesma conta, lida dos dois lados. Cada casa é comparada separadamente.',
      opcional: true,
    },
    {
      rota: null,
      alvo: 'resultado-aviso',
      titulo: 'Como usar o resultado',
      texto:
        'Mostra com quem você votaria igual nestas votações. Não é recomendação de voto ' +
        'nem resume tudo o que um parlamentar defende.',
    },
  ];
}

/**
 * O tour do site conserva a chave de antes: quem já o viu não é perguntado de novo só
 * porque os tours de tela chegaram.
 */
function chave(nome: NomeDoTour): string {
  return nome === 'site' ? 'poligraph:tour-visto' : `poligraph:tour-visto:${nome}`;
}

/** Sem armazenamento, finge que já viu: é melhor perder a oferta que repeti-la sempre. */
export function tourJaVisto(nome: NomeDoTour): boolean {
  try {
    return localStorage.getItem(chave(nome)) === '1';
  } catch {
    return true;
  }
}

/**
 * A oferta volta na próxima visita; não há o que fazer sem armazenamento.
 */
export function marcarTourVisto(nome: NomeDoTour): void {
  try {
    localStorage.setItem(chave(nome), '1');
  } catch {
  }
}


/** O mapa das emendas. Os passos da cidade só aparecem com uma cidade aberta. */
export function passosDasEmendas(): PassoDoTour[] {
  return [
    {
      rota: null,
      alvo: 'emendas-cidade',
      titulo: 'Comece pela sua cidade',
      texto:
        'Busque pelo nome ou use a sua localização. A cidade fica guardada só neste ' +
        'navegador, e a localização é convertida em cidade aqui mesmo: só o código da ' +
        'cidade vai ao servidor.',
    },
    {
      rota: null,
      alvo: 'emendas-periodo',
      titulo: 'Um ano ou vários',
      texto:
        'O padrão são todos os anos carregados. Escolha um intervalo para comparar. O ano ' +
        'é o da emenda: uma emenda de 2024 paga em 2025 conta em 2024.',
    },
    {
      rota: null,
      alvo: 'emendas-numeros',
      titulo: 'O que fica fora do mapa',
      texto:
        'Nem todo dinheiro tem cidade. O que foi ao Banco do Brasil para ser pago adiante, ' +
        'e o que foi pago a pessoas, não aparecem no mapa, mas estão somados aqui.',
    },
    {
      rota: null,
      alvo: 'emendas-mapa',
      titulo: 'A cor é quanto chegou',
      texto:
        'Quanto mais escuro, mais dinheiro. A cidade é a da sede de quem recebeu: para a ' +
        'prefeitura, é a própria cidade; para uma entidade, é onde ela foi aberta.',
    },
    {
      rota: null,
      alvo: 'emendas-parlamentares',
      titulo: 'Quem mandou',
      texto:
        'Os deputados e senadores que apresentaram as emendas. O nome leva à página de ' +
        'cada um, com os votos, os gastos e o financiamento de campanha.',
      opcional: true,
    },
  ];
}


/** O perfil do governo federal. */
export function passosDoGoverno(): PassoDoTour[] {
  return [
    {
      rota: null,
      alvo: 'governo-ano',
      titulo: 'Um ano por vez',
      texto:
        'Os números são do governo federal: ministérios e órgãos. Congresso e Justiça têm ' +
        'orçamento próprio e ficam de fora. O ano em andamento vem avisado, porque os valores ainda crescem.',
    },
    {
      rota: null,
      alvo: 'governo-resumo',
      titulo: 'Entrou, gastou, pegou emprestado',
      texto:
        'Os três números ficam lado a lado, sem formar um saldo. O empréstimo aparece separado ' +
        'da arrecadação porque é dinheiro que vai ser devolvido.',
    },
    {
      rota: null,
      alvo: 'governo-cem',
      titulo: 'De cada R$ 100',
      texto:
        'A divisão do gasto numa escala que se entende sem saber o tamanho de um trilhão. Cada ' +
        'linha traz também o valor em reais.',
    },
    {
      rota: null,
      alvo: 'governo-abas',
      titulo: 'Cada gasto na sua página',
      texto:
        'Aqui está o orçamento inteiro. Em Cartões ficam o cartão corporativo, o que foi comprado em segredo e o ' +
        'cartão da Defesa Civil; em Viagens, diárias e passagens de cada órgão; em Compras e contratos, quem o ' +
        'governo contratou e de que modo.',
    },
    {
      rota: null,
      alvo: 'governo-detalhes',
      titulo: 'Para conferir',
      texto:
        'Todas as áreas, o orçamento aprovado e o executado, com os termos técnicos explicados e ' +
        'os dados para baixar.',
    },
  ];
}

