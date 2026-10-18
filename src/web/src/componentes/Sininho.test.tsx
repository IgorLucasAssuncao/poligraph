import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listarSeguidos, obterChaveDosAvisos, obterNovidades } from '../api';
import type { Novidades, Parlamentar } from '../api';
import { CHAVE_NOVIDADES_VISTAS } from '../constantes';
import { SininhoComponent } from './Sininho';
import { deBase64Url } from './useAvisosNoNavegador';

let sessao: { usuario: { nome: string } | null } = { usuario: { nome: 'Ana' } };
vi.mock('../sessao', () => ({ useSessao: () => sessao }));

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterNovidades: vi.fn(),
  listarSeguidos: vi.fn(),
  obterChaveDosAvisos: vi.fn(),
}));

const VAZIAS: Novidades = {
  semana: { de: '2026-09-26', ate: '2026-10-02' },
  atualizacoes: [{ fonte: 'CAMARA', orgao: 'Câmara dos Deputados', ultimaCarga: '2026-10-02T14:58:55Z' }],
  votosNaSemana: [],
  contraOPartido: [],
  trocasDePartido: [],
  gastosNaCota: [],
  emendasPagas: [],
};

const COM_TROCA: Novidades = {
  ...VAZIAS,
  votosNaSemana: [{ idPessoa: 7, nome: 'Ana Ribeiro', casa: 'CAMARA', votou: 3, ausente: null, ausenteJustificado: null }],
  trocasDePartido: [{ idPessoa: 7, nome: 'Ana Ribeiro', casa: 'CAMARA', partidoAnterior: 'PL', partidoNovo: 'PP', primeiroVoto: '2026-10-01' }],
};

const UM_SEGUIDO = [{ idPessoa: 7, nome: 'Ana Ribeiro', casa: 'CAMARA', partido: 'PP', uf: 'SP', nVotacoes: 0 }] as Parlamentar[];

function renderizar(novidades: Novidades, seguidos: Parlamentar[] = UM_SEGUIDO) {
  vi.mocked(obterNovidades).mockResolvedValue(novidades);
  vi.mocked(listarSeguidos).mockResolvedValue(seguidos);
  vi.mocked(obterChaveDosAvisos).mockResolvedValue(null);
  return render(
    <MemoryRouter>
      <SininhoComponent />
    </MemoryRouter>,
  );
}

/** Pendência 89: o sininho do cabeçalho conta o que este navegador ainda não mostrou. */
describe('sininho', () => {
  beforeEach(() => {
    sessao = { usuario: { nome: 'Ana' } };
    localStorage.clear();
  });

  it('sem conta, não aparece', () => {
    sessao = { usuario: null };
    const { container } = renderizar(VAZIAS);

    expect(container).toBeEmptyDOMElement();
  });

  it('conta as novidades novas, sem os votos da semana, e zera ao abrir', async () => {
    renderizar(COM_TROCA);

    const botao = await screen.findByRole('button', { name: 'Novidades de quem você segue, 1 nova' });
    fireEvent.click(botao);

    expect(await screen.findByText(/votou pelo/)).toBeInTheDocument();
    expect(screen.queryByText(/votou em/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novidades de quem você segue' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CHAVE_NOVIDADES_VISTAS)!)).toEqual(['troca-7']);
  });

  it('o que já foi visto neste navegador não conta', async () => {
    localStorage.setItem(CHAVE_NOVIDADES_VISTAS, JSON.stringify(['troca-7']));
    renderizar(COM_TROCA);

    expect(await screen.findByRole('button', { name: 'Novidades de quem você segue' })).toBeInTheDocument();
  });

  it('quem não segue ninguém recebe o caminho para seguir', async () => {
    renderizar(VAZIAS, []);

    fireEvent.click(await screen.findByRole('button', { name: 'Novidades de quem você segue' }));

    expect(await screen.findByText(/Você ainda não segue ninguém/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Procurar parlamentares' })).toHaveAttribute('href', '/parlamentares');
  });

  it('sem chave no servidor, não oferece avisos no navegador', async () => {
    renderizar(COM_TROCA);

    fireEvent.click(await screen.findByRole('button', { name: /Novidades de quem você segue/ }));
    await screen.findByText(/votou pelo/);

    expect(screen.queryByText('Receber avisos neste navegador')).not.toBeInTheDocument();
  });
});

describe('chave pública dos avisos', () => {
  it('base64url vira os 65 bytes do ponto P-256', () => {
    const chave = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

    const bytes = deBase64Url(chave);

    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});
