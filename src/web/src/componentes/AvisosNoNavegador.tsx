import { TEXTO_CONSENTIMENTO_AVISOS } from '../textos-legais';
import { TEXTOS_DOS_AVISOS } from '../textos/avisos';
import { PedidoDeConsentimentoComponent } from './PedidoDeConsentimento';
import { useAvisosNoNavegador } from './useAvisosNoNavegador';

const T = TEXTOS_DOS_AVISOS.navegador;

/**
 * Liga e desliga os avisos neste navegador (Pendência 89). Aparece no sininho do cabeçalho e na
 * página da conta.
 *
 * DECISÃO: Sem chave no servidor, não aparece nada: oferecer um botão que não funciona é pior que
 * não oferecer. Sem suporte no navegador, diz por quê, e no iPhone o que fazer.
 */
export function AvisosNoNavegadorComponent() {
  const avisos = useAvisosNoNavegador();

  if (avisos.situacao === 'carregando' || avisos.situacao === 'indisponivel') return null;

  const outros = Math.max(0, (avisos.estado?.navegadores ?? 0) - (avisos.situacao === 'ligado' ? 1 : 0));

  return (
    <div className="avisos-navegador">
      <p className="avisos-navegador-titulo">{T.titulo}</p>
      <p className="ajuda">{T.explicacao}</p>

      {avisos.situacao === 'sem-suporte' && <p className="ajuda">{T.semSuporte}</p>}
      {avisos.situacao === 'bloqueado' && <p className="ajuda">{T.bloqueado}</p>}

      {avisos.situacao === 'desligado' && (
        <button type="button" className="botao-secundario" disabled={avisos.ocupado} onClick={() => void avisos.ligar()}>
          {avisos.ocupado ? T.ocupado : T.ligar}
        </button>
      )}

      {avisos.situacao === 'ligado' && (
        <>
          <p className="avisos-navegador-ligado">{T.ligado}</p>
          <button type="button" className="botao-secundario" disabled={avisos.ocupado} onClick={() => void avisos.desligar()}>
            {avisos.ocupado ? T.ocupado : T.desligar}
          </button>
        </>
      )}

      {outros > 0 && <p className="ajuda">{T.outros(outros)}</p>}
      {avisos.erro && <p className="erro">{T.erro}</p>}

      {avisos.pedindoConsentimento && (
        <PedidoDeConsentimentoComponent
          texto={TEXTO_CONSENTIMENTO_AVISOS}
          aoAceitar={() => void avisos.aceitar()}
          aoRecusar={() => void avisos.recusar()}
        />
      )}
    </div>
  );
}
