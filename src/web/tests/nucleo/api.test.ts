import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buscarTudo,
  calcularAfinidade,
  ConsentimentoNecessarioError,
  deixarDeSeguir,
  entrarComGoogle,
  excluirConta,
  listarConvenios,
  listarEmendas,
  listarEntidades,
  listarFavorecidos,
  listarLancamentos,
  listarParlamentares,
  listarParlamentaresDoMunicipio,
  listarSeguidos,
  listarVotos,
  NaoAutenticadoError,
  obterDesempate,
  obterEntidade,
  obterFicha,
  obterFinanciamento,
  obterGastos,
  obterGoverno,
  obterMapaDoBrasil,
  obterProcedencia,
  quemSouEu,
  registrarAvaliacao,
  RespostasInsuficientesError,
  sair,
  seguir,
} from '../../src/nucleo/api';
import { VERSAO_CONSENTIMENTO } from '../../src/nucleo/textos-legais';

/**
 * O contrato do front com a API: a URL, o método e o cabeçalho anti-CSRF de cada chamada.
 * As telas testam com a API simulada; aqui é a API simulada que não existe, e o `fetch` é
 * quem responde.
 */
const fetchSimulado = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Uma resposta com o status e o corpo pedidos. */
function responder(status: number, corpo: unknown = {}) {
  fetchSimulado.mockResolvedValueOnce(new Response(status === 204 ? null : JSON.stringify(corpo), { status }));
}

/** A URL e as opções da chamada de número `indice`. */
function chamada(indice = 0): { url: string; opcoes: RequestInit } {
  const [url, opcoes] = fetchSimulado.mock.calls[indice];
  return { url: String(url), opcoes: opcoes ?? {} };
}

describe('URLs da ficha: cada ano diz de que é', () => {
  it('ficha e votos levam a legislatura, a busca e o filtro de rito', async () => {
    responder(200);
    responder(200);

    await obterFicha(5, 57);
    await listarVotos(5, 2, 20, 57, 'reforma tributária', true);

    expect(chamada(0).url).toBe('/api/parlamentares/5?legislatura=57');
    expect(chamada(1).url).toBe(
      '/api/parlamentares/5/votos?pagina=2&tamanho=20&legislatura=57&busca=reforma%20tribut%C3%A1ria&semRito=true',
    );
  });

  it('cota usa anoDaDespesa; emendas, anoDaEmenda', async () => {
    for (let i = 0; i < 7; i++) responder(200);

    await obterGastos(5, 57, 2025);
    await obterGastos(5);
    await listarLancamentos(5, 2025, 2, 20);
    await listarEmendas(5, 2024, 1, 8);
    await listarFavorecidos(5, 2024, 2, 8);
    await listarConvenios(5, 2024, 3, 8);
    await obterFinanciamento(5, 57);

    expect(fetchSimulado.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/parlamentares/5/gastos?legislatura=57&anoDaDespesa=2025',
      '/api/parlamentares/5/gastos',
      '/api/parlamentares/5/gastos/lancamentos?anoDaDespesa=2025&pagina=2&tamanho=20',
      '/api/parlamentares/5/emendas/lista?anoDaEmenda=2024&pagina=1&tamanho=8',
      '/api/parlamentares/5/emendas/favorecidos?anoDaEmenda=2024&pagina=2&tamanho=8',
      '/api/parlamentares/5/emendas/convenios?anoDaEmenda=2024&pagina=3&tamanho=8',
      '/api/parlamentares/5/financiamento?legislatura=57',
    ]);
  });

  it('procedência manda só os parâmetros que vieram', async () => {
    responder(200);

    await obterProcedencia({ contexto: 'cota', idPessoa: 1, anoDaDespesa: 2025, categoria: 'COMBUSTÍVEIS', legislatura: undefined });

    expect(chamada().url).toBe('/api/procedencia/cota?idPessoa=1&anoDaDespesa=2025&categoria=COMBUST%C3%8DVEIS');
  });
});

describe('URLs com período, lista e busca', () => {
  it('o período vira de e ate; sem período, nada', async () => {
    for (let i = 0; i < 4; i++) responder(200);

    await obterMapaDoBrasil({ primeiroAno: 2023, ultimoAno: 2025 });
    await obterMapaDoBrasil();
    await listarParlamentaresDoMunicipio('4106902', { primeiroAno: 2025, ultimoAno: 2025 }, 2);
    await obterGoverno({ primeiroAno: 2019, ultimoAno: 2022 });

    expect(fetchSimulado.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/mapa/emendas?de=2023&ate=2025',
      '/api/mapa/emendas',
      '/api/municipios/4106902/emendas/parlamentares?pagina=2&de=2025&ate=2025',
      '/api/governo?de=2019&ate=2022',
    ]);
  });

  it('a lista ignora filtro vazio, e a busca codifica o termo', async () => {
    for (let i = 0; i < 4; i++) responder(200, []);

    await listarParlamentares({ nome: 'ana', uf: '', pagina: 2 });
    await listarEntidades({ busca: 'hospital', grupo: null, pagina: 3 });
    await listarEntidades({});
    await buscarTudo('são paulo');

    expect(fetchSimulado.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/parlamentares?nome=ana&pagina=2',
      '/api/entidades?busca=hospital&pagina=3',
      '/api/entidades',
      '/api/busca?q=s%C3%A3o%20paulo',
    ]);
  });
});

describe('respostas que não são 200', () => {
  it('401 vira NaoAutenticadoError; outro erro, Error com a URL', async () => {
    responder(401);
    responder(500);

    await expect(obterFicha(1)).rejects.toBeInstanceOf(NaoAutenticadoError);
    await expect(obterFicha(1)).rejects.toThrow('/api/parlamentares/1');
  });

  it('sem sessão, quemSouEu é nulo; governo e entidade sem dado também', async () => {
    responder(401);
    responder(404);
    responder(404);

    expect(await quemSouEu()).toBeNull();
    expect(await obterGoverno()).toBeNull();
    expect(await obterEntidade('12345678000190')).toBeNull();
  });

  it('afinidade com poucas respostas devolve o mínimo que faltou', async () => {
    responder(422, { minimo: 15 });

    const erro = await calcularAfinidade([{ perguntaId: 'q1', valor: 1 }]).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(RespostasInsuficientesError);
    expect((erro as RespostasInsuficientesError).minimo).toBe(15);
  });

  it('o desempate nunca derruba o questionário: falha vira lista vazia', async () => {
    fetchSimulado.mockRejectedValueOnce(new Error('rede'));
    responder(500);

    expect(await obterDesempate([{ perguntaId: 'q1', valor: 1 }])).toEqual([]);
    expect(await obterDesempate([{ perguntaId: 'q1', valor: 1 }])).toEqual([]);
  });
});

describe('escrita: método, cabeçalho do site e corpo', () => {
  it('entrar, avaliar e calcular mandam JSON com o cabeçalho anti-CSRF', async () => {
    responder(200, { nome: 'Fulana' });
    responder(204, null);
    responder(200, { porCasa: [] });

    await entrarComGoogle('token');
    await registrarAvaliacao({ perguntasRespondidas: 24, acordosDoPrimeiro: 17, comparaveisDoPrimeiro: 20, acertou: true, posicaoAutodeclarada: null });
    await calcularAfinidade([{ perguntaId: 'q1', valor: -1 }], 'PR');

    for (let i = 0; i < 3; i++) {
      expect(chamada(i).opcoes.method).toBe('POST');
      expect(chamada(i).opcoes.headers).toMatchObject({ 'X-Requested-With': 'poligraph', 'Content-Type': 'application/json' });
    }
    expect(JSON.parse(String(chamada(0).opcoes.body))).toEqual({ idToken: 'token' });
    expect(JSON.parse(String(chamada(2).opcoes.body))).toEqual({ respostas: [{ perguntaId: 'q1', valor: -1 }], uf: 'PR' });
  });

  it('seguir manda a versão do consentimento; 428 pede o consentimento', async () => {
    responder(204, null);
    responder(428);

    await seguir(7, true);
    await expect(seguir(7)).rejects.toBeInstanceOf(ConsentimentoNecessarioError);

    expect(chamada(0).url).toBe(`/api/seguidos/7?versao=${encodeURIComponent(VERSAO_CONSENTIMENTO)}&aceite=true`);
    expect(chamada(0).opcoes.method).toBe('PUT');
    expect(chamada(1).url).not.toContain('aceite');
  });

  it('deixar de seguir, excluir a conta e sair usam o método certo', async () => {
    responder(204, null);
    responder(204, null);
    responder(204, null);

    await deixarDeSeguir(7);
    await excluirConta();
    await sair();

    expect([0, 1, 2].map((i) => [chamada(i).url, chamada(i).opcoes.method])).toEqual([
      ['/api/seguidos/7', 'DELETE'],
      ['/api/auth/conta', 'DELETE'],
      ['/api/auth/logout', 'POST'],
    ]);
  });

  it('a lista de seguidos chega sem contagem de votações', async () => {
    responder(200, [{ idPessoa: 3, nome: 'Fulana', casa: 'CAMARA', partido: 'P', uf: 'PR' }]);

    expect(await listarSeguidos()).toEqual([{ idPessoa: 3, nome: 'Fulana', casa: 'CAMARA', partido: 'P', uf: 'PR', nVotacoes: 0 }]);
  });
});
