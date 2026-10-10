import { useQuery } from '@tanstack/react-query';
import { useRef, type ReactNode } from 'react';
import { clienteDeConsultas } from '../consultas';
import { useEntradaAoNavegar } from '../transicao';

/**
 * Lê um dado da API pela `chave` e segura o anterior na tela enquanto o novo não chega.
 *
 * DECISÃO (2026-10-10): trocar um filtro (período, legislatura, casa) não volta a tela ao
 * esqueleto. O esqueleto aparece só na primeira carga; depois, `atualizando` diz que o que está
 * na tela é o da chave anterior. O dado fica no `clienteDeConsultas`: voltar à página não pede de
 * novo.
 *
 * ATENÇÃO: a chave precisa ser única no site inteiro; começa pelo nome da leitura
 * (`['governo', de, ate]`). `ativo: false` espera, sem buscar, até a chave estar completa.
 *
 * RISCO: `manter` diz quantos itens do começo da chave precisam ser iguais para o dado anterior
 * ficar na tela. Na ficha são dois (`['ficha', idPessoa]`): trocar de legislatura mantém, abrir
 * outro parlamentar não, senão a foto e o nome de um apareceriam no lugar do outro.
 */
export function useCarga<T>(
  chave: readonly unknown[],
  buscar: () => Promise<T>,
  opcoes: { ativo?: boolean; manter?: number } = {},
): { dados: T | undefined; erro: boolean; atualizando: boolean; chaveDoDado: string | undefined } {
  const consulta = useQuery(
    {
      queryKey: chave,
      queryFn: buscar,
      placeholderData: (anterior, consultaAnterior) =>
        consultaAnterior && mesmoComeco(consultaAnterior.queryKey, chave, opcoes.manter ?? 1) ? anterior : undefined,
      enabled: opcoes.ativo ?? true,
    },
    clienteDeConsultas,
  );
  const chaveAtual = JSON.stringify(chave);
  const ultima = useRef<string | undefined>(undefined);
  if (consulta.data !== undefined && !consulta.isPlaceholderData) {
    ultima.current = chaveAtual;
  }

  return {
    dados: consulta.data,
    erro: consulta.isError && !consulta.isPlaceholderData,
    atualizando: consulta.isPlaceholderData,
    chaveDoDado: consulta.data === undefined ? undefined : ultima.current,
  };
}

/** As duas chaves começam pelos mesmos `n` itens. */
function mesmoComeco(a: readonly unknown[], b: readonly unknown[], n: number): boolean {
  return JSON.stringify(a.slice(0, n)) === JSON.stringify(b.slice(0, n));
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
