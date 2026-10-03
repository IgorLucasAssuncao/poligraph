import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BarraDePeriodoComponent } from './BarraDePeriodo';

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

function renderizarEm(endereco: string, elemento: React.ReactNode = <BarraDePeriodoComponent />) {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="*" element={<>{elemento}<Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * DECISÃO: A escolha do período, no alto do conteúdo: na faixa escura ficava escondida (autor,
 * 2026-10-02). E ela diz que a legislatura é das DUAS casas.
 */
describe('a barra de período', () => {
  it('escolher muda o endereço', async () => {
    renderizarEm('/');
    fireEvent.change(await screen.findByLabelText('Período de quatro anos do Congresso'), { target: { value: '55' } });
    expect(screen.getByTestId('endereco')).toHaveTextContent('/?legislatura=55');
  });

  it('a corrente tira o parâmetro do endereço', async () => {
    renderizarEm('/?legislatura=55');
    fireEvent.change(await screen.findByLabelText('Período de quatro anos do Congresso'), { target: { value: '57' } });
    expect(screen.getByTestId('endereco')).toHaveTextContent(/^\/$/);
  });

  it('diz que o período vale para Câmara e Senado', async () => {
    renderizarEm('/');
    expect(await screen.findByText('57ª legislatura · Câmara e Senado no mesmo período')).toBeInTheDocument();
  });

  it('num período passado, avisa e oferece voltar', async () => {
    renderizarEm('/?legislatura=55');
    expect(await screen.findByText(/um período anterior/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar para 2023–2027' }));
    expect(screen.getByTestId('endereco')).toHaveTextContent(/^\/$/);
  });

  it('"todos os períodos" só onde pedido', async () => {
    const { unmount } = renderizarEm('/parlamentares', <BarraDePeriodoComponent comTodas />);
    expect(await screen.findByRole('option', { name: 'Todos os períodos' })).toBeInTheDocument();
    unmount();

    renderizarEm('/parlamentares?legislatura=todas');
    expect(await screen.findByLabelText('Período de quatro anos do Congresso')).toHaveValue('57');
    expect(screen.queryByRole('option', { name: 'Todos os períodos' })).toBeNull();
  });
});
