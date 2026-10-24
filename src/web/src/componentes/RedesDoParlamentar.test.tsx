import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RedeSocial } from '../api';
import { RedesDoParlamentarComponent } from './RedesDoParlamentar';

const rede = (r: RedeSocial['rede'], url: string): RedeSocial => ({ rede: r, url, fonte: 'TSE' });

describe('redes na ficha', () => {
  it('perfil repetido sai legível: decodificado, sem o número do Facebook, canal do YouTube e caminho do site repetido', () => {
    render(
      <RedesDoParlamentarComponent
        redes={[
          rede('FACEBOOK', 'https://www.facebook.com/Evang%C3%A9licos-com-Lula-110274598449557/'),
          rede('FACEBOOK', 'https://www.facebook.com/Lula'),
          rede('YOUTUBE', 'https://www.youtube.com/channel/UCOjkvpTU9ok80J84G2XIvDQ'),
          rede('YOUTUBE', 'https://www.youtube.com/lulaoficial'),
          rede('OUTRA', 'https://lula.com.br'),
          rede('OUTRA', 'https://lula.com.br/evangelicos-com-lula'),
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /Facebook · Evangélicos com Lula/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /YouTube · canal …XIvDQ|YouTube · canal …IvDQ/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /lula\.com\.br\/evangelicos-com-lula/ })).toBeInTheDocument();
  });

  it('passa de seis, o resto abre num clique, e nenhuma some', () => {
    render(<RedesDoParlamentarComponent redes={Array.from({ length: 9 }, (_, i) => rede('OUTRA', `https://site${i}.com.br`))} />);

    expect(screen.getByText('Ver as outras 3')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { hidden: true })).toHaveLength(9);
  });
});
