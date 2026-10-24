import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import type { Parlamentar } from '../api';
import { EVENTO_SEGUIDOS_MUDARAM } from '../constantes';
import { marcarSeguido, useSeguidos } from './useSeguidos';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  listarSeguidos: vi.fn(),
}));
vi.mock('../sessao', () => ({ useSessao: () => ({ usuario: { nome: 'Ana' } }) }));

const parlamentar = (idPessoa: number, nome: string) =>
  ({ idPessoa, nome, casa: 'CAMARA', partido: 'PP', uf: 'SP', nVotacoes: 0, urlFoto: null }) as Parlamentar;

function ListaComponent() {
  const { lista } = useSeguidos();
  return <p data-testid="lista">{lista?.map((p) => p.nome).join(',') ?? 'nada'}</p>;
}

function BotaoComponent({ idPessoa }: { idPessoa: number }) {
  const { ids } = useSeguidos();
  return <p data-testid={`botao-${idPessoa}`}>{ids.has(idPessoa) ? 'Seguindo' : 'Seguir'}</p>;
}

describe('quem a pessoa segue', () => {
  it('as telas abertas pedem uma vez só e mudam juntas no clique e na resposta', async () => {
    vi.mocked(api.listarSeguidos).mockReset().mockResolvedValue([parlamentar(1, 'Ana')]);
    render(
      <>
        <ListaComponent />
        <BotaoComponent idPessoa={1} />
        <BotaoComponent idPessoa={2} />
      </>,
    );

    await waitFor(() => expect(screen.getByTestId('lista')).toHaveTextContent('Ana'));
    expect(api.listarSeguidos).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('botao-2')).toHaveTextContent('Seguir');

    act(() => marcarSeguido(2, true));
    expect(screen.getByTestId('botao-2')).toHaveTextContent('Seguindo');

    vi.mocked(api.listarSeguidos).mockResolvedValue([parlamentar(1, 'Ana'), parlamentar(2, 'Bia')]);
    act(() => {
      window.dispatchEvent(new Event(EVENTO_SEGUIDOS_MUDARAM));
    });
    await waitFor(() => expect(screen.getByTestId('lista')).toHaveTextContent('Ana,Bia'));

    act(() => marcarSeguido(1, false));
    expect(screen.getByTestId('lista')).toHaveTextContent('Bia');
    expect(screen.getByTestId('botao-1')).toHaveTextContent('Seguir');
  });
});
