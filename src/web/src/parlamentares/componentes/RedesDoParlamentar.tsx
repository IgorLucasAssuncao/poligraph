import type { RedeSocial, TipoRedeSocial } from '../../nucleo/api';
import { TEXTOS_DOS_COMPONENTES as T } from '../../comum/textos/componentes';

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
 * DECISÃO (autor, 2026-10-24): cada rede é uma etiqueta com o fundo claro no tom dela, e não um link numa fila separada por
 * ponto: com dezenas de endereços, a fila não se lia.
 *
 * DECISÃO: Diz de onde vieram: a lista da Câmara é a atual; a do TSE é a da candidatura, e pode estar velha. Sem isso, um
 * perfil abandonado pareceria o canal de hoje.
 *
 * RISCO: Só vira link o que é `http(s)`. O banco já recusa o resto (`ck_rede_url`); a tela confere de novo, porque um
 * `javascript:` que escapasse seria script rodando no clique.
 *
 * ATENÇÃO: `nofollow` além de `noopener noreferrer`: o site não recomenda perfil nenhum aos buscadores (RNF-16).
 */
export function RedesDoParlamentarComponent({ redes }: { redes: RedeSocial[] }) {
  const seguras = mesmoLugarUmaVez(redes.filter((r) => /^https?:\/\//i.test(r.url)));
  if (seguras.length === 0) return null;

  const daCamara = seguras.every((r) => r.fonte === 'CAMARA');
  const rotulos = rotulosDistintos(seguras);
  const etiqueta = (r: RedeSocial) => (
    <li key={r.url}>
      <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className={`rede rede-${r.rede.toLowerCase()}`}>
        {rotulos.get(r.url)}
        <span className="sr-apenas">{T.novaAba}</span>
      </a>
    </li>
  );

  return (
    <div className="perfil-redes">
      <span className="perfil-redes-rotulo">{daCamara ? T.redes.daCamara : T.redes.doTse}</span>
      <ul className="redes">{seguras.slice(0, REDES_A_VISTA).map(etiqueta)}</ul>
      {seguras.length > REDES_A_VISTA && (
        <details className="perfil-redes-outras">
          <summary>{T.redes.outras(seguras.length - REDES_A_VISTA)}</summary>
          <ul className="redes">{seguras.slice(REDES_A_VISTA).map(etiqueta)}</ul>
        </details>
      )}
    </div>
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
 * O rótulo de cada endereço. A rede que aparece uma vez fica só com o nome; a repetida leva o perfil, para "Facebook ·
 * Facebook" não parecer erro. O site mostra o domínio, e o caminho quando o domínio se repete.
 *
 * ATENÇÃO: o perfil vem da URL como o candidato digitou: sai decodificado (`%C3%A9` vira "é"), sem o número que o Facebook
 * acrescenta no fim, e o canal do YouTube pelo id vira "canal".
 */
function rotulosDistintos(redes: RedeSocial[]): Map<string, string> {
  const contagem = new Map<string, number>();
  const chave = (r: RedeSocial) => (r.rede === 'OUTRA' ? dominio(r.url) : r.rede);
  for (const r of redes) contagem.set(chave(r), (contagem.get(chave(r)) ?? 0) + 1);

  return new Map(redes.map((r) => {
    const repetida = (contagem.get(chave(r)) ?? 0) > 1;
    if (r.rede === 'OUTRA') return [r.url, repetida ? `${dominio(r.url)}${caminho(r.url) ? `/${caminho(r.url)}` : ''}` : dominio(r.url)];
    if (!repetida) return [r.url, NOME[r.rede]];
    const perfil = perfilDaUrl(r);
    return [r.url, perfil ? `${NOME[r.rede]} · ${perfil}` : NOME[r.rede]];
  }));
}

/** Endereços que levam ao mesmo lugar (http e https, com e sem barra no fim, com e sem www) contam uma vez. */
function mesmoLugarUmaVez(redes: RedeSocial[]): RedeSocial[] {
  const vistos = new Set<string>();
  return redes.filter((r) => {
    const lugar = `${dominio(r.url)}/${caminho(r.url)}`.toLowerCase();
    if (vistos.has(lugar)) return false;
    vistos.add(lugar);
    return true;
  });
}

function dominio(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./, '').split(/[/?#]/)[0];
}

function caminho(url: string): string {
  return decodificado(url.replace(/^https?:\/\/[^/]+\/?/i, '').split(/[?#]/)[0].replace(/\/+$/, ''));
}

function perfilDaUrl(r: RedeSocial): string {
  const perfil = caminho(r.url);
  if (r.rede === 'YOUTUBE' && /^channel\//i.test(perfil)) return T.redes.canal(perfil.slice(-4));
  if (r.rede === 'FACEBOOK') return perfil.replace(/-\d{6,}$/, '').replace(/-/g, ' ');
  return perfil.replace(/^@/, '@');
}

function decodificado(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}
