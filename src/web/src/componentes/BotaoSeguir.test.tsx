import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsentimentoNecessarioError, seguir } from '../api';
import { BotaoSeguirComponent } from './BotaoSeguir';

vi.mock('../sessao', () => ({ useSessao: () => ({ usuario: { nome: 'Ana' } }) }));
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  seguir: vi.fn(),
  deixarDeSeguir: vi.fn(),
}));

afterEach(() => vi.mocked(seguir).mockReset());

/** Um botão com o estado de "seguindo" guardado, como na lista. */
function Montado() {
  const estado = { seguindo: false };
  const aoAlternar = vi.fn((_: number, agora: boolean) => {
    estado.seguindo = agora;
  });
  render(
    <MemoryRouter>
      <BotaoSeguirComponent idPessoa={7} seguindo={false} aoAlternar={aoAlternar} />
    </MemoryRouter>,
  );
  return aoAlternar;
}

/**
 * Pendência 62: a lista de seguidos é dado sensível, e o consentimento é pedido na primeira vez
 * que a pessoa segue alguém. Recusar não segue; aceitar chama de novo com o aceite.
 */
describe('o consentimento de seguir', () => {
  it('a API pede, a tela pergunta, e o aceite segue', async () => {
    vi.mocked(seguir).mockRejectedValueOnce(new ConsentimentoNecessarioError()).mockResolvedValueOnce();
    const aoAlternar = Montado();

    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    const pedido = await screen.findByRole('dialog', { name: 'Antes de seguir' });
    expect(pedido.textContent).toMatch(/dado sensível/);
    expect(aoAlternar).toHaveBeenLastCalledWith(7, false);

    await userEvent.click(screen.getByRole('button', { name: 'Concordo e quero seguir' }));

    await waitFor(() => expect(seguir).toHaveBeenLastCalledWith(7, true));
    expect(aoAlternar).toHaveBeenLastCalledWith(7, true);
  });

  it('"Agora não" fecha sem seguir', async () => {
    vi.mocked(seguir).mockRejectedValueOnce(new ConsentimentoNecessarioError());
    const aoAlternar = Montado();

    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(seguir).toHaveBeenCalledTimes(1);
    expect(aoAlternar).toHaveBeenLastCalledWith(7, false);
  });
});
