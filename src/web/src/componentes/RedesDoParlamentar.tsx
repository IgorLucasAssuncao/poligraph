import type { RedeSocial, TipoRedeSocial } from '../api';

/**
 * As redes que o parlamentar publicou — à Câmara, ou ao TSE na candidatura (PP4).
 *
 * DECISÃO: Diz de onde vieram: a lista da Câmara é a atual; a do TSE é a da candidatura, e pode
 * estar velha. Sem isso, um perfil abandonado pareceria o canal de hoje.
 *
 * RISCO: Só vira link o que é `http(s)`. O banco já recusa o resto (`ck_rede_url`); a tela confere
 * de novo, porque um `javascript:` que escapasse seria script rodando no clique.
 *
 * ATENÇÃO: `nofollow` além de `noopener noreferrer`: o site não recomenda perfil nenhum aos buscadores
 * (RNF-16).
 */
export function RedesDoParlamentar({ redes }: { redes: RedeSocial[] }) {
  const seguras = redes.filter((r) => /^https?:\/\//i.test(r.url));
  if (seguras.length === 0) return null;

  const daCamara = seguras.every((r) => r.fonte === 'CAMARA');

  return (
    <p className="perfil-redes">
      <span className="perfil-redes-rotulo">{daCamara ? 'Redes publicadas na Câmara' : 'Redes declaradas ao TSE'}:</span>{' '}
      {seguras.map((r, i) => (
        <span key={r.url}>
          {i > 0 && ' · '}
          <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">
            {rotulo(r)}
            <span className="sr-apenas"> (abre em nova aba)</span>
          </a>
        </span>
      ))}
    </p>
  );
}

const NOME: Record<TipoRedeSocial, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  X: 'X (Twitter)',
  YOUTUBE: 'YouTube',
  TIKTOK: 'TikTok',
  LINKEDIN: 'LinkedIn',
  OUTRA: 'Site',
};

/** "Site" sozinho não diz qual: a rede sem nome conhecido mostra o domínio. */
function rotulo(r: RedeSocial): string {
  if (r.rede !== 'OUTRA') return NOME[r.rede];
  return r.url.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
}
