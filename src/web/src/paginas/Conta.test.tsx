import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Panorama } from '../api';
import { ContextoDaSessao, type Sessao } from '../sessao';
import { TEXTOS_DA_CONTA } from '../textos/conta';
import { LoginComponent } from './Login';
import { MinhaContaComponent } from './MinhaConta';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterPanorama: vi.fn(),
  excluirConta: vi.fn(),
  revogarConsentimentoDeSeguir: vi.fn(),
}));

vi.mock('../componentes/BotaoGoogle', () => ({
  BotaoGoogleComponent: () => <button type="button">Entrar com o Google</button>,
}));

const api = await import('../api');

/** A sessão que a tela recebe, com o que o teste quiser trocar. */
function sessao(campos: Partial<Sessao> = {}): Sessao {
  return {
    usuario: { nome: 'Fulana', fotoUrl: null },
    carregando: false,
    leituraPublica: true,
    entrou: vi.fn(),
    sair: vi.fn(() => Promise.resolve()),
    ...campos,
  };
}

function abrir(tela: React.ReactNode, valor: Sessao) {
  return render(
    <MemoryRouter>
      <ContextoDaSessao.Provider value={valor}>{tela}</ContextoDaSessao.Provider>
    </MemoryRouter>,
  );
}

const PANORAMA: Panorama = {
  legislatura: 57,
  porCasa: [{ casa: 'CAMARA', parlamentares: 513, votacoes: 1123, votacoesSecretas: 2, votosComPosicao: 470727, comunidades: 4, ligacoes: 10 }],
} as unknown as Panorama;

describe('entrar', () => {
  beforeEach(() => {
    vi.mocked(api.obterPanorama).mockReset();
  });

  it('mostra o tamanho da base e, com leitura pública, que a conta é opcional', async () => {
    vi.mocked(api.obterPanorama).mockResolvedValue(PANORAMA);

    abrir(<LoginComponent />, sessao());

    expect(screen.getByRole('heading', { name: TEXTOS_DA_CONTA.login.titulo })).toBeDefined();
    expect(await screen.findByText('513')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Entrar com o Google' })).toBeDefined();
  });

  it('sem a base, a tela continua de pé', async () => {
    vi.mocked(api.obterPanorama).mockRejectedValue(new Error('fora'));

    const { container } = abrir(<LoginComponent />, sessao({ leituraPublica: false }));

    await waitFor(() => expect(api.obterPanorama).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.login-base')).toBeNull();
    expect(container.querySelector('.login-opcional')).toBeNull();
  });
});

describe('minha conta', () => {
  const T = TEXTOS_DA_CONTA.conta;

  beforeEach(() => {
    vi.mocked(api.excluirConta).mockReset();
    vi.mocked(api.revogarConsentimentoDeSeguir).mockReset();
  });

  it('revogar o consentimento avisa que a lista foi apagada', async () => {
    vi.mocked(api.revogarConsentimentoDeSeguir).mockResolvedValue();

    abrir(<MinhaContaComponent />, sessao());
    fireEvent.click(screen.getByRole('button', { name: T.revogar }));

    expect(await screen.findByText(T.revogado)).toBeDefined();
  });

  it('apagar pede confirmação, e cancelar volta atrás', () => {
    abrir(<MinhaContaComponent />, sessao());

    fireEvent.click(screen.getByRole('button', { name: T.apagar }));
    fireEvent.click(screen.getByRole('button', { name: T.cancelar }));

    expect(screen.getByRole('button', { name: T.apagar })).toBeDefined();
    expect(api.excluirConta).not.toHaveBeenCalled();
  });

  it('falha ao apagar mostra o erro e desfaz a confirmação', async () => {
    vi.mocked(api.excluirConta).mockRejectedValue(new Error('fora'));

    abrir(<MinhaContaComponent />, sessao());
    fireEvent.click(screen.getByRole('button', { name: T.apagar }));
    fireEvent.click(screen.getByRole('button', { name: T.apagarDefinitivamente }));

    expect(await screen.findByText(T.erro)).toBeDefined();
    expect(screen.getByRole('button', { name: T.apagar })).toBeDefined();
  });

  it('sair chama a sessão, e a falha aparece como erro', async () => {
    const sair = vi.fn(() => Promise.reject(new Error('fora')));

    abrir(<MinhaContaComponent />, sessao({ sair, usuario: null }));
    fireEvent.click(screen.getByRole('button', { name: T.sair }));

    expect(sair).toHaveBeenCalled();
    expect(await screen.findByText(T.erro)).toBeDefined();
    expect(screen.getByText(T.semNome)).toBeDefined();
  });

  it('falha ao revogar também aparece como erro', async () => {
    vi.mocked(api.revogarConsentimentoDeSeguir).mockRejectedValue(new Error('fora'));

    abrir(<MinhaContaComponent />, sessao());
    fireEvent.click(screen.getByRole('button', { name: T.revogar }));

    expect(await screen.findByText(T.erro)).toBeDefined();
  });
});
