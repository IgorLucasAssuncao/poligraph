import { useEffect, useState } from 'react';
import { obterNovidades } from '../api';
import type { Novidades } from '../api';
import { dataCurta } from '../formato';
import { montarItens, ultimaCarga } from './itensDoQueMudou';
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
