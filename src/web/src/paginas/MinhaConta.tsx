import { useState } from 'react';
import { Link } from 'react-router-dom';
import { excluirConta } from '../api';
import { Avatar } from '../componentes/Avatar';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { useSessao } from '../sessao';

/**
 * As operações que a pessoa precisa ter sobre a própria conta.
 *
 * RISCO: LGPD art. 18, VI — o direito à eliminação precisa estar ao alcance,
 * não escondido num e-mail de suporte.
 *
 * ATENÇÃO: Recarrega do zero: o estado em memória ainda acha que há sessão.
 */
export function MinhaConta() {
  const { usuario, sair } = useSessao();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState(false);

  return (
    <>
      <CabecalhoDaColuna titulo="Conta" />

      <section className="conta-identidade">
        <Avatar nome={usuario?.nome ?? '?'} fotoUrl={usuario?.fotoUrl} tamanho="grande" />
        <div>
          <strong>{usuario?.nome ?? 'Sem nome'}</strong>
          <p className="ajuda">Entrada feita com a sua conta Google.</p>
        </div>
      </section>

      <section className="conta-secao">
        <h2>Sessão</h2>
        <button type="button" className="botao-secundario" onClick={sair}>
          Sair deste aparelho
        </button>
      </section>

      <section className="conta-secao">
        <h2>Seus dados</h2>
        <p className="ajuda">
          Guardamos seu nome, e-mail e foto do Google, e a lista de quem você segue.{' '}
          <Link to="/privacidade">Veja o detalhe</Link>.
        </p>

        {!confirmando ? (
          <button type="button" className="botao-perigo" onClick={() => setConfirmando(true)}>
            Apagar minha conta
          </button>
        ) : (
          <div className="confirmacao">
            <p>
              <strong>Isto apaga tudo:</strong> sua conta, a lista de quem você segue e seus
              consentimentos. Não dá para desfazer.
            </p>
            <div className="confirmacao-acoes">
              <button type="button" className="botao-perigo" onClick={apagar}>
                Apagar definitivamente
              </button>
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {erro && <p className="erro">Não foi possível apagar agora. Tente de novo.</p>}
      </section>
    </>
  );

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
