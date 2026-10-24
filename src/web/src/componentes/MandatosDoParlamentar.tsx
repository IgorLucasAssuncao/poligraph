import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Mandato, MandatoNoTse } from '../api';
import { mesCurto, nomeProprio, periodoDaLegislatura } from '../formato';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';
import { NOMES_DOS_CARGOS } from '../textos/politicos';

/** Quantos cartões aparecem antes de "ver todos": os mais recentes, e o aberto na ficha sempre. */
const MANDATOS_A_VISTA = 4;

/** Um cartão: a legislatura em que votou, que troca a ficha, ou o cargo do TSE fora do Congresso, que leva aonde ele se lê. */
type Cartao =
  | { tipo: 'voto'; chave: string; inicio: number; mandato: Mandato; indice: number }
  | { tipo: 'tse'; chave: string; inicio: number; mandato: MandatoNoTse };

/**
 * Os mandatos da pessoa num só lugar, do mais recente: as legislaturas em que votou no Congresso e os cargos que o TSE
 * registra fora dele (presidente, governador, prefeito).
 *
 * DECISÃO (autor, 2026-10-24): um cartão por mandato. O de legislatura troca o que a ficha mostra (`?legislatura=` no
 * endereço, para o "voltar" e o link compartilhado); o de cargo fora do Congresso abre o perfil daquele mandato
 * (`?eleicao=&cargo=`, ver `PerfilDoCargoComponent`). Antes, os cargos do TSE ficavam numa linha e numa seta recolhida embaixo.
 *
 * ATENÇÃO: Partido e UF da legislatura são os do último voto DAQUELE mandato: quem trocou de partido aparece com a sigla de
 * então. O período é o do primeiro ao último voto, e não o da legislatura. MEDIDO (2026-10-09): na 57ª, 122 dos 643 deputados
 * pararam de votar mais de 90 dias antes da última votação da casa.
 *
 * ATENÇÃO: O mandato de deputado ou senador do TSE já aparece pela legislatura em que votou, e não vira um segundo cartão.
 * No Senado, um mandato cobre duas legislaturas.
 */
export function MandatosDoParlamentarComponent({
  mandatos,
  doTse = [],
  atual,
  caminho,
  cargoAberto,
}: {
  mandatos: Mandato[];
  /** Os mandatos do TSE; os do Congresso que têm voto já estão em `mandatos`. */
  doTse?: MandatoNoTse[];
  atual: number | null;
  /** O endereço da aba aberta, sem a busca: o mandato troca e a aba fica. */
  caminho: string;
  /** O cargo do TSE aberto na ficha, quando o cartão dele foi escolhido. */
  cargoAberto?: MandatoNoTse;
}) {
  const [todos, setTodos] = useState(false);

  const cobertos = (m: MandatoNoTse) =>
    mandatos.some((v) => v.anoInicial <= m.ultimoAno && v.anoInicial + 3 >= m.primeiroAno && (m.cargo === 'SENADOR') === (v.casa === 'SENADO'));
  const cartoes: Cartao[] = [
    ...mandatos.map((m, indice): Cartao => ({ tipo: 'voto', chave: `v-${m.legislatura}-${m.casa}`, inicio: m.anoInicial, mandato: m, indice })),
    ...doTse
      .filter((m) => !((m.cargo === 'DEPUTADO_FEDERAL' || m.cargo === 'SENADOR') && cobertos(m)))
      .map((m): Cartao => ({ tipo: 'tse', chave: `t-${m.anoEleicao}-${m.cargo}`, inicio: m.primeiroAno, mandato: m })),
  ].sort((a, b) => b.inicio - a.inicio);

  if (cartoes.length === 0) return null;

  if (cartoes.length === 1 && cartoes[0].tipo === 'voto') {
    const unico = cartoes[0].mandato;
    return (
      <p className="mandatos-unico">
        {T.mandatos.votouDe}
        <span className="dado">{mesCurto(unico.primeiroVoto)}</span>
        {T.mandatos.ate}
        <span className="dado">{mesCurto(unico.ultimoVoto)}</span>
        {T.mandatos.naLegislatura}
        <span className="dado">{periodoDaLegislatura(unico.legislatura)}</span>
      </p>
    );
  }

  const aberto = (c: Cartao) =>
    c.tipo === 'voto' ? c.mandato.legislatura === atual : c.mandato.anoEleicao === cargoAberto?.anoEleicao && c.mandato.cargo === cargoAberto?.cargo;
  const visiveis = todos ? cartoes : cartoes.filter((c, i) => i < MANDATOS_A_VISTA || aberto(c));
  const escondidos = cartoes.length - visiveis.length;

  return (
    <nav className="mandatos" aria-label={T.mandatos.rotulo}>
      <span className="mandatos-rotulo">
        {T.mandatos.rotulo}
        {mandatos.some((m) => m.casa === 'SENADO') && <small>{T.mandatos.senadoCobreDuas}</small>}
      </span>
      <ul>
        {visiveis.map((c) => (
          <li key={c.chave}>{c.tipo === 'voto' ? cartaoDeVoto(c, atual, caminho) : cartaoDoTse(c.mandato, caminho, aberto(c))}</li>
        ))}
      </ul>
      {escondidos > 0 && (
        <button type="button" className="botao-secundario mandatos-mais" onClick={() => setTodos(true)}>
          {T.mandatos.verTodos(cartoes.length)}
        </button>
      )}
    </nav>
  );
}

function cartaoDeVoto(c: Extract<Cartao, { tipo: 'voto' }>, atual: number | null, caminho: string) {
  const m = c.mandato;
  const ativo = m.legislatura === atual;
  return (
    <Link
      to={c.indice === 0 ? caminho : `${caminho}?legislatura=${m.legislatura}`}
      replace
      className={ativo ? 'ativo' : ''}
      aria-current={ativo ? 'true' : undefined}
    >
      <span className="mandatos-cargo">{m.casa === 'SENADO' ? T.mandatos.senador : T.mandatos.deputado}</span>
      <span className="dado">{periodoDaLegislatura(m.legislatura)}</span>
      <span className="mandatos-detalhe">
        {m.casa === 'SENADO' ? T.mandatos.senado : T.mandatos.camara}
        {m.partido && ` · ${m.partido}`}
        {m.uf && `-${m.uf}`}
        {` · ${mesCurto(m.primeiroVoto)}${T.mandatos.ate}${mesCurto(m.ultimoVoto)}`}
      </span>
    </Link>
  );
}

function cartaoDoTse(m: MandatoNoTse, caminho: string, ativo: boolean) {
  return (
    <Link
      to={`${caminho}?eleicao=${m.anoEleicao}&cargo=${m.cargo}`}
      replace
      className={`mandatos-tse${ativo ? ' ativo' : ''}`}
      aria-current={ativo ? 'true' : undefined}
    >
      <span className="mandatos-cargo">{NOMES_DOS_CARGOS[m.cargo]}</span>
      <span className="dado">{`${m.primeiroAno}–${m.ultimoAno}`}</span>
      <span className="mandatos-detalhe">
        {[m.municipio ? `${nomeProprio(m.municipio.nome)} – ${m.municipio.uf}` : m.uf, m.partido].filter(Boolean).join(' · ')}
        {T.mandatos.eleitoEm(m.anoEleicao)}
      </span>
    </Link>
  );
}
