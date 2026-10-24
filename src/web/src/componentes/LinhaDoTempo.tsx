import { useState } from 'react';
import { Link } from 'react-router-dom';
import { obterLinhaDoTempo, type Marco } from '../api';
import { nomeProprio, reaisCompacto } from '../formato';
import { TEXTOS_DA_LINHA_DO_TEMPO as T } from '../textos/linhaDoTempo';
import { NOMES_DOS_CARGOS, descricaoDoMandato } from '../textos/politicos';
import { anosComCiclos, ciclosDaLinha } from './ciclosDaLinhaDoTempo';
import { EsqueletoDeTextoComponent } from './Esqueleto';
import { useCarga } from './useCarga';

/**
 * A linha do tempo da pessoa, numa linha horizontal: do ano mais antigo, à esquerda, ao mais recente, à direita (Pendência 92).
 *
 * DECISÃO (autor, 2026-10-24): uma linha só, na largura do espaço, sem rolagem lateral, como os nós de um grafo ligados por
 * uma aresta. Cada ano com dado é um nó, maior quanto mais a base tem dele; os mandatos são faixas acima da linha, do ano de
 * início ao de fim, em dois tons que se alternam. O nó escolhido mostra embaixo o que a base tem daquele ano, e as setas andam
 * de um ano com dado ao outro. Abre no mais recente.
 *
 * DECISÃO: Cada marco é o resumo que a aba já mostra, e leva a ela. A linha junta; não traz número novo.
 *
 * `abas` é a raiz da ficha do parlamentar. Sem ela (ficha do político), os marcos não viram link:
 * quem não votou no Congresso não tem as abas de cota e emendas.
 */
export function LinhaDoTempoComponent({ idPessoa, abas }: { idPessoa: number; abas?: string }) {
  const lida = useCarga(['linha-do-tempo', idPessoa], () => obterLinhaDoTempo(idPessoa));
  const [escolhido, setEscolhido] = useState<number | null>(null);

  if (lida.erro) return <p className="erro">{T.erro}</p>;
  if (!lida.dados) return <EsqueletoDeTextoComponent rotulo={T.carregando} />;
  if (lida.dados.anos.length === 0) return <p className="vazio">{T.vazio}</p>;

  const anos = anosComCiclos(lida.dados, new Date().getFullYear());
  const comDado = anos.filter((a) => a.marcos.length > 0);
  const primeiro = anos[0].ano;
  const ultimo = anos[anos.length - 1].ano;
  const vao = Math.max(ultimo - primeiro + 1, 1);
  const posicao = (ano: number) => ((ano - primeiro + 0.5) / vao) * 100;
  const atual = comDado.find((a) => a.ano === escolhido) ?? comDado[comDado.length - 1];
  const indice = comDado.indexOf(atual);
  const passo = vao > 24 ? 4 : vao > 12 ? 2 : 1;
  const maisMarcos = Math.max(...comDado.map((a) => a.marcos.length), 1);
  const ciclos = ciclosDaLinha(lida.dados).filter((c) => c.mandato.primeiroAno <= ultimo);

  return (
    <section className="aba-dinheiro" aria-labelledby="linha-do-tempo-titulo">
      <h2 id="linha-do-tempo-titulo" className="titulo-secao">
        {T.titulo}
      </h2>
      <p className="ajuda">{T.ajuda}</p>

      <div className="linha-horizontal">
        <div className="linha-horizontal-faixas" aria-hidden="true">
          {ciclos.map((c) => {
            const fim = Math.min(c.mandato.ultimoAno, ultimo);
            return (
              <span
                key={`${c.mandato.anoEleicao}-${c.mandato.cargo}`}
                className={`linha-horizontal-faixa ciclo-${c.ordem % 2}`}
                style={{
                  left: `${((c.mandato.primeiroAno - primeiro) / vao) * 100}%`,
                  width: `${((fim - c.mandato.primeiroAno + 1) / vao) * 100}%`,
                }}
                title={descricaoDoMandato(c.mandato, nomeProprio)}
              >
                {NOMES_DOS_CARGOS[c.mandato.cargo]}
              </span>
            );
          })}
        </div>
        <div className="linha-horizontal-eixo">
          {comDado.map((a) => (
            <button
              key={a.ano}
              type="button"
              className={`linha-horizontal-ponto${a === atual ? ' escolhido' : ''}${a.ciclo ? ` ciclo-${a.ciclo.ordem % 2}` : ''}`}
              style={{ left: `${posicao(a.ano)}%`, '--tamanho': `${10 + 8 * (a.marcos.length / maisMarcos)}px` } as React.CSSProperties}
              aria-pressed={a === atual}
              aria-label={T.ponto(a.ano, a.marcos.length)}
              onClick={() => setEscolhido(a.ano)}
            />
          ))}
        </div>
        <div className="linha-horizontal-anos" aria-hidden="true">
          {anos
            .filter((a) => a === atual || (a !== atual && (a.ano - primeiro) % passo === 0 && Math.abs(a.ano - atual.ano) >= passo))
            .map((a) => (
              <span key={a.ano} className={a === atual ? 'escolhido' : ''} style={{ left: `${posicao(a.ano)}%` }}>
                {a.ano}
              </span>
            ))}
        </div>
      </div>

      <div className="linha-horizontal-detalhe" aria-live="polite">
        <div className="linha-horizontal-navegar">
          <button
            type="button"
            className="botao-secundario"
            disabled={indice <= 0}
            onClick={() => setEscolhido(comDado[indice - 1].ano)}
          >
            {T.anterior}
          </button>
          <h3>
            {atual.ano}
            {atual.ciclo && (
              <small>
                {atual.inicio ? T.inicio : atual.fim ? T.fim : ''}
                {descricaoDoMandato(atual.ciclo.mandato, nomeProprio)}
              </small>
            )}
          </h3>
          <button
            type="button"
            className="botao-secundario"
            disabled={indice >= comDado.length - 1}
            onClick={() => setEscolhido(comDado[indice + 1].ano)}
          >
            {T.seguinte}
          </button>
        </div>
        <ul className="linha-do-tempo-marcos">
          {atual.marcos.map((m, k) => (
            <li key={`${m.tipo}-${k}`}>
              <MarcoComponent marco={m} abas={abas} />
            </li>
          ))}
        </ul>
      </div>
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
      return marco.foraDoPadrao ? (
        <>
          {T.bens(<strong className="numero-fora-do-padrao">{valor}</strong>, marco.quantidade ?? 0)}
          <small className="aviso-fora-do-padrao">{T.bensForaDoPadrao}</small>
        </>
      ) : (
        <>{T.bens(valor, marco.quantidade ?? 0)}</>
      );
    case 'GASTOU_NA_COTA':
      return comLink(T.cota(valor), '/cota');
    case 'EMENDAS_PAGAS':
      return comLink(T.emendas(valor, reaisCompacto(marco.pago ?? 0)), '/emendas');
  }
}
