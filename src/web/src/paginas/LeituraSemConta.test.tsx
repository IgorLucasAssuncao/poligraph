import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Parlamentar } from './Parlamentar';

/**
 * Leitura sem conta — desligada no período eleitoral (RNF-17), pronta para depois dele.
 *
 * 🔴 O que se protege: sem conta, a ficha abre (a lista de seguidos responderia 401 e a
 * derrubaria).
 *
 * ⭐ Desde 2026-10-02 a conta é opcional e só serve para seguir: o "Seguir" aparece, e
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
  }),
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
          <Route path="/parlamentar/:id" element={<Parlamentar />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('heading', { name: /Ana Ribeiro/ })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Seguir/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Seguir' })).toHaveAttribute(
      'href', '/entrar?voltar=%2Fparlamentar%2F1',
    );
    expect(api.listarSeguidos).not.toHaveBeenCalled();
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
