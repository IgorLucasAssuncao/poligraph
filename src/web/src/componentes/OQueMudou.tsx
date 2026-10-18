import { useEffect, useState } from 'react';
import { obterNovidades } from '../api';
import type { Novidades } from '../api';
import { NOVIDADES_A_VISTA } from '../constantes';
import { BotaoMostrarMaisComponent } from './BotaoMostrarMais';
import { montarItens, ultimaCarga } from './itensDoQueMudou';
import { ListaDeNovidadesComponent } from './ListaDeNovidades';
import { TEXTOS_DO_QUE_MUDOU as T } from '../textos/oQueMudou';

/**
 * "O que mudou" (Pendência 63): os cinco avisos sobre quem a pessoa segue, um item por fato, do
 * mais recente. Especificação em `docs/plano/09 §4.1`.
 *
 * DECISÃO: Fato registrado pela casa, sem adjetivo e sem ranking (RNF-16). "Votou contra o
 * partido" diz o voto e a orientação; não diz "traiu".
 *
 * ATENÇÃO: A data de cada item é a do dado. Sem novidade, a tela diz de quando é a carga: a base
 * não é de hoje, e "sem novidades hoje" afirmaria uma atualidade que ela não tem.
 *
 * DECISÃO do autor (2026-10-18): na coluna da direita do início, com as dez primeiras e "Mostrar
 * mais". No meio da página, a lista inteira empurrava o resto para baixo.
 */
export function OQueMudouComponent() {
  const [novidades, setNovidades] = useState<Novidades | null>(null);
  const [erro, setErro] = useState(false);
  const [aVista, setAVista] = useState(NOVIDADES_A_VISTA);

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
  const restantes = Math.max(itens.length - aVista, 0);

  return (
    <section className="painel-secao o-que-mudou" aria-labelledby="titulo-o-que-mudou">
      <h2 id="titulo-o-que-mudou">{T.titulo}</h2>

      {itens.length === 0 ? (
        <p className="vazio">{T.nadaNovo(carga)}</p>
      ) : (
        <>
          <ListaDeNovidadesComponent itens={itens.slice(0, aVista)} />
          <BotaoMostrarMaisComponent
            proximos={Math.min(NOVIDADES_A_VISTA, restantes)}
            restantes={restantes}
            carregando={false}
            erro={false}
            aoClicar={() => setAVista((n) => n + NOVIDADES_A_VISTA)}
          />
        </>
      )}
    </section>
  );
}
