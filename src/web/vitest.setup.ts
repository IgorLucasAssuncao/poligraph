import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { clienteDeConsultas } from './src/nucleo/consultas';

/** Cada teste começa sem nada guardado: o dublê da API de um teste não vaza para o seguinte. */
beforeEach(() => clienteDeConsultas.clear());

/**
 * O jsdom não implementa `showModal` nem `close`, que são do `<dialog>` nativo — sem
 * dublê, qualquer componente que os chame estoura antes de a asserção rodar.
 *
 * Fica aqui, e não em cada arquivo de teste, porque o projeto já tem três `<dialog>`:
 * `Avaliacao`, `GrafoAmpliado` e `ContasAmpliadas`.
 */
/**
 * O `ResizeObserver` também não existe no jsdom, e o grafo mede o contêiner com ele
 * para dimensionar o canvas.
 *
 * ATENÇÃO: O dublê é INERTE de propósito: não dispara callback nenhum. Chamar a callback com
 * medidas inventadas faria o componente desenhar num tamanho que não existe, e o teste
 * passaria a afirmar coisas sobre um quadro fictício. O que os testes verificam é o
 * comportamento dos controles, não a geometria.
 */
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * ATENÇÃO: O jsdom não implementa Canvas 2D e grita "Not implemented" a cada render do
 * grafo. Devolver `null` é o mesmo que ele já faz — só que em silêncio, e o componente já
 * trata esse caso (sem contexto, não desenha).
 */
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});
