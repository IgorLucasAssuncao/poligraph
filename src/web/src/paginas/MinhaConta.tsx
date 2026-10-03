import { useState } from 'react';
import { excluirConta, revogarConsentimentoDeSeguir } from '../api';
import { AvatarComponent } from '../componentes/Avatar';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { useSessao } from '../sessao';
import { TEXTOS_DA_CONTA } from '../textos/conta';

const T = TEXTOS_DA_CONTA.conta;

/**
 * As operações que a pessoa precisa ter sobre a própria conta.
 *
 * RISCO: LGPD art. 18, VI — o direito à eliminação precisa estar ao alcance,
 * não escondido num e-mail de suporte.
 *
 * ATENÇÃO: Recarrega do zero: o estado em memória ainda acha que há sessão.
 */
export function MinhaContaComponent() {
  const { usuario, sair } = useSessao();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState(false);
  const [revogado, setRevogado] = useState(false);

  return (
    <>
      <CabecalhoDaColunaComponent titulo={T.titulo} />

      <section className="conta-identidade">
        <AvatarComponent nome={usuario?.nome ?? '?'} fotoUrl={usuario?.fotoUrl} tamanho="grande" />
        <div>
          <strong>{usuario?.nome ?? T.semNome}</strong>
          <p className="ajuda">{T.entradaGoogle}</p>
        </div>
      </section>

      <section className="conta-secao">
        <h2>{T.sessao}</h2>
        <button type="button" className="botao-secundario" onClick={sair}>
          {T.sair}
        </button>
      </section>

      <section className="conta-secao">
        <h2>{T.seusDados}</h2>
        <p className="ajuda">{T.guardamos}</p>

        <p className="ajuda">{T.revogarAjuda}</p>
        {revogado ? (
          <p className="ajuda">{T.revogado}</p>
        ) : (
          <button type="button" className="botao-secundario" onClick={revogar}>
            {T.revogar}
          </button>
        )}

        {!confirmando ? (
          <button type="button" className="botao-perigo" onClick={() => setConfirmando(true)}>
            {T.apagar}
          </button>
        ) : (
          <div className="confirmacao">
            <p>{T.confirmacao}</p>
            <div className="confirmacao-acoes">
              <button type="button" className="botao-perigo" onClick={apagar}>
                {T.apagarDefinitivamente}
              </button>
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setConfirmando(false)}
              >
                {T.cancelar}
              </button>
            </div>
          </div>
        )}

        {erro && <p className="erro">{T.erro}</p>}
      </section>
    </>
  );

  async function revogar() {
    try {
      await revogarConsentimentoDeSeguir();
      setRevogado(true);
    } catch {
      setErro(true);
    }
  }

  async function apagar() {
    try {
      await excluirConta();
      window.location.href = '/';
    } catch {
      setErro(true);
      setConfirmando(false);
    }
  }
}
