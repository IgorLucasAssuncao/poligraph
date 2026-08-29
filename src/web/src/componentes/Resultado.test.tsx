import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Resultado } from './Resultado';
import type { Pergunta, ResultadoAfinidade } from '../api';

const PERGUNTAS: Pergunta[] = [
  { id: 'q1', texto: 'Primeira afirmação.', ordem: 1, totalVotos: 400, totalPossivel: 513 },
  { id: 'q2', texto: 'Segunda afirmação.', ordem: 2, totalVotos: 410, totalPossivel: 513 },
  { id: 'q3', texto: 'Terceira afirmação.', ordem: 3, totalVotos: 420, totalPossivel: 513 },
];

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
      // Sem execução do grafo não há posição — a tela omite o desenho, não inventa ponto.
      posicaoNoGrafo: null,
    },
  ],
};

/** ⚠️ O componente usa `Link`, que exige contexto de rota. */
function renderizar() {
  return render(
    <MemoryRouter>
      <Resultado resultado={RESULTADO} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
    </MemoryRouter>,
  );
}

describe('Resultado', () => {
  it('mostra "X de Y" — o número junto da base', () => {
    const { container } = renderizar();

    // ⚠️ o texto é quebrado por <strong>, então a checagem é sobre o conteúdo inteiro
    const texto = container.textContent!.replace(/\s+/g, ' ');

    // ⭐ RF-29: nunca o número sozinho — sempre "2 de 3"
    expect(texto).toMatch(/concordaram em 2 de 3 perguntas/);
    expect(texto).toMatch(/concordaram em 0 de 3 perguntas/);
  });

  it('🔴 NUNCA exibe percentual', () => {
    const { container } = renderizar();

    // "67%" esconderia que a base foram 3 perguntas
    expect(container.textContent).not.toMatch(/\d+\s*%/);
    expect(container.textContent).not.toMatch(/0[.,]\d\d/);
  });

  /**
   * 🔴 A invariante do projeto na tela: todo número vem com a conta que o produziu.
   * "Concordaram em 2 de 3" não é conferível sem dizer em QUAIS — não dá para saber se
   * os acordos foram nas perguntas que importam ou nas de data comemorativa.
   */
  it('diz em QUAIS perguntas houve acordo, e em quais não', () => {
    const { container } = renderizar();

    const texto = container.textContent!.replace(/\s+/g, ' ');

    expect(texto).toMatch(/Primeira afirmação\./);
    expect(texto).toMatch(/Terceira afirmação\./);
    expect(texto).toMatch(/Segunda afirmação\./);
  });

  /**
   * ⚠️ O denominador é a parte que mais engana. "2 de 3" parece um questionário de 3
   * perguntas; na verdade 3 é quantas OS DOIS responderam. Quando sobra alguma fora da
   * conta, a tela diz quantas e por quê.
   */
  it('explica quantas perguntas ficaram fora da conta', () => {
    const comAusencia: ResultadoAfinidade = {
      ...RESULTADO,
      porCasa: [{ ...RESULTADO.porCasa[0], perguntasRespondidas: 5 }],
    };

    const { container } = render(
      <MemoryRouter>
        <Resultado resultado={comAusencia} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
      </MemoryRouter>,
    );

    const texto = container.textContent!.replace(/\s+/g, ' ');

    // 5 respondidas na casa - 3 comparáveis = 2 fora
    expect(texto).toMatch(/Outras 2 perguntas ficaram de fora da conta/);
    expect(texto).toMatch(/não votou|Não sei/);
  });

  /**
   * ⛔ O leitor de tela ⛔ não recebe o ✓ e o ✗ — eles são `aria-hidden`. Sem o rótulo
   * textual, quem ouve receberia a lista de afirmações sem saber quais foram acordo.
   */
  it('marca acordo e desacordo para quem usa leitor de tela', () => {
    const { container } = renderizar();

    const texto = container.textContent!;

    expect(texto).toMatch(/Concordaram: Primeira afirmação\./);
    expect(texto).toMatch(/Discordaram: Segunda afirmação\./);
  });

  it('mostra os mais distantes, não só os mais próximos', () => {
    renderizar();

    // RF-28 — ver de quem você discorda é parte do método
    expect(screen.getByText('Bruno Tavares')).toBeDefined();
  });

  it('exibe o aviso de que não é recomendação de voto', () => {
    renderizar();

    // RNF-14 — obrigatório em toda tela de resultado
    expect(screen.getByRole('note').textContent).toMatch(/não é recomendação de voto/i);
  });

  it('deixa claro quantas perguntas foram respondidas', () => {
    const { container } = renderizar();

    // ⚠️ Sem a base, "Ana Ribeiro é quem mais vota como você" soa definitivo. O total
    //    respondido fica no cabeçalho da coluna, à vista o tempo todo.
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
    },
    {
      casa: 'SENADO',
      perguntasRespondidas: 2,
      maisProximos: [
        { pessoaId: 9, nome: 'Célia Nunes', partido: 'PARTIDO-C', uf: 'BA', acordos: 2, comparaveis: 2, acordou: [], discordou: [] },
      ],
      maisDistantes: [],
      posicaoNoGrafo: null,
    },
  ],
};

describe('resultado com as duas casas', () => {
  function renderizarDuasCasas() {
    return render(
      <MemoryRouter>
        <Resultado resultado={DUAS_CASAS} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
      </MemoryRouter>,
    );
  }

  it('mostra uma lista por casa, cada uma com o próprio nome', () => {
    const { container } = renderizarDuasCasas();
    const texto = container.textContent!.replace(/\s+/g, ' ');

    expect(texto).toMatch(/Os deputados mais próximos de você/);
    expect(texto).toMatch(/Os senadores mais próximos de você/);
  });

  it('🔴 cada casa mostra o próprio denominador, não o total', () => {
    const { container } = renderizarDuasCasas();
    const texto = container.textContent!.replace(/\s+/g, ' ');

    // O piso de comparáveis vale por casa: um senador responde poucas perguntas do
    // Senado, e exibir "8 perguntas" ao lado dele afirmaria uma base que ele não tem.
    expect(texto).toMatch(/6 perguntas desta casa/);
    expect(texto).toMatch(/2 perguntas desta casa/);
  });

  it('mantém o total respondido no cabeçalho', () => {
    const { container } = renderizarDuasCasas();

    expect(container.textContent).toMatch(/8 perguntas respondidas/);
  });

  it('⛔ nunca exibe percentual, nem com duas casas', () => {
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
        <Resultado resultado={semSenado} aoRefazer={vi.fn()} perguntas={PERGUNTAS} />
      </MemoryRouter>,
    );

    expect(container.textContent).not.toMatch(/Senadores mais próximos/);
  });
});
