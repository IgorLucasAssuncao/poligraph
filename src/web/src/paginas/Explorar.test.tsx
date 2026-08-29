import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Explorar } from './Explorar';
import type { Parlamentar } from '../api';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  listarParlamentares: vi.fn(),
  listarSeguidos: vi.fn(),
}));

const api = await import('../api');

function parlamentar(
  id: number,
  nome: string,
  casa: Parlamentar['casa'],
  nVotacoes: number,
): Parlamentar {
  return { id, nome, casa, partido: 'PARTIDO-A', uf: 'SP', nVotacoes, urlFoto: null };
}

/**
 * 🔴 A lista mistura as duas casas — 87 deputados e 13 senadores na primeira página do
 * banco real —, e os números **não são comparáveis entre elas**.
 *
 * 📐 Medido em 2026-08-29: o deputado mediano tem **845** votações registradas e o
 * senador mediano, **140**. O senador com MAIS votações (177) fica abaixo de **549 dos
 * 643** deputados.
 *
 * ⚠️ A causa é o Senado fazer menos votação nominal — e 56,8% delas serem secretas —,
 * ⛔ não o senador trabalhar menos. Sem dizer de que casa é cada linha, todo senador
 * parece inativo: um número plausível levando à conclusão errada.
 */
describe('Explorar mistura as casas e precisa dizer qual é qual', () => {
  beforeEach(() => {
    vi.mocked(api.listarSeguidos).mockResolvedValue([]);
    vi.mocked(api.listarParlamentares).mockResolvedValue([
      parlamentar(1, 'Ana Ribeiro', 'CAMARA', 845),
      parlamentar(2, 'Bruno Tavares', 'SENADO', 140),
    ]);
  });

  function renderizar() {
    return render(
      <MemoryRouter>
        <Explorar />
      </MemoryRouter>,
    );
  }

  it('ancora o número à casa de cada parlamentar', async () => {
    renderizar();

    expect(await screen.findByText(/845 votações registradas na Câmara/)).toBeInTheDocument();
    expect(screen.getByText(/140 votações registradas no Senado/)).toBeInTheDocument();
  });

  /**
   * ⛔ "Buscar deputado" excluiria os senadores da leitura de quem procura — e eles
   * estão na lista.
   */
  it('a busca fala de parlamentar, não de deputado', async () => {
    renderizar();

    const campo = await screen.findByRole('searchbox');

    expect(campo.getAttribute('placeholder')).toMatch(/parlamentar/i);
    expect(campo.getAttribute('placeholder')).not.toMatch(/deputado/i);
  });
});
