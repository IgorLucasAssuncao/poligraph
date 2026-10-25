import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvatarComponent } from '../../../src/comum/componentes/Avatar';

/**
 * O comentário dizia "cai para as iniciais", e o código só escondia a imagem.
 */
describe('Avatar', () => {
  it('mostra as iniciais mesmo com foto: elas aparecem antes de a foto chegar', () => {
    const { container } = render(<AvatarComponent nome="Ana Ribeiro" fotoUrl="https://www.camara.leg.br/x.jpg" />);

    expect(container.textContent).toContain('AR');
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('pede a foto só quando ela chega perto da tela', () => {
    const { container } = render(<AvatarComponent nome="Ana Ribeiro" fotoUrl="https://www.camara.leg.br/x.jpg" />);
    const foto = container.querySelector('img')!;

    expect(foto.getAttribute('loading')).toBe('lazy');
    expect(foto.getAttribute('decoding')).toBe('async');
  });

  it('se a foto falha, as iniciais ficam no lugar', () => {
    const { container } = render(<AvatarComponent nome="Ana Ribeiro" fotoUrl="https://www.camara.leg.br/x.jpg" />);

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('AR');
  });

  it('sem foto, só as iniciais', () => {
    const { container } = render(<AvatarComponent nome="Ana Ribeiro" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('AR');
  });
});
