import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entidade as DadosDaEntidade, EntidadeNaLista } from '../api';
import { EntidadeComponent } from './Entidade';
import { EntidadesComponent } from './Entidades';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  listarEntidades: vi.fn(),
  obterEntidade: vi.fn(),
  listarParlamentaresDaEntidade: vi.fn(),
}));

const api = await import('../api');

const ASSOCIACAO: EntidadeNaLista = {
  cnpj: '11222333000144', nome: 'ASSOCIACAO EXEMPLO', naturezaJuridica: 'Associação Privada',
  grupo: 'SEM_FINS_LUCRATIVOS', sede: { codigoIbge: '4106902', nome: 'CURITIBA', uf: 'PR' },
  recebido: 1_300_000, emendas: 2,
};

const COMPLETA: DadosDaEntidade = {
  ...ASSOCIACAO,
  urlFonte: 'https://portaldatransparencia.gov.br/busca/pessoa-juridica/11222333000144',
  porAno: [{ anoDaEmenda: 2025, recebido: 300_000 }, { anoDaEmenda: 2026, recebido: 1_000_000 }],
  deParlamentares: 300_000,
  parlamentares: {
    itens: [{ idPessoa: 42, nome: 'Fulano de Tal', partido: 'XYZ', uf: 'PR', casa: 'CAMARA', urlFoto: null, recebido: 300_000, emendas: 1 }],
    pagina: 1, tamanho: 20, total: 1,
  },
  coletivos: [{ tipo: 'BANCADA', nome: 'BANCADA DO PARANA', recebido: 1_000_000, emendas: 1 }],
  sancoes: [],
  comOGoverno: null,
  naCota: { total: 150, lancamentos: 2, porParlamentar: [{ idPessoa: 42, nome: 'Fulano de Tal', partido: 'XYZ', casa: 'CAMARA', total: 150, lancamentos: 2 }] },
  convenios: {
    itens: [{
      numero: '1AAQKR', objeto: 'AQUISICAO DE AMBULANCIA', situacao: 'EM EXECUÇÃO', dataPublicacao: '2025-01-16',
      valor: 500_000, valorLiberado: 200_000, urlFonte: 'https://portaldatransparencia.gov.br/convenios/1AAQKR',
    }],
    pagina: 1, tamanho: 20, total: 1,
  },
};

function renderizar(endereco: string) {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/entidades" element={<EntidadesComponent />} />
        <Route path="/entidades/:cnpj" element={<EntidadeComponent />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listarEntidades).mockResolvedValue({ itens: [ASSOCIACAO], pagina: 1, tamanho: 20, total: 1 });
  vi.mocked(api.obterEntidade).mockResolvedValue(COMPLETA);
});

describe('Entidades', () => {
  it('lista com a natureza e a sede, e leva à página da entidade', async () => {
    renderizar('/entidades');

    const link = await screen.findByRole('link', { name: 'Associacao Exemplo' });
    expect(link).toHaveAttribute('href', '/entidades/11222333000144');
    expect(screen.getByText(/Associação Privada · Curitiba – PR/)).toBeInTheDocument();
  });

  it('o grupo filtra a consulta', async () => {
    renderizar('/entidades');

    fireEvent.click(await screen.findByRole('button', { name: 'Empresas' }));

    await vi.waitFor(() => expect(api.listarEntidades).toHaveBeenLastCalledWith({ busca: '', grupo: 'EMPRESA' }));
  });

  it('as abas de Dinheiro público estão no topo', async () => {
    renderizar('/entidades');

    const abas = await screen.findByRole('navigation', { name: 'Dinheiro público' });
    expect(within(abas).getByRole('link', { name: 'Entidades' })).toHaveAttribute('aria-current', 'page');
  });
});

/**
 * RISCO: A cota ao lado não é acusação: a ressalva vem antes dos nomes.
 */
describe('Entidade', () => {
  it('separa deputados das bancadas e leva ao perfil', async () => {
    renderizar('/entidades/11222333000144');

    const deputados = (await screen.findByRole('heading', { name: 'Deputados e senadores' })).parentElement!;
    expect(within(deputados).getByRole('link', { name: /Fulano/ })).toHaveAttribute('href', '/parlamentar/42');
    expect(screen.getByText(/Bancada estadual/)).toBeInTheDocument();
  });

  it('a cota aparece com a ressalva de que não indica irregularidade', async () => {
    renderizar('/entidades/11222333000144');

    const aviso = await screen.findByText(/não indica irregularidade/);
    const secao = aviso.closest('section')!;
    expect(aviso.compareDocumentPosition(within(secao).getByRole('link', { name: /Fulano/ })) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('as sanções dizem quantas estão em vigor, quem puniu e quando', async () => {
    vi.mocked(api.obterEntidade).mockResolvedValue({
      ...COMPLETA,
      sancoes: [
        { cadastro: 'CNEP', categoria: 'Multa', inicio: '2022-03-09', fim: null, vigente: true, orgaoSancionador: 'Petróleo Brasileiro S.A.',
          esfera: 'FEDERAL', fundamentacaoLegal: 'LEI 12846 - ART. 6º, I', valorDaMulta: 137260.07 },
        { cadastro: 'CEIS', categoria: 'Inidoneidade', inicio: '2019-01-10', fim: '2021-01-10', vigente: false, orgaoSancionador: 'CGU',
          esfera: 'FEDERAL', fundamentacaoLegal: null, valorDaMulta: null },
      ],
      comOGoverno: { contratos: 3, valor: 75e6, primeiroAno: 2024, ultimoAno: 2025 },
    });
    renderizar('/entidades/11222333000144');

    expect(await screen.findByText('Sanções no cadastro de empresas punidas')).toBeDefined();
    const texto = document.body.textContent ?? '';
    expect(texto).toMatch(/2 sanções registradas, 1 ainda em vigor/);
    expect(texto).toMatch(/desde 09\/03\/2022, sem data de fim · Petróleo Brasileiro S\.A\. · multa de R\$\s*137\.260,07/);
    expect(texto).toMatch(/3 contratos publicados no Diário Oficial de 2024 a 2025, que somam R\$\s*75\s*mi/);
  });

  it('liga à fonte oficial e à cidade da sede', async () => {
    renderizar('/entidades/11222333000144');

    expect(await screen.findByRole('link', { name: /Portal da Transparência/ })).toHaveAttribute('href', COMPLETA.urlFonte);
    expect(screen.getByRole('link', { name: 'Curitiba – PR' })).toHaveAttribute('href', '/cidades/4106902');
  });

  it('CNPJ que não recebeu emenda diz isso', async () => {
    vi.mocked(api.obterEntidade).mockResolvedValue(null);

    renderizar('/entidades/99999999000199');

    expect(await screen.findByText(/não recebeu dinheiro de emenda/)).toBeInTheDocument();
  });
});

/**
 * DECISÃO: O objeto responde "comprou o quê"; o liberado ao lado do combinado diz quanto saiu.
 */
describe('o que foi combinado', () => {
  it('mostra o objeto, o combinado e o liberado, e leva ao convênio no Portal', async () => {
    renderizar('/entidades/11222333000144');

    expect(await screen.findByText('Aquisicao de ambulancia')).toBeInTheDocument();
    expect(screen.getByText('R$ 500.000,00 combinados')).toBeInTheDocument();
    expect(screen.getByText('R$ 200.000,00 liberados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /convênio 1AAQKR/ })).toHaveAttribute(
      'href', 'https://portaldatransparencia.gov.br/convenios/1AAQKR');
  });
});
