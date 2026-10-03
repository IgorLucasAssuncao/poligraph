import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ResultadoComponent } from './Resultado';
import type { Pergunta, ResultadoAfinidade } from '../api';

/** Sem conta: o resultado funciona igual, e só a avaliação some (ela exige conta no servidor). */
const sessao = { usuario: null as { nome: string } | null };
vi.mock('../sessao', () => ({ useSessao: () => sessao }));

const PERGUNTAS: Pergunta[] = [
  { id: 'q1', texto: 'Primeira afirmação.', ordem: 1, totalVotos: 400, totalPossivel: 513 },
  { id: 'q2', texto: 'Segunda afirmação.', ordem: 2, totalVotos: 410, totalPossivel: 513 },
  { id: 'q3', texto: 'Terceira afirmação.', ordem: 3, totalVotos: 420, totalPossivel: 513 },
];

/**
 * Sem execução do grafo não há posição — a tela omite o desenho, não inventa ponto.
 */
const RESULTADO: ResultadoAfinidade = {
  totalPerguntasRespondidas: 3,
  porCasa: [
    {
      casa: 'CAMARA',
      perguntasRespondidas: 3,
      maisProximos: [
        {
          pessoaId: 1,
          nome: 'Ana Ribeiro',
          partido: 'PARTIDO-A',
          uf: 'SP',
          acordos: 2,
          comparaveis: 3,
          acordou: ['q1', 'q3'],
          discordou: ['q2'],
        },
      ],
      maisDistantes: [
        { pessoaId: 2, nome: 'Bruno Tavares', partido: 'PARTIDO-B', uf: 'MG', acordos: 0, comparaveis: 3, acordou: [], discordou: [] },
      ],
      posicaoNoGrafo: null,
      escala: { comparados: 12, medianoAcordos: 1, medianoComparaveis: 3 },
    },
  ],
};

/** ATENÇÃO: O componente usa `Link`, que exige contexto de rota. */
function renderizar() {
  return render(
    <MemoryRouter>
      <ResultadoComponent resultado={RESULTADO} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
    </MemoryRouter>,
  );
}

/**
 * ATENÇÃO: o texto é quebrado por <strong>, então a checagem é sobre o conteúdo inteiro
 *
 * DECISÃO: RF-29: nunca o número sozinho — sempre "2 de 3"
 * O destaque traz o número em evidência e a base logo em seguida.
 *
 * "67%" esconderia que a base foram 3 perguntas
 *
 * RISCO: A invariante do projeto na tela: todo número vem com a conta que o produziu.
 * "Concordaram em 2 de 3" não é conferível sem dizer em QUAIS — não dá para saber se
 * os acordos foram nas perguntas que importam ou nas de data comemorativa.
 *
 * ATENÇÃO: O denominador é a parte que mais engana. "2 de 3" parece um questionário de 3
 * perguntas; na verdade 3 é quantas OS DOIS responderam. Quando sobra alguma fora da
 * conta, a tela diz quantas e por quê.
 *
 * 5 respondidas na casa - 3 comparáveis = 2 fora
 *
 * Não O leitor de tela não recebe o ✓ e o ✗ — eles são `aria-hidden`. Sem o rótulo
 * textual, quem ouve receberia a lista de afirmações sem saber quais foram acordo.
 *
 * RF-28 — ver de quem você discorda é parte do método
 *
 * RNF-14 — obrigatório em toda tela de resultado
 *
 * ATENÇÃO: Sem a base, "Ana Ribeiro é quem mais vota como você" soa definitivo. O total
 * respondido fica no cabeçalho da coluna, à vista o tempo todo.
 */
describe('Resultado', () => {
  it('mostra "X de Y" — o número junto da base', () => {
    const { container } = renderizar();

    const texto = container.textContent!.replace(/\s+/g, ' ');

    expect(texto).toMatch(/2 de 3 perguntas comparáveis em que vocês votaram igual/);
    expect(texto).toMatch(/concordaram em 0 de 3 perguntas/);
  });

  it('RISCO: NUNCA exibe percentual', () => {
    const { container } = renderizar();

    expect(container.textContent).not.toMatch(/\d+\s*%/);
    expect(container.textContent).not.toMatch(/0[.,]\d\d/);
  });

  it('diz em QUAIS perguntas houve acordo, e em quais não', () => {
    const { container } = renderizar();

    const texto = container.textContent!.replace(/\s+/g, ' ');

    expect(texto).toMatch(/Primeira afirmação\./);
    expect(texto).toMatch(/Terceira afirmação\./);
    expect(texto).toMatch(/Segunda afirmação\./);
  });

  it('explica quantas perguntas ficaram fora da conta', () => {
    const comAusencia: ResultadoAfinidade = {
      ...RESULTADO,
      porCasa: [{ ...RESULTADO.porCasa[0], perguntasRespondidas: 5 }],
    };

    const { container } = render(
      <MemoryRouter>
        <ResultadoComponent resultado={comAusencia} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
      </MemoryRouter>,
    );

    const texto = container.textContent!.replace(/\s+/g, ' ');

    expect(texto).toMatch(/Outras 2 perguntas ficaram de fora da conta/);
    expect(texto).toMatch(/não votou|Não sei/);
  });

  it('marca acordo e desacordo para quem usa leitor de tela', () => {
    const { container } = renderizar();

    const texto = container.textContent!;

    expect(texto).toMatch(/Concordaram: Primeira afirmação\./);
    expect(texto).toMatch(/Discordaram: Segunda afirmação\./);
  });

  it('mostra os mais distantes, não só os mais próximos', () => {
    renderizar();

    expect(screen.getByText('Bruno Tavares')).toBeDefined();
  });

  it('exibe o aviso de que não é recomendação de voto', () => {
    renderizar();

    expect(screen.getByRole('note').textContent).toMatch(/não é recomendação de voto/i);
  });

  it('deixa claro quantas perguntas foram respondidas', () => {
    const { container } = renderizar();

    expect(container.textContent).toMatch(/3 perguntas respondidas/i);
  });
});

const DUAS_CASAS: ResultadoAfinidade = {
  totalPerguntasRespondidas: 8,
  porCasa: [
    {
      casa: 'CAMARA',
      perguntasRespondidas: 6,
      maisProximos: [
        { pessoaId: 1, nome: 'Ana Ribeiro', partido: 'PARTIDO-A', uf: 'SP', acordos: 5, comparaveis: 6, acordou: [], discordou: [] },
      ],
      maisDistantes: [
        { pessoaId: 2, nome: 'Bruno Tavares', partido: 'PARTIDO-B', uf: 'MG', acordos: 1, comparaveis: 6, acordou: [], discordou: [] },
      ],
      posicaoNoGrafo: null,
      escala: { comparados: 12, medianoAcordos: 1, medianoComparaveis: 3 },
    },
    {
      casa: 'SENADO',
      perguntasRespondidas: 2,
      maisProximos: [
        { pessoaId: 9, nome: 'Célia Nunes', partido: 'PARTIDO-C', uf: 'BA', acordos: 2, comparaveis: 2, acordou: [], discordou: [] },
      ],
      maisDistantes: [],
      posicaoNoGrafo: null,
      escala: { comparados: 12, medianoAcordos: 1, medianoComparaveis: 3 },
    },
  ],
};

/**
 * O piso de comparáveis vale por casa: um senador responde poucas perguntas do
 * Senado, e exibir "8 perguntas" ao lado dele afirmaria uma base que ele não tem.
 */
describe('resultado com as duas casas', () => {
  function renderizarDuasCasas() {
    return render(
      <MemoryRouter>
        <ResultadoComponent resultado={DUAS_CASAS} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
      </MemoryRouter>,
    );
  }

  it('mostra uma lista por casa, cada uma com o próprio nome', () => {
    const { container } = renderizarDuasCasas();
    const texto = container.textContent!.replace(/\s+/g, ' ');

    expect(texto).toMatch(/Os deputados mais próximos de você/);
    expect(texto).toMatch(/Os senadores mais próximos de você/);
  });

  it('RISCO: cada casa mostra o próprio denominador, não o total', () => {
    const { container } = renderizarDuasCasas();
    const texto = container.textContent!.replace(/\s+/g, ' ');

    expect(texto).toMatch(/6 perguntas desta casa/);
    expect(texto).toMatch(/2 perguntas desta casa/);
  });

  it('mantém o total respondido no cabeçalho', () => {
    const { container } = renderizarDuasCasas();

    expect(container.textContent).toMatch(/8 perguntas respondidas/);
  });

  it('nunca exibe percentual, nem com duas casas', () => {
    const { container } = renderizarDuasCasas();

    expect(container.textContent).not.toMatch(/\d+\s*%/);
  });

  it('casa sem ninguém próximo não vira seção vazia', () => {
    const semSenado: ResultadoAfinidade = {
      ...DUAS_CASAS,
      porCasa: [
        DUAS_CASAS.porCasa[0],
        { ...DUAS_CASAS.porCasa[1], maisProximos: [] },
      ],
    };

    const { container } = render(
      <MemoryRouter>
        <ResultadoComponent resultado={semSenado} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
      </MemoryRouter>,
    );

    expect(container.textContent).not.toMatch(/Senadores mais próximos/);
  });
});

/**
 * ATENÇÃO: "8 de 11" sozinho não diz se é muito: o parlamentar do meio da lista dá a escala.
 */
describe('a régua do resultado', () => {
  it('diz quantos foram comparados e quanto concordou o do meio da lista', async () => {
    renderizar();

    expect(await screen.findByText(/Entre os/)).toBeDefined();
    expect(document.body.textContent).toMatch(/12 deputados comparados com você, o do meio da lista votou como você em 1 de 3/);
  });
});

/** U15: o estado recalcula as listas; a casa sem ninguém daquele estado é dita, não some calada. */
describe('o recorte por estado', () => {
  it('escolher um estado pede o recálculo com a sigla', async () => {
    const aoEscolherUf = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ResultadoComponent resultado={RESULTADO} aoRefazer={vi.fn()} perguntas={PERGUNTAS} aoEscolherUf={aoEscolherUf} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Comparar com'), { target: { value: 'SP' } });

    expect(aoEscolherUf).toHaveBeenCalledWith('SP');
    await waitFor(() => expect(screen.getByLabelText('Comparar com')).not.toBeDisabled());
  });

  it('com estado escolhido, diz a casa que ficou sem ninguém dele', () => {
    render(
      <MemoryRouter>
        <ResultadoComponent resultado={{ ...RESULTADO, uf: 'AC' }} aoRefazer={vi.fn()} perguntas={PERGUNTAS} aoEscolherUf={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Nenhum senador de AC votou nas perguntas que você respondeu.')).toBeInTheDocument();
    expect(screen.getByText(/A lista e a régua contam só quem votou por AC/)).toBeInTheDocument();
  });
});

/** U19: a linha diz de quantas respondidas a base saiu. */
describe('a base de cada linha', () => {
  it('diz das quantas respondidas quando a base é menor', () => {
    const menor: ResultadoAfinidade = {
      ...RESULTADO,
      porCasa: [{ ...RESULTADO.porCasa[0], perguntasRespondidas: 5 }],
    };
    render(
      <MemoryRouter>
        <ResultadoComponent resultado={menor} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/das 5 que você respondeu nesta casa/)).toBeInTheDocument();
  });
});
