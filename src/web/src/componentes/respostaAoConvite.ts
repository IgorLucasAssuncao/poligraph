import { CHAVE_CONVITE_DE_AVISOS } from '../constantes';

/** Se o convite já foi respondido neste navegador. Sem armazenamento, pergunta de novo: é o lado seguro. */
export function conviteRespondido(): boolean {
  try {
    return localStorage.getItem(CHAVE_CONVITE_DE_AVISOS) !== null;
  } catch {
    return false;
  }
}

export function marcarConviteRespondido(): void {
  try {
    localStorage.setItem(CHAVE_CONVITE_DE_AVISOS, new Date().toISOString());
  } catch {
    return;
  }
}
