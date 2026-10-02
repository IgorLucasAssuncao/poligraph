import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EsqueletoDeLista, EsqueletoDePainel } from './Esqueleto';

/**
 * O leitor de tela não vê o cinza: ele precisa ouvir o que está vindo.
 *
 * RISCO: Forma sem conteúdo: nenhum número, nome ou manchete de exemplo.
 */
describe('Esqueleto', () => {
  it('anuncia ao leitor de tela o que está carregando', () => {
    render(<EsqueletoDeLista rotulo="Buscando parlamentares" />);

    const estado = screen.getByRole('status');
    expect(estado.getAttribute('aria-busy')).toBe('true');
    expect(estado.textContent).toContain('Buscando parlamentares');
  });

  it('esconde as barras da árvore de acessibilidade', () => {
    const { container } = render(<EsqueletoDeLista rotulo="Buscando parlamentares" linhas={3} />);

    expect(container.querySelector('[aria-hidden="true"] .esqueleto-avatar')).not.toBeNull();
    expect(container.querySelectorAll('.linha.esqueleto')).toHaveLength(3);
  });

  it('não inventa conteúdo: só o rótulo escondido tem texto', () => {
    const { container } = render(<EsqueletoDePainel rotulo="Carregando o governo" />);

    expect(container.textContent).toBe('Carregando o governo');
  });
});
