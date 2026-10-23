import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GestoesDaCidade } from '../api';
import { CidadeComponent } from './Cidade';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterGestoesDaCidade: vi.fn(),
  obterCaminhosDaCidade: vi.fn().mockResolvedValue(null),
}));

const api = await import('../api');

const eleito = (idPessoa: number, nome: string, parlamentar = false) => ({ idPessoa, nome, partido: 'XYZ', parlamentar });

const CAMPINAS: GestoesDaCidade = {
  municipio: { codigoIbge: '3509502', nome: 'Campinas', uf: 'SP' },
  populacao: 1_189_761,
  recebido: 90_000_000,
  naPrefeitura: 50_000_000,
  noGovernoDoEstado: 10_000_000,
  porAno: [{ ano: 2015, recebido: 10_000_000, naPrefeitura: 5_000_000 }],
  gestoes: [
    {
      primeiroAno: 2013, ultimoAno: 2016, prefeitos: [eleito(1, 'JONAS EXEMPLO', true)], vices: [eleito(2, 'VICE EXEMPLO')],
      governadores: [{ governador: eleito(3, 'GOVERNADOR EXEMPLO'), deAno: 2013, ateAno: 2016 }],
      viceGovernadores: [{ governador: eleito(5, 'VICE GOVERNADORA'), deAno: 2013, ateAno: 2016 }],
      recebido: 90_000_000, naPrefeitura: 50_000_000, comPagamento: true,
      contas: { receita: 1_950_000_000, despesaPaga: 1_900_000_000, anosDeclarados: 3, anosNaGestao: 4, foraDoPadrao: [{ ano: 2015, receitaDeclarada: 11_000_000_000 }] },
    },
    {
      primeiroAno: 2009, ultimoAno: 2012, prefeitos: [eleito(4, 'ANTIGO EXEMPLO')], vices: [], governadores: [],
      recebido: 0, naPrefeitura: 0, comPagamento: false,
    },
  ],
};

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/cidades/3509502']}>
      <Routes>
        <Route path="/cidades/:codigoIbge" element={<CidadeComponent />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.obterGestoesDaCidade).mockResolvedValue(CAMPINAS);
});

describe('Página da cidade', () => {
  it('liga cada eleito à ficha certa e diz que a base começa em 2015', async () => {
    renderizar();

    expect(await screen.findByRole('link', { name: 'Jonas Exemplo' })).toHaveAttribute('href', '/parlamentar/1');
    expect(screen.getByRole('link', { name: 'Vice Exemplo' })).toHaveAttribute('href', '/politico/2');
    expect(screen.getByText(/só de agosto de 2015 em diante/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vice Governadora' })).toHaveAttribute('href', '/politico/5');
  });

  it('separa o governo do estado, que tem sede na capital, das entidades', async () => {
    renderizar();

    expect(await screen.findByText(/R\$\s10 mi a órgãos do governo do estado/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s30 mi a entidades e empresas com sede aqui/)).toBeInTheDocument();
  });

  it('o ano declarado fora do padrão diz o valor e que ficou fora da soma', async () => {
    renderizar();

    expect(await screen.findByText(/2015 ficou fora da soma: a prefeitura declarou R\$\s11 bi/)).toBeInTheDocument();
    expect(screen.getByText(/em 3 dos 4 anos/)).toBeInTheDocument();
  });

  it('a gestão sem pagamento fica recolhida e diz por quê', async () => {
    renderizar();

    expect(await screen.findByText('Gestão de 2009 a 2012, sem pagamento de emenda na base')).toBeInTheDocument();
    expect(screen.getByText('Governador eleito antes de 1998, fora da base')).toBeInTheDocument();
  });

  it('diz que a troca no meio do mandato não aparece e que a emenda é de quem a apresentou', async () => {
    renderizar();

    expect(await screen.findByText(/a troca não aparece aqui/)).toBeInTheDocument();
    expect(screen.getByText(/A emenda é do deputado ou do senador que a apresentou/)).toBeInTheDocument();
  });
});
