import type { RedeSocial, TipoRedeSocial } from '../api';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * Quantas redes ficam à vista; o resto abre num clique.
 *
 * MEDIDO (2026-10-24): a campanha de Lula em 2022 declarou 54 endereços ao TSE, perfis de apoio entre eles, e a ficha virava
 * uma parede de links. Nenhum some: todos são o que a candidatura declarou.
 */
const REDES_A_VISTA = 6;

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
export function RedesDoParlamentarComponent({ redes }: { redes: RedeSocial[] }) {
  const seguras = redes.filter((r) => /^https?:\/\//i.test(r.url));
  if (seguras.length === 0) return null;

  const daCamara = seguras.every((r) => r.fonte === 'CAMARA');
  const repetidas = new Set(seguras.map((r) => r.rede).filter((rede, i, todas) => rede !== 'OUTRA' && todas.indexOf(rede) !== i));

  const link = (r: RedeSocial, i: number) => (
    <span key={r.url}>
      {i > 0 && ' · '}
      <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">
        {rotulo(r, repetidas.has(r.rede))}
        <span className="sr-apenas">{T.novaAba}</span>
      </a>
    </span>
  );

  return (
    <span className="perfil-redes">
      <span className="perfil-redes-rotulo">{daCamara ? T.redes.daCamara : T.redes.doTse}:</span>{' '}
      {seguras.slice(0, REDES_A_VISTA).map(link)}
      {seguras.length > REDES_A_VISTA && (
        <details className="perfil-redes-outras">
          <summary>{T.redes.outras(seguras.length - REDES_A_VISTA)}</summary>
          {seguras.slice(REDES_A_VISTA).map(link)}
        </details>
      )}
    </span>
  );
}


const NOME: Record<TipoRedeSocial, string> = {
  INSTAGRAM: T.redes.nomes.INSTAGRAM,
  FACEBOOK: T.redes.nomes.FACEBOOK,
  X: T.redes.nomes.X,
  YOUTUBE: T.redes.nomes.YOUTUBE,
  TIKTOK: T.redes.nomes.TIKTOK,
  LINKEDIN: 'LinkedIn',
  OUTRA: 'Site',
};

/**
 * "Site" sozinho não diz qual: a rede sem nome conhecido mostra o domínio.
 *
 * Duas contas da mesma rede levam o perfil entre parênteses: "Facebook (CarmenZanottoLages) · Facebook (CarmenZanottoSC)".
 * Antes eram "Facebook · Facebook", e parecia erro.
 */
function rotulo(r: RedeSocial, repetida: boolean): string {
  if (r.rede === 'OUTRA') return r.url.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
  if (!repetida) return NOME[r.rede];
  const perfil = r.url.replace(/^https?:\/\/[^/]+\/?/i, '').split(/[?#]/)[0].replace(/\/+$/, '');
  return perfil ? `${NOME[r.rede]} (${perfil})` : NOME[r.rede];
}
