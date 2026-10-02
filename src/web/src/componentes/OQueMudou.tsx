import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { obterNovidades } from '../api';
import type { Casa, Novidades } from '../api';
import { dataCurta, mesCurto, minusculas, reais } from '../formato';
import { LinkDeFonte } from './LinkDeFonte';

/**
 * "O que mudou" (PL63): os cinco avisos sobre quem a pessoa segue, um item por fato, do
 * mais recente. Especificação em `docs/plano/09 §4.1`.
 *
 * DECISÃO: Fato registrado pela casa, sem adjetivo e sem ranking (RNF-16). "Votou contra o
 * partido" diz o voto e a orientação; não diz "traiu".
 *
 * ATENÇÃO: A data de cada item é a do dado, e a tela diz de quando é a carga: a base não é
 * de hoje, e "sem novidades hoje" afirmaria uma atualidade que ela não tem.
 */
export function OQueMudou() {
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
      <h2 id="titulo-o-que-mudou">O que mudou</h2>
      <p className="ajuda">
        Sobre quem você segue. Votos de {dataCurta(novidades.semana.de)} a {dataCurta(novidades.semana.ate)}
        {carga && <>; base atualizada em {carga}</>}.
      </p>

      {itens.length === 0 ? (
        <p className="vazio">Nada novo desde a última atualização{carga ? `, em ${carga}` : ''}.</p>
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

const ORGAO: Record<Casa, string> = { CAMARA: 'Câmara dos Deputados', SENADO: 'Senado Federal' };

/** Os cinco avisos num feed só, do mais recente. `ordem` é a data ISO do fato. */
function montarItens(n: Novidades): Item[] {
  const ficha = (id: number, nome: string, aba = '') => <Link to={`/parlamentar/${id}${aba}`}>{nome}</Link>;
  const itens: Item[] = [];

  for (const v of n.votosNaSemana) {
    itens.push({
      chave: `semana-${v.pessoaId}-${v.casa}`,
      ordem: n.semana.ate,
      quando: `${dataCurta(n.semana.de).slice(0, 5)} a ${dataCurta(n.semana.ate).slice(0, 5)}`,
      texto: (
        <>
          {ficha(v.pessoaId, v.nome)} votou em <strong>{v.votou}</strong>{' '}
          {v.votou === 1 ? 'votação' : 'votações'} de plenário
          {v.ausente !== null && v.ausente + (v.ausenteJustificado ?? 0) > 0 && (
            <>
              ; ausente em <strong>{v.ausente + (v.ausenteJustificado ?? 0)}</strong>
              {v.ausenteJustificado ? ` (${v.ausenteJustificado} com justificativa)` : ''}
            </>
          )}
          .
        </>
      ),
      fonte: ORGAO[v.casa],
    });
  }

  for (const c of n.contraOPartido) {
    itens.push({
      chave: `contra-${c.pessoaId}-${c.votacaoId}`,
      ordem: c.data,
      quando: dataCurta(c.data),
      texto: (
        <>
          {ficha(c.pessoaId, c.nome)} votou <strong>{c.voto}</strong>
          {c.proposicao ? <> na {c.proposicao}</> : ''}; a bancada {c.bancada}, do {c.partido}, orientou{' '}
          <strong>{c.orientacao}</strong>.
          {c.descricao && <span className="novidade-detalhe">{c.descricao}</span>}
        </>
      ),
      fonte: (
        <>
          {ORGAO.CAMARA}
          {c.urlFonte && (
            <>
              {' · '}
              <LinkDeFonte href={c.urlFonte}>registro da votação</LinkDeFonte>
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
      texto: (
        <>
          {ficha(t.pessoaId, t.nome)} votou pelo <strong>{t.partidoNovo}</strong> a partir de{' '}
          {dataCurta(t.primeiroVoto)}; antes, pelo {t.partidoAnterior}.
        </>
      ),
      fonte: ORGAO[t.casa],
    });
  }

  for (const g of n.gastosNaCota) {
    const mes = `${g.ano}-${String(g.mes).padStart(2, '0')}-01`;
    itens.push({
      chave: `cota-${g.pessoaId}-${mes}`,
      ordem: mes,
      quando: mesCurto(mes),
      texto: (
        <>
          {ficha(g.pessoaId, g.nome, '/cota')} gastou <strong>{reais(g.total)}</strong> da cota em{' '}
          {mesCurto(mes)}; o maior gasto, {reais(g.maiorCategoriaValor)} com {minusculas(g.maiorCategoria)}.
        </>
      ),
      fonte: g.casa ? `${ORGAO[g.casa]} · ${g.casa === 'SENADO' ? 'CEAPS' : 'CEAP'}` : 'Cota parlamentar',
    });
  }

  for (const e of n.emendasPagas) {
    itens.push({
      chave: `emenda-${e.pessoaId}-${e.mes}`,
      ordem: e.mes,
      quando: mesCurto(e.mes),
      texto: (
        <>
          {ficha(e.pessoaId, e.nome, '/emendas')}: <strong>{reais(e.pago)}</strong> pagos em emendas em{' '}
          {mesCurto(e.mes)}
          {e.maiorDestino && (
            <>
              ; o maior valor para {e.maiorDestino}
              {e.lugarDoMaiorDestino ? `, ${e.lugarDoMaiorDestino}` : ''}
            </>
          )}
          .
        </>
      ),
      fonte: 'Portal da Transparência',
    });
  }

  return itens.sort((a, b) => b.ordem.localeCompare(a.ordem));
}

/** A carga mais recente, em `dd/mm`, ou nulo sem carga registrada. */
function ultimaCarga(n: Novidades): string | null {
  const mais = n.atualizacoes.map((a) => a.ultimaCarga).sort().at(-1);
  return mais ? dataCurta(mais.slice(0, 10)).slice(0, 5) : null;
}
