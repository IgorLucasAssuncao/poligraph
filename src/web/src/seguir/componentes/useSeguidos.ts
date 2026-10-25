import { useEffect, useSyncExternalStore } from 'react';
import { listarSeguidos, type Parlamentar } from '../../nucleo/api';
import { EVENTO_SEGUIDOS_MUDARAM } from '../../nucleo/constantes';
import { useSessao } from '../../nucleo/sessao';

/** O que o site sabe de quem a pessoa segue: a lista (nula até chegar) e os ids, já com os cliques que ainda não voltaram. */
export type Seguidos = { lista: Parlamentar[] | null; ids: ReadonlySet<number> };

const SEM_LISTA: Seguidos = { lista: null, ids: new Set() };

let guardado = SEM_LISTA;
let geracao = 0;
let pedindo = false;
let telasQueUsam = 0;
const ouvintes = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener(EVENTO_SEGUIDOS_MUDARAM, () => {
    if (guardado.lista !== null || pedindo) buscar();
  });
}

/**
 * Quem a pessoa segue, numa lista só para o site inteiro.
 *
 * DECISÃO (2026-10-23): antes cada tela pedia a sua (o início pedia quatro vezes) e guardava a sua cópia; seguir pelas
 * sugestões não aparecia em "Quem você segue" logo abaixo. Agora todas leem a mesma, e seguir ou deixar de seguir muda
 * todas na hora.
 *
 * RISCO: Dado de quem a pessoa segue, fora do cache de leituras, como antes: some ao sair da conta e quando nenhuma tela o
 * usa, e é buscado de novo a cada mudança (o `api.ts` avisa com `EVENTO_SEGUIDOS_MUDARAM`).
 */
export function useSeguidos(): Seguidos {
  const { usuario } = useSessao();
  const comConta = usuario !== null;

  useEffect(() => {
    if (!comConta) {
      esquecer();
      return;
    }
    telasQueUsam++;
    if (guardado.lista === null && !pedindo) buscar();
    return () => {
      telasQueUsam--;
      if (telasQueUsam === 0) esquecer();
    };
  }, [comConta]);

  const atual = useSyncExternalStore(assinar, () => guardado);
  return comConta ? atual : SEM_LISTA;
}

/**
 * O clique em "Seguir" ou "Deixar de seguir", antes de a API responder: o botão é otimista, e todas as telas mudam com ele.
 * A resposta traz a lista certa logo depois.
 */
export function marcarSeguido(idPessoa: number, seguindoAgora: boolean): void {
  const ids = new Set(guardado.ids);
  if (seguindoAgora) ids.add(idPessoa);
  else ids.delete(idPessoa);
  const lista = guardado.lista && (seguindoAgora ? guardado.lista : guardado.lista.filter((p) => p.idPessoa !== idPessoa));
  publicar({ lista, ids });
}

function buscar(): void {
  const esta = ++geracao;
  pedindo = true;
  listarSeguidos()
    .then((lista) => esta === geracao && publicar({ lista, ids: new Set(lista.map((p) => p.idPessoa)) }))
    .catch(() => esta === geracao && publicar({ lista: guardado.lista ?? [], ids: guardado.ids }))
    .finally(() => {
      if (esta === geracao) pedindo = false;
    });
}

function esquecer(): void {
  geracao++;
  pedindo = false;
  if (guardado !== SEM_LISTA) publicar(SEM_LISTA);
}

function publicar(novo: Seguidos): void {
  guardado = novo;
  ouvintes.forEach((avisar) => avisar());
}

function assinar(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}
