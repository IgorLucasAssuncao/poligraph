import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TermoComponent } from './Termo';

/**
 * O balão sai da caixa onde o termo está: a faixa de números da ficha tem `overflow: hidden`
 * e cortava a explicação pela metade (2026-10-03).
 */
describe('o balão do termo', () => {
  it('abre fora da caixa que contém o termo', async () => {
    render(
      <div data-testid="caixa" style={{ overflow: 'hidden' }}>
        <TermoComponent nome="orientacao" />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'orientação de bancada' }));

    const balao = screen.getByRole('tooltip');
    expect(screen.getByTestId('caixa').contains(balao)).toBe(false);
    expect(screen.getByRole('button', { name: 'orientação de bancada' })).toHaveAttribute('aria-describedby', balao.id);
  });

  it('fecha com Esc e com clique fora, mas não com clique no próprio balão', async () => {
    render(<TermoComponent nome="orientacao" />);
    await userEvent.click(screen.getByRole('button'));

    await userEvent.click(screen.getByRole('tooltip'));
    expect(screen.queryByRole('tooltip')).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(document.body);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
