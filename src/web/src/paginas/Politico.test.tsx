import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaDoPolitico } from '../api';
import { PoliticoComponent } from './Politico';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterFichaDoPolitico: vi.fn(),
  obterPatrimonio: vi.fn(),
}));

const api = await import('../api');

const PREFEITO_E_GOVERNADOR: FichaDoPolitico = {
  idPessoa: 7, nome: 'JOÃO EXEMPLO', nomeCivil: 'JOÃO DA SILVA EXEMPLO', urlFoto: null, parlamentar: false, redesSociais: [],
  mandatos: [
    { cargo: 'GOVERNADOR', nivel: 'ESTADUAL', anoEleicao: 2018, primeiroAno: 2019, ultimoAno: 2022, uf: 'SP', municipio: null, partido: 'XYZ' },
    {
      cargo: 'PREFEITO', nivel: 'MUNICIPAL', anoEleicao: 2016, primeiroAno: 2017, ultimoAno: 2020, uf: 'SP',
      municipio: { codigoIbge: '3550308', nome: 'SÃO PAULO', uf: 'SP' }, partido: 'XYZ',
    },
  ],
};

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/politico/7']}>
      <Routes>
        <Route path="/politico/:idPessoa" element={<PoliticoComponent />} />
        <Route path="/parlamentar/:idPessoa" element={<p>ficha do parlamentar</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.obterFichaDoPolitico).mockResolvedValue(PREFEITO_E_GOVERNADOR);
  vi.mocked(api.obterPatrimonio).mockResolvedValue([]);
});

describe('Ficha do político', () => {
  it('lista os mandatos e diz por que não há voto', async () => {
    renderizar();

    expect(await screen.findByRole('heading', { name: 'João Exemplo' })).toBeInTheDocument();
    expect(screen.getByText('Governador de SP, 2019–2022')).toBeInTheDocument();
    expect(screen.getByText('Prefeito de São Paulo – SP, 2017–2020')).toBeInTheDocument();
    expect(screen.getByText(/só a Câmara e o Senado publicam o voto/)).toBeInTheDocument();
  });

  it('quem votou no Congresso vai para a ficha do parlamentar', async () => {
    vi.mocked(api.obterFichaDoPolitico).mockResolvedValue({ ...PREFEITO_E_GOVERNADOR, parlamentar: true });
    renderizar();

    expect(await screen.findByText('ficha do parlamentar')).toBeInTheDocument();
  });

  it('sem mandato no TSE, diz isso e leva à lista', async () => {
    vi.mocked(api.obterFichaDoPolitico).mockResolvedValue(null);
    renderizar();

    expect(await screen.findByText(/não tem mandato eleito/)).toBeInTheDocument();
  });
});
