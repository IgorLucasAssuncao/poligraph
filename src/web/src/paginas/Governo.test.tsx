import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AreaDaDespesa, Governo as DadosDoGoverno } from '../api';
import { GovernoComponent } from './Governo';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterGoverno: vi.fn(),
}));

vi.mock('../componentes/contextoDoTour', () => ({
  useTour: () => ({ iniciar: vi.fn(), registrar: vi.fn() }),
}));

const api = await import('../api');

function area(codigoDaFuncao: string, nome: string, campos: Partial<AreaDaDespesa> = {}): AreaDaDespesa {
  return {
    codigoDaFuncao, nome, dotacaoAtualizada: 100e9, empenhado: 90e9, pago: 80e9,
    restosAPagarPagos: 0, dotacaoCompleta: true, ...campos,
  };
}

/** DECISÃO: A forma de 2025, com os valores medidos arredondados. */
const DE_2025: DadosDoGoverno = {
  gestoes: [{
    anoDaEleicao: 2022, primeiroAno: 2023, ultimoAno: 2026,
    presidente: { nome: 'LUIZ INÁCIO LULA DA SILVA', nomeDeUrna: 'LULA', partido: 'PT' },
    vice: { nome: 'GERALDO JOSÉ RODRIGUES ALCKMIN FILHO', nomeDeUrna: 'GERALDO ALCKMIN', partido: 'PSB' },
    coligacao: 'Federação Brasil da Esperança',
  }],
  periodo: { primeiroAno: 2025, ultimoAno: 2025 },
  geradoEm: '2026-09-22',
  emAndamento: null,
  porAno: [{ anoDoOrcamento: 2025, arrecadou: 2.88e12, gastou: 2.5e12, pegouEmprestado: 2.46e12, fechado: true }],
  gestoesDisponiveis: [
    {
      anoDaEleicao: 2018, primeiroAno: 2019, ultimoAno: 2022,
      presidente: { nome: 'JAIR MESSIAS BOLSONARO', nomeDeUrna: 'JAIR BOLSONARO', partido: 'PSL' },
      vice: { nome: 'ANTONIO HAMILTON MARTINS MOURÃO', nomeDeUrna: 'GENERAL MOURÃO', partido: 'PRTB' },
      coligacao: null,
    },
    {
      anoDaEleicao: 2022, primeiroAno: 2023, ultimoAno: 2026,
      presidente: { nome: 'LUIZ INÁCIO LULA DA SILVA', nomeDeUrna: 'LULA', partido: 'PT' },
      vice: { nome: 'GERALDO JOSÉ RODRIGUES ALCKMIN FILHO', nomeDeUrna: 'GERALDO ALCKMIN', partido: 'PSB' },
      coligacao: 'Federação Brasil da Esperança',
    },
  ],
  anosDisponiveis: [2023, 2024, 2025, 2026],
  arrecadacao: {
    arrecadado: 2.88e12,
    porOrigem: [
      { origem: 'Contribuições', prevista: 1.5e12, realizada: 1.44e12 },
      { origem: 'Impostos, Taxas e Contribuições de Melhoria', prevista: 1.1e12, realizada: 1.1e12 },
    ],
    emissaoDeDivida: 2.46e12,
    outrasReceitasDeCapital: 0.25e12,
  },
  despesa: {
    empenhadoAcimaDaDotacao: 228.6e9,
    areas: [
      area('09', 'Previdência social', { pago: 1126e9, restosAPagarPagos: 65e9, dotacaoCompleta: false }),
      area('15', 'Urbanismo', { pago: 2e9, restosAPagarPagos: 6.5e9 }),
    ],
    encargos: [
      { grupo: 'TRANSFERENCIAS', pago: 588e9, restosAPagarPagos: 0 },
      { grupo: 'SERVICO_DA_DIVIDA', pago: 607e9, restosAPagarPagos: 0 },
      { grupo: 'REFINANCIAMENTO', pago: 1412e9, restosAPagarPagos: 0 },
      { grupo: 'OUTROS', pago: 230e9, restosAPagarPagos: 0 },
    ],
  },
  defesaCivil: null,
  comprasCentralizadas: null,
  sigilo: {
    cartaoSigiloso: 50.6e6,
    cartaoTotal: 122.3e6,
    transacoesSigilosas: 38663,
    acaoSigilosa: 7.8e6,
    meses: 12,
    porOrgao: [
      { orgao: 'Ministério da Justiça e Segurança Pública', cartao: 27e6, cartaoTotal: 40e6, acao: 0 },
      { orgao: 'Ministério da Defesa', cartao: 0, cartaoTotal: 0, acao: 7.8e6 },
    ],
  },
};

function renderizar(secao: 'orcamento' | 'cartoes' = 'orcamento') {
  return render(
    <MemoryRouter>
      <GovernoComponent secao={secao} />
    </MemoryRouter>,
  );
}

/**
 * RISCO: Dívida emitida não é arrecadação: ela aparece à parte, com o motivo.
 *
 * RISCO: A rolagem não entra em "áreas de governo" nem nos quatro números do topo.
 *
 * DECISÃO: "De cada R$ 100" só é honesto se as parcelas fecharem 100.
 *
 * O sigiloso do cartão vem com a base: "R$ 50 mi" sozinho não diz se é muito ou pouco.
 *
 * DECISÃO: "O cartão é todo secreto?" — não : o total do cartão vem antes, e a parte sigilosa é uma fração dele.
 *
 * ATENÇÃO: Sem o de anos anteriores, Urbanismo mostraria R$ 2 bi — área de obra parada.
 *
 * ATENÇÃO: Em ano eleitoral, o presidente no topo lia como vitrine: os números vêm antes.
 *
 * DECISÃO: Com mais de um ano, a comparação vem pronta — não depende de trocar o filtro.
 */
describe('Governo federal', () => {
  beforeEach(() => {
    vi.mocked(api.obterGoverno).mockResolvedValue(DE_2025);
  });

  it('diz quem governa, com o nome escrito como nome — o TSE publica em caixa alta', async () => {
    renderizar();

    expect(await screen.findByText('Lula')).toBeDefined();
    expect(screen.getByText('Luiz Inácio Lula da Silva · PT')).toBeDefined();
    expect(screen.getByText('Geraldo Alckmin')).toBeDefined();
    expect(screen.getByText(/Eleitos em 2022/)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Quem governou de 2023 a 2026' })).toBeDefined();
  });

  it('mostra a emissão de dívida fora da arrecadação', async () => {
    renderizar();

    const entrou = (await screen.findByText('Entrou')).closest('.numero-do-ano')!;
    expect(entrou.textContent).toMatch(/R\$ 2,88 tri/);
    const emprestado = screen.getByText('Pegou emprestado').closest('.numero-do-ano')!;
    expect(emprestado.textContent).toMatch(/R\$ 2,46 tri/);
    expect(screen.getByText(/pegos emprestados/).textContent).toMatch(/Fora da conta: R\$ 2,46 tri/);
  });

  it('a rolagem da dívida vai em linha própria', async () => {
    renderizar();

    const rolagem = (await screen.findByText('Rolagem da dívida')).closest('li')!;
    expect(rolagem.textContent).toMatch(/R\$ 1,41 tri/);

    const topo = screen.getByRole('region', { name: '2025 em números' });
    expect(topo.textContent).not.toMatch(/1,41 tri/);
    const nota = [...document.querySelectorAll('.nota-curta')].find((p) => /rolagem/.test(p.textContent!))!;
    expect(nota.textContent).toMatch(/Fora da conta: R\$ 1,41 tri de rolagem da dívida/);
  });

  it('as parcelas de cada R$ 100 somam 100', async () => {
    renderizar();

    await screen.findByText('De cada R$ 100 gastos');
    const partes = [...document.querySelectorAll('.cada-cem-parte')].map((el) =>
      Number(el.textContent!.replace('R$', '').trim()),
    );

    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(document.querySelector('.cada-cem')!.textContent).not.toMatch(/Rolagem/);
  });

  it('o gasto sigiloso vem com a base do cartão inteiro', async () => {
    renderizar('cartoes');

    const destaque = (await screen.findByText(/são sigilosos/)).closest('p')!;
    expect(destaque.textContent).toMatch(/R\$ 122,3 mi/);
    expect(destaque.textContent).toMatch(/41 de cada R\$ 100/);
    expect(screen.getByText(/com detalhe, compra por compra: R\$ 71,7 mi/)).toBeDefined();
    expect(screen.getByRole('rowheader', { name: 'Ministério da Defesa' })).toBeDefined();
    expect(screen.getByText(/Só o que o Portal marca como sigiloso/)).toBeDefined();
  });

  it('o cartão da Defesa Civil fica à parte e nomeia o mês que o Portal não publicou', async () => {
    vi.mocked(api.obterGoverno).mockResolvedValue({
      ...DE_2025,
      defesaCivil: {
        total: 420e6, estadual: 100e6, naoInformado: 0, transacoes: 900, executores: 312,
        porAno: [{ anoDoExtrato: 2025, valor: 420e6, meses: 11 }],
        porUf: [{ uf: 'RS', valor: 300e6, executores: 90 }, { uf: 'SC', valor: 120e6, executores: 40 }],
        mesesSemArquivo: ['2025-11'],
      },
    });

    renderizar('cartoes');

    expect(await screen.findByText('Cartão da Defesa Civil')).toBeDefined();
    const texto = document.body.textContent ?? '';
    expect(texto).toMatch(/gastaram R\$\s*420\s*mi de dinheiro federal, em 312 prefeituras e governos/);
    expect(texto).toMatch(/não publicou o extrato de nov\/2025/);
    expect(texto).toMatch(/fica fora do cartão corporativo/);
  });

  it('sem carga do sigilo, diz isso em vez de mostrar zero', async () => {
    vi.mocked(api.obterGoverno).mockResolvedValue({ ...DE_2025, sigilo: null });

    renderizar('cartoes');

    expect(await screen.findByText(/gastos sigilosos deste período ainda não foram carregados/)).toBeDefined();
  });

  it('a aba Orçamento não traz os cartões, que têm aba própria', async () => {
    renderizar();

    await screen.findAllByText('Urbanismo');
    expect(screen.queryByText('Gasto sigiloso')).toBeNull();
    expect(screen.getByRole('link', { name: 'Cartões' }).getAttribute('href')).toBe('/governo/cartoes');
  });

  it('soma o pago de anos anteriores e o mostra à parte', async () => {
    renderizar();

    const urbanismo = (await screen.findAllByText('Urbanismo'))
      .map((el) => el.closest<HTMLElement>('li.barra-area'))
      .find(Boolean)!;
    expect(urbanismo.textContent).toMatch(/R\$ 6,5 bi de anos anteriores/);
    expect(within(urbanismo).getByText('R$ 8,5 bi')).toBeDefined();
  });

  it('dotação incompleta não vira percentual', async () => {
    renderizar();

    const linha = (await screen.findByRole('rowheader', { name: 'Previdência social' })).closest('tr')!;
    expect(within(linha).getByText('dotação incompleta')).toBeDefined();
    expect(linha.textContent).not.toMatch(/%/);
  });

  it('a gestão vem depois dos números do ano', async () => {
    renderizar();

    const numeros = await screen.findByRole('region', { name: '2025 em números' });
    const gestao = screen.getByRole('region', { name: 'Quem governou de 2023 a 2026' });

    expect(numeros.compareDocumentPosition(gestao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ano em andamento abre avisado', async () => {
    vi.mocked(api.obterGoverno).mockResolvedValue({ ...DE_2025, periodo: { primeiroAno: 2026, ultimoAno: 2026 }, emAndamento: 2026 });

    renderizar();

    expect(await screen.findByText(/2026 vai até 22\/09\/2026/)).toBeDefined();
  });

  it('com vários anos, mostra o ano a ano e marca o que está em andamento', async () => {
    vi.mocked(api.obterGoverno).mockResolvedValue({
      ...DE_2025,
      periodo: { primeiroAno: 2025, ultimoAno: 2026 },
      emAndamento: 2026,
      porAno: [
        { anoDoOrcamento: 2025, arrecadou: 2.88e12, gastou: 2.5e12, pegouEmprestado: 2.46e12, fechado: true },
        { anoDoOrcamento: 2026, arrecadou: 2.1e12, gastou: 1.9e12, pegouEmprestado: 1.2e12, fechado: false },
      ],
    });

    renderizar();

    const linha = (await screen.findByRole('rowheader', { name: /2026/ })).closest('tr')!;
    expect(linha.textContent).toMatch(/em andamento/);
    expect(within(linha).getByText('R$ 2,10 tri')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Todos os anos' })).toBeDefined();
  });

  it('sem carga, diz que ainda não foi carregado', async () => {
    vi.mocked(api.obterGoverno).mockResolvedValue(null);

    renderizar();

    expect(await screen.findByText(/ainda não foram carregados/)).toBeDefined();
  });
});

/**
 * DECISÃO: Um botão por gestão, recortado aos anos que existem: medir as duas do mesmo jeito.
 *
 * ATENÇÃO: Sem correção pela inflação, o ano recente parece maior — a tabela avisa.
 */
describe('comparar gestões', () => {
  it('cada gestão é um atalho de período', async () => {
    vi.mocked(api.obterGoverno).mockResolvedValue({ ...DE_2025, anosDisponiveis: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] });
    renderizar();

    fireEvent.click(await screen.findByRole('button', { name: 'Jair Bolsonaro (2019–2022)' }));

    await vi.waitFor(() => expect(api.obterGoverno).toHaveBeenLastCalledWith({ primeiroAno: 2019, ultimoAno: 2022 }));
  });

  it('o ano a ano diz a gestão de cada ano e que o valor é nominal', async () => {
    vi.mocked(api.obterGoverno).mockResolvedValue({
      ...DE_2025,
      periodo: { primeiroAno: 2022, ultimoAno: 2023 },
      porAno: [
        { anoDoOrcamento: 2022, arrecadou: 2.2e12, gastou: 2.9e12, pegouEmprestado: 1.7e12, fechado: true },
        { anoDoOrcamento: 2023, arrecadou: 2.3e12, gastou: 2.9e12, pegouEmprestado: 1.8e12, fechado: true },
      ],
    });
    renderizar();

    const linha2022 = (await screen.findByRole('rowheader', { name: '2022' })).closest('tr')!;
    expect(within(linha2022).getByText('Jair Bolsonaro')).toBeDefined();
    expect(within(screen.getByRole('rowheader', { name: '2023' }).closest('tr')!).getByText('Lula')).toBeDefined();
    expect(screen.getByText(/sem correção pela inflação/)).toBeDefined();
  });
});
