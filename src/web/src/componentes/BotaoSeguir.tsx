import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConsentimentoNecessarioError, deixarDeSeguir, seguir } from '../api';
import { useSessao } from '../sessao';
import { TEXTO_CONSENTIMENTO_SEGUIR } from '../textos-legais';
import { useEntrar } from './useEntrar';

/**
 * RISCO: Este botão escreve na tabela `segue`, que é REGISTRO DE CONVICÇÃO POLÍTICA
 * — dado sensível pela LGPD art. 5º, II.
 *
 * ATENÇÃO: O estado é otimista: a interface muda antes da confirmação, e volta se falhar.
 * Sem isso o clique parece travado, e a pessoa clica de novo — gerando duas chamadas
 * para uma intenção só. O `PUT` é idempotente justamente para tolerar isso.
 *
 * DECISÃO: Sem conta, o botão aparece igual e leva a entrar (2026-10-02, decisão do autor):
 * a conta só existe para seguir. Esconder o botão escondia também que dava para seguir.
 *
 * ATENÇÃO: O <span> não é decorativo: o CSS o esconde no hover para revelar
 * "Deixar de seguir" no lugar. Sem ele, os dois textos aparecem juntos.
 *
 * `evento.stopPropagation();`: o cartão inteiro é um link
 *
 * `aoAlternar(pessoaId, proximo);`: otimista
 *
 * `aoAlternar(pessoaId, !proximo);`: desfaz
 *
 * RISCO: Na primeira vez, a API responde 428 e o botão pergunta o consentimento (Pendência 62).
 * Só com o aceite a chamada volta, e a API grava a versão do texto junto.
 */
export function BotaoSeguir({
  pessoaId,
  seguindo,
  aoAlternar,
}: {
  pessoaId: number;
  seguindo: boolean;
  aoAlternar: (id: number, seguindoAgora: boolean) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [perguntando, setPerguntando] = useState(false);
  const { usuario } = useSessao();
  const entrar = useEntrar();

  if (!usuario) {
    return (
      <Link to={entrar} className="botao-seguir" title="Entre com o Google para seguir">
        <span>Seguir</span>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={seguindo ? 'botao-seguindo' : 'botao-seguir'}
        disabled={ocupado}
        aria-pressed={seguindo}
        onClick={alternar}
      >
        <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
      </button>
      {perguntando && (
        <PedidoDeConsentimento
          aoAceitar={() => {
            setPerguntando(false);
            void executar(true, true);
          }}
          aoRecusar={() => setPerguntando(false)}
        />
      )}
    </>
  );

  function alternar(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    void executar(!seguindo, false);
  }

  async function executar(proximo: boolean, aceite: boolean) {
    setOcupado(true);
    aoAlternar(pessoaId, proximo);

    try {
      await (proximo ? seguir(pessoaId, aceite) : deixarDeSeguir(pessoaId));
    } catch (erro) {
      aoAlternar(pessoaId, !proximo);
      if (erro instanceof ConsentimentoNecessarioError) setPerguntando(true);
    } finally {
      setOcupado(false);
    }
  }
}

/**
 * O pedido de consentimento, num `<dialog>` modal: foco preso e Esc, como o tour e o painel do
 * modo análise. Esc e "Agora não" fecham sem seguir.
 */
function PedidoDeConsentimento({ aoAceitar, aoRecusar }: { aoAceitar: () => void; aoRecusar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="titulo-consentimento-seguir"
      onCancel={aoRecusar}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 id="titulo-consentimento-seguir">{TEXTO_CONSENTIMENTO_SEGUIR.titulo}</h2>
      <p>{TEXTO_CONSENTIMENTO_SEGUIR.texto}</p>
      <p className="ajuda">
        <Link to="/privacidade">Política de privacidade</Link>
      </p>
      <div className="confirmacao-acoes">
        <button type="button" className="botao-destaque" onClick={aoAceitar}>
          {TEXTO_CONSENTIMENTO_SEGUIR.aceitar}
        </button>
        <button type="button" className="botao-secundario" onClick={aoRecusar}>
          {TEXTO_CONSENTIMENTO_SEGUIR.recusar}
        </button>
      </div>
    </dialog>
  );
}
