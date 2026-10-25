import { QueryClient } from '@tanstack/react-query';

/** Quanto um dado lido vale antes de ser buscado de novo: o mesmo `max-age` da API. */
const VALIDADE = 5 * 60 * 1000;

/** Quanto um dado que nenhuma tela usa fica guardado antes de sair da memória. */
const GUARDA = 30 * 60 * 1000;

/**
 * O cache de leituras do site: cada resposta da API fica guardada pela chave da consulta.
 *
 * DECISÃO (2026-10-10): voltar a uma página mostra o dado guardado na hora, sem pedir de novo
 * por cinco minutos. O dado só muda quando a ETL roda. Pedidos iguais em andamento viram um só.
 *
 * ATENÇÃO: os hooks passam este cliente direto ao `useQuery`, e não por contexto: os testes
 * renderizam componentes soltos, sem provedor. O `vitest.setup.ts` limpa o cache entre os testes.
 *
 * DECISÃO: dado da pessoa (quem ela segue, novidades) fica fora deste cache e é buscado na hora:
 * um "seguindo" guardado ficaria velho no momento em que ela segue alguém em outra tela.
 */
export const clienteDeConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: VALIDADE,
      gcTime: GUARDA,
      refetchOnWindowFocus: false,
      retry: import.meta.env.MODE === 'test' ? false : 1,
    },
  },
});
