import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Um modal com título, botão de fechar e corpo que rola, sobre `<dialog>` nativo: foco preso, Esc
 * e fundo inerte, como os outros diálogos do projeto. A entrada e a saída usam a mesma animação
 * (`.modal` no bloco de animação dos diálogos, em `App.css`).
 *
 * DECISÃO (2026-10-18): Nasceu com as novidades por parlamentar. Os três modais anteriores
 * (avaliação, grafo ampliado e grafo do dinheiro) montam o próprio `<dialog>`; o próximo usa este.
 *
 * ATENÇÃO: Clicar fora da caixa fecha, como no grafo do dinheiro: o clique cai no próprio
 * `<dialog>`, que é o fundo, e não num filho.
 */
export function ModalComponent({
  aberto,
  aoFechar,
  titulo,
  sobre,
  rotuloDeFechar,
  largo = false,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  /** A linha pequena acima do título, em mono, dizendo de que se trata. */
  sobre?: string;
  rotuloDeFechar: string;
  /** Mais largo, para conteúdo em colunas ou com filtros no topo. */
  largo?: boolean;
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idDoTitulo = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) {
      if (elemento.showModal) elemento.showModal();
      else elemento.setAttribute('open', '');
    }
    if (!aberto && elemento.open) {
      if (elemento.close) elemento.close();
      else elemento.removeAttribute('open');
    }
  }, [aberto]);

  return (
    <dialog
      ref={dialogo}
      className={largo ? 'modal modal-largo' : 'modal'}
      aria-labelledby={idDoTitulo}
      onClose={() => aberto && aoFechar()}
      onClick={(e) => e.target === dialogo.current && aoFechar()}
    >
      <header className="modal-topo">
        <div>
          {sobre && <p className="modal-sobre">{sobre}</p>}
          <h2 id={idDoTitulo}>{titulo}</h2>
        </div>
        <button type="button" className="botao-icone" aria-label={rotuloDeFechar} onClick={aoFechar}>
          ✕
        </button>
      </header>
      <div className="modal-corpo">{children}</div>
    </dialog>
  );
}
