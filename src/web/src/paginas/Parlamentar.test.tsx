import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParlamentarComponent } from './Parlamentar';
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
  obterFichaDoPolitico: vi.fn().mockResolvedValue(null),
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
  idPessoa: 1,
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
  legislatura: 57,
  mandatos: [
    { legislatura: 57, casa: 'CAMARA', anoInicial: 2023, partido: 'PARTIDO-A', uf: 'SP', nRegistrosDeVoto: 120, primeiroVoto: '2023-02-01', ultimoVoto: '2026-12-01' },
  ],
  emExercicio: true,
};

/**
 * Um voto de cada situação em que a orientação do Governo aparece — ou não deve
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

/** DECISÃO: Empenhado ≠ pago, e a razão entre eles é 40%. */
const EMENDAS: EmendasDoParlamentar = {
  anoDaEmenda: 2025,
  empenhado: 1_000_000,
  pago: 400_000,
  pagoDepois: 0,
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
        <Route path="/parlamentar/:idPessoa/:aba?" element={<ParlamentarComponent />} />
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
  vi.mocked(api.listarSeguidos).mockResolvedValue([]);
  vi.mocked(api.obterEmendas).mockResolvedValue(EMENDAS);
  vi.mocked(api.obterFinanciamento).mockResolvedValue(CAMPANHA);
  vi.mocked(api.obterPatrimonio).mockResolvedValue([]);
});

/**
 * Situa todo o resto: um "PT · SP" sem a casa deixa o leitor sem saber se está
 * diante de deputado ou senador — e as duas votam matérias diferentes, então o
 * número de votações e o grafo significam coisas distintas.
 */
describe('a casa do parlamentar', () => {
  it('aparece no perfil, antes de partido e UF', async () => {
    await abrirPerfil();

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

/**
 * ATENÇÃO: Exibir só o empenhado deixaria a pessoa concluir que o dinheiro chegou — que
 * é exatamente o que quem anuncia emenda gostaria que ela concluísse.
 *
 * RISCO: Zero afirmaria que ele não teve emenda; o que se sabe é que a BASE não tem.
 *
 * Sem a guarda, `0/0` daria `NaN%` na tela
 */
describe('contas — emendas', () => {
  it('RISCO: mostra o pago junto do empenhado, nunca só o empenhado', async () => {
    await abrirAba('Emendas');

    const texto = await tela();

    expect(texto).toMatch(/R\$\s*1\.000\.000,00/);
    expect(texto).toMatch(/R\$\s*400\.000,00/);
    expect(texto).toMatch(/40% saiu de fato/);
  });

  it('soma o que foi pago nos anos seguintes (restos a pagar)', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({ ...EMENDAS, pago: 400_000, pagoDepois: 500_000 });
    await abrirAba('Emendas');

    const texto = await tela();
    expect(texto).toMatch(/90% saiu de fato/);
    expect(texto).toMatch(/pago nos anos seguintes:\s*R\$\s*500\.000,00/);
    expect(texto).toMatch(/ainda não pago:\s*R\$\s*100\.000,00/);
  });

  it('recebido diferente do pago diz quanto e por quê', async () => {
    await abrirAba('Emendas');

    const texto = await tela();
    expect(texto).toMatch(/São R\$\s*300\.000,00 a mais que o pago registrado nas emendas/);
  });

  it('recebido igual ao pago não ganha a frase da diferença', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({ ...EMENDAS, pago: 400_000, pagoDepois: 300_000 });
    await abrirAba('Emendas');

    const texto = await tela();
    expect(texto).not.toMatch(/que o pago registrado nas emendas/);
  });

  it('DECISÃO: estado vazio é honesto, não "R$ 0,00"', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      anoDaEmenda: 0, empenhado: 0, pago: 0, pagoDepois: 0, quantidade: 0, porDestino: [], porFuncao: [],
      ...SEM_DESTINO,
    });

    await abrirAba('Emendas');
    await screen.findByText(/Nenhuma emenda atribuída/);

    expect(await tela()).not.toMatch(/R\$\s*0,00/);
  });

  it('ATENÇÃO: não divide por zero quando nada foi empenhado', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      ...EMENDAS, empenhado: 0, pago: 0, pagoDepois: 0, porDestino: [], porFuncao: [],
    });

    await abrirAba('Emendas');

    expect(await tela()).not.toMatch(/NaN/);
  });
});

/**
 * RISCO: O intermediário e as pessoas saem da lista, não da conta: o valor de cada um
 * aparece em linha própria.
 *
 * DECISÃO: A frase é a leitura; o gráfico, o detalhe.
 *
 * RISCO: R$ 80 mi de 23 emendas não é dinheiro deste parlamentar, e a linha precisa dizer.
 */
describe('contas — quem recebeu a emenda', () => {
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

  it('diz quanto saiu no próprio ano', async () => {
    await abrirAba('Emendas');

    expect(await tela()).toMatch(/R\$\s*300\.000,00 de R\$\s*700\.000,00 \(43%\) saíram ainda em 2025/);
  });

  it('o convênio diz de quantas emendas é', async () => {
    await abrirAba('Emendas');

    expect(await tela()).toMatch(/financiado por 23 emendas/);
  });

  it('as fitas das emendas do ano fecham com o que quem recebeu recebeu', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      ...EMENDAS,
      caminhos: [
        { tipo: 'Emenda Individual - Transferências com Finalidade Definida', area: 'Saúde', recebedor: 'EMPRESA', valor: 500_000 },
        { tipo: 'Emenda Individual - Transferências Especiais', area: 'Encargos Especiais', recebedor: 'VIA_BANCO', valor: 200_000 },
      ],
    });
    await abrirAba('Emendas');

    expect(await screen.findByRole('heading', { name: 'Por onde passou o dinheiro dessas emendas' })).toBeDefined();
    expect(screen.getByRole('img', { name: /R\$ 700 mil das emendas de 2025, por tipo, área e quem recebeu/ })).toBeDefined();
  });
});

/**
 * DECISÃO: Cada um com o próprio valor…
 *
 * Não …e a soma dos dois NÃO substitui os dois: ela aparece dita como soma.
 *
 * 3.200.000 de 3.250.000 = 98%
 *
 * RNF-13 — nem CPF, nem hash, nem a palavra
 */
describe('contas — campanha', () => {
  it('RISCO: os dois fundos aparecem SEPARADOS e nomeados', async () => {
    await abrirAba('Campanha');

    await screen.findAllByText('Fundo Partidário');
    const texto = await tela();

    expect(texto).toMatch(/R\$\s*3\.000\.000,00/);
    expect(texto).toMatch(/R\$\s*200\.000,00/);

    expect(texto).toMatch(/Juntos, os dois fundos somam R\$\s*3\.200\.000,00/);
    expect(texto).toMatch(/São fundos distintos/);
  });

  it('DECISÃO: a proporção pública é sobre o total arrecadado', async () => {
    await abrirAba('Campanha');

    expect(await tela()).toMatch(/98% do que a campanha arrecadou/);
  });

  it('RISCO: marca o doador pessoa física sem revelar documento', async () => {
    await abrirAba('Campanha');

    await screen.findByText(/Jose da Silva/);
    const texto = await tela();

    expect(texto).toMatch(/pessoa física/);
    expect(texto).not.toMatch(/cpf|cnpj/i);
  });

  it('DECISÃO: estado vazio é honesto', async () => {
    vi.mocked(api.obterFinanciamento).mockResolvedValue({
      anoEleicao: 0, total: 0, fundoEspecial: 0, fundoPartidario: 0,
      porFonte: [], maioresDoadores: [],
    });

    await abrirAba('Campanha');
    await screen.findByText(/Nenhuma receita de campanha desta pessoa/);

    expect(await tela()).not.toMatch(/NaN/);
  });
});

/** ATENÇÃO: O texto é quebrado por `<strong>` e `<TermoComponent>` — a checagem é sobre o todo. */
async function tela(): Promise<string> {
  return await waitFor(() => document.body.textContent!.replace(/\s+/g, ' '));
}

/**
 * RISCO: "Votou Sim" sozinho não diz nada. O que informa é "votou Sim quando o Governo
 * pediu Não" — e é isso que a linha precisa mostrar.
 *
 * ATENÇÃO: Texto neutro: "votou diferente", nunca "contrariou" nem um ✗ vermelho.
 * Divergir da orientação não é erro, e a tela não pode dar nota.
 *
 * O Governo não orientou — o caso mais comum, e uma marca em toda linha
 * viraria ruído.
 *
 * DECISÃO: `Obstrução` é tática de quórum, não posição de mérito.
 *
 * DECISÃO: `Liberado` é ausência de orientação.
 *
 * O parlamentar se absteve: não há voto a comparar.
 */
describe('orientação do Governo ao lado do voto', () => {
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

    expect(await screen.findByText(/votou diferente/)).toBeInTheDocument();
  });

  it('Não cala quando não há o que comparar', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      votosRecentes: [
        voto('a', 1, null),
        voto('b', -1, 'Obstrução'),
        voto('c', 1, 'Liberado'),
        voto('d', 0, 'Sim'),
      ],
    });

    await abrirPerfil();
    await screen.findByText(/Votação a/);

    expect(screen.queryByText(/Governo pediu/)).not.toBeInTheDocument();
  });
});

/**
 * RISCO: A descrição diz o NÚMERO do projeto — "Aprovado o Substitutivo ao Projeto de Lei
 * nº 4.133" — e não diz o assunto. Quem não acompanha o Congresso lê isso e não sabe
 * em que a pessoa votou. A ementa é o que torna o voto legível.
 *
 * ATENÇÃO: A descrição processual continua acessível: é ela que identifica QUAL votação
 * daquele projeto foi — texto principal, destaque, redação final. Sem ela, dois votos
 * opostos do mesmo projeto apareceriam como a mesma linha repetida.
 *
 * Sem ementa — todo o Senado e parte da Câmara — a tela cai na descrição, nunca
 * num espaço em branco.
 */
describe('a ementa na lista de votos', () => {
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

  it('sem ementa, cai na descrição', async () => {
    const semEmenta = {
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), descricao: 'Votação nominal do PLP 73.' }],
    };

    const { container } = await renderizarCom(semEmenta);

    expect(container.textContent).toMatch(/Votação nominal do PLP 73/);
  });
});

/**
 * RISCO: O modo de falha que este projeto persegue: plausível e errado. 43,2% das linhas
 * da ficha são de rito. Com a ementa por manchete, "Institui o IBS" ao lado de um
 * "Sim" faria o leitor concluir que a pessoa votou a favor da reforma tributária —
 * quando ela votou sobre andamento.
 *
 * ATENÇÃO: A ementa não some: vira contexto, para dizer sobre QUE projeto era o rito.
 *
 * Não Voto de rito não é escondido — ele existe e é público. Mas pesa ZERO na
 * afinidade, e a tela precisa dizer isso antes do enunciado, não depois.
 *
 * DECISÃO: No voto de mérito a ordem é a oposta: a ementa manda.
 */
describe('voto de rito não pode usar a ementa como manchete', () => {
  const RITO = {
    descricao: 'Rejeitado o Requerimento. Sim: 118; Não: 289; Total: 407.',
    ementa: 'Institui o Imposto sobre Bens e Serviços - IBS e dá outras providências.',
    materia: 'PLP 68/2024',
    categoria: 'PROCEDIMENTAL' as const,
  };

  it('a manchete é o que foi de fato votado, não a ementa', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO }],
    });

    const manchete = container.querySelector('.voto-descricao')!.textContent!;

    expect(manchete).toMatch(/Rejeitado o Requerimento/);
    expect(manchete).not.toMatch(/Institui o Imposto/);
  });

  it('a ementa vira contexto, junto da matéria', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO }],
    });

    const contexto = container.querySelector('.voto-processual')!.textContent!;

    expect(contexto).toMatch(/PLP 68\/2024/);
    expect(contexto).toMatch(/Institui o Imposto/);
  });

  it('avisa que não é voto no mérito', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO }],
    });

    expect(container.textContent).toMatch(/votou o andamento da proposta/i);
  });

  it('no voto de mérito a ementa continua sendo a manchete', async () => {
    const { container } = await renderizarCom({
      ...FICHA,
      votosRecentes: [{ ...voto('v1', 1, null), ...RITO, categoria: 'SUBSTANTIVA' as const }],
    });

    expect(container.querySelector('.voto-descricao')!.textContent).toMatch(/Institui o Imposto/);
    expect(container.textContent).not.toMatch(/não é voto no mérito/i);
  });
});

/**
 * Um alvo que sumisse da página faria o tour pular o passo calado.
 */
describe('o tour da ficha', () => {
  it('encontra na página cada elemento que explica', async () => {
    const { passosDaFicha } = await import('../tour');
    await renderizarCom({
      ...FICHA,
      votosRecentes: [voto('v1', 1, 'Sim')],
      maisSimilares: [{ idPessoa: 2, nome: 'Bruno Tavares', partido: 'PARTIDO-B', valor: 0.9, comuns: 100 }],
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

/**
 * RISCO: A ficha trazia 20 votos e parava, sem dizer que havia mais. Agora diz o total, e
 * quantos ficam fora das "votações registradas" por não ter posição.
 *
 * `expect(vi.mocked(api.listarVotos)).toHaveBeenCalledWith(1, 2, 2, 57...`: a legislatura que a ficha mostra
 *
 * DECISÃO: "Como fulano votou em X" sem rolar centenas de votos (2026-10-02). A busca vai ao
 * servidor — a ficha só tem a primeira página — e a contagem diz o que achou.
 */
describe('listas da ficha em páginas', () => {
  it('votos: diz o total e busca a página seguinte', async () => {
    const primeiros = Array.from({ length: 2 }, (_, i) => voto(`v${i}`, 1, null));
    vi.mocked(api.listarVotos).mockResolvedValue({ itens: [voto('v2', -1, null)], pagina: 2, tamanho: 2, total: 3 });

    await renderizarCom({ ...FICHA, votosRecentes: primeiros, nVotacoes: 2, nRegistrosDeVoto: 3 });

    expect(await tela()).toMatch(/2 de 3 registros de voto, 1 deles sem posição/);

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais 1' }));

    expect(await screen.findByText('Votação v2')).toBeDefined();
    expect(vi.mocked(api.listarVotos)).toHaveBeenCalledWith(1, 2, 2, 57, undefined, false);
    expect(screen.queryByRole('button', { name: /Mostrar mais/ })).toBeNull();
  });

  it('votos: a busca pede ao servidor e diz quantos achou', async () => {
    vi.mocked(api.listarVotos).mockResolvedValue({ itens: [voto('v9', 1, null)], pagina: 1, tamanho: 20, total: 1 });
    await renderizarCom({ ...FICHA, votosRecentes: [voto('v0', 1, null)], nVotacoes: 1, nRegistrosDeVoto: 1 });

    await userEvent.type(await screen.findByLabelText('Buscar nos votos'), 'tributaria');

    expect(await screen.findByText('Votação v9')).toBeDefined();
    expect(await tela()).toMatch(/1 voto com “tributaria”/);
    expect(vi.mocked(api.listarVotos)).toHaveBeenLastCalledWith(1, 1, 20, 57, 'tributaria', false);
    expect(screen.queryByText('Votação v0')).toBeNull();
  });

  it('votos: uma letra não busca, e apagar volta à lista da ficha', async () => {
    vi.mocked(api.listarVotos).mockClear();
    await renderizarCom({ ...FICHA, votosRecentes: [voto('v0', 1, null)], nVotacoes: 1, nRegistrosDeVoto: 1 });

    const campo = await screen.findByLabelText('Buscar nos votos');
    await userEvent.type(campo, 'a');
    await new Promise((r) => setTimeout(r, 400));

    expect(vi.mocked(api.listarVotos)).not.toHaveBeenCalled();
    expect(screen.getByText('Votação v0')).toBeDefined();
  });

  it('votos: busca sem resultado diz onde procurou', async () => {
    vi.mocked(api.listarVotos).mockResolvedValue({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await renderizarCom({ ...FICHA, votosRecentes: [voto('v0', 1, null)], nVotacoes: 1, nRegistrosDeVoto: 1 });

    await userEvent.type(await screen.findByLabelText('Buscar nos votos'), 'xyz');

    expect(await screen.findByText(/Nenhum voto com “xyz” nesta legislatura/)).toBeDefined();
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

/**
 * RISCO: A persona da jornalista: sem link para a fonte, ela não cita o site.
 */
describe('fontes oficiais', () => {
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

/**
 * DECISÃO: Cada dinheiro tem endereço: o link compartilhado abre direto nele.
 *
 * A cidade vem da sede de quem recebeu, e leva ao mapa.
 *
 * O secundário fica recolhido: a aba abre com a resposta, não com 13 blocos.
 */
describe('as abas do perfil', () => {
  it('o número do topo leva à aba do dinheiro', async () => {
    await abrirPerfil();

    const faixa = await screen.findByRole('navigation', { name: 'Contas do mandato' });
    await userEvent.click(within(faixa).getByRole('link', { name: /Campanha/ }));

    expect(await screen.findByText(/Arrecadou/)).toBeInTheDocument();
    const abas = screen.getByRole('navigation', { name: 'Seções do perfil' });
    expect(within(abas).getByRole('link', { name: 'Campanha' })).toHaveAttribute('aria-current', 'page');
  });

  it('as cidades que receberam levam ao mapa', async () => {
    await abrirAba('Emendas');

    expect(await screen.findByRole('link', { name: 'Ananindeua – PA' })).toHaveAttribute(
      'href',
      '/emendas?uf=PA&cidade=1500800',
    );
  });

  it('os detalhes começam fechados', async () => {
    await abrirAba('Emendas');

    const detalhes = (await screen.findByText(/Ver detalhes: áreas do orçamento/)).closest('details')!;
    expect(detalhes.open).toBe(false);
  });
});

/**
 * RISCO: Só vira link o que é http(s), e nenhum leva recomendação do site aos buscadores.
 *
 * ATENÇÃO: Duas declarações, dois números — não "cresceu X%", que leria como acusação.
 */
describe('redes e patrimônio', () => {
  beforeEach(() => {
    vi.mocked(api.obterPatrimonio).mockResolvedValue([
      { anoEleicao: 2022, total: 900_000, bens: 3, porTipo: [
        { tipo: 'Casa', valor: 600_000, quantidade: 2 }, { tipo: 'Veículo', valor: 300_000, quantidade: 1 }] },
      { anoEleicao: 2018, total: 400_000, bens: 1, porTipo: [{ tipo: 'Casa', valor: 400_000, quantidade: 1 }] },
    ]);
  });

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
    expect(screen.getByText('Redes')).toBeInTheDocument();
  });

  it('o patrimônio mostra a última declaração e a anterior, sem porcentagem', async () => {
    await abrirAba('Campanha');

    const frase = (await screen.findByText(/Declarou/)).closest('p')!;
    expect(frase.textContent).toMatch(/R\$\s*900\.000,00 em 3 bens ao se candidatar em 2022/);
    expect(frase.textContent).toMatch(/Em 2018, tinha declarado R\$\s*400\.000,00/);
    expect(frase.textContent).not.toMatch(/%/);
    expect(screen.getByText(/sem avaliação de mercado/)).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('a declaração fora do padrão aparece como veio, em vermelho, com o aviso de que o site não confere', async () => {
    vi.mocked(api.obterPatrimonio).mockResolvedValue([
      { anoEleicao: 2026, total: 400_000_000, bens: 1, porTipo: [{ tipo: 'Casa', valor: 400_000_000, quantidade: 1 }], foraDoPadrao: true },
      { anoEleicao: 2022, total: 315_000, bens: 1, porTipo: [{ tipo: 'Casa', valor: 315_000, quantidade: 1 }] },
    ]);
    await abrirAba('Campanha');

    const frase = (await screen.findByText(/Declarou/)).closest('p')!;
    expect(frase.querySelector('.numero-fora-do-padrao')?.textContent).toMatch(/400\.000\.000,00/);
    expect(screen.getByRole('note')).toHaveTextContent(/fora do padrão em 2026.*não confere/);
  });
});

/**
 * DECISÃO: Sempre "X de Y", com o percentual depois — não percentual solto (RF-29).
 *
 * O Senado publica a justificativa da ausência; a tela a mostra à parte.
 */
describe('participação nas votações', () => {
  it('diz de quantas votações participou, com a base', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      presenca: { presente: 812, votacoes: 1015, ausente: 203, ausenteJustificado: null, justificativaPublicada: false, desde: '2023-02-01', ate: '2026-09-10', medianaDaCasa: 0.88 },
    });
    await abrirPerfil();

    const bloco = screen.getByText('812 de 1.015').closest('div')!;
    expect(bloco.textContent).toMatch(/Presença no plenário/);
    expect(bloco.textContent).toMatch(/votações \(80%\)/);
    expect(bloco.textContent).toMatch(/mediana da Câmara: 88%/);
    expect(bloco.textContent).not.toMatch(/licença/);
  });

  it('governismo e disciplina vêm como "X de Y", e a base pequena é dita', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue({
      ...FICHA,
      alinhamento: {
        governismo: 0.82, baseGovernismo: 658, disciplina: 1, baseDisciplina: 2, partidoMedido: 'MDB',
        medianaGovernismo: 0.71, medianaDisciplina: 0.93,
      },
    });
    await abrirPerfil();

    const governo = screen.getByText('540 de 658').closest('div')!;
    expect(governo.textContent).toMatch(/votações orientadas \(82%\)/);
    expect(governo.textContent).not.toMatch(/poucas/);
    expect(governo.textContent).toMatch(/mediana da Câmara: 71%/);
    const partido = screen.getByText('2 de 2').closest('div')!;
    expect(partido.textContent).toMatch(/Seguiu a orientação do MDB/);
    expect(partido.textContent).toMatch(/poucas para tirar conclusão/);
  });

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

/**
 * Os mandatos (achado #35). Com o histórico na base, a ficha abre na legislatura da
 * PESSOA, e quem teve mais de um mandato escolhe qual ver.
 */
describe('os mandatos na ficha', () => {
  const DOIS_MANDATOS: Ficha = {
    ...FICHA,
    mandatos: [
      { legislatura: 57, casa: 'CAMARA', anoInicial: 2023, partido: 'PARTIDO-A', uf: 'SP', nRegistrosDeVoto: 120, primeiroVoto: '2023-02-01', ultimoVoto: '2026-12-01' },
      { legislatura: 56, casa: 'CAMARA', anoInicial: 2019, partido: 'PARTIDO-B', uf: 'SP', nRegistrosDeVoto: 80, primeiroVoto: '2019-02-01', ultimoVoto: '2022-12-01' },
    ],
  };

  beforeEach(() => {
    vi.mocked(api.listarSeguidos).mockResolvedValue([]);
  });

  it('um mandato só vira a linha que diz de quando é a ficha, não um seletor', async () => {
    await renderizarCom(FICHA);

    expect(screen.getByText('2023–2027')).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Mandatos' })).toBeNull();
  });

  it('quem saiu antes do fim mostra o período em que votou, não a legislatura inteira', async () => {
    await renderizarCom({
      ...FICHA,
      mandatos: [{ ...FICHA.mandatos[0], primeiroVoto: '2023-03-14', ultimoVoto: '2024-12-17' }],
    });

    const linha = document.querySelector('.mandatos-unico');
    expect(linha?.textContent).toBe('Votou de mar/2023 a dez/2024 · legislatura 2023–2027');
  });

  it('com dois, cada mandato é um link, com a sigla de então', async () => {
    await renderizarCom(DOIS_MANDATOS);

    const mandatos = screen.getByRole('navigation', { name: 'Mandatos' });
    const links = within(mandatos).getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('aria-current')).toBe('true');
    expect(links[1].getAttribute('href')).toBe('/parlamentar/1?legislatura=56');
    expect(within(mandatos).getByText(/PARTIDO-B/)).toBeDefined();
  });

  it('o presidente que foi deputado tem um cartão de presidente, que leva ao governo federal do mandato', async () => {
    vi.mocked(api.obterFichaDoPolitico).mockResolvedValueOnce({
      idPessoa: 1, nome: 'ANA RIBEIRO', nomeCivil: null, urlFoto: null, parlamentar: true, redesSociais: [],
      mandatos: [
        { cargo: 'PRESIDENTE', nivel: 'FEDERAL', anoEleicao: 2026, primeiroAno: 2027, ultimoAno: 2030, uf: null, municipio: null, partido: 'XYZ' },
        { cargo: 'DEPUTADO_FEDERAL', nivel: 'FEDERAL', anoEleicao: 2022, primeiroAno: 2023, ultimoAno: 2026, uf: 'SP', municipio: null, partido: 'XYZ' },
      ],
    });
    await renderizarCom(DOIS_MANDATOS);

    const mandatos = await screen.findByRole('navigation', { name: 'Mandatos' });
    const presidente = await within(mandatos).findByRole('link', { name: /Presidente/ });
    expect(presidente).toHaveAttribute('href', '/governo?de=2027&ate=2030');
    expect(within(mandatos).getAllByRole('link')).toHaveLength(3);
  });

  it('escolher um mandato pede a ficha daquela legislatura', async () => {
    vi.mocked(api.obterFicha).mockResolvedValue(DOIS_MANDATOS);
    renderizar();
    await screen.findAllByRole('heading', { name: /Ana Ribeiro/ });

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Mandatos' })).getByText('2019–2023'));

    await waitFor(() => expect(vi.mocked(api.obterFicha)).toHaveBeenLastCalledWith(1, 56));
  });
});

/** A cota mostrava só o ano corrente, pela metade. Os anos do mandato viram botões (2026-10-03). */
describe('o ano da cota', () => {
  it('troca o ano e pede a cota daquele ano', async () => {
    const doAno = (ano: number, total: number) => ({
      anoDaDespesa: ano, total, lancamentos: 3,
      porCategoria: [{ categoria: 'PASSAGEM AÉREA', total, lancamentos: 3 }],
      maioresFornecedores: [],
    });
    vi.mocked(api.obterGastos).mockImplementation(async (_id, _leg, ano) => (ano === 2024 ? doAno(2024, 9_000) : doAno(2026, 5_000)));
    await abrirAba('Cota');

    expect(await screen.findByText(/em 2026/)).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: '2024' }));

    expect(await screen.findByText(/em 2024/)).toBeDefined();
    expect(vi.mocked(api.obterGastos)).toHaveBeenLastCalledWith(expect.any(Number), 57, 2024);
    expect(screen.getByRole('button', { name: '2024' })).toHaveAttribute('aria-pressed', 'true');
  });
});

/** Os votos de rito são perto de um terço da lista e não entram na afinidade: dá para escondê-los. */
describe('votos de rito', () => {
  it('a caixa pede a lista sem eles ao servidor', async () => {
    vi.mocked(api.listarVotos).mockResolvedValue({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await renderizarCom({ ...FICHA, votosRecentes: [voto('v1', 1, 'Sim')] });

    await userEvent.click(screen.getByRole('checkbox', { name: /Esconder votos de rito/ }));

    await waitFor(() =>
      expect(vi.mocked(api.listarVotos)).toHaveBeenLastCalledWith(1, 1, 20, 57, undefined, true),
    );
  });
});

/** Votos seguidos da mesma proposição viram um grupo: a ementa aparece uma vez (2026-10-03). */
describe('votos agrupados por proposição', () => {
  it('junta os vizinhos da mesma matéria e mantém os outros sozinhos', async () => {
    const daPec = (id: string, descricao: string) => ({
      ...voto(id, 1, null), materia: 'PEC 45/2019', ementa: 'Altera o Sistema Tributário Nacional.', descricao,
    });
    await renderizarCom({
      ...FICHA,
      votosRecentes: [daPec('a', 'Aprovada em segundo turno'), daPec('b', 'Requerimento de urgência'), voto('c', -1, null)],
    });

    expect(await screen.findByText('2 votações nesta proposição')).toBeDefined();
    expect(screen.getAllByText(/Altera o Sistema Tributário Nacional/)).toHaveLength(1);
    expect(screen.getByText('Aprovada em segundo turno')).toBeDefined();
    expect(screen.getByText('Votação c')).toBeDefined();
  });
});

/** Pendência 83: o grafo do dinheiro abre num modal da aba Emendas, com a pessoa no centro. */
describe('o grafo do dinheiro', () => {
  it('abre com quem financiou a campanha e quem recebeu as emendas', async () => {
    await abrirAba('Emendas');

    await userEvent.click(await screen.findByRole('button', { name: 'Ver o grafo do dinheiro' }));

    const grafo = await screen.findByRole('img', { name: /Campanha de .*Emendas de 2025/ });
    expect(grafo.getAttribute('aria-label')).toMatch(/Jose da Silva/);
    expect(screen.getByRole('heading', { name: 'Ana Ribeiro', level: 2 })).toBeDefined();
  });

  it('a entidade com página leva a ela, como na lista "Quem recebeu"', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      ...EMENDAS,
      favorecidos: { ...EMENDAS.favorecidos, maiores: [{ ...EMENDAS.favorecidos.maiores[0], cnpj: '12345678000190' }] },
    });
    await abrirAba('Emendas');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver o grafo do dinheiro' }));

    const link = await screen.findByRole('link', { name: /Construtora Exemplo Ltda: abrir a página da entidade/ });
    expect(link.getAttribute('href')).toMatch(/^\/entidades\/\d{14}$/);
  });
});
