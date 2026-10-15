import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BannerConsentimentoComponent } from './BannerConsentimento';
import { TEXTO_CONSENTIMENTO, VERSAO_CONSENTIMENTO } from '../textos-legais';

/**
 * ATENÇÃO: Sem ferramenta configurada o banner não aparece — ver o último teste.
 * Os demais precisam do cenário "há o que consentir".
 *
 * RISCO: LGPD art. 9º §3 — recusar não pode ser mais difícil que aceitar.
 * "Aceitar" em destaque com "saiba mais" escondido invalidaria o consentimento.
 *
 * mesmo elemento, mesmo tipo — nenhum é link disfarçado nem está escondido
 *
 * RISCO: As quatro coisas que o texto PRECISA dizer (plano/02 §4.5.2).
 * Um "usamos cookies para melhorar sua experiência" não autoriza o que é gravado aqui.
 *
 * `expect(texto).toMatch(/gravar sua navegação|cliques/);`: 1. o que é gravado
 *
 * `expect(texto).toMatch(/posição política/);`: 2. revela opinião
 *
 * DECISÃO (2026-10-15): o aviso deixou de dizer que as gravações podem ser exibidas na
 * apresentação e na defesa, a pedido do autor. Sem isso no aviso, gravação do Clarity não se mostra
 * na banca; números agregados (conclusão, abandono) podem.
 *
 * `expect(texto).toMatch(/clarity|fora do brasil/);`: 4. quem recebe
 *
 * `expect(texto).toMatch(/30 dias|9 meses/);`: 5. por quanto tempo
 *
 * DECISÃO: Mudou o texto, mudou a versão → o consentimento antigo não cobre o novo.
 * Sem isto, uma alteração no banner seria aplicada retroativamente a quem nunca a leu.
 *
 * RISCO: O script não pode ser injetado antes do aceite — senão o cookie já foi gravado.
 *
 * DECISÃO: Sem ferramenta de medição configurada, não há o que consentir.
 *
 * Mostrar o banner assim mesmo seria teatro de consentimento: pediria permissão para
 * algo que não acontece, e treinaria a pessoa a clicar em "aceitar" sem ler — que é
 * exatamente o hábito que torna o consentimento inútil quando ele passa a importar.
 */
describe('BannerConsentimento', () => {
  beforeEach(() => {
    localStorage.clear();
    document.getElementById('clarity-js')?.remove();
    vi.stubEnv('VITE_CLARITY_ID', 'abcdefghij');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('aparece quando ainda não houve escolha', () => {
    render(<BannerConsentimentoComponent />);

    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('oferece aceitar e recusar como botões equivalentes', () => {
    render(<BannerConsentimentoComponent />);

    const aceitar = screen.getByRole('button', { name: TEXTO_CONSENTIMENTO.aceitar });
    const recusar = screen.getByRole('button', { name: TEXTO_CONSENTIMENTO.recusar });

    expect(aceitar.tagName).toBe(recusar.tagName);
  });

  it('diz as quatro coisas obrigatórias', () => {
    const { container } = render(<BannerConsentimentoComponent />);
    const texto = container.textContent!.toLowerCase();

    expect(texto).toMatch(/gravar sua navegação|cliques/);
    expect(texto).toMatch(/posição política/);
    expect(texto).toMatch(/clarity|fora do brasil/);
    expect(texto).toMatch(/30 dias|9 meses/);
  });

  it('avisa que recusar não bloqueia o site', () => {
    const { container } = render(<BannerConsentimentoComponent />);

    expect(container.textContent).toMatch(/usar o site normalmente/i);
  });

  it('some depois da escolha', () => {
    localStorage.setItem(
      'poligraph.consentimento',
      JSON.stringify({ versao: VERSAO_CONSENTIMENTO, aceito: false, em: '2026-08-26' }),
    );

    render(<BannerConsentimentoComponent />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('volta a aparecer quando a versão do texto muda', () => {
    localStorage.setItem(
      'poligraph.consentimento',
      JSON.stringify({ versao: 'versao-antiga', aceito: true, em: '2026-01-01' }),
    );

    render(<BannerConsentimentoComponent />);

    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('não carrega o script de medição antes do aceite', () => {
    render(<BannerConsentimentoComponent />);

    expect(document.getElementById('clarity-js')).toBeNull();
  });

  it('não carrega o script se a pessoa recusou', () => {
    localStorage.setItem(
      'poligraph.consentimento',
      JSON.stringify({ versao: VERSAO_CONSENTIMENTO, aceito: false, em: '2026-08-26' }),
    );

    render(<BannerConsentimentoComponent />);

    expect(document.getElementById('clarity-js')).toBeNull();
  });

  it('não aparece quando não há ferramenta de medição configurada', () => {
    vi.stubEnv('VITE_CLARITY_ID', '');

    render(<BannerConsentimentoComponent />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});