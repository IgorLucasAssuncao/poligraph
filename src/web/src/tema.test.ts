import { afterEach, describe, expect, it, vi } from 'vitest';
import { aoMudarTema, aplicarTema, temaEfetivoEscuro } from './tema';
import { corDaComunidade } from './componentes/grafo/desenho';

function sistemaEscuro(escuro: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('dark') ? escuro : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/**
 * O grafo pinta em canvas e não tem seletor de CSS. Perguntando só ao sistema, ele
 * saía com as cores do tema claro sobre a página escura quando a pessoa escolhia o
 * escuro no botão com o sistema claro.
 */
describe('tema efetivo', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-tema');
    vi.unstubAllGlobals();
  });

  it('a escolha do botão vence o sistema, nos dois sentidos', () => {
    sistemaEscuro(false);
    document.documentElement.setAttribute('data-tema', 'escuro');
    expect(temaEfetivoEscuro()).toBe(true);

    sistemaEscuro(true);
    document.documentElement.setAttribute('data-tema', 'claro');
    expect(temaEfetivoEscuro()).toBe(false);
  });

  it('sem escolha, segue o sistema', () => {
    sistemaEscuro(true);
    expect(temaEfetivoEscuro()).toBe(true);

    sistemaEscuro(false);
    expect(temaEfetivoEscuro()).toBe(false);
  });

  it('avisa quem desenha quando o botão troca o tema', () => {
    sistemaEscuro(false);
    const aviso = vi.fn();
    const cancelar = aoMudarTema(aviso);

    aplicarTema('escuro');
    expect(aviso).toHaveBeenCalledTimes(1);

    cancelar();
    aplicarTema('claro');
    expect(aviso).toHaveBeenCalledTimes(1);
  });
});

describe('cores de comunidade', () => {
  it('o tema escuro usa a paleta clara, mesma posição, mesmo matiz', () => {
    for (let comunidade = 0; comunidade < 8; comunidade++) {
      expect(corDaComunidade(comunidade, true)).not.toBe(corDaComunidade(comunidade, false));
    }
  });

  it('sem comunidade, o mesmo cinza nos dois temas', () => {
    expect(corDaComunidade(null, true)).toBe(corDaComunidade(null, false));
  });
});
