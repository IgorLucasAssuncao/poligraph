import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARIO } from '../textos/glossario';

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
export function TermoComponent({ nome, children }: { nome: keyof typeof GLOSSARIO; children?: React.ReactNode }) {
  const [destino, setDestino] = useState<Element | null>(null);
  const aberto = destino !== null;
  const setAberto = (valor: boolean) => {
    if (!valor) setDestino(null);
  };
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
        onClick={(e) => setDestino(aberto ? null : (e.currentTarget.closest('dialog') ?? document.body))}
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
          destino,
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
