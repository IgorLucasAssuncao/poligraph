import { VERSAO_DO_AVISO_DE_MEDICAO } from './textos-legais';
import { CHAVE_CONSENTIMENTO } from './constantes';

export type Escolha = { versao: string; aceito: boolean; em: string };

/**
 * `return null;`: navegador anônimo, armazenamento bloqueado
 */
export function lerConsentimento(): Escolha | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CONSENTIMENTO);
    return bruto ? (JSON.parse(bruto) as Escolha) : null;
  } catch {
    return null;
  }
}

/**
 * Se o banner já foi respondido NA VERSÃO ATUAL do texto. Mudou a versão, o banner
 * reabre (art. 8º §2), e quem espera por ele tem de esperar de novo.
 */
export function consentimentoDecidido(): boolean {
  return lerConsentimento()?.versao === VERSAO_DO_AVISO_DE_MEDICAO;
}

/** Revoga o consentimento e reabre a escolha. Chamado pela política de privacidade. */
export function revogarConsentimento(): void {
  localStorage.removeItem(CHAVE_CONSENTIMENTO);
  window.clarity?.('consent', false);
  location.reload();
}
