import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { clienteDeConsultas } from '../../nucleo/consultas';

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
  const chaveDoDado = useChaveDoDado(chave, consulta.data !== undefined && !consulta.isPlaceholderData);

  return {
    dados: consulta.data,
    erro: consulta.isError && !consulta.isPlaceholderData,
    atualizando: consulta.isPlaceholderData,
    chaveDoDado: consulta.data === undefined ? undefined : chaveDoDado,
  };
}

/** Uma página de lista: os itens dela, qual é, de que tamanho, e o total da lista inteira. */
type PaginaDeLista<I> = { itens: I[]; pagina: number; tamanho: number; total: number };

/**
 * Uma lista em páginas, com "mostrar mais": a primeira página e as que vierem depois ficam juntas
 * no cache de leituras, e voltar à lista mostra tudo o que já tinha sido aberto.
 *
 * DECISÃO (2026-10-10): `useInfiniteQuery`, o padrão do TanStack para listas que crescem. Trocar
 * um filtro segura a lista anterior apagada, como o `useCarga`.
 */
export function useLista<P extends PaginaDeLista<unknown>>(
  chave: readonly unknown[],
  buscarPagina: (pagina: number) => Promise<P>,
): {
  primeira: P | undefined;
  itens: P['itens'][number][];
  total: number;
  erro: boolean;
  atualizando: boolean;
  chaveDoDado: string | undefined;
  carregandoMais: boolean;
  carregarMais: () => void;
} {
  const consulta = useInfiniteQuery(
    {
      queryKey: chave,
      queryFn: ({ pageParam }) => buscarPagina(pageParam),
      initialPageParam: 1,
      getNextPageParam: (ultima: P, todas: P[]) =>
        todas.reduce((soma, p) => soma + p.itens.length, 0) < ultima.total ? ultima.pagina + 1 : undefined,
      placeholderData: (anterior, consultaAnterior) =>
        consultaAnterior && mesmoComeco(consultaAnterior.queryKey, chave, 1) ? anterior : undefined,
    },
    clienteDeConsultas,
  );
  const chaveDoDado = useChaveDoDado(chave, consulta.data !== undefined && !consulta.isPlaceholderData);
  const paginas = consulta.data?.pages ?? [];

  return {
    primeira: paginas[0],
    itens: paginas.flatMap((p) => p.itens as P['itens'][number][]),
    total: paginas[0]?.total ?? 0,
    erro: consulta.isError && !consulta.isPlaceholderData,
    atualizando: consulta.isPlaceholderData,
    chaveDoDado: consulta.data === undefined ? undefined : chaveDoDado,
    carregandoMais: consulta.isFetchingNextPage,
    carregarMais: () => void consulta.fetchNextPage(),
  };
}

/** As duas chaves começam pelos mesmos `n` itens. */
function mesmoComeco(a: readonly unknown[], b: readonly unknown[], n: number): boolean {
  return JSON.stringify(a.slice(0, n)) === JSON.stringify(b.slice(0, n));
}

/**
 * A chave do dado que está na tela: a atual quando ele chegou, a anterior enquanto o novo carrega.
 * O `AtualizandoComponent` anima quando ela muda.
 */
function useChaveDoDado(chave: readonly unknown[], chegou: boolean): string | undefined {
  const atual = JSON.stringify(chave);
  const [ultima, setUltima] = useState<string | undefined>(undefined);
  if (chegou && ultima !== atual) {
    setUltima(atual);
    return atual;
  }
  return ultima;
}
