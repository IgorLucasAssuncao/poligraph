import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginaDeParlamentares, Parlamentar } from '../../../src/nucleo/api';
import { SUGESTOES_PARA_SEGUIR } from '../../../src/nucleo/constantes';
import { ContextoDaSessao, type Sessao } from '../../../src/nucleo/sessao';
import { TEXTOS_DOS_COMPONENTES as T } from '../../../src/comum/textos/componentes';
import { SugestoesParaSeguirComponent } from '../../../src/seguir/componentes/SugestoesParaSeguir';

vi.mock('../../../src/nucleo/api', async (original) => ({
  ...(await original<typeof import('../../../src/nucleo/api')>()),
  listarParlamentares: vi.fn(),
  listarSeguidos: vi.fn(),
}));

vi.mock('../../../src/seguir/componentes/BotaoSeguir', () => ({
  BotaoSeguirComponent: ({ seguindo }: { seguindo: boolean }) => <button type="button">{seguindo ? 'seguindo' : 'seguir'}</button>,
}));

const api = await import('../../../src/nucleo/api');

function parlamentar(idPessoa: number, nome: string): Parlamentar {
  return { idPessoa, nome, casa: 'CAMARA', partido: 'PARTIDO', uf: 'PR', nVotacoes: 100 - idPessoa, urlFoto: null };
}

function pagina(itens: Parlamentar[]): PaginaDeParlamentares {
  return { itens, pagina: 1, tamanho: itens.length, total: itens.length, partidos: [], ufs: [], legislaturaCorrente: 57 };
}

function abrir(usuario: Sessao['usuario']) {
  const sessao: Sessao = { usuario, carregando: false, leituraPublica: true, entrou: vi.fn(), sair: vi.fn() };
  return render(
    <MemoryRouter>
      <ContextoDaSessao.Provider value={sessao}>
        <SugestoesParaSeguirComponent />
      </ContextoDaSessao.Provider>
    </MemoryRouter>,
  );
}

describe('quem seguir', () => {
  beforeEach(() => {
    vi.mocked(api.listarParlamentares).mockReset();
    vi.mocked(api.listarSeguidos).mockReset();
  });

  it('sem conta, sugere os que mais votaram', async () => {
    vi.mocked(api.listarParlamentares).mockResolvedValue(pagina([parlamentar(1, 'Ana'), parlamentar(2, 'Bia')]));

    abrir(null);

    expect(await screen.findByRole('heading', { name: T.sugestoes.titulo })).toBeDefined();
    expect(screen.getByText('Ana')).toBeDefined();
    expect(api.listarParlamentares).toHaveBeenCalledWith({ ordem: 'VOTACOES', tamanho: SUGESTOES_PARA_SEGUIR });
    expect(api.listarSeguidos).not.toHaveBeenCalled();
  });

  it('com conta, tira quem a pessoa já segue e pede a mais para completar', async () => {
    vi.mocked(api.listarSeguidos).mockResolvedValue([parlamentar(1, 'Ana')]);
    vi.mocked(api.listarParlamentares).mockResolvedValue(pagina([parlamentar(1, 'Ana'), parlamentar(2, 'Bia')]));

    abrir({ nome: 'Fulana', fotoUrl: null });

    expect(await screen.findByText('Bia')).toBeDefined();
    expect(screen.queryByText('Ana')).toBeNull();
    expect(api.listarParlamentares).toHaveBeenCalledWith({ ordem: 'VOTACOES', tamanho: SUGESTOES_PARA_SEGUIR + 1 });
  });

  it('se a lista falhar, a seção não aparece', async () => {
    vi.mocked(api.listarParlamentares).mockRejectedValue(new Error('fora'));

    const { container } = abrir(null);

    await waitFor(() => expect(api.listarParlamentares).toHaveBeenCalled());
    expect(container.querySelector('.cartao-lateral')).toBeNull();
  });
});
