import { useCallback, useEffect, useState } from 'react';
import type { Novidades } from '../../nucleo/api';
import { CHAVE_NOVIDADES_VISTAS } from '../../nucleo/constantes';
import { montarItens } from './itensDoQueMudou';
import type { Item } from './itensDoQueMudou';

/** O evento que avisa os outros leitores da lista de vistas, no mesmo navegador, que ela mudou. */
const EVENTO = 'poligraph:novidades-vistas';

/**
 * As novidades que este navegador já mostrou (Pendência 89), compartilhadas entre o sininho do
 * cabeçalho e o bloco do início: abrir um zera a contagem do outro na hora.
 *
 * DECISÃO: Fica no aparelho, e não na conta: é uma lista de fatos sobre quem a pessoa segue, e o
 * servidor não precisa saber o que ela leu.
 */
export function useNovidadesVistas() {
  const [vistas, setVistas] = useState<string[]>(lerVistas);

  useEffect(() => {
    const atualizar = () => setVistas(lerVistas());
    window.addEventListener(EVENTO, atualizar);
    return () => window.removeEventListener(EVENTO, atualizar);
  }, []);

  const marcar = useCallback((chaves: string[]) => {
    setVistas(chaves);
    try {
      localStorage.setItem(CHAVE_NOVIDADES_VISTAS, JSON.stringify(chaves));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { vistas, marcar };
}

/**
 * As novidades que contam como novas: todas, menos os votos da semana, que se repetem
 * toda semana e não avisam (Pendência 89).
 */
export function novidadesQueContam(novidades: Novidades | null): Item[] {
  return novidades ? montarItens(novidades).filter((item) => !item.chave.startsWith('semana-')) : [];
}

function lerVistas(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_NOVIDADES_VISTAS);
    return bruto ? (JSON.parse(bruto) as string[]) : [];
  } catch {
    return [];
  }
}
