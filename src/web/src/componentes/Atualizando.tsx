import { useRef, type ReactNode } from 'react';
import { useEntradaAoNavegar } from '../transicao';

/**
 * O bloco de dados que troca quando um filtro muda: apagado enquanto o novo carrega, e entra com a
 * mesma transição da troca de tela quando ele chega. O resto da página fica parado.
 */
export function AtualizandoComponent({
  atualizando,
  chave,
  children,
}: {
  atualizando: boolean;
  /** Muda quando o dado novo chega; é o que dispara a entrada. */
  chave: string | undefined;
  children: ReactNode;
}) {
  const bloco = useRef<HTMLDivElement>(null);
  useEntradaAoNavegar(bloco, chave ?? '');
  return (
    <div ref={bloco} className="atualizavel" data-atualizando={atualizando || undefined} aria-busy={atualizando}>
      {children}
    </div>
  );
}
