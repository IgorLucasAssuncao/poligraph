import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Parlamentar } from './Parlamentar';
import type { EmendasDoParlamentar, Ficha, FinanciamentoDeCampanha } from '../api';

vi.mock('../sessao', () => ({
  useSessao: () => ({
    usuario: { nome: 'Pessoa de Teste', email: 'teste@exemplo.com', fotoUrl: null },
    carregando: false,
    leituraPublica: false,
    entrou: () => {},
    sair: async () => {},
  }),
}));

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterFicha: vi.fn(),
  obterNoticias: vi.fn(),
  listarVotos: vi.fn(),
  listarLancamentos: vi.fn(),
  listarConvenios: vi.fn(),
  listarSeguidos: vi.fn(),
  obterGastos: vi.fn(),
  obterEmendas: vi.fn(),
  obterFinanciamento: vi.fn(),
  obterPatrimonio: vi.fn(),
}));

const api = await import('../api');

const FICHA: Ficha = {
  id: 1,
  nome: 'Ana Ribeiro',
  casa: 'CAMARA',
  nomeCivil: 'ANA RIBEIRO',
  partido: 'PARTIDO-A',
  uf: 'SP',
  urlFoto: null,
  nVotacoes: 120,
  nRegistrosDeVoto: 120,
  votosRecentes: [],
  maisSimilares: [],
  alinhamento: null,
  urlFonte: 'https://www.camara.leg.br/deputados/1',
  redesSociais: [],
  presenca: null,
};

/**
 * Um voto de cada situação em que a orientação do Governo aparece — ou ⛔ não deve
 * aparecer. As três últimas são os motivos distintos de a orientação ser inútil.
 */
function voto(
  id: string,
  valor: number | null,
  orientacaoDoGoverno: string | null,
): Ficha['votosRecentes'][number] {
  return {
    votacaoId: id,
    data: '2025-06-01',
    descricao: `Votação ${id}`,
    valor,
    orientacaoDoGoverno,
    ementa: null,
    materia: null,
    categoria: 'SUBSTANTIVA' as const,
    urlProposicao: null,
    urlRegistro: null,
  };
}

/** ⭐ Empenhado ≠ pago, e a razão entre eles é 40%. */
const EMENDAS: EmendasDoParlamentar = {
  ano: 2025,
  empenhado: 1_000_000,
  pago: 400_000,
  quantidade: 3,
  porDestino: [
    { localidade: 'Ananindeua - PA', empenhado: 900_000, pago: 400_000, quantidade: 2 },
    { localidade: 'Belém - PA', empenhado: 100_000, pago: 0, quantidade: 1 },
  ],
  porFuncao: [{ funcao: 'Saúde', empenhado: 900_000, pago: 400_000 }],
  favorecidos: {
    recebido: 700_000,
    viaIntermediario: 200_000,
    aPessoas: 50_000,
    semIdentificacao: 0,
    ultimoMes: '2026-03-01',
    identificados: 1,
    maiores: [
      {
        nome: 'CONSTRUTORA EXEMPLO LTDA',
        naturezaJuridica: 'Sociedade Empresária Limitada',
        uf: 'PA',
        municipio: 'ANANINDEUA',
        recebido: 450_000,
      },
    ],
  },
  pagamentosPorMes: [
    { mes: '2025-11-01', valor: 300_000 },
    { mes: '2026-03-01', valor: 400_000 },
  ],
  convenios: {
    quantidade: 1,
    maiores: [
      {
        numero: '1AAQKR',
        convenente: 'MUNICIPIO DE ANANINDEUA',
        objeto: 'AQUISICAO DE EQUIPAMENTO',
        dataPublicacao: '2025-01-16',
        valor: 80_000_000,
        emendasQueFinanciam: 23,
        urlFonte: 'https://portaldatransparencia.gov.br/convenios/1AAQKR',
      },
    ],
  },
  cidades: {
    quantidade: 1,
    maiores: [{ municipio: { codigoIbge: '1500800', nome: 'Ananindeua', uf: 'PA' }, recebido: 450_000 }],
  },
};

const SEM_DESTINO = {
  cidades: { quantidade: 0, maiores: [] },
  favorecidos: {
    recebido: 0, viaIntermediario: 0, aPessoas: 0, semIdentificacao: 0,
    ultimoMes: null, identificados: 0, maiores: [],
  },
  pagamentosPorMes: [],
  convenios: { quantidade: 0, maiores: [] },
};

const CAMPANHA: FinanciamentoDeCampanha = {
  anoEleicao: 2022,
  total: 3_250_000,
  fundoEspecial: 3_000_000,
  fundoPartidario: 200_000,
  porFonte: [
    { fonte: 'FUNDO ESPECIAL', total: 3_000_000, lancamentos: 4 },
    { fonte: 'FUNDO PARTIDARIO', total: 200_000, lancamentos: 1 },
    { fonte: 'OUTROS RECURSOS', total: 50_000, lancamentos: 9 },
  ],
  maioresDoadores: [{ nome: 'Jose da Silva', total: 50_000, pessoaFisica: true }],
};

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/parlamentar/1']}>
      <Routes>
        <Route path="/parlamentar/:id/:aba?" element={<Parlamentar />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Renderiza com uma ficha específica e espera ela chegar. */
async function renderizarCom(ficha: Ficha) {
  vi.mocked(api.obterFicha).mockResolvedValue(ficha);
  const resultado = renderizar();
  await screen.findAllByRole('heading', { name: /Ana Ribeiro/ });

  return resultado;
}

/** Renderiza e espera a ficha chegar. O nome aparece em dois `<h1>` — daí o `findAll`. */
async function abrirPerfil() {
  renderizar();
  await screen.findAllByRole('heading', { name: /Ana Ribeiro/ });
}

/** Cada dinheiro é uma aba com endereço: abre pelo link da aba, como a pessoa faria. */
async function abrirAba(nome: 'Emendas' | 'Cota' | 'Campanha') {
  await abrirPerfil();
  const abas = screen.getByRole('navigation', { name: 'Seções do perfil' });
  await userEvent.click(within(abas).getByRole('link', { name: nome }));
}

beforeEach(() => {
  vi.mocked(api.obterFicha).mockResolvedValue(FICHA);
  vi.mocked(api.obterNoticias).mockResolvedValue({ itens: [], pagina: 1, tamanho: 10, total: 0 });
  vi.mocked(api.listarSeguidos).mockResolvedValue([]);
  vi.mocked(api.obterEmendas).mockResolvedValue(EMENDAS);
  vi.mocked(api.obterFinanciamento).mockResolvedValue(CAMPANHA);
  vi.mocked(api.obterPatrimonio).mockResolvedValue([]);
});

describe('a casa do parlamentar', () => {
  it('aparece no perfil, antes de partido e UF', async () => {
    await abrirPerfil();

    // Situa todo o resto: um "PT · SP" sem a casa deixa o leitor sem saber se está
    // diante de deputado ou senador — e as duas votam matérias diferentes, então o
    // número de votações e o grafo significam coisas distintas.
    expect(await screen.findByRole('button', { name: 'Deputado' })).toBeInTheDocument();
  });

  it('senador é rotulado como senador', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({ ...FICHA, casa: 'SENADO' });
    await abrirPerfil();

    expect(await screen.findByRole('button', { name: 'Senador' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deputado' })).toBeNull();
  });

  it('sem casa na base, o perfil não inventa rótulo', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({ ...FICHA, casa: '' });
    await abrirPerfil();

    expect(screen.queryByRole('button', { name: 'Deputado' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Senador' })).toBeNull();
  });
});

describe('contas — emendas', () => {
  it('🔴 mostra o pago junto do empenhado, nunca só o empenhado', async () => {
    await abrirAba('Emendas');

    const texto = await tela();

    // ⚠️ Exibir só o empenhado deixaria a pessoa concluir que o dinheiro chegou — que
    //    é exatamente o que quem anuncia emenda gostaria que ela concluísse.
    expect(texto).toMatch(/R\$\s*1\.000\.000,00/);
    expect(texto).toMatch(/R\$\s*400\.000,00/);
    expect(texto).toMatch(/40% saiu de fato/);
  });

  it('⭐ estado vazio é honesto, não "R$ 0,00"', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      ano: 0, empenhado: 0, pago: 0, quantidade: 0, porDestino: [], porFuncao: [],
      ...SEM_DESTINO,
    });

    await abrirAba('Emendas');
    await screen.findByText(/Nenhuma emenda atribuída/);

    // 🔴 Zero afirmaria que ele não teve emenda; o que se sabe é que a BASE não tem.
    expect(await tela()).not.toMatch(/R\$\s*0,00/);
  });

  it('⚠️ não divide por zero quando nada foi empenhado', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      ...EMENDAS, empenhado: 0, pago: 0, porDestino: [], porFuncao: [],
    });

    await abrirAba('Emendas');

    // ⛔ Sem a guarda, `0/0` daria `NaN%` na tela
    expect(await tela()).not.toMatch(/NaN/);
  });
});

describe('contas — quem recebeu a emenda', () => {
  /**
   * 🔴 O intermediário e as pessoas saem da lista, ⛔ da conta: o valor de cada um
   * aparece em linha própria.
   */
  it('mostra o intermediário e as pessoas à parte, com o valor', async () => {
    await abrirAba('Emendas');
    const texto = await tela();

    expect(texto).toMatch(/Via Banco do Brasil, que repassa\s*R\$\s*200\.000,00/);
    expect(texto).toMatch(/A pessoas, sem identificação\s*R\$\s*50\.000,00/);
    expect(texto).not.toMatch(/Sem identificação na fonte/);
  });

  it('diz até quando vai a soma, porque ela inclui os anos seguintes', async () => {
    await abrirAba('Emendas');

    expect(await tela()).toMatch(/R\$\s*700\.000,00 recebidos pelas emendas de 2025, até mar\/2026/);
  });

  /** ⭐ A frase é a leitura; o gráfico, o detalhe. */
  it('diz quanto saiu no próprio ano', async () => {
    await abrirAba('Emendas');

    expect(await tela()).toMatch(/R\$\s*300\.000,00 de R\$\s*700\.000,00 — 43% — saíram ainda em 2025/);
  });

  /** 🔴 R$ 80 mi de 23 emendas ⛔ é dinheiro deste parlamentar, e a linha precisa dizer. */
  it('o convênio diz de quantas emendas é', async () => {
    await abrirAba('Emendas');

    expect(await tela()).toMatch(/financiado por 23 emendas/);
  });
});

describe('contas — campanha', () => {
  it('🔴 os dois fundos aparecem SEPARADOS e nomeados', async () => {
    await abrirAba('Campanha');

    await screen.findByText('Fundo Partidário');
    const texto = await tela();

    // ⭐ Cada um com o próprio valor…
    expect(texto).toMatch(/R\$\s*3\.000\.000,00/);
    expect(texto).toMatch(/R\$\s*200\.000,00/);

    // ⛔ …e a soma dos dois NÃO substitui os dois: ela aparece dita como soma.
    expect(texto).toMatch(/Juntos, os dois fundos somam R\$\s*3\.200\.000,00/);
    expect(texto).toMatch(/São fundos distintos/);
  });

  it('⭐ a proporção pública é sobre o total arrecadado', async () => {
    await abrirAba('Campanha');

    // 3.200.000 de 3.250.000 = 98%
    expect(await tela()).toMatch(/98% do que a campanha arrecadou/);
  });

  it('🔴 marca o doador pessoa física sem revelar documento', async () => {
    await abrirAba('Campanha');

    await screen.findByText(/Jose da Silva/);
    const texto = await tela();

    expect(texto).toMatch(/pessoa física/);
    // RNF-13 — nem CPF, nem hash, nem a palavra
    expect(texto).not.toMatch(/cpf|cnpj/i);
  });

  it('⭐ estado vazio é honesto', async () => {
    vi.mocked(api.obterFinanciamento).mockResolvedValue({
      anoEleicao: 0, total: 0, fundoEspecial: 0, fundoPartidario: 0,
      porFonte: [], maioresDoadores: [],
    });

    await abrirAba('Campanha');
    await screen.findByText(/Nenhuma receita de campanha registrada/);

    expect(await tela()).not.toMatch(/NaN/);
  });
});

/** ⚠️ O texto é quebrado por `<strong>` e `<Termo>` — a checagem é sobre o todo. */
async function tela(): Promise<string> {
  return await waitFor(() => document.body.textContent!.replace(/\s+/g, ' '));
}

describe('orientação do Governo ao lado do voto', () => {
  /**
   * 🔴 "Votou Sim" sozinho ⛔ não diz nada. O que informa é "votou Sim quando o Governo
   * pediu Não" — e é isso que a linha precisa mostrar.
   */
  it('mostra o que o Governo pediu', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      votosRecentes: [voto('a', 1, 'Sim')],
    });

    await abrirPerfil();

    expect(await screen.findByText(/Governo pediu/)).toBeInTheDocument();
  });

  it('avisa quando o voto divergiu da orientação', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      votosRecentes: [voto('a', 1, 'Não')],
    });

    await abrirPerfil();

    // ⚠️ Texto neutro: "votou diferente", ⛔ nunca "contrariou" nem um ✗ vermelho.
    //    Divergir da orientação ⛔ não é erro, e a tela ⛔ não pode dar nota.
    expect(await screen.findByText(/votou diferente/)).toBeInTheDocument();
  });

  it('⛔ cala quando não há o que comparar', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      votosRecentes: [
        // O Governo ⛔ não orientou — o caso mais comum, e uma marca em toda linha
        // viraria ruído.
        voto('a', 1, null),
        // ⭐ `Obstrução` é tática de quórum, ⛔ não posição de mérito.
        voto('b', -1, 'Obstrução'),
        // ⭐ `Liberado` é ausência de orientação.
        voto('c', 1, 'Liberado'),
        // O parlamentar se absteve: ⛔ não há voto a comparar.
        voto('d', 0, 'Sim'),
      ],
    });

    await abrirPerfil();
    await screen.findByText(/Votação a/);

    expect(screen.queryByText(/Governo pediu/)).not.toBeInTheDocument();
  });
});


describe('a ementa na lista de votos', () => {
  /**
   * 🔴 A descrição diz o NÚMERO do projeto — "Aprovado o Substitutivo ao Projeto de Lei
   * nº 4.133" — e não diz o assunto. Quem não acompanha o Congresso lê isso e não sabe
   * em que a pessoa votou. A ementa é o que torna o voto legível.
   */
  it('mostra a ementa no lugar da descrição processual', async () => {
    const comEmenta = {
      ...FICHA,
      votosRecentes: [
        {
          ...voto('v1', 1, null),
          descricao: 'Aprovado o Substitutivo ao Projeto de Lei nº 4.133, de 2023.',
          ementa: 'Dispõe sobre diretrizes para a política industrial brasileira.',
          materia: 'PL 4133/2023',
          categoria: 'SUBSTANTIVA' as const,
        },
      ],
    };

    const { container } = await renderizarCom(comEmenta);

    const texto = container.textContent!;
    expect(texto).toMatch(/diretrizes para a política industrial/i);
  });

  /**
   * ⚠️ A descrição processual continua acessível: é ela que identifica QUAL votação
   * daquele projeto foi — texto principal, destaque, redação final. Sem ela, dois votos
   * opostos do mesmo projeto apareceriam como a mesma linha repetida.
   */
  it('mantém a descrição processual junto da matéria', async () => {
    const comEmenta = {
      ...FICHA,
      votosRecentes: [
        {
          ...voto('v1', 1, null),
          descricao: 'Aprovado o Substitutivo ao Projeto de Lei nº 4.133, de 2023.',
          ementa: 'Dispõe sobre diretrizes para a política industrial brasileira.',
          materia: 'PL 4133/2023',
          categoria: 'SUBSTANTIVA' as const,
        },
      ],
    };

    const { container } = await renderizarCom(comEmenta);

    const texto = container.textContent!;
    expect(texto).toMatch(/PL 4133\/2023/);
    expect(texto).toMatch(/Aprovado o Substitutivo/);
  });

  /**
   * ⛔ Sem ementa — todo o Senado e parte da Câmara — a tela cai na descrição, ⛔ nunca
   * num espaço em branco.
   */
  it('sem ementa, cai na descrição', async () => {
    const semEmenta = {
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), descricao: 'Votação nominal do PLP 73.' }],
    };

    const { container } = await renderizarCom(semEmenta);

    expect(container.textContent).toMatch(/Votação nominal do PLP 73/);
  });
});


describe('voto de rito não pode usar a ementa como manchete', () => {
  const RITO = {
    descricao: 'Rejeitado o Requerimento. Sim: 118; Não: 289; Total: 407.',
    ementa: 'Institui o Imposto sobre Bens e Serviços - IBS e dá outras providências.',
    materia: 'PLP 68/2024',
    categoria: 'PROCEDIMENTAL' as const,
  };

  /**
   * 🔴 O modo de falha que este projeto persegue: plausível e errado. 43,2% das linhas
   * da ficha são de rito. Com a ementa por manchete, "Institui o IBS" ao lado de um
   * "Sim" faria o leitor concluir que a pessoa votou a favor da reforma tributária —
   * quando ela votou sobre andamento.
   */
  it('a manchete é o que foi de fato votado, não a ementa', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO }],
    });

    const manchete = container.querySelector('.voto-descricao')!.textContent!;

    expect(manchete).toMatch(/Rejeitado o Requerimento/);
    expect(manchete).not.toMatch(/Institui o Imposto/);
  });

  /** ⚠️ A ementa não some: vira contexto, para dizer sobre QUE projeto era o rito. */
  it('a ementa vira contexto, junto da matéria', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO }],
    });

    const contexto = container.querySelector('.voto-processual')!.textContent!;

    expect(contexto).toMatch(/PLP 68\/2024/);
    expect(contexto).toMatch(/Institui o Imposto/);
  });

  /**
   * ⛔ Voto de rito não é escondido — ele existe e é público. Mas pesa ZERO na
   * afinidade, e a tela precisa dizer isso antes do enunciado, não depois.
   */
  it('avisa que não é voto no mérito', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO }],
    });

    expect(container.textContent).toMatch(/não é voto no mérito/i);
  });

  /** ⭐ No voto de mérito a ordem é a oposta: a ementa manda. */
  it('no voto de mérito a ementa continua sendo a manchete', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO, categoria: 'SUBSTANTIVA' as const }],
    });

    expect(container.querySelector('.voto-descricao')!.textContent).toMatch(/Institui o Imposto/);
    expect(container.textContent).not.toMatch(/não é voto no mérito/i);
  });
});

describe('o tour da ficha', () => {
  /** Um alvo que sumisse da página faria o tour pular o passo calado. */
  it('encontra na página cada elemento que explica', async () => {
    const { passosDaFicha } = await import('../tour');
    await renderizarCom({
      ...FICHA,
      votosRecentes: [voto('v1', 1, 'Sim')],
      maisSimilares: [{ pessoaId: 2, nome: 'Bruno Tavares', partido: 'PARTIDO-B', valor: 0.9, comuns: 100 }],
      alinhamento: {
        governismo: 0.8,
        baseGovernismo: 50,
        disciplina: 0.9,
        baseDisciplina: 50,
        partidoMedido: 'PARTIDO-A',
      },
    });
    await screen.findByRole('navigation', { name: 'Contas do mandato' });

    for (const passo of passosDaFicha()) {
      expect(document.querySelector(`[data-tour="${passo.alvo}"]`), passo.alvo).not.toBeNull();
    }
  });
});

describe('listas da ficha em páginas', () => {
  /**
   * 🔴 A ficha trazia 20 votos e parava, sem dizer que havia mais. Agora diz o total, e
   * quantos ficam fora das "votações registradas" por ⛔ ter posição.
   */
  it('votos: diz o total e busca a página seguinte', async () => {
    const primeiros = Array.from({ length: 2 }, (_, i) => voto(`v${i}`, 1, null));
    vi.mocked(api.listarVotos).mockResolvedValue({ itens: [voto('v2', -1, null)], pagina: 2, tamanho: 2, total: 3 });

    await renderizarCom({ ...FICHA, votosRecentes: primeiros, nVotacoes: 2, nRegistrosDeVoto: 3 });

    expect(await tela()).toMatch(/2 de 3 registros de voto, 1 deles sem posição/);

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais 1' }));

    expect(await screen.findByText('Votação v2')).toBeDefined();
    expect(vi.mocked(api.listarVotos)).toHaveBeenCalledWith(1, 2, 2);
    expect(screen.queryByRole('button', { name: /Mostrar mais/ })).toBeNull();
  });

  it('convênios: o botão diz quantos faltam', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      ...EMENDAS,
      convenios: { quantidade: 72, maiores: EMENDAS.convenios.maiores },
    });

    await abrirAba('Emendas');

    expect(await screen.findByRole('button', { name: 'Mostrar mais 1' })).toBeDefined();
    expect(await tela()).toMatch(/71 ainda não mostrados/);
  });
});

describe('fontes oficiais', () => {
  /** 🔴 A persona da jornalista: sem link para a fonte, ela ⛔ cita o site. */
  it('a ficha leva à página oficial do parlamentar', async () => {
    await abrirPerfil();

    const link = screen.getByRole('link', { name: /Página oficial na Câmara/ });
    expect(link.getAttribute('href')).toBe('https://www.camara.leg.br/deputados/1');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.textContent).toMatch(/abre o site oficial em nova aba/);
  });

  it('cada voto leva à proposição e ao registro da votação', async () => {
    await renderizarCom({
      ...FICHA,
      votosRecentes: [{
        ...voto('v1', 1, null),
        urlProposicao: 'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=1',
        urlRegistro: 'https://dadosabertos.camara.leg.br/api/v2/votacoes/1-1',
      }],
    });

    expect(screen.getByRole('link', { name: /proposição/ }).getAttribute('href')).toMatch(/idProposicao=1/);
    expect(screen.getByRole('link', { name: /registro da votação/ }).getAttribute('href')).toMatch(/votacoes\/1-1/);
  });

  it('o convênio leva ao Portal', async () => {
    await abrirAba('Emendas');

    expect(screen.getByRole('link', { name: /no Portal/ }).getAttribute('href')).toBe(
      'https://portaldatransparencia.gov.br/convenios/1AAQKR',
    );
  });
});

describe('as abas do perfil', () => {
  /** ⭐ Cada dinheiro tem endereço: o link compartilhado abre direto nele. */
  it('o número do topo leva à aba do dinheiro', async () => {
    await abrirPerfil();

    const faixa = await screen.findByRole('navigation', { name: 'Contas do mandato' });
    await userEvent.click(within(faixa).getByRole('link', { name: /Campanha/ }));

    expect(await screen.findByText(/Arrecadou/)).toBeInTheDocument();
    const abas = screen.getByRole('navigation', { name: 'Seções do perfil' });
    expect(within(abas).getByRole('link', { name: 'Campanha' })).toHaveAttribute('aria-current', 'page');
  });

  /** A cidade vem da sede de quem recebeu, e leva ao mapa. */
  it('as cidades que receberam levam ao mapa', async () => {
    await abrirAba('Emendas');

    expect(await screen.findByRole('link', { name: 'Ananindeua – PA' })).toHaveAttribute(
      'href',
      '/emendas?uf=PA&cidade=1500800',
    );
  });

  /** O secundário fica recolhido: a aba abre com a resposta, ⛔ com 13 blocos. */
  it('os detalhes começam fechados', async () => {
    await abrirAba('Emendas');

    const detalhes = (await screen.findByText(/Ver detalhes: áreas do orçamento/)).closest('details')!;
    expect(detalhes.open).toBe(false);
  });
});

describe('redes e patrimônio', () => {
  beforeEach(() => {
    vi.mocked(api.obterPatrimonio).mockResolvedValue([
      { anoEleicao: 2022, total: 900_000, bens: 3, porTipo: [
        { tipo: 'Casa', valor: 600_000, quantidade: 2 }, { tipo: 'Veículo', valor: 300_000, quantidade: 1 }] },
      { anoEleicao: 2018, total: 400_000, bens: 1, porTipo: [{ tipo: 'Casa', valor: 400_000, quantidade: 1 }] },
    ]);
  });

  /** 🔴 Só vira link o que é http(s), e nenhum leva recomendação do site aos buscadores. */
  it('as redes viram link seguro, e o que não é http(s) some', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      redesSociais: [
        { rede: 'INSTAGRAM', url: 'https://instagram.com/ana', fonte: 'CAMARA' },
        { rede: 'OUTRA', url: 'javascript:alert(1)', fonte: 'CAMARA' },
      ],
    });
    await abrirPerfil();

    const link = screen.getByRole('link', { name: /Instagram/ });
    expect(link).toHaveAttribute('href', 'https://instagram.com/ana');
    expect(link.getAttribute('rel')).toContain('nofollow');
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.getByText(/Redes publicadas na Câmara/)).toBeInTheDocument();
  });

  /** ⚠️ Duas declarações, dois números — ⛔ "cresceu X%", que leria como acusação. */
  it('o patrimônio mostra a última declaração e a anterior, sem porcentagem', async () => {
    await abrirAba('Campanha');

    const frase = (await screen.findByText(/Declarou/)).closest('p')!;
    expect(frase.textContent).toMatch(/R\$\s*900\.000,00 em 3 bens ao se candidatar em 2022/);
    expect(frase.textContent).toMatch(/Em 2018, tinha declarado R\$\s*400\.000,00/);
    expect(frase.textContent).not.toMatch(/%/);
    expect(screen.getByText(/não uma avaliação de mercado/)).toBeInTheDocument();
  });
});

describe('participação nas votações', () => {
  /** ⭐ Sempre "X de Y", com o percentual depois — ⛔ percentual solto (RF-29). */
  it('diz de quantas votações participou, com a base', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      presenca: { presente: 812, votacoes: 1015, ausente: 203, ausenteJustificado: null, justificativaPublicada: false, desde: '2023-02-01', ate: '2026-09-10' },
    });
    await abrirPerfil();

    const bloco = screen.getByText('812 de 1015').closest('div')!;
    expect(bloco.textContent).toMatch(/votações em plenário \(80%\)/);
    expect(bloco.textContent).not.toMatch(/licença/);
  });

  /** O Senado publica a justificativa da ausência; a tela a mostra à parte. */
  it('no Senado, mostra as ausências com licença ou missão à parte', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      casa: 'SENADO',
      presenca: { presente: 380, votacoes: 421, ausente: 3, ausenteJustificado: 38, justificativaPublicada: true, desde: '2023-02-01', ate: '2026-09-10' },
    });
    await abrirPerfil();

    expect(screen.getByText('380 de 421').closest('div')!.textContent).toMatch(/38 ausências com licença ou missão/);
  });
});
