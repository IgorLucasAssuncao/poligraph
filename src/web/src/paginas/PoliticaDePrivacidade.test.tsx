import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CONTATO, VERSAO_CONSENTIMENTO } from '../textos-legais';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';
import { PoliticaDePrivacidadeComponent } from './PoliticaDePrivacidade';

vi.mock('../consentimento', () => ({ revogarConsentimento: vi.fn() }));

const consentimento = await import('../consentimento');

describe('política de privacidade', () => {
  it('o texto vira títulos, listas e tabelas, sem marcação crua de Markdown', () => {
    const { container } = render(<PoliticaDePrivacidadeComponent />);
    const documento = container.querySelector('.documento-legal')!;

    expect(documento.querySelector('h1')).not.toBeNull();
    expect(documento.querySelectorAll('h2').length).toBeGreaterThan(1);
    expect(documento.querySelector('table td')).not.toBeNull();
    expect(documento.querySelector('li')).not.toBeNull();
    expect(documento.textContent).not.toMatch(/\*\*|^#|\|---/m);
  });

  it('mostra a versão aceita, o contato e deixa rever a escolha', () => {
    render(<PoliticaDePrivacidadeComponent />);

    expect(screen.getByText(VERSAO_CONSENTIMENTO)).toBeDefined();
    expect(screen.getByRole('link', { name: CONTATO }).getAttribute('href')).toBe(`mailto:${CONTATO}`);

    fireEvent.click(screen.getByRole('button', { name: T.privacidadePagina.rever }));
    expect(consentimento.revogarConsentimento).toHaveBeenCalled();
  });
});
