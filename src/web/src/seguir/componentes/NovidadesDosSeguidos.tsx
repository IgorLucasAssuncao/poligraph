import { useState } from 'react';
import { TEXTOS_DO_QUE_MUDOU as T } from '../textos/oQueMudou';
import { IconeSinoComponent } from '../../comum/componentes/Icones';
import { ModalDeNovidadesComponent } from './ModalDeNovidades';
import { novidadesQueContam, useNovidadesVistas } from './useNovidadesVistas';
import { useNovidades } from './useNovidades';
import './novidades.css';

/**
 * As novidades de quem a pessoa segue, no início (Pendências 63 e 89): um cartão que abre o modal
 * agrupado por parlamentar.
 *
 * DECISÃO do autor (2026-10-18): fechado até a pessoa clicar, e no tom de realce quando há algo
 * que este navegador ainda não mostrou. A lista aberta na coluna ocupava espaço para quem só
 * queria saber se havia algo novo. O nome "O que mudou" saiu: não dizia de quem.
 *
 * DECISÃO: Fato registrado pela casa, sem adjetivo e sem ranking (RNF-16). "Votou contra o
 * partido" diz o voto e a orientação; não diz "traiu".
 *
 * RISCO: O dado diz quem a pessoa segue, então fica fora do cache de leituras.
 */
export function NovidadesDosSeguidosComponent() {
  const { novidades, erro } = useNovidades(true);
  const [aberto, setAberto] = useState(false);
  const { vistas, marcar } = useNovidadesVistas();

  if (erro || !novidades) return null;

  const contam = novidadesQueContam(novidades);
  const novas = contam.filter((item) => !vistas.includes(item.chave)).length;

  return (
    <section className="painel-secao novidades-seguidos">
      <button
        type="button"
        className={novas > 0 ? 'novidades-cartao com-novas' : 'novidades-cartao'}
        aria-haspopup="dialog"
        onClick={() => setAberto(true)}
      >
        <IconeSinoComponent className="novidades-cartao-icone" />
        <span className="novidades-cartao-texto">
          <strong>{T.titulo}</strong>
          <span>{novas > 0 ? T.cartao.novas(novas) : T.cartao.semNovas}</span>
        </span>
        <span className="novidades-cartao-abrir">{T.cartao.abrir}</span>
      </button>

      <ModalDeNovidadesComponent
        aberto={aberto}
        novidades={novidades}
        vistas={vistas}
        aoFechar={() => {
          setAberto(false);
          marcar(contam.map((item) => item.chave));
        }}
      />
    </section>
  );
}
