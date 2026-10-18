import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Casa, Novidades } from '../api';
import { dataCurta, mesCurto, minusculas, reais } from '../formato';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { TEXTOS_DO_QUE_MUDOU as T } from '../textos/oQueMudou';

/** Um fato do "O que mudou": a chave estável, a data ISO para ordenar e o que a tela mostra. */
export type Item = { chave: string; ordem: string; quando: string; texto: ReactNode; fonte: ReactNode };

const ORGAO: Record<Casa, string> = T.orgao;

/** Os cinco avisos num feed só, do mais recente. `ordem` é a data ISO do fato. */
export function montarItens(n: Novidades): Item[] {
  const ficha = (id: number, nome: string, aba = '') => <Link to={`/parlamentar/${id}${aba}`}>{nome}</Link>;
  const itens: Item[] = [];

  for (const v of n.votosNaSemana) {
    itens.push({
      chave: `semana-${v.idPessoa}-${v.casa}`,
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
      ordem: mes,
      quando: mesCurto(mes),
      texto: T.gastouNaCota(
        ficha(g.idPessoa, g.nome, '/cota'),
        reais(g.total),
        mesCurto(mes),
        reais(g.maiorCategoriaValor),
        minusculas(g.maiorCategoria),
      ),
      fonte: g.casa ? T.fonteDaCota(ORGAO[g.casa], g.casa === 'SENADO') : T.cotaParlamentar,
    });
  }

  for (const e of n.emendasPagas) {
    itens.push({
      chave: `emenda-${e.idPessoa}-${e.mes}`,
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
