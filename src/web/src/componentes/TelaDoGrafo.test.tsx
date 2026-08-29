import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Grafo, NoDoGrafo } from '../api';
import { TelaDoGrafo } from './TelaDoGrafo';

function no(id: number, nome: string, partido = 'PARTIDO-A'): NoDoGrafo {
  return {
    id,
    nome,
    partido,
    uf: 'SP',
    comunidade: 0,
    eixoX: id / 10,
    eixoY: 0.2,
    nVotacoes: 500,
    componente1: 0.1,
    componente2: -0.1,
    urlFoto: null,
    governismo: id / 4,
  };
}

const GRAFO: Grafo = {
  execucaoId: 1,
  casa: 'CAMARA',
  legislatura: 57,
  nos: [no(1, 'Ana Ribeiro'), no(2, 'Bruno Tavares'), no(3, 'Célia Nunes')],
  arestas: [
    { de: 1, para: 2, peso: 0.92, votacoesComuns: 137, cosseno: 0.9 },
    { de: 2, para: 3, peso: 0.61, votacoesComuns: 40, cosseno: 0.6 },
  ],
};

describe('ferramentas sobre o desenho', () => {
  it('a busca começa recolhida numa lupa', () => {
    render(<TelaDoGrafo grafo={GRAFO} />);

    // ⭐ É o ponto da mudança: o campo ocupava uma faixa fixa abaixo do canvas, e essa
    //    faixa custava altura de desenho em toda tela.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /procurar parlamentar/i }),
    ).toBeInTheDocument();
  });

  it('clicar na lupa abre o campo já com o foco', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    await usuario.click(screen.getByRole('button', { name: /procurar parlamentar/i }));

    const campo = screen.getByRole('searchbox');
    // ⚠️ Sem o foco automático, abrir a lupa exigiria um segundo clique e ela deixaria
    //    de funcionar como atalho.
    expect(campo).toHaveFocus();
  });

  it('digitar sugere pelo nome', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    await usuario.click(screen.getByRole('button', { name: /procurar parlamentar/i }));
    await usuario.type(screen.getByRole('searchbox'), 'bru');

    expect(screen.getByRole('button', { name: /Bruno Tavares/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ana Ribeiro/ })).not.toBeInTheDocument();
  });

  it('uma letra só não acusa "nada encontrado"', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    await usuario.click(screen.getByRole('button', { name: /procurar parlamentar/i }));
    await usuario.type(screen.getByRole('searchbox'), 'z');

    // Dizer "nada encontrado" com uma letra digitada é ruído, não informação.
    expect(screen.queryByText(/Nenhum parlamentar/)).not.toBeInTheDocument();

    await usuario.type(screen.getByRole('searchbox'), 'zz');
    expect(screen.getByText(/Nenhum parlamentar/)).toBeInTheDocument();
  });

  it('Esc fecha a busca e limpa o que foi digitado', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    await usuario.click(screen.getByRole('button', { name: /procurar parlamentar/i }));
    await usuario.type(screen.getByRole('searchbox'), 'ana');
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

    // Reabrir vem em branco: o termo antigo reapareceria como se fosse busca nova.
    await usuario.click(screen.getByRole('button', { name: /procurar parlamentar/i }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});

describe('painel de ajustes', () => {
  it('começa fechado e abre pela engrenagem', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    expect(screen.queryByLabelText(/Rostos ao aproximar/)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    expect(screen.getByLabelText(/Rostos ao aproximar/)).toBeChecked();
    expect(screen.getByRole('button', { name: 'Molas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('o filtro de ligações mostra quantas sobraram', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    expect(screen.getByText('2 de 2')).toBeInTheDocument();
  });

  it('🔴 a ressalva do layout escolhido fica junto do seletor', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    // ⚠️ Este teste afirmava "os eixos não significam nada" para molas. Era verdade
    //    por construção e passou a ser FALSO por medição: o eixo horizontal do layout
    //    de molas mede −0,89 contra o alinhamento com o Governo, sem nunca ter visto
    //    orientação de bancada. A tela ⛔ não pode negar o que o dado mostra.
    expect(screen.getByText(/vertical não mede nada/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Componentes' }));

    // 🔴 Duas ressalvas obrigatórias no eixo nomeado:
    //    · ⛔ NÃO é esquerda e direita — é alinhamento com ESTE governo, e um deputado
    //      muda de lado na eleição seguinte sem mudar uma posição sequer;
    //    · o centro ⛔ não é moderação, porque quem faltou a muitas votações cai ali.
    expect(screen.getByText(/não é esquerda e direita/)).toBeInTheDocument();
    expect(screen.getByText(/centro não é moderação/)).toBeInTheDocument();
  });

  it('os eixos começam desligados e a chave existe', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    // ⚠️ Desligado por padrão: quem abre o desenho quer ver a forma primeiro, e o eixo
    //    rotulado é a leitura seguinte.
    expect(screen.getByLabelText(/Mostrar os eixos/)).not.toBeChecked();
  });

  it('⛔ sem orientação de bancada, avisa que o eixo não tem nome', async () => {
    const usuario = userEvent.setup();
    // É o caso do Senado, que não publica orientação.
    const senado = { ...GRAFO, nos: GRAFO.nos.map((n) => ({ ...n, governismo: null })) };
    render(<TelaDoGrafo grafo={senado} />);

    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));
    await usuario.click(screen.getByLabelText(/Mostrar os eixos/));

    expect(screen.getByText(/não tem eixo com nome/)).toBeInTheDocument();
  });

  it('⛔ a simulação de forças não existe mais', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    // O desenho é sempre o retrato reproduzível do ETL.
    expect(screen.queryByLabelText(/Soltar as molas/)).not.toBeInTheDocument();
  });
});

describe('o desenho', () => {
  it('anuncia o que está desenhado para leitor de tela', () => {
    render(<TelaDoGrafo grafo={GRAFO} />);

    expect(
      screen.getByRole('img', { name: /3 parlamentares e 2 ligações/ }),
    ).toBeInTheDocument();
  });

  it('oferece tela cheia só quando quem chama sabe abri-la', () => {
    const { rerender } = render(<TelaDoGrafo grafo={GRAFO} />);
    expect(screen.queryByRole('button', { name: /tela cheia/i })).not.toBeInTheDocument();

    rerender(<TelaDoGrafo grafo={GRAFO} aoAmpliar={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tela cheia/i })).toBeInTheDocument();
  });
});
