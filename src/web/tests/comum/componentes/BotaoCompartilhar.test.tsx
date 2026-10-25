import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotaoCompartilharComponent } from '../../../src/comum/componentes/BotaoCompartilhar';

afterEach(() => vi.unstubAllGlobals());

describe('Compartilhar', () => {
  it('com o compartilhamento do sistema, manda o link curto com o nome', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<BotaoCompartilharComponent caminho="/p/42" nome="Fulano de Tal" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' })));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fulano de Tal', url: `${window.location.origin}/p/42` }));
  });

  it('sem ele, copia o link e diz que copiou', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    render(<BotaoCompartilharComponent caminho="/p/42" nome="Fulano de Tal" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' })));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/p/42`);
    expect(screen.getByRole('status')).toHaveTextContent('Link copiado');
  });
});
