import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ParlamentarComponent } from './Parlamentar';

/**
 * Leitura sem conta — desligada no período eleitoral (RNF-17), pronta para depois dele.
 *
 * RISCO: O que se protege: sem conta, a ficha abre (a lista de seguidos responderia 401 e a
 * derrubaria).
 *
 * DECISÃO: Desde 2026-10-02 a conta é opcional e só serve para seguir: o "Seguir" aparece, e
 * leva a entrar — voltando para a mesma ficha.
 */
vi.mock('../sessao', () => ({
  useSessao: () => ({
    usuario: null, carregando: false, leituraPublica: true, entrou: () => {}, sair: async () => {},
  }),
}));

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterFicha: vi.fn().mockResolvedValue({
    id: 1, nome: 'Ana Ribeiro', casa: 'CAMARA', nomeCivil: 'ANA RIBEIRO', partido: 'PARTIDO-A',
    uf: 'SP', urlFoto: null, nVotacoes: 0, nRegistrosDeVoto: 0, votosRecentes: [],
    maisSimilares: [], alinhamento: null, urlFonte: null,
    legislatura: 57,
    mandatos: [{ legislatura: 57, casa: 'CAMARA', anoInicial: 2023, partido: 'PARTIDO-A', uf: 'SP', nRegistrosDeVoto: 0 }],
  }),
  listarLegislaturas: vi.fn().mockResolvedValue([
    { numero: 57, anoInicial: 2023, anoFinal: 2027, corrente: true, casas: ['CAMARA', 'SENADO'] },
    { numero: 56, anoInicial: 2019, anoFinal: 2023, corrente: false, casas: ['CAMARA', 'SENADO'] },
  ]),
  listarSeguidos: vi.fn().mockRejectedValue(new Error('401')),
  obterGastos: vi.fn().mockResolvedValue({ ano: 0, total: 0, lancamentos: 0, porCategoria: [], maioresFornecedores: [] }),
  obterEmendas: vi.fn().mockRejectedValue(new Error('sem')),
  obterFinanciamento: vi.fn().mockRejectedValue(new Error('sem')),
}));

const api = await import('../api');

describe('ficha sem conta', () => {
  it('abre, e "Seguir" leva a entrar e voltar para cá', async () => {
    render(
      <MemoryRouter initialEntries={['/parlamentar/1']}>
        <Routes>
          <Route path="/parlamentar/:id" element={<ParlamentarComponent />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('heading', { name: /Ana Ribeiro/ })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Seguir/ })).toBeNull();
    expect(await screen.findByRole('link', { name: 'Seguir' })).toHaveAttribute(
      'href', '/entrar?voltar=%2Fparlamentar%2F1',
    );
    expect(api.listarSeguidos).not.toHaveBeenCalled();
  });
});

/** DECISÃO: Seguir é acompanhar quem está no poder (decisão do autor, 2026-10-02). */
describe('ficha de quem já saiu', () => {
  it('Não oferece "Seguir"', async () => {
    vi.mocked(api.obterFicha).mockResolvedValueOnce({
      ...(await api.obterFicha(1)),
      legislatura: 52,
      mandatos: [{ legislatura: 52, casa: 'CAMARA', anoInicial: 2003, partido: 'PARTIDO-A', uf: 'SP', nRegistrosDeVoto: 9 }],
    });
    render(
      <MemoryRouter initialEntries={['/parlamentar/1']}>
        <Routes>
          <Route path="/parlamentar/:id" element={<ParlamentarComponent />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('heading', { name: /Ana Ribeiro/ })).length).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('link', { name: 'Seguir' })).toBeNull();
  });
});

describe('a volta depois de entrar', () => {
  it('só aceita caminho interno — outro domínio seria redirecionamento aberto', async () => {
    const { destinoSeguro } = await import('../componentes/useEntrar');

    expect(destinoSeguro('/parlamentar/1?legislatura=56')).toBe('/parlamentar/1?legislatura=56');
    expect(destinoSeguro('https://exemplo.com')).toBe('/');
    expect(destinoSeguro('//exemplo.com')).toBe('/');
    expect(destinoSeguro(null)).toBe('/');
  });
});
