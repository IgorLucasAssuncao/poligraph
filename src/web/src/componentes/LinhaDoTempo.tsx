import { Link } from 'react-router-dom';
import { obterLinhaDoTempo, type Marco } from '../api';
import { nomeProprio, reaisCompacto } from '../formato';
import { TEXTOS_DA_LINHA_DO_TEMPO as T } from '../textos/linhaDoTempo';
import { descricaoDoMandato } from '../textos/politicos';
import { EsqueletoDeTextoComponent } from './Esqueleto';
import { useCarga } from './useCarga';

/**
 * A linha do tempo da pessoa: um ano por linha, do mais recente, com o que a base tem daquele ano (Pendência 92).
 *
 * DECISÃO: Cada marco é o resumo que a aba já mostra, e leva a ela. A linha junta; não traz número novo.
 *
 * `abas` é a raiz da ficha do parlamentar. Sem ela (ficha do político), os marcos não viram link:
 * quem não votou no Congresso não tem as abas de cota e emendas.
 */
export function LinhaDoTempoComponent({ idPessoa, abas }: { idPessoa: number; abas?: string }) {
  const lida = useCarga(['linha-do-tempo', idPessoa], () => obterLinhaDoTempo(idPessoa));

  if (lida.erro) return <p className="erro">{T.erro}</p>;
  if (!lida.dados) return <EsqueletoDeTextoComponent rotulo={T.carregando} />;
  if (lida.dados.anos.length === 0) return <p className="vazio">{T.vazio}</p>;

  return (
    <section className="aba-dinheiro" aria-labelledby="linha-do-tempo-titulo">
      <h2 id="linha-do-tempo-titulo" className="titulo-secao">
        {T.titulo}
      </h2>
      <p className="ajuda">{T.ajuda}</p>
      <ol className="linha-do-tempo">
        {lida.dados.anos.map(({ ano, marcos }) => (
          <li key={ano} className="linha-do-tempo-ano">
            <span className="linha-do-tempo-rotulo">{ano}</span>
            <ul className="linha-do-tempo-marcos">
              {marcos.map((m, i) => (
                <li key={`${m.tipo}-${i}`}>
                  <MarcoComponent marco={m} abas={abas} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="nota-curta">{T.fontes}</p>
    </section>
  );
}

function MarcoComponent({ marco, abas }: { marco: Marco; abas?: string }) {
  const valor = marco.valor != null ? reaisCompacto(marco.valor) : '';
  const comLink = (texto: string, aba: string) => (abas ? <Link to={`${abas}${aba}`}>{texto}</Link> : texto);

  switch (marco.tipo) {
    case 'ELEITO':
      return <>{T.eleito(marco.mandato ? descricaoDoMandato(marco.mandato, nomeProprio) : '', marco.mandato?.partido ?? '')}</>;
    case 'TROCOU_DE_PARTIDO':
      return <>{T.trocou(marco.partidoAnterior ?? '', marco.partido ?? '')}</>;
    case 'VOTOU':
      return comLink(T.votou(marco.quantidade ?? 0), '');
    case 'DECLAROU_BENS':
      return <>{T.bens(valor, marco.quantidade ?? 0)}</>;
    case 'GASTOU_NA_COTA':
      return comLink(T.cota(valor), '/cota');
    case 'EMENDAS_PAGAS':
      return comLink(T.emendas(valor, reaisCompacto(marco.pago ?? 0)), '/emendas');
  }
}
