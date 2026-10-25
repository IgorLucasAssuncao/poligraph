import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FaixaDeProcedenciaComponent } from '../../../src/site/componentes/FaixaDeProcedencia';

vi.mock('../../../src/nucleo/api', async (original) => ({
  ...(await original<typeof import('../../../src/nucleo/api')>()),
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
        <Route path="*" element={<><FaixaDeProcedenciaComponent /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * RISCO: A faixa dizia "57ª legislatura" sobre a lista de 2015–2019 (2026-10-02). Ela não pode
 * afirmar um período que a tela não mostra. O seletor saiu dela para a `BarraDePeriodo`.
 */
describe('a faixa do topo', () => {
  it('diz o período do endereço, não a corrente', async () => {
    renderizarEm('/parlamentares?legislatura=56');
    expect(await screen.findByText('56ª legislatura · 2019–2023')).toBeInTheDocument();
  });

  it('sem período no endereço, a corrente', async () => {
    renderizarEm('/');
    expect(await screen.findByText('57ª legislatura · 2023–2027')).toBeInTheDocument();
  });

  it('"todos os períodos" na lista; no grafo, a corrente', async () => {
    const { unmount } = renderizarEm('/parlamentares?legislatura=todas');
    expect(await screen.findByText('Todos os períodos')).toBeInTheDocument();
    unmount();

    renderizarEm('/parlamentares?vista=grafo&legislatura=todas');
    expect(await screen.findByText('57ª legislatura · 2023–2027')).toBeInTheDocument();
  });

  it('Não é controle: a escolha mora na barra do conteúdo', async () => {
    renderizarEm('/');
    await screen.findByText(/57ª legislatura/);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('no questionário diz de que legislatura são as perguntas', async () => {
    renderizarEm('/resultado?legislatura=55');
    expect(await screen.findByText('Perguntas da 57ª legislatura')).toBeInTheDocument();
  });

  it('no dinheiro e na ficha não afirma legislatura nenhuma', async () => {
    renderizarEm('/emendas');
    await screen.findByText('Dados públicos');
    expect(screen.queryByText(/legislatura/)).toBeNull();
  });
});
