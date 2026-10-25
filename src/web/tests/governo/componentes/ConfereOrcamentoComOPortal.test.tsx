import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../../../src/nucleo/api';
import { ConfereOrcamentoComOPortalComponent } from '../../../src/governo/componentes/ConfereOrcamentoComOPortal';

vi.mock('../../../src/nucleo/api', async (original) => ({
  ...(await original<typeof import('../../../src/nucleo/api')>()),
  obterReconciliacao: vi.fn(),
}));

const conta = (anoDaFonte: number, totalNaFonte: number, totalNaBase: number): api.Reconciliacao => ({
  conjunto: 'GOVERNO_FEDERAL',
  medida: 'PAGO',
  anoDaFonte,
  totalNaFonte,
  totalNaBase,
  totalInferido: 0,
  motivos: [{ motivo: 'MENSAL_DIFERENTE_DO_ANUAL', valor: totalNaFonte - totalNaBase }],
});

describe('o pago do orçamento federal contra o Portal', () => {
  it('diz a maior diferença do período e mostra cada ano, para mais e para menos', async () => {
    vi.mocked(api.obterReconciliacao).mockResolvedValue([
      conta(2014, 2_112_574e6, 2_104_800e6),
      conta(2022, 3_924_910e6, 3_927_288e6),
      { ...conta(2015, 10, 10), conjunto: 'EMENDAS', medida: 'EMPENHADO' },
    ]);
    render(<ConfereOrcamentoComOPortalComponent periodo={{ primeiroAno: 2014, ultimoAno: 2025 }} />);

    const resumo = (await screen.findByText(/dois arquivos que não batem/)).textContent!.replace(/ /g, ' ');
    expect(resumo).toMatch(/R\$ 7,8 bi em 2014, 3,7 a cada R\$ 1\.000/);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/a mais nos mensais/)).toBeInTheDocument();
    expect(screen.getByText(/a menos nos mensais/)).toBeInTheDocument();
  });

  it('sem ano fechado comparado, não aparece', async () => {
    vi.mocked(api.obterReconciliacao).mockResolvedValue([]);
    const { container } = render(<ConfereOrcamentoComOPortalComponent periodo={{ primeiroAno: 2026, ultimoAno: 2026 }} />);

    await vi.waitFor(() => expect(api.obterReconciliacao).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
