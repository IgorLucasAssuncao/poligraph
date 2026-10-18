import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obterChaveDosAvisos, obterEstadoDosAvisos } from '../api';
import { CHAVE_CONVITE_DE_AVISOS } from '../constantes';
import { ConviteDeAvisosComponent } from './ConviteDeAvisos';
import { conviteRespondido } from './respostaAoConvite';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterChaveDosAvisos: vi.fn(),
  obterEstadoDosAvisos: vi.fn(),
}));

function renderizar(aoFechar = vi.fn()) {
  render(
    <MemoryRouter>
      <ConviteDeAvisosComponent aoFechar={aoFechar} />
    </MemoryRouter>,
  );
  return aoFechar;
}

/** Pendência 89: o convite para avisos aparece ao seguir, uma vez por navegador, e só para quem pode receber. */
describe('convite de avisos', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
    vi.stubGlobal('PushManager', class {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    });
    vi.mocked(obterChaveDosAvisos).mockResolvedValue('chave-publica');
    vi.mocked(obterEstadoDosAvisos).mockResolvedValue({ consentimento: false, navegadores: 0, esteNavegador: false });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('pergunta, e "Agora não" fecha e não pergunta de novo', async () => {
    const aoFechar = renderizar();

    expect(await screen.findByRole('dialog', { name: 'Receber avisos de quem você segue?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));

    expect(aoFechar).toHaveBeenCalled();
    expect(conviteRespondido()).toBe(true);
    expect(localStorage.getItem(CHAVE_CONVITE_DE_AVISOS)).not.toBeNull();
  });

  it('sem chave no servidor, não pergunta', async () => {
    vi.mocked(obterChaveDosAvisos).mockResolvedValue(null);
    renderizar();

    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('com a permissão já negada, não pergunta', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    renderizar();

    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
