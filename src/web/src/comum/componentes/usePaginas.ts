import { useState } from 'react';
import type { PaginaDe } from '../../nucleo/api';
import { A_VISTA } from '../../nucleo/constantes';

/**
 * Lista que ainda não trouxe nada: a primeira página vem no primeiro clique.
 *
 * ATENÇÃO: Precisa ser SEMPRE este mesmo array. Um `[]` escrito na chamada é um array novo a
 * cada desenho, e o hook entenderia que a lista mudou e a zeraria.
 */
export const NENHUM: never[] = [];

/**
 * Uma lista que começa com o que a tela já tem e busca o resto sob demanda.
 *
 * DECISÃO: `inicial` é a primeira página quando a ficha já a traz, e buscá-la de novo seria uma
 * chamada à toa. A próxima página sai do que já foi carregado dividido por `porPagina`:
 * com `NENHUM`, o primeiro clique busca a página 1.
 *
 * ATENÇÃO: Mudou `inicial` (outro parlamentar, outro ano), a lista recomeça — não se somam
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


/**
 * Corta a lista em {@link A_VISTA} itens até o primeiro "Mostrar mais", que abre o que já veio
 * carregado; daí em diante o botão segue a paginação de {@link usePaginas}, quando há.
 *
 * DECISÃO (2026-10-03, pedido do autor para encurtar a aba Emendas): a API manda oito por página,
 * e oito linhas em cada lista empurravam o resto da aba para baixo.
 */
export function useAVista<T>(
  lista: { itens: T[]; restantes: number; proximos: number; carregando: boolean; erro: boolean; carregarMais: () => void },
) {
  const [aberta, setAberta] = useState(false);
  const escondidos = aberta ? 0 : Math.max(lista.itens.length - A_VISTA, 0);

  return {
    itens: escondidos > 0 ? lista.itens.slice(0, A_VISTA) : lista.itens,
    restantes: lista.restantes + escondidos,
    proximos: escondidos > 0 ? escondidos : lista.proximos,
    carregando: lista.carregando,
    erro: lista.erro,
    carregarMais: escondidos > 0 ? () => setAberta(true) : lista.carregarMais,
  };
}
