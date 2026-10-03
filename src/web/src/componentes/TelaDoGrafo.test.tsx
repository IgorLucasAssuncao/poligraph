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
  vizinhosPorNo: 10,
  nos: [no(1, 'Ana Ribeiro'), no(2, 'Bruno Tavares'), no(3, 'Célia Nunes')],
  arestas: [
    { de: 1, para: 2, peso: 0.92, votacoesComuns: 137, cosseno: 0.9 },
    { de: 2, para: 3, peso: 0.61, votacoesComuns: 40, cosseno: 0.6 },
  ],
  legislaturasComGrafo: [57],
  votacoesDePlenario: 1103,
  secretasDePlenario: 0,
  abertasDesde: null,
  abertasAte: null,
};

/**
 * DECISÃO: É o ponto da mudança: o campo ocupava uma faixa fixa abaixo do canvas, e essa
 * faixa custava altura de desenho em toda tela.
 *
 * ATENÇÃO: Sem o foco automático, abrir a lupa exigiria um segundo clique e ela deixaria
 * de funcionar como atalho.
 *
 * Dizer "nada encontrado" com uma letra digitada é ruído, não informação.
 *
 * Reabrir vem em branco: o termo antigo reapareceria como se fosse busca nova.
 */
describe('ferramentas sobre o desenho', () => {
  it('a busca começa recolhida numa lupa', () => {
    render(<TelaDoGrafo grafo={GRAFO} />);

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

    await usuario.click(screen.getByRole('button', { name: /procurar parlamentar/i }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});

/**
 * Com molas, a tela declara que os eixos não significam nada.
 *
 * RISCO: Duas ressalvas obrigatórias no layout do eixo nomeado:
 * · NÃO é esquerda e direita — é alinhamento com ESTE governo, e um deputado
 * muda de lado na eleição seguinte sem mudar uma posição sequer;
 * · o meio não é moderação — é onde está a maioria (achado #27).
 *
 * ATENÇÃO: Desligado por padrão: quem abre o desenho quer ver a forma primeiro, e o eixo
 * rotulado é a leitura seguinte.
 *
 * É o caso do Senado, que não publica orientação.
 *
 * ATENÇÃO: Pendência 43: o SVD saiu da TELA e não do dado. Ele mostrava a mesma divisão que
 * Alinhamento (−0,87) e exigia um parágrafo para dizer o que o outro diz sozinho.
 *
 * Sem orientação de bancada publicada, o eixo do governismo não teria coordenada.
 *
 * Não Com uma opção só, o seletor inteiro some: um botão que não escolhe nada.
 *
 * DECISÃO: Mas a explicação fica, porque ela é que importa.
 *
 * DECISÃO: É o que distingue este layout do de molas: aqui a coordenada É a medida.
 *
 * O desenho é sempre o retrato reproduzível do ETL.
 */
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

  it('RISCO: a ressalva do layout escolhido fica junto do seletor', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    expect(screen.getByText(/eixos não significam nada/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Alinhamento' }));

    expect(screen.getByText(/não é esquerda e direita/)).toBeInTheDocument();
    expect(screen.getByText(/meio não é moderação/)).toBeInTheDocument();
  });

  it('os eixos começam desligados e a chave existe', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    expect(screen.getByLabelText(/Mostrar os eixos/)).not.toBeChecked();
  });

  it('sem orientação de bancada, avisa que o eixo não tem nome', async () => {
    const usuario = userEvent.setup();
    const senado = { ...GRAFO, nos: GRAFO.nos.map((n) => ({ ...n, governismo: null })) };
    render(<TelaDoGrafo grafo={senado} />);

    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));
    await usuario.click(screen.getByLabelText(/Mostrar os eixos/));

    expect(screen.getByText(/não tem eixo com nome/)).toBeInTheDocument();
  });

  it('DECISÃO: oferece Molas e Alinhamento, e não Componentes', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    expect(screen.getByRole('button', { name: 'Alinhamento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Componentes' })).not.toBeInTheDocument();
  });

  it('Não esconde o alinhamento no Senado', async () => {
    const usuario = userEvent.setup();
    const senado = { ...GRAFO, nos: GRAFO.nos.map((n) => ({ ...n, governismo: null })) };
    render(<TelaDoGrafo grafo={senado} />);

    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

    expect(screen.queryByRole('button', { name: 'Alinhamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Molas' })).not.toBeInTheDocument();
    expect(screen.getByText(/Ligações como molas/)).toBeInTheDocument();
  });

  it('RISCO: no alinhamento a tela declara que a posição não vem de algoritmo', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));
    await usuario.click(screen.getByRole('button', { name: 'Alinhamento' }));

    expect(screen.getByText(/a própria medida, não resultado de cálculo/)).toBeInTheDocument();
  });

  it('Não a simulação de forças não existe mais', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);
    await usuario.click(screen.getByRole('button', { name: /ajustes do desenho/i }));

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

/**
 * RISCO: Sem `tabIndex`, o desenho inteiro fica fora da ordem de tabulação e quem não usa
 * mouse não consegue nem aproximar.
 *
 * ATENÇÃO: O rótulo precisa DIZER que as teclas existem. Um canvas focável cujas teclas
 * ninguém anuncia é o mesmo que não ter teclado.
 *
 * Não Tab e Escape seguem para o navegador. Prender o foco dentro de um canvas seria
 * pior do que não tê-lo — a pessoa ficaria sem saída.
 *
 * RISCO: O canvas com `role="img"` anuncia "Grafo de 3 parlamentares" e acaba ali. Esta
 * lista é o único caminho para a informação do desenho — quem vota junto com quem.
 *
 * Bruno liga com Ana (0,92) e Célia (0,61) — as duas arestas do fixture.
 *
 * ATENÇÃO: Achado #27: quem votou pouco demais não tem par comparável e no desenho aparece
 * solto na borda, sem explicação. Na lista a ausência é DITA.
 *
 * DECISÃO: A lista não é só leitura: cada nome leva ao mesmo lugar que clicar no ponto.
 */
describe('acessibilidade do grafo', () => {
  it('o desenho recebe foco pelo teclado', () => {
    const { container } = render(<TelaDoGrafo grafo={GRAFO} />);

    const canvas = container.querySelector('canvas')!;

    expect(canvas.getAttribute('tabindex')).toBe('0');
  });

  it('o rótulo anuncia as teclas e a alternativa em texto', () => {
    const { container } = render(<TelaDoGrafo grafo={GRAFO} />);

    const rotulo = container.querySelector('canvas')!.getAttribute('aria-label')!;

    expect(rotulo).toMatch(/setas/i);
    expect(rotulo).toMatch(/lista/i);
  });

  it('não sequestra Tab', async () => {
    const usuario = userEvent.setup();
    const { container } = render(<TelaDoGrafo grafo={GRAFO} />);

    const canvas = container.querySelector('canvas')!;
    canvas.focus();
    await usuario.tab();

    expect(document.activeElement).not.toBe(canvas);
  });

  it('a lista em texto traz quem vota junto com quem', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    await usuario.click(screen.getByText(/ver o grafo como lista/i));

    const bruno = screen.getByText(/vota junto com Ana Ribeiro, Célia Nunes/i);

    expect(bruno).toBeInTheDocument();
  });

  it('diz quando o parlamentar não tem ligação nenhuma', async () => {
    const usuario = userEvent.setup();
    const isolado: Grafo = { ...GRAFO, nos: [...GRAFO.nos, no(9, 'Dora Lima')] };

    render(<TelaDoGrafo grafo={isolado} />);
    await usuario.click(screen.getByText(/ver o grafo como lista/i));

    expect(screen.getByText(/precisa de ao menos 20 votações em comum/i)).toBeInTheDocument();
  });

  it('cada nome da lista é acionável', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    await usuario.click(screen.getByText(/ver o grafo como lista/i));

    expect(screen.getByRole('button', { name: 'Ana Ribeiro' })).toBeInTheDocument();
  });
});

/**
 * RISCO: Medido em 2026-08-29: o número do grafo é, em média, METADE do que a lista de
 * parlamentares mostra para a mesma pessoa. Sargento Fahur aparece com **1.134
 * votações registradas** lá e **559** aqui.
 *
 * Os dois estão certos e contam coisas diferentes — lá é votação registrada, aqui são
 * as que entram na comparação, fora as procedimentais, que pesam zero. Não Com a mesma
 * palavra nos dois lugares não há como conciliar, e o leitor conclui que um erra.
 */
describe('os dois números de "votações" não podem usar a mesma palavra', () => {
  it('a lista qualifica o número como "comparáveis"', async () => {
    const usuario = userEvent.setup();
    render(<TelaDoGrafo grafo={GRAFO} />);

    await usuario.click(screen.getByText(/ver o grafo como lista/i));

    expect(screen.getAllByText(/500 votações comparáveis/i).length).toBeGreaterThan(0);
  });
});

/**
 * MEDIDO: O grafo do início sequestrava a rolagem: a roda sobre ele dava zoom, prendia quem
 * rolava a página e disparava o download das fotos (2026-10-02). Embutido, a roda é da
 * página; o zoom pede Ctrl.
 */
describe('a roda num grafo embutido', () => {
  function rodar(canvas: Element, ctrlKey: boolean) {
    const evento = new WheelEvent('wheel', { deltaY: -120, ctrlKey, bubbles: true, cancelable: true });
    canvas.dispatchEvent(evento);
    return evento.defaultPrevented;
  }

  it('sem Ctrl, rola a página e avisa como aproximar', async () => {
    render(<TelaDoGrafo grafo={GRAFO} embutido />);
    const canvas = screen.getByRole('img');

    expect(rodar(canvas, false)).toBe(false);
    expect(await screen.findByText('Use Ctrl + roda do mouse para aproximar')).toBeInTheDocument();
  });

  it('com Ctrl, aproxima — e não deixa a página rolar junto', () => {
    render(<TelaDoGrafo grafo={GRAFO} embutido />);

    expect(rodar(screen.getByRole('img'), true)).toBe(true);
  });

  it('fora da página que rola — a aba do grafo —, a roda aproxima sem Ctrl', () => {
    render(<TelaDoGrafo grafo={GRAFO} />);

    expect(rodar(screen.getByRole('img'), false)).toBe(true);
    expect(screen.queryByText(/Ctrl \+ roda/)).toBeNull();
  });
});
