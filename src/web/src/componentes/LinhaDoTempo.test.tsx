import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      { ano: 2024, marcos: [{ tipo: 'TROCOU_DE_PARTIDO', partido: 'ABC', partidoAnterior: 'XYZ' }, { tipo: 'GASTOU_NA_COTA', valor: 500_000 }, { tipo: 'EMENDAS_PAGAS', valor: 3_000_000, pago: 1_000_000 }] },
      { ano: 2022, marcos: [{ tipo: 'DECLAROU_BENS', valor: 1_000_000, quantidade: 3 }] },
    ],
  });
});

describe('Linha do tempo', () => {
  it('abre no ano mais recente, o marco leva à aba, e o nó de outro ano mostra o dele', async () => {
    render(
      <MemoryRouter>
        <LinhaDoTempoComponent idPessoa={7} abas="/parlamentar/7" />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Passou a votar pelo ABC; antes, XYZ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /da cota parlamentar/ })).toHaveAttribute('href', '/parlamentar/7/cota');
    expect(screen.getByRole('link', { name: /R\$\s3 mi empenhados, R\$\s1 mi pagos/ })).toHaveAttribute('href', '/parlamentar/7/emendas');
    expect(screen.queryByText(/em 3 bens ao TSE/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2022, 1 registro' }));
    expect(screen.getByText(/em 3 bens ao TSE/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹ Anterior' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Seguinte ›' }));
    expect(screen.getByText('Passou a votar pelo ABC; antes, XYZ')).toBeInTheDocument();
  });
});
