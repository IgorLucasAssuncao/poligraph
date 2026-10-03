import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obterFluxoDeEmendas, type FluxoDeEmendas, type NoDoFluxo, type Periodo } from '../api';
import { reais, reaisCompacto } from '../formato';
import { BlocoComponent, EsqueletoComponent } from './Esqueleto';

/** Largura do desenho em unidades do SVG; a tela o encaixa na largura disponível. */
const LARGURA = 1000;
const ALTURA = 640;
const ESPACO_ENTRE_NOS = 8;
const LARGURA_DO_NO = 14;
/** Onde fica cada coluna: quem mandou, quem recebeu, cidade. */
const X_DA_COLUNA = [230, 500, 770];
const TITULOS = ['Quem mandou', 'Quem recebeu', 'Cidade da sede'];

type Posicionado = NoDoFluxo & { y: number; altura: number };

/**
 * A visualização avançada das emendas (Pendência 83): um grafo direcionado em três colunas,
 * quem mandou → quem recebeu → cidade da sede, com a espessura de cada seta proporcional ao valor.
 *
 * DECISÃO: Colunas fixas, e não um grafo de molas: a direção do dinheiro é a informação, e ela
 * se lê da esquerda para a direita. Os menores de cada coluna chegam juntos em "outros", e o que
 * não tem destino (repasse por banco, pessoas, sem cidade) é nó próprio, então cada coluna soma o
 * mesmo total que a página mostra.
 *
 * ATENÇÃO: Uma cor só, a do realce (RNF-16): cor por partido sugeriria espectro político.
 */
export function FluxoDeEmendasComponent({ periodo, uf }: { periodo: Periodo; uf: string | null }) {
  const [fluxo, setFluxo] = useState<FluxoDeEmendas | null>(null);
  const [erro, setErro] = useState(false);
  const [destacado, setDestacado] = useState<string | null>(null);
  const [comoTabela, setComoTabela] = useState(false);
  const navegar = useNavigate();

  useEffect(() => {
    let atual = true;
    setFluxo(null);
    setErro(false);
    obterFluxoDeEmendas(periodo, uf)
      .then((f) => atual && setFluxo(f))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [periodo, uf]);

  const desenho = useMemo(() => (fluxo ? posicionar(fluxo) : null), [fluxo]);

  if (erro) return <p className="erro">Não foi possível montar o caminho do dinheiro agora.</p>;
  if (!fluxo || !desenho) {
    return (
      <EsqueletoComponent rotulo="Montando o caminho do dinheiro">
        <BlocoComponent altura={420} />
      </EsqueletoComponent>
    );
  }
  if (fluxo.total === 0) return <p className="vazio">Nenhum pagamento de emenda neste recorte.</p>;

  const ligadas = (id: string) => destacado === null || id === destacado;

  return (
    <div className="fluxo">
      <p className="ajuda">
        {reaisCompacto(fluxo.total)} pagos {uf ? `a quem tem sede em ${uf}` : 'no período'}. Cada seta vai de quem
        mandou o dinheiro para quem recebeu, e de quem recebeu para a cidade onde tem sede; a espessura é o valor.
        Passe o mouse sobre um nome para seguir só o caminho dele, e clique para abrir a página.
      </p>

      <button type="button" className="botao-secundario" onClick={() => setComoTabela((t) => !t)}>
        {comoTabela ? 'Ver o desenho' : 'Ver como tabela'}
      </button>

      {comoTabela ? (
        <TabelaDoFluxoComponent fluxo={fluxo} />
      ) : (
        <div className="fluxo-desenho">
          <svg viewBox={`0 0 ${LARGURA} ${ALTURA + 40}`} role="img" aria-label={`Caminho do dinheiro de emenda: ${fluxo.nos.length} nós e ${fluxo.arestas.length} setas`}>
            <defs>
              <marker id="fluxo-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" className="fluxo-ponta" />
              </marker>
            </defs>

            {TITULOS.map((titulo, i) => (
              <text key={titulo} x={X_DA_COLUNA[i] + LARGURA_DO_NO / 2} y={14} textAnchor="middle" className="fluxo-titulo">
                {titulo}
              </text>
            ))}

            <g transform="translate(0, 30)">
              {desenho.arestas.map((a) => (
                <path
                  key={`${a.de}>${a.para}`}
                  d={a.caminho}
                  strokeWidth={a.espessura}
                  markerEnd="url(#fluxo-seta)"
                  className={`fluxo-aresta${ligadas(a.de) || ligadas(a.para) ? '' : ' fluxo-apagada'}`}
                >
                  <title>{`${a.rotuloDe} → ${a.rotuloPara}: ${reais(a.valor)}`}</title>
                </path>
              ))}

              {desenho.nos.map((n) => (
                <g
                  key={n.id}
                  className={`fluxo-no fluxo-${n.tipo}${n.destino ? ' fluxo-clicavel' : ''}`}
                  onMouseEnter={() => setDestacado(n.id)}
                  onMouseLeave={() => setDestacado(null)}
                  onClick={() => n.destino && navegar(n.destino)}
                >
                  <rect x={X_DA_COLUNA[n.coluna]} y={n.y} width={LARGURA_DO_NO} height={n.altura} />
                  <text
                    x={n.coluna === 0 ? X_DA_COLUNA[0] - 6 : X_DA_COLUNA[n.coluna] + LARGURA_DO_NO + 6}
                    y={n.y + n.altura / 2}
                    textAnchor={n.coluna === 0 ? 'end' : 'start'}
                    dominantBaseline="middle"
                  >
                    {encurtar(n.rotulo, n.coluna === 1 ? 30 : 34)} · {reaisCompacto(n.valor)}
                  </text>
                  <title>{`${n.rotulo}: ${reais(n.valor)}`}</title>
                </g>
              ))}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}

/** A mesma informação em tabela: para o leitor de tela, e para quem quer copiar os valores. */
function TabelaDoFluxoComponent({ fluxo }: { fluxo: FluxoDeEmendas }) {
  const rotulos = new Map(fluxo.nos.map((n) => [n.id, n.rotulo]));

  return (
    <div className="tabela-rolavel">
      <table className="tabela-orcamento">
        <caption className="sr-apenas">Caminho do dinheiro de emenda, seta por seta</caption>
        <thead>
          <tr>
            <th scope="col">De</th>
            <th scope="col">Para</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {fluxo.arestas.map((a) => (
            <tr key={`${a.de}>${a.para}`}>
              <td>{rotulos.get(a.de)}</td>
              <td>{rotulos.get(a.para)}</td>
              <td>{reaisCompacto(a.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Põe cada nó na sua coluna, com altura proporcional ao valor, e calcula as setas empilhadas na
 * saída e na chegada de cada nó, como num diagrama de Sankey.
 */
function posicionar(fluxo: FluxoDeEmendas) {
  const nos = new Map<string, Posicionado>();
  for (const coluna of [0, 1, 2]) {
    const daColuna = fluxo.nos.filter((n) => n.coluna === coluna);
    const total = daColuna.reduce((s, n) => s + n.valor, 0) || 1;
    const util = ALTURA - ESPACO_ENTRE_NOS * Math.max(daColuna.length - 1, 0);
    let y = 0;
    for (const n of daColuna) {
      const altura = Math.max((n.valor / total) * util, 2);
      nos.set(n.id, { ...n, y, altura });
      y += altura + ESPACO_ENTRE_NOS;
    }
  }

  const escala = (id: string) => {
    const n = nos.get(id)!;
    return n.altura / (n.valor || 1);
  };
  const saida = new Map<string, number>();
  const chegada = new Map<string, number>();

  const arestas = fluxo.arestas
    .filter((a) => nos.has(a.de) && nos.has(a.para))
    .map((a) => {
      const de = nos.get(a.de)!;
      const para = nos.get(a.para)!;
      const espessuraDe = a.valor * escala(a.de);
      const espessuraPara = a.valor * escala(a.para);
      const y1 = de.y + (saida.get(a.de) ?? 0) + espessuraDe / 2;
      const y2 = para.y + (chegada.get(a.para) ?? 0) + espessuraPara / 2;
      saida.set(a.de, (saida.get(a.de) ?? 0) + espessuraDe);
      chegada.set(a.para, (chegada.get(a.para) ?? 0) + espessuraPara);
      const x1 = X_DA_COLUNA[de.coluna] + LARGURA_DO_NO;
      const x2 = X_DA_COLUNA[para.coluna] - 2;
      const meio = (x1 + x2) / 2;
      return {
        de: a.de,
        para: a.para,
        valor: a.valor,
        rotuloDe: de.rotulo,
        rotuloPara: para.rotulo,
        espessura: Math.max(Math.min(espessuraDe, espessuraPara), 1),
        caminho: `M${x1},${y1} C${meio},${y1} ${meio},${y2} ${x2},${y2}`,
      };
    });

  return { nos: [...nos.values()], arestas };
}

function encurtar(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}
