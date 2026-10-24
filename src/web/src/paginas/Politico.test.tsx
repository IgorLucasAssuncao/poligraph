import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaDoPolitico } from '../api';
import { PoliticoComponent } from './Politico';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterFichaDoPolitico: vi.fn(),
  obterPatrimonio: vi.fn(),
  obterFinanciamentoDaEleicao: vi.fn().mockRejectedValue(new Error('sem campanha no teste')),
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

function renderizar(endereco = '/politico/7/cargos') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/politico/:idPessoa/:aba?" element={<PoliticoComponent />} />
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
    expect(screen.getByText('Prefeito, São Paulo – SP, 2017–2020')).toBeInTheDocument();
    expect(screen.getByText(/presidente, governador e prefeito não votam projetos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver a página de São Paulo' })).toHaveAttribute('href', '/cidades/3550308');
    expect(screen.getByText(/contas do governo do estado ainda não estão na base/)).toBeInTheDocument();
  });

  it('o deputado estadual lê por que não há voto, gasto de gabinete nem emenda', async () => {
    vi.mocked(api.obterFichaDoPolitico).mockResolvedValue({
      ...PREFEITO_E_GOVERNADOR,
      mandatos: [{ cargo: 'DEPUTADO_ESTADUAL', nivel: 'ESTADUAL', anoEleicao: 2022, primeiroAno: 2023, ultimoAno: 2026, uf: 'RJ', municipio: null, partido: 'XYZ' }],
    });
    renderizar();

    expect(await screen.findByText(/cada assembleia publica as votações do seu jeito/)).toBeInTheDocument();
    expect(screen.getByText(/em 27 formatos diferentes/)).toBeInTheDocument();
    expect(screen.getByText(/emendas ao orçamento do estado não têm um portal nacional/)).toBeInTheDocument();
    expect(screen.queryByText(/prefeito e governador não votam/)).not.toBeInTheDocument();
  });

  it('o presidente leva às contas do governo federal do mandato, e não às do estado', async () => {
    vi.mocked(api.obterFichaDoPolitico).mockResolvedValue({
      ...PREFEITO_E_GOVERNADOR,
      mandatos: [{ cargo: 'PRESIDENTE', nivel: 'FEDERAL', anoEleicao: 2006, primeiroAno: 2007, ultimoAno: 2010, uf: null, municipio: null, partido: 'PT' }],
    });
    renderizar();

    expect(await screen.findByRole('link', { name: 'Ver o governo federal de 2007 a 2010' })).toHaveAttribute('href', '/governo?de=2007&ate=2010');
    expect(screen.queryByText(/contas do governo do estado/)).not.toBeInTheDocument();
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

  it('abre na campanha do mandato mais recente, com os mandatos em cartões que escolhem a eleição', async () => {
    renderizar('/politico/7');

    const mandatos = await screen.findByRole('navigation', { name: 'Mandatos' });
    const cartoes = within(mandatos).getAllByRole('link');
    expect(cartoes).toHaveLength(2);
    expect(cartoes[0]).toHaveAttribute('aria-current', 'true');
    expect(cartoes[1].getAttribute('href')).toBe('/politico/7?eleicao=2016&cargo=PREFEITO');
    expect(screen.getByRole('link', { name: 'Campanha' })).toHaveAttribute('aria-current', 'page');
  });
});
