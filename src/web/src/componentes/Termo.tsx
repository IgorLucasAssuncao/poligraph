import { useEffect, useId, useRef, useState } from 'react';

/**
 * Explicação de termo institucional, sob demanda.
 *
 * 🔴 A **RNF-29 proíbe jargão na interface do cidadão** — *votação nominal*, *destaque*,
 * *requerimento*, *proposição*, *substitutivo*, *polaridade*, *obstrução*. Este
 * componente ⛔ NÃO é licença para trazer essas palavras de volta.
 *
 * ⭐ Ele serve ao caso que a **RNF-31** admite: o termo que é *contexto descritivo* e
 * não tem substituto honesto — "legislatura", "partido", "plenário". Trocar por
 * aproximação ("período", "grupo") seria impreciso; deixar sem explicação exclui quem
 * não acompanha política, que é justamente o público do trabalho.
 *
 * ⚠️ Abre por clique e por foco, ⛔ nunca só por `:hover`. Em telefone não existe hover,
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
 * ⚠️ Explicações escritas para quem **não acompanha política** — é o público do
 * trabalho. Sem "conforme o regimento", sem remissão a artigo de lei: o verbete que
 * exige outro verbete não explicou nada.
 *
 * ⭐ Cada uma diz também **por que aquilo importa aqui**, não só o que é. Saber que
 * legislatura dura quatro anos não ajuda; saber que por isso não dá para comparar
 * deputado de mandatos diferentes, ajuda.
 */
export const GLOSSARIO = {
  legislatura: {
    rotulo: 'legislatura',
    explicacao:
      ' Os quatro anos de mandato de uma Câmara, entre uma eleição e a seguinte. ' +
      'A 57ª começou em 2023. Só comparamos votos dentro da mesma legislatura: quem ' +
      'foi eleito em 2022 não votou nada do que veio antes.',
  },
  partido: {
    rotulo: 'partido',
    explicacao:
      ' A legenda pela qual o parlamentar foi eleito, ou para a qual mudou depois. ' +
      'Mostramos o partido do voto mais recente, porque trocar de partido é comum e ' +
      'o registro de cada voto guarda o partido daquele momento.',
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
  comunidade: {
    rotulo: 'grupo de voto',
    explicacao:
      ' Conjunto de parlamentares que votam parecido entre si, detectado pelos votos ' +
      'e não pelo partido. Por isso um mesmo partido aparece em vários grupos, e o ' +
      'número do grupo é só um rótulo — não indica posição no espectro político.',
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
  empenho: {
    rotulo: 'empenhado e pago',
    explicacao:
      ' Empenhar é reservar o dinheiro no orçamento; pagar é ele de fato sair dos ' +
      'cofres. Uma emenda pode ser anunciada, empenhada e nunca paga — por isso ' +
      'mostramos os dois valores, e não só o primeiro.',
  },
} as const;
