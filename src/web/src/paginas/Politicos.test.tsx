import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoliticoNaLista } from '../api';
import { PoliticosComponent } from './Politicos';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  listarPoliticos: vi.fn(),
  buscarMunicipios: vi.fn(),
}));

const api = await import('../api');

const PREFEITA: PoliticoNaLista = {
  idPessoa: 7, nome: 'MARIA EXEMPLO', urlFoto: null, mandatos: 2, parlamentar: false,
  mandato: {
    cargo: 'PREFEITO', nivel: 'MUNICIPAL', anoEleicao: 2024, primeiroAno: 2025, ultimoAno: 2028, uf: 'SP',
    municipio: { codigoIbge: '3509502', nome: 'CAMPINAS', uf: 'SP' }, partido: 'XYZ',
  },
};

const SENADOR: PoliticoNaLista = {
  idPessoa: 42, nome: 'Fulano de Tal', urlFoto: null, mandatos: 1, parlamentar: true,
  mandato: { cargo: 'SENADOR', nivel: 'FEDERAL', anoEleicao: 2022, primeiroAno: 2023, ultimoAno: 2030, uf: 'PR', municipio: null, partido: 'ABC' },
};

function renderizar(endereco = '/parlamentares') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/parlamentares" element={<PoliticosComponent />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listarPoliticos).mockResolvedValue({ itens: [PREFEITA, SENADOR], pagina: 1, tamanho: 20, total: 2 });
});

describe('Lista de políticos de todos os cargos', () => {
  it('diz o cargo e o ente, e leva o parlamentar à página dele', async () => {
    renderizar();

    expect(await screen.findByText(/Prefeito, Campinas – SP, 2025–2028/)).toBeInTheDocument();
    expect(screen.getByText(/Senador por PR, 2023–2030/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Maria Exemplo' })).toHaveAttribute('href', '/politico/7');
    expect(screen.getByRole('link', { name: 'Fulano de Tal' })).toHaveAttribute('href', '/parlamentar/42');
  });

  it('o nível limita os cargos oferecidos e vai para a consulta', async () => {
    renderizar();
    await screen.findByText(/Prefeito, Campinas/);

    fireEvent.click(screen.getByRole('button', { name: 'Estadual' }));

    const cargos = screen.getAllByRole('option').map((o) => o.textContent);
    expect(cargos).toContain('Governador');
    expect(cargos).not.toContain('Prefeito');
    expect(api.listarPoliticos).toHaveBeenLastCalledWith(expect.objectContaining({ nivel: 'ESTADUAL' }));
  });

  it('a cidade só se escolhe com o estado', async () => {
    renderizar();
    await screen.findByText(/Prefeito, Campinas/);

    expect(screen.getByText('Escolha o estado para filtrar por cidade')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cidade')).not.toBeInTheDocument();
  });
});
