import { useEffect, useId, useRef, useState } from 'react';

/**
 * Explicação de termo institucional, sob demanda.
 *
 * RISCO: A **RNF-29 proíbe jargão na interface do cidadão** — *votação nominal*, *destaque*,
 * *requerimento*, *proposição*, *substitutivo*, *polaridade*, *obstrução*. Este
 * componente NÃO é licença para trazer essas palavras de volta.
 *
 * DECISÃO: Ele serve ao caso que a **RNF-31** admite: o termo que é *contexto descritivo* e
 * não tem substituto honesto — "legislatura", "partido", "plenário". Trocar por
 * aproximação ("período", "grupo") seria impreciso; deixar sem explicação exclui quem
 * não acompanha política, que é justamente o público do trabalho.
 *
 * ATENÇÃO: Abre por clique e por foco, nunca só por `:hover`. Em telefone não existe hover,
 * e a explicação simplesmente não existiria para metade dos visitantes.
 */
export function Termo({ nome, children }: { nome: keyof typeof GLOSSARIO; children?: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  const id = useId();

  const verbete = GLOSSARIO[nome];

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false);
    }

    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  return (
    <span className="termo" ref={caixa}>
      <button
        type="button"
        className="termo-gatilho"
        aria-expanded={aberto}
        aria-describedby={aberto ? id : undefined}
        onClick={() => setAberto((a) => !a)}
      >
        {children ?? verbete.rotulo}
      </button>

      {aberto && (
        <span className="termo-balao" id={id} role="tooltip">
          <strong>{verbete.rotulo}</strong>
          {verbete.explicacao}
        </span>
      )}
    </span>
  );
}

/**
 * ATENÇÃO: Explicações escritas para quem **não acompanha política** — é o público do
 * trabalho. Sem "conforme o regimento", sem remissão a artigo de lei: o verbete que
 * exige outro verbete não explicou nada.
 *
 * DECISÃO: Cada uma diz também **por que aquilo importa aqui**, não só o que é. Saber que
 * legislatura dura quatro anos não ajuda; saber que por isso não dá para comparar
 * deputado de mandatos diferentes, ajuda.
 */
export const GLOSSARIO = {
  legislatura: {
    rotulo: 'legislatura',
    explicacao:
      ' Os quatro anos do Congresso — Câmara e Senado —, entre uma eleição e a seguinte. ' +
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
      'provisória. É identificado por sigla, número e ano — "PL 4133/2023". Uma mesma ' +
      'proposição costuma ir a voto VÁRIAS vezes: o texto principal, um trecho ' +
      'destacado, a redação final. Por isso duas linhas com o mesmo número podem ter ' +
      'votos opostos sem contradição.',
  },
  ementa: {
    rotulo: 'ementa',
    explicacao:
      ' O parágrafo que resume o que uma proposição faz, escrito por quem a apresentou. ' +
      'É o que diz o ASSUNTO — o registro da votação diz apenas o número do projeto. ' +
      'Sem a ementa, "Aprovado o Substitutivo ao Projeto de Lei nº 4.133" não informa ' +
      'em que a pessoa votou.',
  },
  plenario: {
    rotulo: 'plenário',
    explicacao:
      ' A sessão com todos os deputados, não a reunião de uma comissão menor. ' +
      'Só usamos votações de plenário: em comissão a concordância é muito maior, e ' +
      'misturar as duas achataria a comparação.',
  },
  votacaoNominal: {
    rotulo: 'votação nominal',
    explicacao:
      ' Aquela em que fica registrado o voto de cada parlamentar, um a um. ' +
      'Nas demais só se registra o resultado, então não há como saber quem votou o quê ' +
      '— e sem isso não dá para comparar ninguém.',
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
      ' Voto sobre o ANDAMENTO dos trabalhos — urgência, retirada de pauta, ordem da ' +
      'sessão —, não sobre o conteúdo da proposta. São 56% das votações da Câmara, e ' +
      'costumam separar governo de oposição sem dizer nada sobre o mérito. Por isso ' +
      'não entram no cálculo de afinidade.',
  },
  comunidade: {
    rotulo: 'grupo de voto',
    explicacao:
      ' Conjunto de parlamentares que votam parecido entre si, detectado pelos votos ' +
      'e não pelo partido. Por isso um mesmo partido aparece em vários grupos, e o ' +
      'número do grupo é só um rótulo — não indica posição no espectro político.',
  },
  participacao: {
    rotulo: 'participação nas votações',
    explicacao:
      ' Conta as votações nominais em plenário em que o parlamentar registrou voto — sim, ' +
      'não, abstenção, obstrução ou voto secreto. Não é a presença na sessão, que a Câmara ' +
      'registra à parte: dá para estar na sessão e não votar. No Senado, licença e missão ' +
      'oficial aparecem separadas; na Câmara não, e quem se licenciou para ser ministro, por ' +
      'exemplo, aparece como ausente nesse período.',
  },
  orientacao: {
    rotulo: 'orientação de bancada',
    explicacao:
      ' Antes de uma votação, cada liderança recomenda como sua bancada deve votar. ' +
      'A do Governo é publicada junto com as dos partidos. Seguir ou não seguir é ' +
      'decisão de cada parlamentar — a orientação não obriga, e votar contra é comum. ' +
      'Só a Câmara publica isso; o Senado não.',
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
      ' São 81 senadores, três por estado, com mandato de oito anos. Revisa boa parte ' +
      'do que vem da Câmara — e mais da metade das votações dele é secreta, então há ' +
      'menos base para comparar senadores entre si do que deputados.',
  },
  fundao: {
    rotulo: 'Fundo Especial',
    explicacao:
      ' Dinheiro público repassado aos partidos para financiar campanha eleitoral, ' +
      'criado em 2017 e apelidado de "fundão". Não se confunde com o Fundo ' +
      'Partidário, que custeia o partido o ano inteiro — os dois aparecem separados ' +
      'aqui de propósito.',
  },
  emenda: {
    rotulo: 'emenda parlamentar',
    explicacao:
      ' A parte do orçamento federal que cada parlamentar pode direcionar para onde ' +
      'quiser — em geral obras e serviços no estado dele. É o principal instrumento ' +
      'de poder orçamentário individual no Congresso.',
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
      ' A emenda que os deputados e senadores de um mesmo estado apresentam juntos — a ' +
      '"bancada de Minas Gerais" é o grupo inteiro, e não uma pessoa. A Constituição ' +
      'garante que seja paga (art. 166). Das emendas de 2023 a 2026: R$ 19,4 bi pagos.',
  },
  emendaDeComissao: {
    rotulo: 'emenda de comissão',
    explicacao:
      ' A emenda que uma comissão do Congresso apresenta — a de Saúde, a de Agricultura. ' +
      'É decidida em votação entre os membros da comissão, e por isso não tem um autor ' +
      'só. Das emendas de 2023 a 2026: R$ 18,1 bi pagos.',
  },
  cartaoCorporativo: {
    rotulo: 'cartão corporativo',
    explicacao:
      ' O cartão de crédito que o governo dá a alguns servidores para compras pequenas e ' +
      'urgentes. Quando a compra é marcada como sigilosa, o Portal mostra só o valor: nem ' +
      'quem comprou, nem de quem, nem quando. A lei permite o sigilo quando a informação ' +
      'põe em risco a segurança do Estado ou do presidente (Lei de Acesso à Informação, art. 23).',
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
      ' Pagar uma dívida que venceu pegando um empréstimo novo. O dinheiro entra e sai no ' +
      'mesmo movimento e não paga serviço nenhum — por isso fica fora da conta de "cada R$ 100".',
  },
  sedeDoFavorecido: {
    rotulo: 'sede de quem recebeu',
    explicacao:
      ' A cidade do mapa é onde fica registrado quem recebeu o dinheiro, no cadastro de ' +
      'CNPJ da Receita. Para a prefeitura, é a própria cidade. Para uma entidade ou ' +
      'empresa, é onde ela foi aberta — e ela pode ter aplicado o dinheiro em outro lugar.',
  },
  multiplo: {
    rotulo: 'MÚLTIPLO',
    explicacao:
      ' Não é um lugar — é o aviso de que a emenda se reparte entre vários municípios ' +
      'ou estados, e o Portal da Transparência não diz quais. São 4 de cada 10 emendas, ' +
      'e as maiores: em média oito vezes o valor de uma emenda destinada a uma cidade só.',
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
      ' A classificação oficial do gasto público — Saúde, Educação, Segurança. ' +
      '"Encargos especiais" é a exceção que confunde: não é uma área de serviço, e sim ' +
      'onde entram repasses que o município aplica onde decidir.',
  },
  cota: {
    rotulo: 'cota parlamentar',
    explicacao:
      ' Verba mensal para o deputado manter o mandato — passagem, aluguel de escritório, ' +
      'combustível, divulgação. É separada do salário, varia conforme a distância do ' +
      'estado até Brasília, e cada nota fiscal é pública.',
  },
  empenho: {
    rotulo: 'empenhado e pago',
    explicacao:
      ' Empenhar é reservar o dinheiro no orçamento; pagar é ele de fato sair dos ' +
      'cofres. Uma emenda pode ser anunciada, empenhada e nunca paga — por isso ' +
      'mostramos os dois valores, e não só o primeiro.',
  },
  intermediario: {
    rotulo: 'intermediário',
    explicacao:
      ' Parte das emendas é paga ao Banco do Brasil, em Brasília, que repassa o dinheiro ' +
      'a quem vai executar. O banco não é o destino — por isso ele fica fora da lista de ' +
      'quem recebeu, com o valor mostrado à parte.',
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
      'entidade para um objeto definido — uma obra, a compra de um equipamento. Um ' +
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
      'dotação publicada não é a que autorizou o gasto. Em 2025, a lei do orçamento ' +
      'deixou R$ 228,5 bi condicionados à "regra de ouro" — liberados depois pelo ' +
      'Congresso —, e o arquivo publica a dotação sem essa parcela.',
  },
  restosAPagar: {
    rotulo: 'restos a pagar',
    explicacao:
      ' Despesa reservada num ano e paga no seguinte — comum em obra, que se paga por ' +
      'etapa. Em 2025, R$ 234,6 bi saíram assim. Sem somá-la, área de obra parece parada: ' +
      'Urbanismo pagou R$ 2,0 bi do próprio ano e R$ 6,5 bi de anos anteriores.',
  },
  encargosEspeciais: {
    rotulo: 'Encargos especiais',
    explicacao:
      ' Não é uma área de serviço: reúne a dívida pública e as transferências que a ' +
      'Constituição obriga a fazer a estados e municípios. É a maior linha do orçamento: ' +
      'de 60% a 63% da dotação entre 2023 e 2025.',
  },
} as const;
