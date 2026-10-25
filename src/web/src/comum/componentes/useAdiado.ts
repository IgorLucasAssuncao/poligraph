import { useEffect, useState } from 'react';

/**
 * O valor, só depois de ele ficar parado por `espera` milissegundos: quem digita um nome não
 * dispara uma busca por letra.
 */
export function useAdiado<T>(valor: T, espera: number): T {
  const [adiado, setAdiado] = useState(valor);
  useEffect(() => {
    const relogio = setTimeout(() => setAdiado(valor), espera);
    return () => clearTimeout(relogio);
  }, [valor, espera]);
  return adiado;
}
