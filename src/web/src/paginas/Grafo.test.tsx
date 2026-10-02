import { render, screen, waitFor } from '@testing-library/react';
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
  abertasDesde: null,
  abertasAte: null,
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

/** O período do grafo (achado #35): vem da faixa do topo, pelo endereço. */
describe('o período do grafo', () => {
  it('pede a legislatura do endereço', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue({ ...GRAFO, legislatura: 56, legislaturasComGrafo: [57, 56] });
    render(
      <MemoryRouter initialEntries={['/parlamentares?vista=grafo&legislatura=56']}>
        <Grafo />
      </MemoryRouter>,
    );

    await waitFor(() => expect(vi.mocked(api.obterGrafo)).toHaveBeenLastCalledWith('CAMARA', 56));
  });

  /** ⭐ "Todas" é da lista: ⛔ existe grafo de todas juntas, e vale a corrente. */
  it('"todos os períodos" desenha a corrente', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue(GRAFO);
    render(
      <MemoryRouter initialEntries={['/parlamentares?vista=grafo&legislatura=todas']}>
        <Grafo />
      </MemoryRouter>,
    );

    await waitFor(() => expect(vi.mocked(api.obterGrafo)).toHaveBeenLastCalledWith('CAMARA', undefined));
  });

  it('sem grafo no período, oferece os que têm', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue({
      ...GRAFO, legislatura: 51, nos: [], arestas: [], legislaturasComGrafo: [57, 56],
    });
    render(
      <MemoryRouter initialEntries={['/parlamentares?vista=grafo&legislatura=51']}>
        <Grafo />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: '2019–2023' }));
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

  /** 📐 A 55ª do Senado: a legislatura é 2015–2019, e as abertas vão de 2016 a 2018 (achado #37). */
  it('diz o recorte que o desenho cobre, ⛔ só o período da legislatura', async () => {
    vi.mocked(api.obterGrafo).mockResolvedValue({
      ...GRAFO, legislatura: 55, legislaturasComGrafo: [57, 55],
      abertasDesde: '2016-05-11', abertasAte: '2018-12-12',
    });
    renderizar();

    const texto = (await screen.findByText(/as abertas vão de/)).closest('p')!.textContent;
    expect(texto).toMatch(/2015–2019 — as abertas vão de mai\/2016 a dez\/2018\./);
  });
});
