import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CHAVE_MINHA_CIDADE } from '../constantes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Grafo, Panorama, Parlamentar } from '../api';
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

  it('mostra a base numa linha, com a conta que a produziu, e o grafo da Câmara', async () => {
    vi.mocked(api.obterPanorama).mockResolvedValue({ ...PANORAMA, dinheiro: { primeiroAno: 2023, ultimoAno: 2026, cota: 1_000_000, emendasPagas: 2_000_000_000 } });
    vi.mocked(api.obterGrafo).mockResolvedValue({ nos: [{ idPessoa: 1 }], legislatura: 57 } as unknown as Grafo);

    abrir();

    expect(screen.getByRole('heading', { level: 1, name: T.titulo })).toBeDefined();
    expect(await screen.findByText(/470\.727 votos com posição na Câmara e no Senado/)).toBeDefined();
    expect(screen.getByRole('link', { name: T.comoMedimos })).toHaveAttribute('href', '/metodologia');
    expect(await screen.findByText('grafo com 1 parlamentares')).toBeDefined();
  });

  it('abre com as duas entradas e a busca, e a cidade guardada abre direto', async () => {
    vi.mocked(api.obterPanorama).mockResolvedValue(PANORAMA);
    vi.mocked(api.obterGrafo).mockResolvedValue({ nos: [], legislatura: 57 } as unknown as Grafo);
    localStorage.setItem(CHAVE_MINHA_CIDADE, JSON.stringify({ codigoIbge: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' }));

    abrir();

    expect(screen.getByRole('link', { name: T.entradas.voto.comecar })).toHaveAttribute('href', '/resultado');
    expect(screen.getByRole('link', { name: /Abrir Rio de Janeiro – RJ/ })).toHaveAttribute('href', '/cidades/3304557');
    expect(screen.getByLabelText('Sua cidade')).toBeDefined();
    expect(screen.getByText(T.entradas.busca)).toBeDefined();
    localStorage.removeItem(CHAVE_MINHA_CIDADE);
  });

  it('base vazia diz isso, e o grafo vazio some sem legislatura pedida', async () => {
    vi.mocked(api.obterPanorama).mockResolvedValue({ ...PANORAMA, legislatura: null, porCasa: [] });
    vi.mocked(api.obterGrafo).mockResolvedValue({ nos: [], legislatura: 57 } as unknown as Grafo);

    const { container } = abrir();

    expect(await screen.findByText(T.base.vazio)).toBeDefined();
    await waitFor(() => expect(api.obterGrafo).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('.grafo-reserva')).toBeNull());
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
