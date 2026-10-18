import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConsentimentoNecessarioError, deixarDeSeguir, seguir } from '../api';
import { useSessao } from '../sessao';
import { TEXTO_CONSENTIMENTO_SEGUIR } from '../textos-legais';
import { useEntrar } from './useEntrar';
import { PedidoDeConsentimentoComponent } from './PedidoDeConsentimento';
import { ConviteDeAvisosComponent } from './ConviteDeAvisos';
import { conviteRespondido } from './respostaAoConvite';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

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
 * `aoAlternar(idPessoa, proximo);`: otimista
 *
 * `aoAlternar(idPessoa, !proximo);`: desfaz
 *
 * RISCO: Na primeira vez, a API responde 428 e o botão pergunta o consentimento (Pendência 62).
 * Só com o aceite a chamada volta, e a API grava a versão do texto junto.
 *
 * DECISÃO (2026-10-18): Seguiu, e o convite para avisos ainda não foi respondido neste navegador? Ele
 * aparece em seguida (Pendência 89).
 */
export function BotaoSeguirComponent({
  idPessoa,
  seguindo,
  aoAlternar,
}: {
  idPessoa: number;
  seguindo: boolean;
  aoAlternar: (id: number, seguindoAgora: boolean) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [perguntando, setPerguntando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const { usuario } = useSessao();
  const entrar = useEntrar();

  if (!usuario) {
    return (
      <Link to={entrar} className="botao-seguir" title={T.seguir.entreParaSeguir}>
        <span>{T.seguir.seguir}</span>
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
        <PedidoDeConsentimentoComponent
          texto={TEXTO_CONSENTIMENTO_SEGUIR}
          aoAceitar={() => {
            setPerguntando(false);
            void executar(true, true);
          }}
          aoRecusar={() => setPerguntando(false)}
        />
      )}
      {convidando && <ConviteDeAvisosComponent aoFechar={() => setConvidando(false)} />}
    </>
  );

  function alternar(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    void executar(!seguindo, false);
  }

  async function executar(proximo: boolean, aceite: boolean) {
    setOcupado(true);
    aoAlternar(idPessoa, proximo);

    try {
      await (proximo ? seguir(idPessoa, aceite) : deixarDeSeguir(idPessoa));
      if (proximo && !conviteRespondido()) setConvidando(true);
    } catch (erro) {
      aoAlternar(idPessoa, !proximo);
      if (erro instanceof ConsentimentoNecessarioError) setPerguntando(true);
    } finally {
      setOcupado(false);
    }
  }
}
