import { describe, expect, it } from 'vitest';
import { POLITICA_DE_PRIVACIDADE, TEXTO_CONSENTIMENTO } from './textos-legais';

/**
 * Os dois textos vão para a tela por `dangerouslySetInnerHTML` (o negrito do banner e a política em
 * Markdown simples). RISCO: um `<` no texto de origem viraria HTML de verdade na página; o teste
 * garante que só o conversor do próprio site produz marcação (auditoria de 2026-10-03, OWASP A03).
 */
describe('textos que viram HTML', () => {
  it('a política de privacidade não traz marcação', () => {
    expect(POLITICA_DE_PRIVACIDADE).not.toMatch(/[<>]/);
  });

  it('o banner de consentimento não traz marcação', () => {
    for (const paragrafo of TEXTO_CONSENTIMENTO.corpo) expect(paragrafo).not.toMatch(/[<>]/);
  });
});
