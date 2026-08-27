import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

/**
 * O jsdom não implementa `showModal` nem `close`, que são do `<dialog>` nativo — sem
 * dublê, qualquer componente que os chame estoura antes de a asserção rodar.
 *
 * Fica aqui, e não em cada arquivo de teste, porque o projeto já tem três `<dialog>`:
 * `Avaliacao`, `GrafoAmpliado` e `ContasAmpliadas`.
 */
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});
