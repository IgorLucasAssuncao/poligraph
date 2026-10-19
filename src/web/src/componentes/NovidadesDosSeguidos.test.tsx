import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listarSeguidos, obterNovidades } from '../api';
import type { Novidades, Parlamentar } from '../api';
import { CHAVE_NOVIDADES_VISTAS } from '../constantes';
import { NovidadesDosSeguidosComponent } from './NovidadesDosSeguidos';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterNovidades: vi.fn(),
  listarSeguidos: vi.fn(),
}));

const SEGUIDOS = [
  { idPessoa: 7, nome: 'Ana Ribeiro', casa: 'CAMARA', partido: 'PP', uf: 'SP', nVotacoes: 0, urlFoto: null },
  { idPessoa: 9, nome: 'Bruno Lima', casa: 'SENADO', partido: 'PT', uf: 'BA', nVotacoes: 0, urlFoto: null },
] as Parlamentar[];

const VAZIAS: Novidades = {
  semana: { de: '2026-09-26', ate: '2026-10-02' },
  atualizacoes: [{ fonte: 'CAMARA', orgao: 'Câmara dos Deputados', ultimaCarga: '2026-10-02T14:58:55Z' }],
  votosNaSemana: [],
  contraOPartido: [],
  trocasDePartido: [],
  gastosNaCota: [],
  emendasPagas: [],
};

const DE_DUAS_PESSOAS: Novidades = {
  ...VAZIAS,
  votosNaSemana: [{ idPessoa: 7, nome: 'Ana Ribeiro', casa: 'CAMARA', votou: 3, ausente: null, ausenteJustificado: null }],
  trocasDePartido: [{ idPessoa: 7, nome: 'Ana Ribeiro', casa: 'CAMARA', partidoAnterior: 'PL', partidoNovo: 'PP', primeiroVoto: '2026-10-01' }],
  emendasPagas: [{ idPessoa: 9, nome: 'Bruno Lima', mes: '2026-09-01', pago: 1000, maiorDestino: null, lugarDoMaiorDestino: null }],
};

function renderizar(novidades: Novidades) {
  vi.mocked(obterNovidades).mockResolvedValue(novidades);
  vi.mocked(listarSeguidos).mockResolvedValue(SEGUIDOS);
  return render(
    <MemoryRouter>
      <NovidadesDosSeguidosComponent />
    </MemoryRouter>,
  );
}

/** Pendência 89: fechado até o clique, destacado quando há novidade, e por parlamentar no modal. */
describe('novidades de quem você segue', () => {
  beforeEach(() => localStorage.clear());

  it('fechado, diz quantas são novas e leva o destaque', async () => {
    renderizar(DE_DUAS_PESSOAS);

    const cartao = await screen.findByRole('button', { name: /Novidades de quem você segue/ });

    expect(cartao).toHaveTextContent('2 novidades novas');
    expect(cartao).toHaveClass('com-novas');
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('o feed mostra cada fato num cartão, com quem, partido e o selo de nova', async () => {
    renderizar(DE_DUAS_PESSOAS);

    await userEvent.click(await screen.findByRole('button', { name: /Novidades de quem você segue/ }));

    const troca = (await screen.findByText(/^Votou pelo/)).closest('li')!;
    expect(within(troca).getByRole('link', { name: 'Ana Ribeiro' })).toHaveAttribute('href', '/parlamentar/7');
    expect(within(troca).getByText('PP · SP')).toBeInTheDocument();
    expect(within(troca).getByText('Nova')).toBeInTheDocument();
    const semana = screen.getByText(/^Votou em/).closest('li')!;
    expect(within(semana).queryByText('Nova')).not.toBeInTheDocument();
  });

  it('filtra por parlamentar, por tipo e só as novas', async () => {
    renderizar(DE_DUAS_PESSOAS);
    await userEvent.click(await screen.findByRole('button', { name: /Novidades de quem você segue/ }));
    const pessoas = await screen.findByRole('group', { name: 'Filtrar por parlamentar' });

    await userEvent.click(await within(pessoas).findByRole('button', { name: /Bruno Lima/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText(/^Votou pelo/)).not.toBeInTheDocument();

    await userEvent.click(within(pessoas).getByRole('button', { name: /Todos/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Troca de partido' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText(/^Votou pelo/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tudo' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Só as novas' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText(/^Votou em/)).not.toBeInTheDocument();
  });

  it('quem tem novidade vem primeiro na fila, marcado para o leitor de tela', async () => {
    renderizar({ ...VAZIAS, emendasPagas: DE_DUAS_PESSOAS.emendasPagas });
    await userEvent.click(await screen.findByRole('button', { name: /Novidades de quem você segue/ }));
    const pessoas = await screen.findByRole('group', { name: 'Filtrar por parlamentar' });

    await within(pessoas).findByRole('button', { name: /Ana Ribeiro/ });
    const botoes = within(pessoas).getAllByRole('button');

    expect(botoes[1]).toHaveAccessibleName('Bruno Lima, tem novidade');
    expect(botoes[2]).toHaveAccessibleName('Ana Ribeiro');
  });

  it('fechar o modal marca como visto, e o cartão volta ao neutro', async () => {
    renderizar(DE_DUAS_PESSOAS);
    const cartao = await screen.findByRole('button', { name: /Novidades de quem você segue/ });

    await userEvent.click(cartao);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(JSON.parse(localStorage.getItem(CHAVE_NOVIDADES_VISTAS)!)).toEqual(['troca-7', 'emenda-9-2026-09-01']);
    expect(cartao).not.toHaveClass('com-novas');
    expect(cartao).toHaveTextContent('Nada novo desde a sua última visita');
  });

  it('o voto da semana aparece no modal, mas não conta como novo', async () => {
    renderizar({ ...VAZIAS, votosNaSemana: DE_DUAS_PESSOAS.votosNaSemana });

    const cartao = await screen.findByRole('button', { name: /Novidades de quem você segue/ });

    expect(cartao).not.toHaveClass('com-novas');
  });
});
