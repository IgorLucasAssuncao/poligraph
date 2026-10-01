import type { ReactNode } from 'react';

/**
 * Link para a fonte oficial de um dado — a Câmara, o Senado, o Portal, o TSE.
 *
 * ⭐ Abre em nova aba e DIZ isso ao leitor de tela: sair do site sem aviso desorienta
 * quem ⛔ vê a aba nova surgir.
 *
 * ⚠️ `noopener noreferrer`: a página oficial ⛔ recebe de onde a pessoa veio, nem
 * controle sobre esta aba.
 */
export function LinkDeFonte({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href) return null;

  return (
    <a className="link-fonte" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-apenas"> (abre o site oficial em nova aba)</span>
    </a>
  );
}
