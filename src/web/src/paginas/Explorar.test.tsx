import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Explorar } from './Explorar';
import type { PaginaDeParlamentares, Parlamentar } from '../api';

vi.mock('../sessao', () => ({
  useSessao: () => ({
    usuario: { nome: 'Pessoa de Teste', email: 'teste@exemplo.com', fotoUrl: null },
    carregando: false,
    leituraPublica: false,
    entrou: () => {},
    sair: async () => {},
  }),
}));

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  listarParlamentares: vi.fn(),
  listarSeguidos: vi.fn(),
  listarLegislaturas: vi.fn().mockResolvedValue([
    { numero: 57, anoInicial: 2023, anoFinal: 2027, corrente: true, casas: ['CAMARA', 'SENADO'] },
    { numero: 56, anoInicial: 2019, anoFinal: 2023, corrente: false, casas: ['CAMARA', 'SENADO'] },
  ]),
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

function pagina(itens: Parlamentar[], total = itens.length, numero = 1): PaginaDeParlamentares {
  return {
    itens, pagina: numero, tamanho: 30, total,
    partidos: ['PARTIDO-A', 'PARTIDO-B'], ufs: ['BA', 'SP'],
    legislaturaCorrente: 57,
  };
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
    vi.mocked(api.listarParlamentares).mockResolvedValue(
      pagina([parlamentar(1, 'Ana Ribeiro', 'CAMARA', 845), parlamentar(2, 'Bruno Tavares', 'SENADO', 140)]),
    );
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

    expect(await screen.findByText(/845 votos com posição na Câmara/)).toBeInTheDocument();
    expect(screen.getByText(/140 votos com posição no Senado/)).toBeInTheDocument();
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

describe('Explorar em páginas', () => {
  beforeEach(() => {
    vi.mocked(api.listarSeguidos).mockResolvedValue([]);
  });

  /** 🔴 A lista cortava em 100 sem avisar. Agora ela diz quantos são e busca o resto. */
  it('diz o total e mostra mais quando pedido', async () => {
    const primeiros = Array.from({ length: 30 }, (_, i) => parlamentar(i + 1, `Nome ${i + 1}`, 'CAMARA', 800));
    vi.mocked(api.listarParlamentares)
      .mockResolvedValueOnce(pagina(primeiros, 32))
      .mockResolvedValueOnce(pagina([parlamentar(31, 'Nome 31', 'CAMARA', 800), parlamentar(32, 'Nome 32', 'SENADO', 100)], 32, 2));

    render(
      <MemoryRouter>
        <Explorar />
      </MemoryRouter>,
    );

    expect(await screen.findByText('30 de 32 parlamentares')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 2' }));

    expect(await screen.findByText('Nome 32')).toBeInTheDocument();
    expect(screen.getByText('32 parlamentares')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mostrar mais/ })).toBeNull();
    expect(vi.mocked(api.listarParlamentares).mock.lastCall?.[0]).toMatchObject({ pagina: 2 });
  });

  /** ⚠️ As opções vêm da API, da lista inteira — ⛔ do que está na tela. */
  it('os filtros oferecem todos os partidos, mesmo com um só na tela', async () => {
    vi.mocked(api.listarParlamentares).mockResolvedValue(pagina([parlamentar(1, 'Ana Ribeiro', 'CAMARA', 845)]));

    render(
      <MemoryRouter>
        <Explorar />
      </MemoryRouter>,
    );

    await screen.findByText('Ana Ribeiro');
    expect(screen.getByRole('option', { name: 'PARTIDO-B' })).toBeInTheDocument();
  });
});

/** O histórico (achado #35): fora da lista por padrão, e marcado quando entra. */
describe('quem já saiu', () => {
  beforeEach(() => {
    vi.mocked(api.listarSeguidos).mockResolvedValue([]);
    vi.mocked(api.listarParlamentares).mockResolvedValue(
      pagina([
        { ...parlamentar(1, 'Ana Ribeiro', 'CAMARA', 845), legislatura: 57 },
        { ...parlamentar(2, 'Bruno Tavares', 'CAMARA', 610), legislatura: 55 },
      ]),
    );
  });

  function renderizar() {
    return render(
      <MemoryRouter>
        <Explorar />
      </MemoryRouter>,
    );
  }

  it('diz de quando era o mandato de quem já saiu, e ⛔ o de quem está', async () => {
    renderizar();

    expect(await screen.findByText(/Ex-deputado · 2015–2019 · 610 votos com posição/)).toBeInTheDocument();
    expect(screen.getByText('845 votos com posição na Câmara')).toBeInTheDocument();
  });

  /** O período vem da faixa do topo, pelo endereço — a lista só o lê. */
  function renderizarEm(endereco: string) {
    return render(
      <MemoryRouter initialEntries={[endereco]}>
        <Explorar />
      </MemoryRouter>,
    );
  }

  it('o histórico só entra quando pedido', async () => {
    renderizar();
    await screen.findByText(/Ex-deputado/);
    expect(vi.mocked(api.listarParlamentares).mock.calls[0][0]?.anteriores).toBeUndefined();

    vi.mocked(api.listarParlamentares).mockClear();
    renderizarEm('/parlamentares?legislatura=todas');

    await vi.waitFor(() =>
      expect(vi.mocked(api.listarParlamentares).mock.lastCall?.[0]?.anteriores).toBe(true),
    );
  });

  /**
   * Um período passado é a lista DELE — e quem foi reeleito ⛔ vira "Ex-deputado" só
   * por estar numa lista de 2019.
   */
  it('um período passado pede a legislatura dele e ⛔ chama ninguém de ex', async () => {
    renderizarEm('/parlamentares?legislatura=56');

    await vi.waitFor(() =>
      expect(vi.mocked(api.listarParlamentares).mock.lastCall?.[0]).toMatchObject({ legislatura: 56 }),
    );
    expect(vi.mocked(api.listarParlamentares).mock.lastCall?.[0]?.anteriores).toBeUndefined();
    expect(await screen.findByText(/que votaram em 2019–2023/)).toBeInTheDocument();
    expect(screen.queryByText(/Ex-deputado/)).toBeNull();
  });

  it('a ficha abre no mandato de quem já saiu', async () => {
    renderizar();
    await screen.findByText(/Ex-deputado/);

    for (const link of screen.getAllByRole('link', { name: 'Bruno Tavares' })) {
      expect(link).toHaveAttribute('href', '/parlamentar/2?legislatura=55');
    }
    for (const link of screen.getAllByRole('link', { name: 'Ana Ribeiro' })) {
      expect(link).toHaveAttribute('href', '/parlamentar/1');
    }
  });

  it('a casa vira filtro da consulta', async () => {
    renderizar();
    await screen.findByText(/Ex-deputado/);

    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'SENADO' } });

    await vi.waitFor(() =>
      expect(vi.mocked(api.listarParlamentares).mock.lastCall?.[0]?.casa).toBe('SENADO'),
    );
  });
});
