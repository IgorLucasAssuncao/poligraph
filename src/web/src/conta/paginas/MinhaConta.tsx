import { useState } from 'react';
import { excluirConta, revogarAvisos, revogarConsentimentoDeSeguir } from '../../nucleo/api';
import { AvisosNoNavegadorComponent } from '../../seguir/componentes/AvisosNoNavegador';
import { AvatarComponent } from '../../comum/componentes/Avatar';
import { CabecalhoDaColunaComponent } from '../../site/componentes/Layout';
import { useSessao } from '../../nucleo/sessao';
import { TEXTOS_DA_CONTA } from '../textos/conta';
import { TEXTOS_DOS_AVISOS } from '../../seguir/textos/avisos';

const T = TEXTOS_DA_CONTA.conta;
const A = TEXTOS_DOS_AVISOS.conta;

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
  const [avisosRevogados, setAvisosRevogados] = useState(false);

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
        <button type="button" className="botao-secundario" onClick={() => sair().catch(() => setErro(true))}>
          {T.sair}
        </button>
      </section>

      <section className="conta-secao">
        {avisosRevogados ? (
          <p className="ajuda">{A.revogado}</p>
        ) : (
          <>
            <AvisosNoNavegadorComponent />
            <p className="ajuda">{A.revogarAjuda}</p>
            <button type="button" className="botao-secundario" onClick={revogarOsAvisos}>
              {A.revogar}
            </button>
          </>
        )}
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

  async function revogarOsAvisos() {
    try {
      await revogarAvisos();
      setAvisosRevogados(true);
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
