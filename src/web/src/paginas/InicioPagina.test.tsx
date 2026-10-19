import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Grafo, Panorama, Parlamentar } from '../api';
import { periodoDaLegislatura } from '../formato';
import { ContextoDaSessao, type Sessao } from '../sessao';
import { TEXTOS_DO_INICIO as T } from '../textos/inicio';
import { InicioComponent } from './Inicio';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterPanorama: vi.fn(),
  listarSeguidos: vi.fn(),
  obterGrafo: vi.fn(),
}));

vi.mock('../componentes/useLegislatura', () => ({
  useLegislaturaDaUrl: () => [mockLegislaturaDaUrl.valor, vi.fn()],
  useLegislaturas: () => [{ numero: 57, corrente: true, anoInicial: 2023, anoFinal: 2027 }],
}));

vi.mock('../componentes/SugestoesParaSeguir', () => ({ SugestoesParaSeguirComponent: () => null }));
vi.mock('../componentes/NovidadesDosSeguidos', () => ({ NovidadesDosSeguidosComponent: () => <p>novidades de quem você segue</p> }));
vi.mock('../componentes/BarraDePeriodo', () => ({ BarraDePeriodoComponent: () => null }));
vi.mock('../componentes/TelaDoGrafo', () => ({
  TelaDoGrafoComponent: ({ grafo }: { grafo: Grafo }) => <p>grafo com {grafo.nos.length} parlamentares</p>,
}));

/** A legislatura que a URL pede, trocada por teste. */
const mockLegislaturaDaUrl: { valor: number | 'todas' | undefined } = { valor: undefined };

const api = await import('../api');

const PANORAMA: Panorama = {
  legislatura: 57,
  perguntasAtivas: 49,
  perguntasNoQuestionario: 24,
  dinheiro: null,
  porCasa: [
    {
      casa: 'CAMARA', parlamentares: 513, votacoes: 1123, votacoesSemVotoNominal: 4, votacoesSecretas: 2,
      votosComPosicao: 470727, comunidades: 4, ligacoes: 10, votacoesSimbolicas: 300,
      ultima: { data: '2026-09-30', materia: 'PL 1/2026', ementa: null, posicionados: 480, cadeiras: 513 },
    },
  ],
};

function parlamentar(idPessoa: number, nome: string): Parlamentar {
  return { idPessoa, nome, casa: 'CAMARA', partido: 'P', uf: 'PR', nVotacoes: 10, urlFoto: null };
}

function abrir(usuario: Sessao['usuario'] = null) {
  const sessao: Sessao = { usuario, carregando: false, leituraPublica: true, entrou: vi.fn(), sair: vi.fn() };
  return render(
    <MemoryRouter>
      <ContextoDaSessao.Provider value={sessao}>
        <InicioComponent />
      </ContextoDaSessao.Provider>
    </MemoryRouter>,
  );
}

describe('a página inicial', () => {
  beforeEach(() => {
    mockLegislaturaDaUrl.valor = undefined;
    vi.mocked(api.obterPanorama).mockReset();
    vi.mocked(api.listarSeguidos).mockReset();
    vi.mocked(api.obterGrafo).mockReset();
  });

  it('mostra a base de cada casa e o grafo da Câmara', async () => {
    vi.mocked(api.obterPanorama).mockResolvedValue(PANORAMA);
    vi.mocked(api.obterGrafo).mockResolvedValue({ nos: [{ idPessoa: 1 }], legislatura: 57 } as unknown as Grafo);

    abrir();

    expect(screen.getByRole('heading', { level: 1, name: T.titulo })).toBeDefined();
    expect(await screen.findByText('513')).toBeDefined();
    expect(screen.getByText('1.123')).toBeDefined();
    expect(await screen.findByText('grafo com 1 parlamentares')).toBeDefined();
  });

  it('base vazia diz isso, e o grafo vazio some sem legislatura pedida', async () => {
    vi.mocked(api.obterPanorama).mockResolvedValue({ ...PANORAMA, legislatura: null, porCasa: [] });
    vi.mocked(api.obterGrafo).mockResolvedValue({ nos: [], legislatura: 57 } as unknown as Grafo);

    const { container } = abrir();

    expect(await screen.findByText(T.base.vazio)).toBeDefined();
    await waitFor(() => expect(api.obterGrafo).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('.grafo-reserva')).toBeNull());
  });

  it('legislatura sem grafo diz qual período ficou sem desenho', async () => {
    mockLegislaturaDaUrl.valor = 55;
    vi.mocked(api.obterPanorama).mockRejectedValue(new Error('fora'));
    vi.mocked(api.obterGrafo).mockRejectedValue(new Error('fora'));

    abrir();

    expect(await screen.findByText(T.grafo.semGrafo(periodoDaLegislatura(55)))).toBeDefined();
    expect(api.obterPanorama).toHaveBeenCalledWith(55);
  });

  it('com conta, lista quem a pessoa segue e tira quem ela deixa de seguir', async () => {
    vi.mocked(api.obterPanorama).mockResolvedValue(PANORAMA);
    vi.mocked(api.obterGrafo).mockResolvedValue({ nos: [], legislatura: 57 } as unknown as Grafo);
    vi.mocked(api.listarSeguidos).mockResolvedValue([parlamentar(1, 'Ana'), parlamentar(2, 'Bia')]);

    abrir({ nome: 'Fulana', fotoUrl: null });

    expect(await screen.findByRole('heading', { name: T.quemVoceSegue })).toBeDefined();
    expect(screen.getByText('novidades de quem você segue')).toBeDefined();
    expect(screen.getByText('Ana')).toBeDefined();
    expect(screen.getByText('Bia')).toBeDefined();
  });
});
