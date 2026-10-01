import { render, screen } from '@testing-library/react';
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
