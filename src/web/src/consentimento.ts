import { VERSAO_CONSENTIMENTO } from './textos-legais';

/**
 * O consentimento de medição guardado no navegador, fora do componente do banner.
 *
 * Separado para que outras partes da tela (a oferta do tour, a política de privacidade)
 * leiam e revoguem a escolha sem importar o componente.
 */
export const CHAVE_CONSENTIMENTO = 'poligraph.consentimento';

/** Disparado quando a pessoa responde o banner. */
export const EVENTO_CONSENTIMENTO = 'poligraph:consentimento';

export type Escolha = { versao: string; aceito: boolean; em: string };

export function lerConsentimento(): Escolha | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CONSENTIMENTO);
    return bruto ? (JSON.parse(bruto) as Escolha) : null;
  } catch {
    return null; // navegador anônimo, armazenamento bloqueado
  }
}

/**
 * Se o banner já foi respondido NA VERSÃO ATUAL do texto. Mudou a versão, o banner
 * reabre (art. 8º §2), e quem espera por ele tem de esperar de novo.
 */
export function consentimentoDecidido(): boolean {
  return lerConsentimento()?.versao === VERSAO_CONSENTIMENTO;
}

/** Revoga o consentimento e reabre a escolha. Chamado pela política de privacidade. */
export function revogarConsentimento(): void {
  localStorage.removeItem(CHAVE_CONSENTIMENTO);
  window.clarity?.('consent', false);
  location.reload();
}
