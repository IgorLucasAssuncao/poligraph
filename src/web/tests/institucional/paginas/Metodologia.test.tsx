import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Metodologia as DadosDaMetodologia } from '../../../src/nucleo/api';
import { MetodologiaComponent } from '../../../src/institucional/paginas/Metodologia';

vi.mock('../../../src/nucleo/api', async (original) => ({
  ...(await original<typeof import('../../../src/nucleo/api')>()),
  obterMetodologia: vi.fn(),
}));

const api = await import('../../../src/nucleo/api');

const DADOS: DadosDaMetodologia = {
  questionario: {
    perguntasDaCamara: 15, aberturaDaCamara: 8, desempateDaCamara: 7,
    perguntasDoSenado: 9, fracaoMinimaDeRespostas: 0.6, minimoDeRespostas: 15,
  },
  afinidade: { quantidadeExibida: 5, vizinhosParaPosicionar: 10 },
  casas: [
    {
      casa: 'CAMARA', legislatura: 57, votacoes: 1122, votacoesSecretas: 0,
      analiseConcluidaEm: '2026-09-25T06:00:00Z', vizinhosPorNo: 12,
      minimoVotacoesComuns: 20, razaoRecencia: 0.86, pesoDestaque: 0.7, pesoAutoridade: 0.3,
    },
    {
      casa: 'SENADO', legislatura: 57, votacoes: 421, votacoesSecretas: 239,
      analiseConcluidaEm: null, vizinhosPorNo: 10,
      minimoVotacoesComuns: null, razaoRecencia: null, pesoDestaque: null, pesoAutoridade: null,
    },
  ],
};

function renderizar() {
  return render(
    <MemoryRouter>
      <MetodologiaComponent />
    </MemoryRouter>,
  );
}

/**
 * RISCO: O número vem do cálculo. O "12" aqui não existe no código da página: se ele
 * aparece, a página leu o parâmetro da execução.
 */
describe('Como calculamos', () => {
  beforeEach(() => {
    vi.mocked(api.obterMetodologia).mockResolvedValue(DADOS);
  });

  it('mostra os parâmetros que a execução gravou', async () => {
    renderizar();

    const linha = (await screen.findByRole('rowheader', { name: 'Ligações mantidas por parlamentar' })).closest('tr')!;
    expect(linha.textContent).toMatch(/12/);
  });

  it('execução antiga, sem parâmetros gravados, mostra traço em vez de inventar', async () => {
    renderizar();

    const linha = (await screen.findByRole('rowheader', { name: /Voto em destaque/ })).closest('tr')!;
    expect(linha.textContent).toMatch(/0,7/);
    expect(linha.textContent).toMatch(/—/);
  });

  it('diz o mínimo de respostas e quantas votações do Senado são secretas', async () => {
    renderizar();

    expect(await screen.findByText(/15 de 24/)).toBeDefined();
    expect(screen.getByText('239')).toBeDefined();
  });
});
