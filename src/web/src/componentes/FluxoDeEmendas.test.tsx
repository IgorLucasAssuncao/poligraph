import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { obterFluxoDeEmendas, type FluxoDeEmendas } from '../api';
import { FluxoDeEmendasComponent } from './FluxoDeEmendas';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterFluxoDeEmendas: vi.fn(),
}));

const FLUXO: FluxoDeEmendas = {
  periodo: { de: 2025, ate: 2025 },
  uf: null,
  total: 1000,
  nos: [
    { id: 'P:1', rotulo: 'Ana Ribeiro', coluna: 0, tipo: 'parlamentar', valor: 1000, destino: '/parlamentar/1' },
    { id: 'E:1', rotulo: 'Município de Luiziana', coluna: 1, tipo: 'entidade', valor: 700, destino: '/entidades/1' },
    { id: 'INTERMEDIARIO', rotulo: 'Repasse por banco (destino final fora do dado)', coluna: 1, tipo: 'sem-destino', valor: 300, destino: null },
    { id: 'M:1', rotulo: 'LUIZIANA – PR', coluna: 2, tipo: 'cidade', valor: 700, destino: '/emendas?uf=PR&cidade=1' },
    { id: 'SEM_CIDADE', rotulo: 'Sem cidade', coluna: 2, tipo: 'sem-destino', valor: 300, destino: null },
  ],
  arestas: [
    { de: 'P:1', para: 'E:1', valor: 700 },
    { de: 'P:1', para: 'INTERMEDIARIO', valor: 300 },
    { de: 'E:1', para: 'M:1', valor: 700 },
    { de: 'INTERMEDIARIO', para: 'SEM_CIDADE', valor: 300 },
  ],
};

/** Pendência 83: o caminho do dinheiro, com a mesma informação também em tabela. */
describe('o caminho do dinheiro', () => {
  it('desenha as três colunas e pede o fluxo do período e do estado', async () => {
    vi.mocked(obterFluxoDeEmendas).mockResolvedValue(FLUXO);
    render(
      <MemoryRouter>
        <FluxoDeEmendasComponent periodo={{ de: 2025, ate: 2025 }} uf="PR" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('img', { name: /5 nós e 4 setas/ })).toBeDefined();
    expect(screen.getByText('Quem mandou')).toBeDefined();
    expect(vi.mocked(obterFluxoDeEmendas)).toHaveBeenCalledWith({ de: 2025, ate: 2025 }, 'PR');
  });

  it('a tabela lista cada seta com o valor', async () => {
    vi.mocked(obterFluxoDeEmendas).mockResolvedValue(FLUXO);
    render(
      <MemoryRouter>
        <FluxoDeEmendasComponent periodo={{ de: 2025, ate: 2025 }} uf={null} />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Ver como tabela' }));

    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getAllByRole('cell', { name: 'Repasse por banco (destino final fora do dado)' })).toHaveLength(2);
  });
});
