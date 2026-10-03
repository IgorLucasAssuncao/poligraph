import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
 *
 * DECISÃO: O balão vai para o fim do `<body>` (portal), com posição fixa calculada a partir do
 * gatilho. Dentro do texto, qualquer caixa com `overflow: hidden` em volta o cortava: foi o
 * que aconteceu na faixa de números da ficha (2026-10-03). Dentro de um `<dialog>` aberto, o
 * portal vai para o próprio diálogo: no `<body>` o balão ficaria atrás da camada superior.
 */
export function Termo({ nome, children }: { nome: keyof typeof GLOSSARIO; children?: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  const balao = useRef<HTMLSpanElement>(null);
  const posicao = usePosicaoDoBalao(aberto, caixa, balao);
  const id = useId();

  const verbete = GLOSSARIO[nome];

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!caixa.current?.contains(alvo) && !balao.current?.contains(alvo)) setAberto(false);
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

      {aberto &&
        createPortal(
          <span
            className="termo-balao"
            id={id}
            role="tooltip"
            ref={balao}
            style={{ left: posicao.left, top: posicao.top, visibility: posicao.medido ? 'visible' : 'hidden' }}
          >
            <strong>{verbete.rotulo}</strong>
            {verbete.explicacao}
          </span>,
          caixa.current?.closest('dialog') ?? document.body,
        )}
    </span>
  );
}

/** A folga, em pixels, entre o balão e o gatilho, e entre o balão e a borda da janela. */
const FOLGA = 8;

/**
 * Onde o balão fica: abaixo do gatilho, alinhado à esquerda dele, sem sair da janela. Sem espaço
 * embaixo, sobe para cima do gatilho. Acompanha rolagem e redimensionamento enquanto aberto.
 */
function usePosicaoDoBalao(
  aberto: boolean,
  caixa: React.RefObject<HTMLSpanElement | null>,
  balao: React.RefObject<HTMLSpanElement | null>,
) {
  const [posicao, setPosicao] = useState({ left: 0, top: 0, medido: false });

  useLayoutEffect(() => {
    if (!aberto) return;

    function medir() {
      const gatilho = caixa.current?.getBoundingClientRect();
      const proprio = balao.current?.getBoundingClientRect();
      if (!gatilho || !proprio) return;
      const largura = document.documentElement.clientWidth;
      const altura = window.innerHeight;
      const left = Math.max(FOLGA, Math.min(gatilho.left, largura - proprio.width - FOLGA));
      const cabeEmbaixo = gatilho.bottom + FOLGA + proprio.height <= altura;
      const top = cabeEmbaixo || gatilho.top < proprio.height + FOLGA
        ? gatilho.bottom + FOLGA
        : gatilho.top - FOLGA - proprio.height;
      setPosicao({ left, top, medido: true });
    }

    medir();
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [aberto, caixa, balao]);

  return posicao;
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
      ' A votação em que fica registrado o voto de cada parlamentar. Nas outras, o ' +
      'registro guarda só o resultado, e aí não há como comparar ninguém.',
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
