import type { ReactNode } from 'react';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * Link para a fonte oficial de um dado — a Câmara, o Senado, o Portal, o TSE.
 *
 * DECISÃO: Abre em nova aba e DIZ isso ao leitor de tela: sair do site sem aviso desorienta
 * quem não vê a aba nova surgir.
 *
 * ATENÇÃO: `noopener noreferrer`: a página oficial não recebe de onde a pessoa veio, nem
 * controle sobre esta aba.
 */
export function LinkDeFonteComponent({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href) return null;

  return (
    <a className="link-fonte" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-apenas">{T.linkDeFonte}</span>
    </a>
  );
}
