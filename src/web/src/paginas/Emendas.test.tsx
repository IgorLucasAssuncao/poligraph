import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmendasDoMunicipio, MapaDoBrasil, MapaDoEstado } from '../api';
import { faixaDe, faixasPorQuantil } from '../mapa';
import { Emendas } from './Emendas';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterMapaDoBrasil: vi.fn(),
  obterReconciliacao: vi.fn().mockResolvedValue([]),
  obterMapaDoEstado: vi.fn(),
  obterEmendasDoMunicipio: vi.fn(),
  listarParlamentaresDoMunicipio: vi.fn(),
  listarFavorecidosDoMunicipio: vi.fn(),
  buscarMunicipios: vi.fn(),
}));

vi.mock('../componentes/contextoDoTour', () => ({
  useTour: () => ({ iniciar: vi.fn(), registrar: vi.fn() }),
}));

const api = await import('../api');

const BRASIL: MapaDoBrasil = {
  periodo: { de: 2023, ate: 2026 },
  anosDisponiveis: [2023, 2024, 2025, 2026],
  recebido: 70e9,
  noMapa: 37.2e9,
  viaIntermediario: 32.5e9,
  semSede: 0.3e9,
  porUf: [
    { uf: 'PR', codigoUf: '41', recebido: 2e9, municipios: 399 },
    { uf: 'SP', codigoUf: '35', recebido: 4e9, municipios: 645 },
  ],
};

const PARANA: MapaDoEstado = {
  uf: 'PR',
  periodo: { de: 2023, ate: 2026 },
  recebido: 2e9,
  porMunicipio: [
    { codigoIbge: '4106902', nome: 'CURITIBA', recebido: 300e6 },
    { codigoIbge: '4113734', nome: 'LUIZIANA', recebido: 7e6 },
    { codigoIbge: '4100103', nome: 'ABATIA', recebido: 0 },
  ],
};

const LUIZIANA: EmendasDoMunicipio = {
  municipio: { codigoIbge: '4113734', nome: 'LUIZIANA', uf: 'PR' },
  periodo: { de: 2023, ate: 2026 },
  anosDisponiveis: [2023, 2024, 2025, 2026],
  recebido: 7e6,
  naPropriaCidade: 5e6,
  deParlamentares: 4e6,
  parlamentares: {
    itens: [
      { pessoaId: 42, nome: 'Fulano de Tal', partido: 'XYZ', uf: 'PR', casa: 'CAMARA', urlFoto: null, recebido: 4e6, emendas: 2 },
      ...Array.from({ length: 9 }, (_, i) => ({
        pessoaId: 100 + i, nome: `Parlamentar ${i}`, partido: 'XYZ', uf: 'PR', casa: 'CAMARA' as const,
        urlFoto: null, recebido: 1e5, emendas: 1,
      })),
    ],
    pagina: 1,
    tamanho: 10,
    total: 11,
  },
  coletivos: [{ tipo: 'BANCADA', nome: 'BANCADA DO PARANA', recebido: 3e6, emendas: 1 }],
  favorecidos: {
    itens: [{ nome: 'MUNICIPIO DE LUIZIANA', naturezaJuridica: 'Município', uf: 'PR', municipio: 'LUIZIANA', recebido: 5e6 }],
    pagina: 1,
    tamanho: 10,
    total: 1,
  },
  convenios: {
    quantidade: 1, emExecucao: 1, combinado: 3e6, liberado: 1.2e6, aLiberar: 1.8e6,
    lista: {
      itens: [{
        numero: 'EXEC1', objeto: 'CONSTRUCAO DE UNIDADE BASICA DE SAUDE', convenente: 'MUNICIPIO DE LUIZIANA',
        cnpj: '76205954000150', situacao: 'EM EXECUÇÃO', dataPublicacao: '2025-02-01', valor: 3e6, valorLiberado: 1.2e6,
        urlFonte: 'https://portaldatransparencia.gov.br/convenios/EXEC1',
      }],
      pagina: 1, tamanho: 10, total: 1,
    },
  },
};

/** Um quadrado para o Paraná: o bastante para o d3 desenhar e o teste clicar. */
const MALHA = {
  type: 'Topology',
  objects: {
    BRUF: {
      type: 'GeometryCollection',
      geometries: [{ type: 'Polygon', arcs: [[0]], properties: { codarea: '41' } }],
    },
  },
  arcs: [[[-50, -25], [-49, -25], [-49, -24], [-50, -24], [-50, -25]]],
};

function renderizar(endereco = '/emendas') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Emendas />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.obterMapaDoBrasil).mockResolvedValue(BRASIL);
  vi.mocked(api.obterMapaDoEstado).mockResolvedValue(PARANA);
  vi.mocked(api.obterEmendasDoMunicipio).mockResolvedValue(LUIZIANA);
  vi.mocked(api.listarParlamentaresDoMunicipio).mockResolvedValue({
    itens: [{ pessoaId: 7, nome: 'Beltrana', partido: 'ABC', uf: 'PR', casa: 'SENADO', urlFoto: null, recebido: 1e6, emendas: 1 }],
    pagina: 2,
    tamanho: 10,
    total: 11,
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(MALHA))));
});

afterEach(() => vi.unstubAllGlobals());

/**
 * O mapa é por onde se escolhe: o painel da cidade vem depois dele, não o empurra para baixo.
 *
 * A cidade guardada abre na chegada, e não prende: "Ver o Brasil" precisa voltar ao Brasil.
 */
describe('Emendas no mapa', () => {
  it('declara o que ficou fora do mapa, com valor', async () => {
    renderizar();

    const numeros = await screen.findByRole('region', { name: 'O dinheiro das emendas do período' });
    expect(within(numeros).getByText('Repassado por banco')).toBeInTheDocument();
    expect(within(numeros).getByText('R$ 32,5 bi')).toBeInTheDocument();
    expect(within(numeros).getByText('Sem cidade')).toBeInTheDocument();
  });

  it('abre em todos os anos, e o período vai para a consulta', async () => {
    renderizar();

    const todos = await screen.findByRole('button', { name: 'Todos os anos' });
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    expect(api.obterMapaDoBrasil).toHaveBeenLastCalledWith(undefined);

    fireEvent.change(screen.getByLabelText(/^De/), { target: { value: '2025' } });

    await vi.waitFor(() => expect(api.obterMapaDoBrasil).toHaveBeenLastCalledWith({ de: 2025, ate: 2026 }));
  });

  it('lista os estados pelo valor recebido', async () => {
    renderizar();

    const linhas = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(linhas.map((l) => within(l).getByRole('rowheader').textContent)).toEqual(['SP', 'PR']);
  });

  it('escolher o estado lista só as cidades que receberam', async () => {
    renderizar();

    fireEvent.click(await screen.findByRole('button', { name: 'PR' }));

    expect(await screen.findByRole('button', { name: 'Curitiba' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abatia' })).not.toBeInTheDocument();
    expect(screen.getByText(/em 2 das 3\s+cidades de PR/)).toBeInTheDocument();
  });

  it('o mapa do Brasil responde ao teclado', async () => {
    renderizar();

    const parana = await screen.findByRole('button', { name: /^PR: R\$ 2 bi/ });
    fireEvent.keyDown(parana, { key: 'Enter' });

    expect(await screen.findByRole('button', { name: 'Curitiba' })).toBeInTheDocument();
  });

  it('o nome da área acompanha o mouse', async () => {
    const { container } = renderizar();

    const area = await vi.waitFor(() => {
      const achada = container.querySelector('[data-codigo="41"]');
      if (!achada) throw new Error('ainda sem área');
      return achada;
    });
    fireEvent.pointerMove(area, { clientX: 10, clientY: 10 });

    expect(container.querySelector('.mapa-rotulo')).toHaveTextContent('PR: R$ 2 bi');
  });

  it('separa deputados e senadores das bancadas, e leva ao perfil', async () => {
    renderizar('/emendas?uf=PR&cidade=4113734');

    const painel = await screen.findByRole('region', { name: /Luiziana/ });
    const parlamentares = within(painel).getByRole('heading', { name: /Deputados e senadores/ }).parentElement!;
    expect(within(parlamentares).getByRole('link', { name: /Fulano/ })).toHaveAttribute('href', '/parlamentar/42');
    expect(within(parlamentares).queryByText(/Bancada do Parana/i)).not.toBeInTheDocument();

    const coletivos = within(painel).getByRole('heading', { name: 'Bancadas e comissões' }).parentElement!;
    expect(within(coletivos).getByText(/Bancada estadual/)).toBeInTheDocument();
  });

  it('o painel da cidade fica abaixo do mapa', async () => {
    const { container } = renderizar('/emendas?uf=PR&cidade=4113734');

    const painel = await screen.findByRole('region', { name: /Luiziana/ });
    const mapa = await vi.waitFor(() => {
      const achado = container.querySelector('.mapa, .mapa-carregando');
      if (!achado) throw new Error('ainda sem mapa');
      return achado;
    });

    expect(mapa.compareDocumentPosition(painel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('busca a próxima página de parlamentares sob demanda', async () => {
    renderizar('/emendas?uf=PR&cidade=4113734');

    fireEvent.click(await screen.findByRole('button', { name: 'Mostrar mais 1' }));

    expect(await screen.findByRole('link', { name: /Beltrana/ })).toHaveAttribute('href', '/parlamentar/7');
    expect(api.listarParlamentaresDoMunicipio).toHaveBeenCalledWith('4113734', undefined, 2);
  });

  it('abre a cidade guardada neste navegador', async () => {
    localStorage.setItem('poligraph.minhaCidade', JSON.stringify(LUIZIANA.municipio));

    renderizar();

    expect(await screen.findByRole('region', { name: /Luiziana/ })).toBeInTheDocument();
    expect(api.obterEmendasDoMunicipio).toHaveBeenCalledWith('4113734', undefined);
  });

  it('com cidade guardada, "Ver o Brasil" volta ao mapa do país', async () => {
    localStorage.setItem('poligraph.minhaCidade', JSON.stringify(LUIZIANA.municipio));
    renderizar();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver o Brasil' }));

    expect(await screen.findByRole('heading', { name: 'Por estado' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Luiziana/ })).not.toBeInTheDocument();
  });

  it('ignora uma cidade guardada malformada', async () => {
    localStorage.setItem('poligraph.minhaCidade', JSON.stringify({ codigoIbge: '<script>', uf: 'PR' }));

    renderizar();

    await screen.findByRole('table');
    expect(api.obterEmendasDoMunicipio).not.toHaveBeenCalled();
  });
});

describe('faixas do mapa', () => {
  it('sem pagamento é a faixa zero, e zero não entra no quantil', () => {
    const limites = faixasPorQuantil([0, 10, 20, 30, 40, 50]);

    expect(faixaDe(0, limites)).toBe(0);
    expect(faixaDe(undefined, limites)).toBe(0);
    expect(faixaDe(10, limites)).toBe(1);
    expect(faixaDe(50, limites)).toBe(5);
  });

  it('valores repetidos não criam faixa vazia', () => {
    expect(faixasPorQuantil([5, 5, 5, 5, 5])).toEqual([]);
    expect(faixaDe(5, [])).toBe(1);
  });
});

/**
 * DECISÃO: "Quanto já foi liberado?": o que falta liberar, só dos em execução.
 */
describe('convênios da cidade', () => {
  it('diz o combinado, o liberado e o que ainda falta liberar, e leva à entidade', async () => {
    renderizar('/emendas?uf=PR&cidade=4113734');

    const resumo = (await screen.findByText(/R\$\s3 mi combinados, R\$\s1,2 mi já liberados/)).closest('p')!;
    expect(resumo.textContent).toMatch(/1 em execução, com R\$\s1,8 mi ainda a liberar/);
    expect(screen.getByText('Construcao de unidade basica de saude')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Municipio de Luiziana' })).toHaveAttribute('href', '/entidades/76205954000150');
  });
});

/** Em reais absolutos SP fica no topo por ser grande; por habitante, a ordem é outra (2026-10-03). */
describe('o mapa por habitante', () => {
  it('reordena a tabela pelo valor por habitante', async () => {
    vi.mocked(api.obterMapaDoBrasil).mockResolvedValue({
      ...BRASIL,
      anoDaPopulacao: 2025,
      porUf: [
        { uf: 'PR', codigoUf: '41', recebido: 2e9, municipios: 399, populacao: 11e6 },
        { uf: 'SP', codigoUf: '35', recebido: 4e9, municipios: 645, populacao: 46e6 },
      ],
    });
    renderizar();

    const primeiraLinha = async () =>
      (await screen.findAllByRole('row'))[1].querySelector('th')!.textContent;
    expect(await primeiraLinha()).toBe('SP');

    await userEvent.click(await screen.findByRole('button', { name: 'Por habitante' }));

    expect(await primeiraLinha()).toBe('PR');
    expect(screen.getByText(/População estimada pelo IBGE para 2025/)).toBeDefined();
  });

  it('sem população, não oferece a leitura', async () => {
    renderizar();
    await screen.findAllByRole('row');

    expect(screen.queryByRole('button', { name: 'Por habitante' })).toBeNull();
  });
});
