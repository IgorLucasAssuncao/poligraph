import type { Municipio } from './api';
import { CHAVE_MINHA_CIDADE } from './constantes';

/**
 * A cidade que a pessoa escolheu, guardada só neste navegador: a tela de emendas e a lista de cidades a oferecem.
 *
 * Sem armazenamento (navegação privada, bloqueio), a escolha vale só para esta visita.
 */
export function lerMinhaCidade(): Municipio | null {
  try {
    const bruto = localStorage.getItem(CHAVE_MINHA_CIDADE);
    const lida = bruto ? (JSON.parse(bruto) as Municipio) : null;
    return lida && /^\d{7}$/.test(lida.codigoIbge) && /^[A-Z]{2}$/.test(lida.uf) ? lida : null;
  } catch {
    return null;
  }
}

export function guardarMinhaCidade(m: Municipio): void {
  try {
    localStorage.setItem(CHAVE_MINHA_CIDADE, JSON.stringify(m));
  } catch {
    return;
  }
}
