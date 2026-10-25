import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CaminhosDasEmendas } from '../../../src/nucleo/api';
import { CaminhosDasEmendasComponent } from '../../../src/emendas/componentes/CaminhosDasEmendas';

vi.mock('../../../src/nucleo/api', async (original) => ({
  ...(await original<typeof import('../../../src/nucleo/api')>()),
  obterCaminhosDasEmendas: vi.fn(),
}));

const api = await import('../../../src/nucleo/api');

const CAMINHOS: CaminhosDasEmendas = {
  periodo: { primeiroAno: 2024, ultimoAno: 2024 },
  total: 600,
  caminhos: [
    { tipo: 'Emenda de Bancada', area: 'Saúde', recebedor: 'MUNICIPIO', valor: 300 },
    { tipo: 'Emenda de Bancada', area: 'Educação', recebedor: 'ESTADO', valor: 100 },
    { tipo: 'Emenda Individual - Transferências Especiais', area: 'Encargos Especiais', recebedor: 'VIA_BANCO', valor: 200 },
  ],
};

/** O valor que o título de cada caixa diz, pela caixa: `Nome: R$ X`. */
function caixas(): string[] {
  return [...document.querySelectorAll('.fitas-caixa title')].map((t) => (t.textContent ?? '').replace(/ /g, ' '));
}

describe('caminhos das emendas', () => {
  it('as três colunas somam o mesmo total, com o tipo encurtado e o recebedor em grupo', async () => {
    vi.mocked(api.obterCaminhosDasEmendas).mockResolvedValue(CAMINHOS);

    render(<CaminhosDasEmendasComponent periodo={undefined} textoDoPeriodo="2024" />);

    expect(await screen.findByRole('heading', { name: 'Por onde o dinheiro passou' })).toBeDefined();
    expect(screen.getByRole('img', { name: /pagos em emendas de 2024, por tipo, área e quem recebeu/ })).toBeDefined();
    expect(caixas()).toEqual(
      expect.arrayContaining([
        'De bancada: R$ 400,00',
        'Individual, transferência especial: R$ 200,00',
        'Saúde: R$ 300,00',
        'Prefeituras e órgãos municipais: R$ 300,00',
        'Repassado por banco: R$ 200,00',
      ]),
    );
    expect(document.querySelectorAll('.fitas-caixa')).toHaveLength(2 + 3 + 3);
  });

  it('a tabela traz os caminhos, do maior ao menor', async () => {
    vi.mocked(api.obterCaminhosDasEmendas).mockResolvedValue(CAMINHOS);

    render(<CaminhosDasEmendasComponent periodo={undefined} textoDoPeriodo="2024" />);

    const linhas = (await screen.findAllByRole('row')).slice(1).map((l) => l.textContent);
    expect(linhas[0]).toContain('Saúde');
    expect(linhas[1]).toContain('Repassado por banco');
  });
});
