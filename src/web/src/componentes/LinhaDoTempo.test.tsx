import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinhaDoTempoComponent } from './LinhaDoTempo';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterLinhaDoTempo: vi.fn(),
}));

const api = await import('../api');

beforeEach(() => {
  vi.mocked(api.obterLinhaDoTempo).mockResolvedValue({
    anos: [
      { ano: 2024, marcos: [{ tipo: 'TROCOU_DE_PARTIDO', partido: 'ABC', partidoAnterior: 'XYZ' }, { tipo: 'GASTOU_NA_COTA', valor: 500_000 }] },
      { ano: 2022, marcos: [{ tipo: 'DECLAROU_BENS', valor: 1_000_000, quantidade: 3 }] },
    ],
  });
});

describe('Linha do tempo', () => {
  it('um ano por linha, e na ficha do parlamentar o marco leva à aba', async () => {
    render(
      <MemoryRouter>
        <LinhaDoTempoComponent idPessoa={7} abas="/parlamentar/7" />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Passou a votar pelo ABC; antes, XYZ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /da cota parlamentar/ })).toHaveAttribute('href', '/parlamentar/7/cota');
    expect(screen.getByText(/em 3 bens ao TSE/)).toBeInTheDocument();
  });
});
