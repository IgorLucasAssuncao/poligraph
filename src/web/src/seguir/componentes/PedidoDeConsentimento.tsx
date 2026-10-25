import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TEXTOS_DOS_COMPONENTES as T } from '../../comum/textos/componentes';

/** O texto de um pedido de consentimento: título, o que se pede e os dois botões. */
export type TextoDoPedido = { titulo: string; texto: string; aceitar: string; recusar: string };

/**
 * O pedido de consentimento, num `<dialog>` modal: foco preso e Esc, como o tour e o painel do
 * modo auditoria. Esc e "Agora não" fecham sem gravar nada.
 *
 * DECISÃO (2026-10-18): saiu do botão de seguir quando os avisos no navegador ganharam
 * consentimento próprio (Pendência 89). Cada finalidade tem o seu texto; a forma é a mesma.
 *
 * ATENÇÃO: Os dois botões têm pesos diferentes, mas recusar é sempre um clique, como aceitar.
 */
export function PedidoDeConsentimentoComponent({
  texto,
  aoAceitar,
  aoRecusar,
}: {
  texto: TextoDoPedido;
  aoAceitar: () => void;
  aoRecusar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idDoTitulo = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento || elemento.open) return;
    if (elemento.showModal) elemento.showModal();
    else elemento.setAttribute('open', '');
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="pedido-consentimento"
      aria-labelledby={idDoTitulo}
      onCancel={aoRecusar}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 id={idDoTitulo}>{texto.titulo}</h2>
      <p>{texto.texto}</p>
      <p className="ajuda">
        <Link to="/privacidade">{T.seguir.privacidade}</Link>
      </p>
      <div className="confirmacao-acoes">
        <button type="button" className="botao-destaque" onClick={aoAceitar}>
          {texto.aceitar}
        </button>
        <button type="button" className="botao-secundario" onClick={aoRecusar}>
          {texto.recusar}
        </button>
      </div>
    </dialog>
  );
}
