import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Parlamentar } from './Parlamentar';
import type { EmendasDoParlamentar, Ficha, FinanciamentoDeCampanha } from '../api';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterFicha: vi.fn(),
  obterNoticias: vi.fn(),
  listarSeguidos: vi.fn(),
  obterGastos: vi.fn(),
  obterEmendas: vi.fn(),
  obterFinanciamento: vi.fn(),
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
  votosRecentes: [],
  maisSimilares: [],
  alinhamento: null,
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
    <MemoryRouter initialEntries={['/parlamentares/1']}>
      <Routes>
        <Route path="/parlamentares/:id" element={<Parlamentar />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Renderiza e espera a ficha chegar. O nome aparece em dois `<h1>` — daí o `findAll`. */
async function abrirPerfil() {
  renderizar();
  await screen.findAllByRole('heading', { name: /Ana Ribeiro/ });
}

/** As contas moram num modal, ⛔ não numa aba: quem abre é o botão da faixa. */
async function abrirContas() {
  await abrirPerfil();
  await userEvent.click(await screen.findByRole('button', { name: 'Ver as contas' }));
}

beforeEach(() => {
  vi.mocked(api.obterFicha).mockResolvedValue(FICHA);
  vi.mocked(api.obterNoticias).mockResolvedValue([]);
  vi.mocked(api.listarSeguidos).mockResolvedValue([]);
  vi.mocked(api.obterEmendas).mockResolvedValue(EMENDAS);
  vi.mocked(api.obterFinanciamento).mockResolvedValue(CAMPANHA);
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
    await abrirContas();

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
    });

    await abrirContas();
    await screen.findByText(/Nenhuma emenda atribuída/);

    // 🔴 Zero afirmaria que ele não teve emenda; o que se sabe é que a BASE não tem.
    expect(await tela()).not.toMatch(/R\$\s*0,00/);
  });

  it('⚠️ não divide por zero quando nada foi empenhado', async () => {
    vi.mocked(api.obterEmendas).mockResolvedValue({
      ...EMENDAS, empenhado: 0, pago: 0, porDestino: [], porFuncao: [],
    });

    await abrirContas();

    // ⛔ Sem a guarda, `0/0` daria `NaN%` na tela
    expect(await tela()).not.toMatch(/NaN/);
  });
});

describe('contas — campanha', () => {
  it('🔴 os dois fundos aparecem SEPARADOS e nomeados', async () => {
    await abrirContas();

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
    await abrirContas();

    // 3.200.000 de 3.250.000 = 98%
    expect(await tela()).toMatch(/98% do que a campanha arrecadou/);
  });

  it('🔴 marca o doador pessoa física sem revelar documento', async () => {
    await abrirContas();

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

    await abrirContas();
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
