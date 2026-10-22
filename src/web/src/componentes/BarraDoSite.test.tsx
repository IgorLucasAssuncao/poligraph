import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Busca } from '../api';
import { ehDinheiroPublico } from '../navegacao';
import { BuscaDoCabecalhoComponent } from './BuscaDoCabecalho';
import { MenuDaContaComponent } from './MenuDaConta';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  buscarTudo: vi.fn(),
}));

const iniciar = vi.fn();
vi.mock('./contextoDoTour', () => ({ useTour: () => ({ iniciar, registrar: vi.fn() }) }));

const sessao = { usuario: null as { nome: string | null; fotoUrl: string | null } | null, sair: vi.fn() };
vi.mock('../sessao', () => ({ useSessao: () => sessao }));

const api = await import('../api');

const RESPOSTA: Busca = {
  parlamentares: [
    { idPessoa: 42, nome: 'Fulano de São Paulo', partido: 'XYZ', uf: 'SP', casa: 'CAMARA', nVotacoes: 500 },
  ],
  municipios: [{ codigoIbge: '3550308', nome: 'SÃO PAULO', uf: 'SP' }],
  entidades: [
    {
      cnpj: '11222333000144', nome: 'ASSOCIACAO SAO PAULO', naturezaJuridica: 'Associação Privada',
      grupo: 'SEM_FINS_LUCRATIVOS', sede: null, recebido: 1e6, emendas: 2,
    },
  ],
};

function Endereco() {
  const { pathname, search } = useLocation();
  return <p data-testid="endereco">{pathname + search}</p>;
}

function renderizar(elemento: React.ReactNode) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={<>{elemento}<Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessao.usuario = null;
  vi.mocked(api.buscarTudo).mockResolvedValue(RESPOSTA);
});

describe('busca do cabeçalho', () => {
  it('responde nos três grupos', async () => {
    renderizar(<BuscaDoCabecalhoComponent />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'são paulo' } });

    const lista = await screen.findByRole('listbox');
    expect(within(lista).getByRole('group', { name: 'Parlamentares' })).toBeInTheDocument();
    expect(within(lista).getByRole('group', { name: 'Cidades' })).toBeInTheDocument();
    expect(within(lista).getByRole('group', { name: 'Entidades' })).toBeInTheDocument();
  });

  it('as setas andam pelas opções e o Enter abre a escolhida', async () => {
    renderizar(<BuscaDoCabecalhoComponent />);
    const campo = screen.getByRole('combobox');

    fireEvent.change(campo, { target: { value: 'são paulo' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(campo, { key: 'ArrowDown' });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(screen.getByTestId('endereco')).toHaveTextContent('/cidades/3550308');
  });

  it('termo de uma letra não busca', () => {
    renderizar(<BuscaDoCabecalhoComponent />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's' } });

    expect(api.buscarTudo).not.toHaveBeenCalled();
  });
});

describe('menu da conta', () => {
  it('sem conta, "Entrar" fica fora do menu', () => {
    renderizar(<MenuDaContaComponent />);

    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  });

  it('abre com tema, tour e conta, e fecha com Esc', () => {
    sessao.usuario = { nome: 'Maria Silva', fotoUrl: null };
    renderizar(<MenuDaContaComponent />);

    const botao = screen.getByRole('button', { name: /Maria/ });
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Minha conta' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tema da interface' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Como funciona o site' }));
    expect(iniciar).toHaveBeenCalled();

    fireEvent.click(botao);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Dinheiro público', () => {
  it.each([
    ['/emendas', true],
    ['/entidades/11222333000144', true],
    ['/governo', true],
    ['/parlamentares', false],
    ['/emendasx', false],
  ])('%s acende o item: %s', (caminho, esperado) => {
    expect(ehDinheiroPublico(caminho)).toBe(esperado);
  });
});
