import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { obterNovidades } from '../api';
import type { Casa, Novidades } from '../api';
import { dataCurta, mesCurto, minusculas, reais } from '../formato';
import { LinkDeFonteComponent } from './LinkDeFonte';
import './oQueMudou.css';
import { TEXTOS_DO_QUE_MUDOU as T } from '../textos/oQueMudou';

/**
 * "O que mudou" (Pendência 63): os cinco avisos sobre quem a pessoa segue, um item por fato, do
 * mais recente. Especificação em `docs/plano/09 §4.1`.
 *
 * DECISÃO: Fato registrado pela casa, sem adjetivo e sem ranking (RNF-16). "Votou contra o
 * partido" diz o voto e a orientação; não diz "traiu".
 *
 * ATENÇÃO: A data de cada item é a do dado, e a tela diz de quando é a carga: a base não é
 * de hoje, e "sem novidades hoje" afirmaria uma atualidade que ela não tem.
 */
export function OQueMudouComponent() {
  const [novidades, setNovidades] = useState<Novidades | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let atual = true;
    obterNovidades()
      .then((n) => atual && setNovidades(n))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, []);

  if (erro) return null;
  if (!novidades) return null;

  const itens = montarItens(novidades);
  const carga = ultimaCarga(novidades);

  return (
    <section className="painel-secao o-que-mudou" aria-labelledby="titulo-o-que-mudou">
      <h2 id="titulo-o-que-mudou">{T.titulo}</h2>
      <p className="ajuda">{T.janela(dataCurta(novidades.semana.de), dataCurta(novidades.semana.ate), carga)}</p>

      {itens.length === 0 ? (
        <p className="vazio">{T.nadaNovo(carga)}</p>
      ) : (
        <ul className="lista-novidades">
          {itens.map((item) => (
            <li key={item.chave}>
              <span className="novidade-data">{item.quando}</span>
              <p className="novidade-texto">{item.texto}</p>
              <p className="novidade-fonte">{item.fonte}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Item = { chave: string; ordem: string; quando: string; texto: ReactNode; fonte: ReactNode };

const ORGAO: Record<Casa, string> = T.orgao;

/** Os cinco avisos num feed só, do mais recente. `ordem` é a data ISO do fato. */
function montarItens(n: Novidades): Item[] {
  const ficha = (id: number, nome: string, aba = '') => <Link to={`/parlamentar/${id}${aba}`}>{nome}</Link>;
  const itens: Item[] = [];

  for (const v of n.votosNaSemana) {
    itens.push({
      chave: `semana-${v.pessoaId}-${v.casa}`,
      ordem: n.semana.ate,
      quando: T.semana(dataCurta(n.semana.de).slice(0, 5), dataCurta(n.semana.ate).slice(0, 5)),
      texto: T.votouNaSemana(
        ficha(v.pessoaId, v.nome),
        v.votou,
        v.ausente === null ? null : v.ausente + (v.ausenteJustificado ?? 0),
        v.ausenteJustificado,
      ),
      fonte: ORGAO[v.casa],
    });
  }

  for (const c of n.contraOPartido) {
    itens.push({
      chave: `contra-${c.pessoaId}-${c.votacaoId}`,
      ordem: c.data,
      quando: dataCurta(c.data),
      texto: T.contraOPartido(ficha(c.pessoaId, c.nome), c.voto, c.proposicao, c.bancada, c.partido, c.orientacao, c.descricao),
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
      chave: `troca-${t.pessoaId}`,
      ordem: t.primeiroVoto,
      quando: dataCurta(t.primeiroVoto),
      texto: T.trocou(ficha(t.pessoaId, t.nome), t.partidoNovo, dataCurta(t.primeiroVoto), t.partidoAnterior),
      fonte: ORGAO[t.casa],
    });
  }

  for (const g of n.gastosNaCota) {
    const mes = `${g.ano}-${String(g.mes).padStart(2, '0')}-01`;
    itens.push({
      chave: `cota-${g.pessoaId}-${mes}`,
      ordem: mes,
      quando: mesCurto(mes),
      texto: T.gastouNaCota(
        ficha(g.pessoaId, g.nome, '/cota'),
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
      chave: `emenda-${e.pessoaId}-${e.mes}`,
      ordem: e.mes,
      quando: mesCurto(e.mes),
      texto: T.emendaPaga(ficha(e.pessoaId, e.nome, '/emendas'), reais(e.pago), mesCurto(e.mes), e.maiorDestino, e.lugarDoMaiorDestino),
      fonte: T.portal,
    });
  }

  return itens.sort((a, b) => b.ordem.localeCompare(a.ordem));
}

/** A carga mais recente, em `dd/mm`, ou nulo sem carga registrada. */
function ultimaCarga(n: Novidades): string | null {
  const mais = n.atualizacoes.map((a) => a.ultimaCarga).sort().at(-1);
  return mais ? dataCurta(mais.slice(0, 10)).slice(0, 5) : null;
}
