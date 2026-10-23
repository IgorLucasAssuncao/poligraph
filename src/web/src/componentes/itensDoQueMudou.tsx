import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Casa, Novidades } from '../api';
import { dataCurta, mesCurto, noMeioDaFrase, nomeDaCategoriaDaCota, nomeDePessoa, reais } from '../formato';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { TEXTOS_DO_QUE_MUDOU as T } from '../textos/oQueMudou';

/** O tipo do fato, para o filtro do feed: os cinco avisos de `docs/plano/09 §4.1`. */
export type TipoDeNovidade = 'contra' | 'troca' | 'cota' | 'emenda' | 'semana';

/** Um fato sobre quem a pessoa segue: a chave estável, de quem é, a data ISO para ordenar e o que a tela mostra. */
export type Item = {
  chave: string;
  tipo: TipoDeNovidade;
  idPessoa: number;
  nome: string;
  ordem: string;
  quando: string;
  texto: ReactNode;
  fonte: ReactNode;
};

const ORGAO: Record<Casa, string> = T.orgao;

/**
 * Os cinco avisos num feed só, do mais recente. `ordem` é a data ISO do fato.
 *
 * `comNome`: falso no modal agrupado por parlamentar, onde o nome já é o título do grupo e o texto
 * começa pelo verbo.
 */
export function montarItens(n: Novidades, comNome = true): Item[] {
  const ficha = (id: number, nome: string, aba = '') =>
    comNome ? <Link to={`/parlamentar/${id}${aba}`}>{nomeDePessoa(nome)}</Link> : null;
  const itens: Item[] = [];

  for (const v of n.votosNaSemana) {
    itens.push({
      chave: `semana-${v.idPessoa}-${v.casa}`,
      tipo: 'semana',
      idPessoa: v.idPessoa,
      nome: v.nome,
      ordem: n.semana.ate,
      quando: T.semana(dataCurta(n.semana.de).slice(0, 5), dataCurta(n.semana.ate).slice(0, 5)),
      texto: T.votouNaSemana(
        ficha(v.idPessoa, v.nome),
        v.votou,
        v.ausente === null ? null : v.ausente + (v.ausenteJustificado ?? 0),
        v.ausenteJustificado,
      ),
      fonte: ORGAO[v.casa],
    });
  }

  for (const c of n.contraOPartido) {
    itens.push({
      chave: `contra-${c.idPessoa}-${c.votacaoId}`,
      tipo: 'contra',
      idPessoa: c.idPessoa,
      nome: c.nome,
      ordem: c.data,
      quando: dataCurta(c.data),
      texto: T.contraOPartido(ficha(c.idPessoa, c.nome), c.voto, c.proposicao, c.bancada, c.partido, c.orientacao, c.descricao),
      fonte: (
        <>
          {ORGAO.CAMARA}
          {c.urlFonte && (
            <>
              {' · '}
              <LinkDeFonteComponent href={c.urlFonte}>{T.registroDaVotacao}</LinkDeFonteComponent>
            </>
          )}
        </>
      ),
    });
  }

  for (const t of n.trocasDePartido) {
    itens.push({
      chave: `troca-${t.idPessoa}`,
      tipo: 'troca',
      idPessoa: t.idPessoa,
      nome: t.nome,
      ordem: t.primeiroVoto,
      quando: dataCurta(t.primeiroVoto),
      texto: T.trocou(ficha(t.idPessoa, t.nome), t.partidoNovo, dataCurta(t.primeiroVoto), t.partidoAnterior),
      fonte: ORGAO[t.casa],
    });
  }

  for (const g of n.gastosNaCota) {
    const mes = `${g.anoDaDespesa}-${String(g.mes).padStart(2, '0')}-01`;
    itens.push({
      chave: `cota-${g.idPessoa}-${mes}`,
      tipo: 'cota',
      idPessoa: g.idPessoa,
      nome: g.nome,
      ordem: mes,
      quando: mesCurto(mes),
      texto: T.gastouNaCota(
        ficha(g.idPessoa, g.nome, '/cota'),
        reais(g.total),
        mesCurto(mes),
        reais(g.maiorCategoriaValor),
        noMeioDaFrase(nomeDaCategoriaDaCota(g.maiorCategoria)),
      ),
      fonte: g.casa ? T.fonteDaCota(ORGAO[g.casa], g.casa === 'SENADO') : T.cotaParlamentar,
    });
  }

  for (const e of n.emendasPagas) {
    itens.push({
      chave: `emenda-${e.idPessoa}-${e.mes}`,
      tipo: 'emenda',
      idPessoa: e.idPessoa,
      nome: e.nome,
      ordem: e.mes,
      quando: mesCurto(e.mes),
      texto: T.emendaPaga(ficha(e.idPessoa, e.nome, '/emendas'), reais(e.pago), mesCurto(e.mes), e.maiorDestino, e.lugarDoMaiorDestino),
      fonte: T.portal,
    });
  }

  return itens.sort((a, b) => b.ordem.localeCompare(a.ordem));
}

/** A carga mais recente, em `dd/mm`, ou nulo sem carga registrada. */
export function ultimaCarga(n: Novidades): string | null {
  const mais = n.atualizacoes.map((a) => a.ultimaCarga).sort((a, b) => a.localeCompare(b)).at(-1);
  return mais ? dataCurta(mais.slice(0, 10)).slice(0, 5) : null;
}
