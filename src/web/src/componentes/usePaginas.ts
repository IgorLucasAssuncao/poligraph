import { useState } from 'react';
import type { PaginaDe } from '../api';

/**
 * Lista que ainda ⛔ trouxe nada: a primeira página vem no primeiro clique.
 *
 * ⚠️ Precisa ser SEMPRE este mesmo array. Um `[]` escrito na chamada é um array novo a
 * cada desenho, e o hook entenderia que a lista mudou e a zeraria.
 */
export const NENHUM: never[] = [];

/**
 * Uma lista que começa com o que a tela já tem e busca o resto sob demanda.
 *
 * ⭐ `inicial` é a primeira página quando a ficha já a traz, e buscá-la de novo seria uma
 * chamada à toa. A próxima página sai do que já foi carregado dividido por `porPagina`:
 * com `NENHUM`, o primeiro clique busca a página 1.
 *
 * ⚠️ Mudou `inicial` (outro parlamentar, outro ano), a lista recomeça — ⛔ se somam
 * itens de duas fichas.
 */
export function usePaginas<T>(
  inicial: T[],
  total: number,
  porPagina: number,
  buscar: (pagina: number) => Promise<PaginaDe<T>>,
) {
  const [estado, setEstado] = useState({ base: inicial, extras: [] as T[] });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  const extras = estado.base === inicial ? estado.extras : [];
  const itens = [...inicial, ...extras];
  const restantes = Math.max(total - itens.length, 0);

  async function carregarMais() {
    setCarregando(true);
    setErro(false);
    try {
      const proxima = await buscar(Math.floor(itens.length / porPagina) + 1);
      setEstado({ base: inicial, extras: [...extras, ...proxima.itens] });
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  return {
    itens,
    restantes,
    proximos: Math.min(porPagina, restantes),
    carregando,
    erro,
    carregarMais,
  };
}
