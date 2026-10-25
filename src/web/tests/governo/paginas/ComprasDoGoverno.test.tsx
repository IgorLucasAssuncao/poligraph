import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../../../src/nucleo/api';
import type { ComprasDoGoverno } from '../../../src/nucleo/api';
import { ComprasDoGovernoComponent } from '../../../src/governo/paginas/ComprasDoGoverno';

vi.mock('../../../src/nucleo/api', async (original) => ({
  ...(await original<typeof import('../../../src/nucleo/api')>()),
  obterComprasDoGoverno: vi.fn(),
}));

const COMPRAS: ComprasDoGoverno = {
  periodo: { primeiroAno: 2022, ultimoAno: 2022 },
  anosDisponiveis: [2022],
  gestoesDisponiveis: [],
  contratos: 35_607, valor: 75.1e9, sigilosos: 120, valorSigiloso: 40e6, semModalidade: 50e9,
  divergentes: 9, valorDescartado: 64.2e9,
  porAno: [{ anoDaPublicacao: 2022, contratos: 35_607, valor: 75.1e9 }],
  porModalidade: [{ modalidade: 'Sem Informação', contratos: 28_000, valor: 50e9 }],
  porOrgao: [{ orgao: 'Ministério da Saúde', contratos: 3_000, valor: 9e9, sigilosos: 0 }],
  contratados: [{ cnpj: '61189445000156', nome: 'FUNDACAO BUTANTAN', contratos: 4, valor: 1.23e9 }],
};

function renderizar() {
  return render(
    <MemoryRouter>
      <ComprasDoGovernoComponent />
    </MemoryRouter>,
  );
}

describe('compras e contratos', () => {
  it('diz o total e o que ficou fora por erro de digitação na fonte', async () => {
    vi.mocked(api.obterComprasDoGoverno).mockResolvedValue(COMPRAS);
    renderizar();

    expect(await screen.findByText('Por modalidade de compra')).toBeDefined();
    const texto = document.body.textContent ?? '';
    expect(texto).toMatch(/Em 2022, o governo federal publicou 35\.607 contratos, que somam R\$\s*75,1\s*bi/);
    expect(texto).toMatch(/9 contratos têm erro de digitação no valor/);
    expect(texto).toMatch(/os R\$\s*64,2\s*bi a mais ficam fora/);
    expect(texto).toMatch(/não diz a modalidade de compra, então não dá para saber se houve licitação/);
  });

  it('a empresa leva à página da entidade', async () => {
    vi.mocked(api.obterComprasDoGoverno).mockResolvedValue(COMPRAS);
    renderizar();

    const link = await screen.findByRole('link', { name: 'Fundacao Butantan' });
    expect(link.getAttribute('href')).toBe('/entidades/61189445000156');
  });

  it('sem carga, diz que os contratos ainda não foram carregados', async () => {
    vi.mocked(api.obterComprasDoGoverno).mockResolvedValue(null);
    renderizar();

    expect(await screen.findByText('Os contratos ainda não foram carregados.')).toBeDefined();
  });
});
