import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ABAS_DO_DINHEIRO, ABAS_DO_GOVERNO } from '../navegacao';
import { TEXTOS_DO_SITE as T } from '../textos/site';
import { useFecharAoSair } from './useFecharAoSair';

/**
 * "Dinheiro público" no cabeçalho com a seta que abre as seções: as abas de dinheiro e, dentro de Governo federal, as dele.
 *
 * DECISÃO (autor, 2026-10-23): Cartões e Viagens ficavam a três cliques do início (Dinheiro público, Governo federal, a aba).
 * Pelo menu ficam a dois. O item continua sendo link: o clique no nome abre Emendas por cidade, como antes.
 *
 * Padrão de revelação, como o {@link MenuDaContaComponent}: botão que abre um painel de links, com Tab e Esc.
 *
 * ATENÇÃO: No celular a seta some. A barra tem três colunas estreitas, e as abas aparecem logo no topo da página.
 */
export function MenuDoDinheiroComponent({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();
  const fechar = useCallback(() => setAberto(false), []);
  useFecharAoSair(aberto, caixa, fechar);

  return (
    <div className="nav-com-menu" ref={caixa}>
      {children}
      <button
        type="button"
        className="nav-menu-botao"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={T.menuDoDinheiro.abrir}
        onClick={() => setAberto((a) => !a)}
      >
        <span aria-hidden="true">▾</span>
      </button>

      {aberto && (
        <div className="menu-conta-painel nav-menu-painel" id={id}>
          {ABAS_DO_DINHEIRO.map((aba) => (
            <Link key={aba.para} to={aba.para} onClick={fechar}>
              {aba.rotulo}
            </Link>
          ))}
          {ABAS_DO_GOVERNO.filter((aba) => aba.para !== '/governo').map((aba) => (
            <Link key={aba.para} to={aba.para} onClick={fechar} className="nav-menu-subitem" aria-label={T.menuDoDinheiro.doGoverno(aba.rotulo)}>
              {aba.rotulo}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
