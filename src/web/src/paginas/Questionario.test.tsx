import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionarioComponent } from './Questionario';

vi.mock('../api', async () => {
  const real = await vi.importActual<typeof import('../api')>('../api');

  return {
    ...real,
    obterPerguntas: vi.fn(),
    obterDesempate: vi.fn(),
    calcularAfinidade: vi.fn(),
  };
});

const { calcularAfinidade, obterDesempate, obterPerguntas } = await import('../api');

const PERGUNTAS = [
  { idPergunta: 'q1', texto: 'Primeira afirmação', ordem: 1, totalVotos: 480, totalPossivel: 513 },
  { idPergunta: 'q2', texto: 'Segunda afirmação', ordem: 2, totalVotos: 501, totalPossivel: 513 },
];

function renderizar() {
  return render(
    <MemoryRouter>
      <QuestionarioComponent />
    </MemoryRouter>,
  );
}

/**
 * DECISÃO: A decisão de desenho que este teste protege: a segunda afirmação só existe
 * depois de a primeira ser respondida. Uma lista longa fazia a pessoa varrer
 * tudo e responder no automático.
 *
 * ATENÇÃO: A pausa é real (setTimeout), então o avanço é assíncrono de propósito.
 *
 * DECISÃO: Revelar "310 votaram Sim" antes das próximas perguntas induziria conformidade,
 * e o instrumento passaria a medir adesão à maioria. Ver `PerguntaPublica`.
 *
 * DECISÃO: E o painel desenhado também não: exatamente DOIS estados de marca, cheia e
 * vazada. Um terceiro estado seria direção codificada em forma.
 *
 * ATENÇÃO: Acontece quando a ingestão não trouxe o placar oficial daquela votação.
 * O que falta é o dado — dizer "0" seria afirmar um comparecimento inexistente.
 *
 * RISCO: A rodada de desempate é invisível de propósito. Ela existe porque as 15
 * melhores perguntas fixas deixam 14 deputados empatados no topo, e 8 fixas mais 7
 * escolhidas contra o empate de quem respondeu deixam 6.
 *
 * ATENÇÃO: Esperar o cartão TROCAR entre os cliques. O botão continua na tela durante a
 * pausa de 760ms, e clicar de novo sem esperar só reescreve a mesma resposta.
 *
 * ATENÇÃO: O denominador é o total DECLARADO, não o tamanho da lista já carregada. Sem
 * isso a barra andaria para trás quando as de desempate chegassem: quem via
 * "Pergunta 2 de 2" passaria a ver "Pergunta 3 de 3" tendo avançado.
 *
 * Não Falha no desempate não pode travar o questionário: `obterDesempate` devolve
 * `[]`, e comparar o índice com o TOTAL previsto (3) em vez de com a lista carregada
 * (2) deixaria o cidadão numa tela sem pergunta e sem encerramento.
 *
 * RISCO: duas perguntas percorridas, UMA opinião — o encerramento não pode dizer "2"
 *
 * Um alvo que sumisse da página faria o tour pular o passo calado.
 */
describe('Questionario', () => {
  beforeEach(() => {
    vi.mocked(obterPerguntas).mockResolvedValue({ perguntas: PERGUNTAS, total: PERGUNTAS.length });
    vi.mocked(obterDesempate).mockResolvedValue([]);
    vi.mocked(calcularAfinidade).mockReset();
  });

  it('mostra uma pergunta por vez, nunca a lista inteira', async () => {
    renderizar();

    expect(await screen.findByText('Primeira afirmação')).toBeDefined();
    expect(screen.queryByText('Segunda afirmação')).toBeNull();
  });

  it('avança sozinho depois de responder', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Concordo' }));

    await waitFor(() => expect(screen.getByText('Segunda afirmação')).toBeDefined());
  });

  it('RISCO: no retorno mostra o comparecimento, NUNCA o placar', async () => {
    const usuario = userEvent.setup();
    const { container } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Discordo' }));

    await waitFor(() => expect(container.textContent).toMatch(/480/));
    expect(container.textContent).not.toMatch(/votaram sim|votaram não|a favor|contra/i);

    const estados = new Set(
      [...container.querySelectorAll('.marca')].map((m) => m.className),
    );
    expect(estados).toEqual(new Set(['marca', 'marca marca-cheia']));
  });

  it('sem placar registrado, não afirma "0 deputados se posicionaram"', async () => {
    vi.mocked(obterPerguntas).mockResolvedValue({
      perguntas: [{ ...PERGUNTAS[0], totalVotos: 0 }],
      total: 1,
    });

    const usuario = userEvent.setup();
    const { container } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Concordo' }));

    await waitFor(() => expect(container.textContent).toMatch(/registrada/i));
    expect(container.textContent).not.toMatch(/0 deputados|se posicionaram/i);
  });

  it('emenda as perguntas de desempate sem o cidadão perceber', async () => {
    vi.mocked(obterPerguntas).mockResolvedValue({ perguntas: PERGUNTAS, total: 3 });
    vi.mocked(obterDesempate).mockResolvedValue([
      { idPergunta: 'q9', texto: 'Afirmação escolhida para desempatar', ordem: 9, totalVotos: 400, totalPossivel: 513 },
    ]);

    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Concordo' }));
    await screen.findByText('Segunda afirmação');
    await usuario.click(screen.getByRole('button', { name: 'Concordo' }));

    expect(await screen.findByText('Afirmação escolhida para desempatar')).toBeDefined();
  });

  it('conta o progresso sobre o questionário inteiro, não sobre o que já chegou', async () => {
    vi.mocked(obterPerguntas).mockResolvedValue({ perguntas: PERGUNTAS, total: 3 });

    renderizar();

    expect(await screen.findByText('Pergunta 1 de 3')).toBeDefined();
  });

  it('encerra normalmente quando o desempate não devolve nada', async () => {
    vi.mocked(obterPerguntas).mockResolvedValue({ perguntas: PERGUNTAS, total: 3 });
    vi.mocked(obterDesempate).mockResolvedValue([]);

    const usuario = userEvent.setup();
    const { container } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Concordo' }));
    await screen.findByText('Segunda afirmação');
    await usuario.click(screen.getByRole('button', { name: 'Concordo' }));

    await waitFor(() => expect(container.textContent).toMatch(/2 de 2 respondidas/));
  });

  it('conta apenas as respostas com opinião — "Não sei" não vira concordância', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Não sei' }));
    await waitFor(() => expect(screen.getByText('Segunda afirmação')).toBeDefined());

    await usuario.click(screen.getByRole('button', { name: 'Concordo' }));

    const encerramento = await screen.findByText(/opinou em/i);
    expect(encerramento.textContent).toMatch(/opinou em 1 de 2/i);
  });

  it('o tour encontra na página cada elemento que explica', async () => {
    const { passosDoQuestionario } = await import('../tour');
    renderizar();
    await screen.findByText('Primeira afirmação');

    for (const passo of passosDoQuestionario()) {
      expect(document.querySelector(`[data-tour="${passo.alvo}"]`), passo.alvo).not.toBeNull();
    }
  });
});
