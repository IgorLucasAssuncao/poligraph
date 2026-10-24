import { useEffect, type RefObject } from 'react';

/** Fecha o painel aberto no clique fora da `caixa` e no Esc: o comportamento de todo menu do cabeçalho. */
export function useFecharAoSair(aberto: boolean, caixa: RefObject<HTMLElement | null>, fechar: () => void): void {
  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) fechar();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto, caixa, fechar]);
}
