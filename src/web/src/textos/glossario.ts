/**
 * Os verbetes do balão de termo (`TermoComponent`), um por palavra que pede explicação.
 *
 * ATENÇÃO: Explicações escritas para quem **não acompanha política** — é o público do
 * trabalho. Sem "conforme o regimento", sem remissão a artigo de lei: o verbete que
 * exige outro verbete não explicou nada.
 *
 * DECISÃO: Cada uma diz também **por que aquilo importa aqui**, não só o que é. Saber que
 * legislatura dura quatro anos não ajuda; saber que por isso não dá para comparar
 * deputado de mandatos diferentes, ajuda.
 */
export const GLOSSARIO = {
  politico: {
    rotulo: 'político',
    explicacao:
      ' Quem foi eleito pelo voto, de 1998 a 2026: presidente, senador, deputado federal, governador, deputado ' +
      'estadual, prefeito e os vices. Do Congresso, o site mostra como cada um votou. Dos outros cargos, mostra os ' +
      'mandatos, a campanha e os bens declarados, porque as assembleias e as câmaras municipais não publicam o voto de cada um.',
  },
  cidade: {
    rotulo: 'cidade',
    explicacao:
      ' Um dos municípios do Brasil. A página dela mostra quem foi eleito para governar em cada gestão, as emendas ' +
      'que chegaram a quem tem sede lá e o que a prefeitura arrecadou e gastou, pelo que ela declarou ao Tesouro.',
  },
  entidade: {
    rotulo: 'entidade',
    explicacao:
      ' Uma organização com CNPJ que recebeu dinheiro de emenda: prefeitura, fundo de saúde, hospital, associação ' +
      'ou empresa. A página dela mostra quanto recebeu, de quais parlamentares, e se tem contrato com o governo federal ' +
      'ou sanção por irregularidade.',
  },
  legislatura: {
    rotulo: 'legislatura',
    explicacao:
      ' Os quatro anos do Congresso, na Câmara e no Senado, entre uma eleição e a seguinte. ' +
      'O deputado tem mandato de uma legislatura; o senador, de duas (oito anos), e por isso ' +
      'aparece nas duas. Só comparamos votos dentro da mesma legislatura: quem foi eleito em ' +
      '2022 não votou nada do que veio antes.',
  },
  partido: {
    rotulo: 'partido',
    explicacao:
      ' A legenda pela qual o parlamentar foi eleito, ou para a qual mudou depois. ' +
      'Mostramos o partido do voto mais recente, porque trocar de partido é comum e ' +
      'o registro de cada voto guarda o partido daquele momento.',
  },
  proposicao: {
    rotulo: 'proposição',
    explicacao:
      ' O documento proposto: um projeto de lei, uma emenda à Constituição, uma medida ' +
      'provisória. É identificado por sigla, número e ano, como "PL 4133/2023". Uma mesma ' +
      'proposição costuma ir a voto várias vezes: o texto principal, um trecho destacado, ' +
      'a redação final. Por isso duas linhas com o mesmo número podem ter votos opostos ' +
      'sem contradição.',
  },
  ementa: {
    rotulo: 'ementa',
    explicacao:
      ' O parágrafo que resume o que uma proposição faz, escrito por quem a apresentou. O ' +
      'registro da votação traz só o número do projeto; é a ementa que diz o assunto. ' +
      '"Aprovado o Substitutivo ao Projeto de Lei nº 4.133", sozinho, não conta em que a ' +
      'pessoa votou.',
  },
  plenario: {
    rotulo: 'plenário',
    explicacao:
      ' A sessão com todos os deputados, ou com todos os senadores. As comissões votam em ' +
      'grupos menores. O questionário usa só votações de plenário, porque nas comissões ' +
      'quase todos concordam e a comparação perderia a diferença entre as pessoas.',
  },
  votacaoNominal: {
    rotulo: 'votação nominal',
    explicacao:
      ' Cada parlamentar vota no painel eletrônico, e fica registrado o Sim ou o Não de cada ' +
      'um. É a única que permite saber como alguém votou, e por isso é a única que este site compara.',
  },
  votacaoSimbolica: {
    rotulo: 'votação simbólica',
    explicacao:
      ' O presidente da sessão pede que quem concorda fique como está, olha o plenário e ' +
      'anuncia o resultado. Fica registrado só se passou ou não, sem o voto de ninguém. ' +
      'Os líderes podem pedir que ela seja refeita como nominal, a chamada verificação.',
  },
  abstencao: {
    rotulo: 'abstenção',
    explicacao:
      ' O parlamentar estava presente e registrou que não queria tomar partido. ' +
      'Não conta como concordância nem como discordância: fica de fora da conta.',
  },
  procedimental: {
    rotulo: 'questão de rito',
    explicacao:
      ' Voto sobre o andamento dos trabalhos: urgência, retirada de pauta, ordem da ' +
      'sessão. O conteúdo da proposta é votado à parte. São 56% das votações da Câmara, e ' +
      'costumam separar governo de oposição por estratégia. Por isso ficam fora do cálculo ' +
      'de afinidade.',
  },
  comunidade: {
    rotulo: 'grupo de voto',
    explicacao:
      ' Um conjunto de parlamentares que votam parecido entre si, achado só pelos votos. ' +
      'Um mesmo partido pode aparecer em vários grupos. O número do grupo é apenas um nome ' +
      'e não indica posição política.',
  },
  participacao: {
    rotulo: 'participação nas votações',
    explicacao:
      ' Conta as votações nominais em plenário em que o parlamentar registrou voto: sim, ' +
      'não, abstenção, obstrução ou voto secreto. A presença na sessão é outro registro da ' +
      'Câmara, e dá para estar na sessão sem votar. No Senado, licença e missão oficial ' +
      'aparecem separadas. Na Câmara elas aparecem como ausência: quem se licenciou para ' +
      'ser ministro, por exemplo, fica ausente nesse período.',
  },
  orientacao: {
    rotulo: 'orientação de bancada',
    explicacao:
      ' Antes de uma votação, cada liderança recomenda como sua bancada deve votar, e a do ' +
      'Governo é publicada junto com as dos partidos. A orientação não obriga ninguém, e ' +
      'votar contra é comum. Só a Câmara publica as orientações.',
  },
  camara: {
    rotulo: 'Câmara dos Deputados',
    explicacao:
      ' São 513 deputados, eleitos a cada quatro anos por estado, na proporção da ' +
      'população. É onde a maioria dos projetos começa, e onde há mais votação com o ' +
      'voto de cada um registrado.',
  },
  senado: {
    rotulo: 'Senado Federal',
    explicacao:
      ' São 81 senadores, três por estado, com mandato de oito anos. O Senado revisa boa ' +
      'parte do que vem da Câmara. Mais da metade das votações dele é secreta, então há ' +
      'menos votos para comparar senadores entre si do que deputados.',
  },
  fundao: {
    rotulo: 'Fundo Especial',
    explicacao:
      ' Dinheiro público repassado aos partidos para a campanha eleitoral, criado em 2017 ' +
      'e apelidado de "fundão". O Fundo Partidário é outro: paga as despesas do partido o ' +
      'ano inteiro. Por isso os dois aparecem em linhas separadas.',
  },
  emenda: {
    rotulo: 'emenda parlamentar',
    explicacao:
      ' A parte do orçamento federal que cada parlamentar pode mandar para onde quiser, em ' +
      'geral obras e serviços no próprio estado. É o principal poder individual de um ' +
      'parlamentar sobre o orçamento.',
  },
  emendaIndividual: {
    rotulo: 'emenda individual',
    explicacao:
      ' A emenda que um deputado ou senador apresenta sozinho, e que leva o nome dele. ' +
      'Todo parlamentar tem direito a uma cota por ano. Das emendas de 2023 a 2026, as ' +
      'individuais somam R$ 74,2 bi pagos.',
  },
  emendaDeBancada: {
    rotulo: 'emenda de bancada',
    explicacao:
      ' A emenda que os deputados e senadores de um mesmo estado apresentam juntos. A ' +
      '"bancada de Minas Gerais" é o grupo inteiro. A Constituição garante que ela seja ' +
      'paga (art. 166). Das emendas de 2023 a 2026, R$ 19,4 bi foram pagos.',
  },
  emendaDeComissao: {
    rotulo: 'emenda de comissão',
    explicacao:
      ' A emenda que uma comissão do Congresso apresenta, como a de Saúde ou a de ' +
      'Agricultura. Os membros da comissão decidem em votação, e por isso ela não tem um ' +
      'autor só. Das emendas de 2023 a 2026, R$ 18,1 bi foram pagos.',
  },
  cartaoCorporativo: {
    rotulo: 'cartão corporativo',
    explicacao:
      ' O cartão de crédito que o governo dá a alguns servidores para compras pequenas e ' +
      'urgentes. Quando a compra é marcada como sigilosa, o Portal mostra só o valor: nem ' +
      'quem comprou, nem de quem, nem quando. A lei permite o sigilo quando a informação ' +
      'põe em risco a segurança do Estado ou do presidente (Lei de Acesso à Informação, art. 23).',
  },
  aditivo: {
    rotulo: 'aditivo',
    explicacao:
      ' Uma mudança no contrato depois de assinado: mais prazo, mais quantidade ou outro preço. ' +
      'Por isso o valor final pode ser maior que o inicial. A lei limita o acréscimo a 25% na ' +
      'maioria dos contratos (Lei 14.133/2021, art. 125).',
  },
  modalidadeDeCompra: {
    rotulo: 'modalidade de compra',
    explicacao:
      ' O jeito como o governo escolheu o fornecedor: pregão e concorrência são licitação; ' +
      'dispensa e inexigibilidade são compra sem licitação, que a lei permite em casos ' +
      'definidos, como emergência ou fornecedor único.',
  },
  contratoSigiloso: {
    rotulo: 'contrato sigiloso',
    explicacao:
      ' O Portal publica o valor, mas esconde a empresa e o que foi comprado. A lei permite ' +
      'quando a informação põe em risco a segurança do Estado (Lei de Acesso à Informação, art. 23).',
  },
  erroDeDigitacao: {
    rotulo: 'erro de digitação',
    explicacao:
      ' Um contrato de R$ 1,4 milhão aparece no Portal com valor inicial de R$ 1,96 trilhão: ' +
      'vírgula no lugar errado. Quando os dois valores do contrato diferem mais de 100 vezes, ' +
      'contamos o menor. Aditivo de verdade não multiplica um contrato por 100.',
  },
  diaria: {
    rotulo: 'diária',
    explicacao:
      ' O valor por dia que o servidor recebe fora da cidade dele. Paga hospedagem, alimentação ' +
      'e deslocamento na cidade de destino (Decreto 5.992/2006). Por isso a hospedagem não aparece separada.',
  },
  orgaoSigiloso: {
    rotulo: 'órgão "Sigiloso"',
    explicacao:
      ' No arquivo de pagamentos, o Portal esconde o órgão de parte das viagens. O arquivo das ' +
      'viagens mostra esse órgão aberto, e o valor é somado nele.',
  },
  cartaoDaDefesaCivil: {
    rotulo: 'cartão da Defesa Civil',
    explicacao:
      ' Um cartão que o governo federal entrega a estados e prefeituras atingidos por enchente, ' +
      'seca ou outro desastre. Quem compra é o governo local, com dinheiro federal, em coisas como ' +
      'água, comida e abrigo.',
  },
  compraCentralizada: {
    rotulo: 'compra centralizada',
    explicacao:
      ' Compra que uma central do governo faz para vários órgãos de uma vez, como passagens aéreas. ' +
      'O cartão de compras centralizadas paga essas compras.',
  },
  acaoSigilosa: {
    rotulo: 'ação sigilosa',
    explicacao:
      ' Uma linha do orçamento chamada "ações de caráter sigiloso". O valor pago aparece; ' +
      'no que foi gasto, não. Quase toda é do Ministério da Defesa.',
  },
  rolagem: {
    rotulo: 'rolagem da dívida',
    explicacao:
      ' Pagar uma dívida que venceu com um empréstimo novo. O dinheiro entra e sai no ' +
      'mesmo movimento e não paga nenhum serviço, por isso fica fora da conta de "cada R$ ' +
      '100".',
  },
  sedeDoFavorecido: {
    rotulo: 'sede de quem recebeu',
    explicacao:
      ' A cidade do mapa é onde fica registrado quem recebeu o dinheiro, no cadastro de ' +
      'CNPJ da Receita. Para a prefeitura, é a própria cidade. Uma entidade ou empresa ' +
      'aparece na cidade onde foi aberta, e pode ter usado o dinheiro em outro lugar.',
  },
  multiplo: {
    rotulo: 'MÚLTIPLO',
    explicacao:
      ' Aparece quando a emenda se reparte entre vários municípios ou estados e o Portal ' +
      'da Transparência não diz quais. São 4 de cada 10 emendas, e as maiores: em média, ' +
      'oito vezes o valor de uma emenda que vai para uma cidade só.',
  },
  nacional: {
    rotulo: 'Nacional',
    explicacao:
      ' A emenda não tem destino territorial: financia algo de alcance federal, como um ' +
      'programa ou um órgão, em vez de uma obra num lugar determinado.',
  },
  funcaoOrcamentaria: {
    rotulo: 'área do orçamento',
    explicacao:
      ' A classificação oficial do gasto público: Saúde, Educação, Segurança. "Encargos ' +
      'especiais" é a que confunde: reúne repasses que o município aplica onde decidir.',
  },
  cota: {
    rotulo: 'cota parlamentar',
    explicacao:
      ' Verba mensal para o deputado manter o mandato: passagem, aluguel de escritório, ' +
      'combustível, divulgação. É separada do salário, varia conforme a distância do ' +
      'estado até Brasília, e cada nota fiscal é pública.',
  },
  empenho: {
    rotulo: 'empenhado e pago',
    explicacao:
      ' Empenhar é reservar o dinheiro no orçamento; pagar é o dinheiro sair dos cofres. ' +
      'Uma emenda pode ser anunciada, empenhada e nunca paga. Por isso mostramos os dois ' +
      'valores.',
  },
  intermediario: {
    rotulo: 'intermediário',
    explicacao:
      ' Parte das emendas é paga ao Banco do Brasil, em Brasília, que repassa o dinheiro a ' +
      'quem vai executar. Como o banco só repassa, ele fica fora da lista de quem recebeu, ' +
      'e o valor aparece à parte.',
  },
  favorecidoPessoa: {
    rotulo: 'pagamento a pessoas',
    explicacao:
      ' Pagamentos a pessoas físicas, a empresários individuais e a produtores rurais. ' +
      'O Portal publica o nome delas; este site não o guarda nem o mostra, e soma os ' +
      'pagamentos num valor só.',
  },
  convenio: {
    rotulo: 'convênio',
    explicacao:
      ' O acordo pelo qual o governo federal repassa dinheiro a um município, estado ou ' +
      'entidade para um objeto definido, como uma obra ou a compra de um equipamento. Um ' +
      'convênio pode ser financiado por emendas de vários parlamentares.',
  },
  dotacao: {
    rotulo: 'dotação',
    explicacao:
      ' Quanto o orçamento autoriza gastar. A inicial é a aprovada na lei do orçamento; ' +
      'a atualizada soma os créditos abertos durante o ano. Empenhar é reservar parte ' +
      'dela, e pagar é o dinheiro sair.',
  },
  dotacaoIncompleta: {
    rotulo: 'dotação incompleta',
    explicacao:
      ' O governo não pode empenhar além da dotação. Quando o arquivo mostra isso, a ' +
      'dotação publicada está menor que a que autorizou o gasto. Em 2025, a lei do ' +
      'orçamento deixou R$ 228,5 bi condicionados à "regra de ouro", liberados depois pelo ' +
      'Congresso, e o arquivo publica a dotação sem essa parcela.',
  },
  restosAPagar: {
    rotulo: 'restos a pagar',
    explicacao:
      ' Despesa reservada num ano e paga no seguinte. É comum em obra, que se paga por ' +
      'etapa. Em 2025, R$ 234,6 bi saíram assim. Sem somá-la, área de obra parece parada: ' +
      'Urbanismo pagou R$ 2,0 bi do próprio ano e R$ 6,5 bi de anos anteriores.',
  },
  encargosEspeciais: {
    rotulo: 'Encargos especiais',
    explicacao:
      ' Reúne a dívida pública e as transferências que a Constituição obriga a fazer a ' +
      'estados e municípios. É a maior linha do orçamento: de 60% a 63% da dotação entre ' +
      '2023 e 2025.',
  },
} as const;
