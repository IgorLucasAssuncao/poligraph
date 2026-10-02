import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Grafo as DadosDoGrafo, NoDoGrafo } from '../api';
import { passosDoGrafo } from '../tour';
import { Grafo } from './Grafo';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterGrafo: vi.fn(),
}));

const api = await import('../api');

function no(id: number, nome: string): NoDoGrafo {
  return {
    id,
    nome,
    partido: 'PARTIDO-A',
    uf: 'SP',
    comunidade: 0,
    eixoX: id / 10,
    eixoY: 0.2,
    nVotacoes: 500,
    componente1: null,
    componente2: null,
    urlFoto: null,
    governismo: 0.5,
  };
}

const GRAFO: DadosDoGrafo = {
  execucaoId: 1,
  casa: 'CAMARA',
  legislatura: 57,
  vizinhosPorNo: 10,
  nos: [no(1, 'Ana Ribeiro'), no(2, 'Bruno Tavares')],
  arestas: [{ de: 1, para: 2, peso: 0.9, votacoesComuns: 100, cosseno: 0.9 }],
  legislaturasComGrafo: [57],
  votacoesDePlenario: 1103,
  secretasDePlenario: 0,
};

describe('o tour do grafo', () => {
  /** Um alvo que sumisse da página faria o tour pular o passo calado. */
  it('encontra na página cada elemento que explica', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue(GRAFO);

    render(
      <MemoryRouter>
        <Grafo />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /Entenda esta tela/ });

    const passos = passosDoGrafo({
      singular: 'deputado',
      plural: 'deputados',
      vizinhosPorNo: 10,
      temAlinhamento: true,
    });
    for (const passo of passos) {
      expect(document.querySelector(`[data-tour="${passo.alvo}"]`), passo.alvo).not.toBeNull();
    }
  });
});

function renderizar() {
  return render(
    <MemoryRouter>
      <Grafo />
    </MemoryRouter>,
  );
}

/** O período do grafo (achado #35): só aparece com mais de uma legislatura com grafo. */
describe('o período do grafo', () => {
  it('com uma legislatura só, ⛔ há seletor', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue(GRAFO);
    renderizar();
    await screen.findByRole('button', { name: /Entenda esta tela/ });

    expect(screen.queryByLabelText('Período')).toBeNull();
  });

  it('com várias, oferece só as que têm grafo e pede a escolhida', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue({ ...GRAFO, legislaturasComGrafo: [57, 56, 55] });
    renderizar();

    const seletor = await screen.findByLabelText('Período');
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual([
      '2023–2027 (atual)', '2019–2023 · 56ª', '2015–2019 · 55ª',
    ]);

    await userEvent.selectOptions(seletor, '56');
    await waitFor(() => expect(vi.mocked(api.obterGrafo)).toHaveBeenLastCalledWith('CAMARA', 56));
  });

  it('o sigilo do Senado é dito com os números da legislatura desenhada', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue({
      ...GRAFO, casa: 'SENADO', votacoesDePlenario: 300, secretasDePlenario: 120,
    });
    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Senado Federal' }));

    expect(await screen.findByText(/Das 300 votações de plenário/)).toBeDefined();
    expect(screen.getByText(/nas 180 abertas/)).toBeDefined();
  });
});
