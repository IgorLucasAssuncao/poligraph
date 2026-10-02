import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FaixaDeProcedencia } from './FaixaDeProcedencia';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  listarLegislaturas: vi.fn().mockResolvedValue([
    { numero: 57, anoInicial: 2023, anoFinal: 2027, corrente: true, casas: ['CAMARA', 'SENADO'] },
    { numero: 56, anoInicial: 2019, anoFinal: 2023, corrente: false, casas: ['CAMARA', 'SENADO'] },
    { numero: 55, anoInicial: 2015, anoFinal: 2019, corrente: false, casas: ['CAMARA', 'SENADO'] },
  ]),
}));

function Endereco() {
  const { pathname, search } = useLocation();
  return <p data-testid="endereco">{pathname + search}</p>;
}

function renderizarEm(endereco: string) {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="*" element={<><FaixaDeProcedencia /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * 🔴 A faixa dizia "57ª legislatura" sobre a lista de 2015–2019 (2026-10-02). Ela ⛔ pode
 * afirmar um período que a tela ⛔ mostra.
 */
describe('a faixa do topo', () => {
  it('no início é o seletor de período, e escolher muda o endereço', async () => {
    renderizarEm('/');

    const seletor = await screen.findByLabelText('Período');
    fireEvent.change(seletor, { target: { value: '55' } });

    expect(screen.getByTestId('endereco')).toHaveTextContent('/?legislatura=55');
  });

  it('mostra o período do endereço, ⛔ a corrente', async () => {
    renderizarEm('/parlamentares?legislatura=56');

    expect(await screen.findByLabelText('Período')).toHaveValue('56');
  });

  it('"todos os períodos" só na lista, ⛔ no grafo', async () => {
    renderizarEm('/parlamentares');
    expect(await screen.findByRole('option', { name: 'Todos os períodos' })).toBeInTheDocument();
  });

  it('no grafo, "todas" vira a corrente', async () => {
    renderizarEm('/parlamentares?vista=grafo&legislatura=todas');

    expect(await screen.findByLabelText('Período')).toHaveValue('57');
    expect(screen.queryByRole('option', { name: 'Todos os períodos' })).toBeNull();
  });

  it('a corrente tira o parâmetro do endereço', async () => {
    renderizarEm('/?legislatura=55');

    fireEvent.change(await screen.findByLabelText('Período'), { target: { value: '57' } });

    expect(screen.getByTestId('endereco')).toHaveTextContent(/^\/$/);
  });

  it('no questionário diz de que legislatura são as perguntas', async () => {
    renderizarEm('/resultado?legislatura=55');

    expect(await screen.findByText('Perguntas da 57ª legislatura')).toBeInTheDocument();
    expect(screen.queryByLabelText('Período')).toBeNull();
  });

  it('no dinheiro e na ficha ⛔ afirma legislatura nenhuma', async () => {
    renderizarEm('/emendas');
    await screen.findByText('Dados públicos');
    expect(screen.queryByText(/legislatura/)).toBeNull();
    expect(screen.queryByLabelText('Período')).toBeNull();
  });
});
