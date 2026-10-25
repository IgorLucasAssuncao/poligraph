import { useEffect, useState } from 'react';
import { obterNovidades } from '../../nucleo/api';
import type { Novidades } from '../../nucleo/api';
import { EVENTO_SEGUIDOS_MUDARAM } from '../../nucleo/constantes';
import { useSeguidos } from './useSeguidos';

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
  const [estado, setEstado] = useState<{ novidades: Novidades | null; erro: boolean }>({ novidades: null, erro: false });
  const lista = useSeguidos().lista;

  useEffect(() => {
    if (!ativo) return;
    let atual = true;
    const buscar = () =>
      obterNovidades()
        .then((novidades) => atual && setEstado({ novidades, erro: false }))
        .catch(() => atual && setEstado((anterior) => ({ ...anterior, erro: true })));
    void buscar();
    window.addEventListener(EVENTO_SEGUIDOS_MUDARAM, buscar);
    return () => {
      atual = false;
      window.removeEventListener(EVENTO_SEGUIDOS_MUDARAM, buscar);
    };
  }, [ativo]);

  return { ...estado, seguidos: lista?.length ?? null };
}
