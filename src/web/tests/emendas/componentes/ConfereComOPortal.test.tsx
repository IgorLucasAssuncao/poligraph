import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { obterReconciliacao } from '../../../src/nucleo/api';
import type { Reconciliacao } from '../../../src/nucleo/api';
import { ConfereComOPortalComponent } from '../../../src/emendas/componentes/ConfereComOPortal';

vi.mock('../../../src/nucleo/api', async (original) => ({
  ...(await original<typeof import('../../../src/nucleo/api')>()),
  obterReconciliacao: vi.fn(),
}));

const EMPENHADO_2016: Reconciliacao = {
  conjunto: 'EMENDAS', medida: 'EMPENHADO', anoDaFonte: 2016,
  totalNaFonte: 25.92e9, totalNaBase: 10.82e9, totalInferido: 3.6e9,
  motivos: [{ motivo: 'RELATOR_SEM_AUTOR', valor: 13.75e9 }, { motivo: 'COMISSAO_SEM_AUTOR', valor: 1.35e9 }],
};
const PAGAMENTOS_2016: Reconciliacao = {
  conjunto: 'PAGAMENTOS', medida: 'RECEBIDO', anoDaFonte: 2016,
  totalNaFonte: 16.17e9, totalNaBase: 3.61e9, totalInferido: 0,
  motivos: [{ motivo: 'PAGAMENTO_SEM_CODIGO_DE_EMENDA', valor: 12.56e9 }],
};

/** Pendência 81: o total fecha com o Portal, e o que não fecha vem com o motivo à vista. */
describe('confere com o Portal', () => {
  it('diz o total do Portal, o daqui e cada motivo do que ficou fora', async () => {
    vi.mocked(obterReconciliacao).mockResolvedValue([EMPENHADO_2016, PAGAMENTOS_2016]);
    render(<ConfereComOPortalComponent periodo={{ primeiroAno: 2016, ultimoAno: 2016 }} />);

    expect(await screen.findByText('Emendas de relator')).toBeInTheDocument();
    expect(screen.getByText('Emendas de comissão, sem dizer qual comissão')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/O Portal publica R\$\s*25,9\s*bi empenhados em emendas de 2016/);
    expect(document.body.textContent).toMatch(/bancada foi deduzida pelo estado/);
    expect(document.body.textContent).toMatch(/12,6\s*bi em pagamentos feitos de 2016 sem o número da emenda/);
  });

  it('diz quanto o pago das emendas e o recebido pelos favorecidos divergem, nas duas direções', async () => {
    vi.mocked(obterReconciliacao).mockResolvedValue([
      EMPENHADO_2016,
      {
        conjunto: 'PAGO_X_RECEBIDO', medida: 'PAGO', anoDaFonte: 2016,
        totalNaFonte: 9.13e9, totalNaBase: 6.13e9, totalInferido: 0,
        motivos: [{ motivo: 'PAGO_SEM_RECEBEDOR', valor: 3.0e9 }, { motivo: 'RECEBIDO_ACIMA_DO_PAGO', valor: -3.3e6 }],
      },
    ]);
    render(<ConfereComOPortalComponent periodo={{ primeiroAno: 2016, ultimoAno: 2016 }} />);

    await screen.findByText('Emendas de relator');
    expect(document.body.textContent).toMatch(/R\$\s*3\s*bi constam como pagos sem o pagamento ao favorecido publicado/);
    expect(document.body.textContent).toMatch(/R\$\s*3,3\s*mi foram recebidos acima do que a emenda registra como pago/);
  });

  it('quando fecha, diz que é o mesmo do Portal', async () => {
    vi.mocked(obterReconciliacao).mockResolvedValue([
      { ...EMPENHADO_2016, anoDaFonte: 2023, totalNaFonte: 35.38e9, totalNaBase: 35.38e9, totalInferido: 0, motivos: [] },
    ]);
    render(<ConfereComOPortalComponent periodo={{ primeiroAno: 2023, ultimoAno: 2023 }} />);

    expect(await screen.findByText(/é o mesmo do Portal/)).toBeInTheDocument();
  });
});
