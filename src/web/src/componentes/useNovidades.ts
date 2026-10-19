import { useEffect, useState } from 'react';
import { listarSeguidos, obterNovidades } from '../api';
import type { Novidades } from '../api';
import { EVENTO_SEGUIDOS_MUDARAM } from '../constantes';

/**
 * As novidades de quem a pessoa segue e quantas pessoas ela segue, para o sininho e o cartão do
 * início (Pendência 89). Busca de novo quando a lista muda: seguir, deixar de seguir ou revogar.
 *
 * RISCO: Dado de quem a pessoa segue, fora do cache de leituras: guardado, mostraria a lista de uma
 * conta a outra no mesmo navegador.
 *
 * `ativo`: falso sem conta, e nada é buscado.
 */
export function useNovidades(ativo: boolean): { novidades: Novidades | null; seguidos: number | null; erro: boolean } {
  const [estado, setEstado] = useState<{ novidades: Novidades | null; seguidos: number | null; erro: boolean }>({
    novidades: null,
    seguidos: null,
    erro: false,
  });

  useEffect(() => {
    if (!ativo) return;
    let atual = true;
    const buscar = () =>
      Promise.all([obterNovidades(), listarSeguidos()])
        .then(([novidades, lista]) => atual && setEstado({ novidades, seguidos: lista.length, erro: false }))
        .catch(() => atual && setEstado((anterior) => ({ ...anterior, erro: true })));
    void buscar();
    window.addEventListener(EVENTO_SEGUIDOS_MUDARAM, buscar);
    return () => {
      atual = false;
      window.removeEventListener(EVENTO_SEGUIDOS_MUDARAM, buscar);
    };
  }, [ativo]);

  return estado;
}
