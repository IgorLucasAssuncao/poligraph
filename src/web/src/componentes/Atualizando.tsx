import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEntradaAoNavegar } from '../transicao';

/**
 * Busca o dado de uma `chave` e segura o anterior na tela enquanto o novo não chega.
 *
 * DECISÃO (2026-10-10): trocar um filtro (período, legislatura, casa) não volta a tela ao
 * esqueleto. O esqueleto aparece só na primeira carga; depois, `atualizando` diz que o que está
 * na tela é o da chave anterior.
 *
 * ATENÇÃO: `buscar` não entra nas dependências: a chave é quem diz quando buscar de novo.
 */
export function useCarga<T>(
  chave: string,
  buscar: () => Promise<T>,
): { dados: T | undefined; erro: boolean; atualizando: boolean; chaveDoDado: string | undefined } {
  const [lido, setLido] = useState<{ chave: string; dados?: T; erro: boolean } | null>(null);
  const busca = useRef(buscar);
  busca.current = buscar;

  useEffect(() => {
    let atual = true;
    busca.current()
      .then((dados) => atual && setLido({ chave, dados, erro: false }))
      .catch(() => atual && setLido((antes) => ({ chave, dados: antes?.dados, erro: true })));
    return () => {
      atual = false;
    };
  }, [chave]);

  const temDado = lido !== null && lido.dados !== undefined;
  return {
    dados: lido?.dados,
    erro: lido?.chave === chave && lido.erro,
    atualizando: temDado && lido.chave !== chave,
    chaveDoDado: temDado ? lido.chave : undefined,
  };
}

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
