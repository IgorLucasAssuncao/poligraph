import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmendasDoParlamentar, FinanciamentoDeCampanha } from '../api';
import { nomeProprio, reaisCompacto } from '../formato';
import { TEXTOS_DAS_CONTAS } from '../textos/contasDoParlamentar';

const T = TEXTOS_DAS_CONTAS.grafoDoDinheiro;

/** Largura do desenho em unidades do SVG; a tela o encaixa na largura do modal. */
const LARGURA = 1000;
/** A altura de cada linha de caixa. */
const LINHA = 50;
const TOPO = 40;
const CAIXA = { largura: 250, altura: 40 };
const CENTRO = { largura: 200, altura: 64 };
/** Quantas caixas cada lado mostra antes de juntar o resto em uma caixa só. */
const CAIXAS_POR_LADO = 7;

type Caixa = { nome: string; detalhe: string | null; valor: number; resto?: boolean; /** A página da entidade, quando há. */ destino?: string };

/**
 * O grafo do dinheiro do parlamentar, aberto da aba Emendas da ficha num modal (Pendência 83).
 *
 * DECISÃO (2026-10-03, pedido do autor): o desenho do vídeo que originou a procedência
 * (plano/10 §1): a pessoa no centro, quem deu dinheiro à esquerda com setas chegando, quem
 * recebeu à direita com setas saindo, e o valor escrito em cada seta. Caixas e linhas finas, em
 * vez de faixas coloridas, para ler como documento.
 *
 * ATENÇÃO: Os dois lados são de anos diferentes, e o desenho diz isso: a campanha é a da eleição
 * do mandato; as emendas, do ano da aba. Cada lado fecha com o seu total, com uma caixa para o
 * resto, como a regra do orçamento pede.
 *
 * RISCO: Uma cor só e nenhuma marca de juízo (RNF-16): a seta diz que o dinheiro passou, e nada
 * além disso.
 */
export function GrafoDoDinheiroComponent({
  aberto,
  aoFechar,
  nome,
  descricao,
  campanha,
  emendas,
}: {
  aberto: boolean;
  aoFechar: () => void;
  nome: string;
  descricao: string;
  campanha: FinanciamentoDeCampanha | null;
  emendas: EmendasDoParlamentar;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) {
      if (elemento.showModal) elemento.showModal();
      else elemento.setAttribute('open', '');
    }
    if (!aberto && elemento.open) elemento.close?.();
  }, [aberto]);

  const entrada = campanha && campanha.total > 0 ? caixasDaCampanha(campanha) : [];
  const saida = caixasDasEmendas(emendas);
  const linhas = Math.max(entrada.length, saida.length, 1);
  const altura = TOPO + linhas * LINHA + 4;
  const centroY = TOPO + (linhas * LINHA) / 2 - CENTRO.altura / 2;
  const centroX = (LARGURA - CENTRO.largura) / 2;
  const yDa = (i: number, total: number) => TOPO + ((linhas - total) * LINHA) / 2 + i * LINHA + (LINHA - CAIXA.altura) / 2;

  return (
    <dialog
      ref={dialogo}
      className="grafo-dinheiro"
      aria-labelledby="titulo-grafo-dinheiro"
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && aoFechar()}
    >
      <header className="grafo-dinheiro-topo">
        <div>
          <p className="grafo-dinheiro-sobre">{T.sobre}</p>
          <h2 id="titulo-grafo-dinheiro">{nome}</h2>
        </div>
        <button type="button" className="botao-icone" aria-label={T.fechar} onClick={aoFechar}>
          ✕
        </button>
      </header>

      <div className="grafo-dinheiro-corpo">
        <svg viewBox={`0 0 ${LARGURA} ${altura}`} role="img" aria-label={descreverParaLeitor(nome, campanha, entrada, emendas, saida)}>
          <defs>
            <marker id="grafo-dinheiro-ponta" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,1 L10,5 L0,9 z" className="grafo-dinheiro-ponta" />
            </marker>
          </defs>

          {campanha && entrada.length > 0 && (
            <text x={30} y={16} className="grafo-dinheiro-coluna">
              {T.campanha(campanha.anoEleicao, reaisCompacto(campanha.total))}
            </text>
          )}
          <text x={LARGURA - 30} y={16} textAnchor="end" className="grafo-dinheiro-coluna">
            {T.emendas(emendas.anoDaEmenda, reaisCompacto(emendas.favorecidos.recebido))}
          </text>

          {entrada.map((c, i) => {
            const y = yDa(i, entrada.length);
            const x1 = 30 + CAIXA.largura;
            const y1 = y + CAIXA.altura / 2;
            const x2 = centroX;
            const y2 = centroY + CENTRO.altura / 2;
            return (
              <g key={`e-${c.nome}`}>
                <SetaComponent x1={x1} y1={y1} x2={x2} y2={y2} valor={c.valor} rotulo={{ x: x1 + 8, y: y1 - 6, ancora: 'start' }} />
                <CaixaComponent x={30} y={y} caixa={c} />
              </g>
            );
          })}

          {saida.map((c, i) => {
            const y = yDa(i, saida.length);
            const x1 = centroX + CENTRO.largura;
            const y1 = centroY + CENTRO.altura / 2;
            const x2 = LARGURA - 30 - CAIXA.largura;
            const y2 = y + CAIXA.altura / 2;
            return (
              <g key={`s-${c.nome}`}>
                <SetaComponent x1={x1} y1={y1} x2={x2} y2={y2} valor={c.valor} rotulo={{ x: x2 - 12, y: y2 - 6, ancora: 'end' }} />
                <CaixaComponent x={LARGURA - 30 - CAIXA.largura} y={y} caixa={c} />
              </g>
            );
          })}

          <g className="grafo-dinheiro-centro">
            <rect x={centroX} y={centroY} width={CENTRO.largura} height={CENTRO.altura} />
            <text x={LARGURA / 2} y={centroY + 26} textAnchor="middle" className="grafo-dinheiro-nome">
              {encurtar(nome, 26)}
            </text>
            <text x={LARGURA / 2} y={centroY + 46} textAnchor="middle" className="grafo-dinheiro-detalhe">
              {descricao}
            </text>
          </g>
        </svg>

        <p className="ajuda">{T.ajuda}</p>
      </div>
    </dialog>
  );
}

/**
 * Uma seta reta entre a caixa e o centro. O valor fica junto da caixa: no meio das setas, onde
 * elas se juntam perto do centro, os números se encavalavam.
 */
function SetaComponent({
  x1,
  y1,
  x2,
  y2,
  valor,
  rotulo,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  valor: number;
  rotulo: { x: number; y: number; ancora: 'start' | 'end' };
}) {
  return (
    <g className="grafo-dinheiro-seta">
      <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#grafo-dinheiro-ponta)" />
      <text x={rotulo.x} y={rotulo.y} textAnchor={rotulo.ancora}>
        {reaisCompacto(valor)}
      </text>
    </g>
  );
}

/**
 * Uma caixa de um lado: o nome e, embaixo, o detalhe (a cidade, "pessoa física"). A entidade com
 * página leva a ela, o mesmo link da lista "Quem recebeu".
 */
function CaixaComponent({ x, y, caixa }: { x: number; y: number; caixa: Caixa }) {
  const navegar = useNavigate();
  const conteudo = (
    <g className={`grafo-dinheiro-caixa${caixa.resto ? ' grafo-dinheiro-resto' : ''}`}>
      <rect x={x} y={y} width={CAIXA.largura} height={CAIXA.altura} />
      <text x={x + 10} y={y + 17}>{encurtar(caixa.nome, 36)}</text>
      {caixa.detalhe && (
        <text x={x + 10} y={y + 32} className="grafo-dinheiro-detalhe">
          {encurtar(caixa.detalhe, 40)}
        </text>
      )}
    </g>
  );
  if (!caixa.destino) return conteudo;
  const destino = caixa.destino;
  return (
    <a
      href={destino}
      className="grafo-dinheiro-link"
      aria-label={T.abrirEntidade(caixa.nome)}
      onClick={(e) => {
        e.preventDefault();
        void navegar(destino);
      }}
    >
      {conteudo}
    </a>
  );
}

/** As receitas da campanha: os maiores doadores e uma caixa com o resto, que fecha com o total. */
function caixasDaCampanha(campanha: FinanciamentoDeCampanha): Caixa[] {
  const maiores = campanha.maioresDoadores.slice(0, CAIXAS_POR_LADO);
  const caixas: Caixa[] = maiores.map((d) => ({
    nome: nomeProprio(d.nome),
    detalhe: d.pessoaFisica ? T.pessoaFisica : null,
    valor: d.total,
  }));
  const resto = campanha.total - maiores.reduce((s, d) => s + d.total, 0);
  if (resto > 0.5) caixas.push({ nome: T.outrasReceitas, detalhe: T.restoDoArrecadado, valor: resto, resto: true });
  return caixas;
}

/** Quem recebeu as emendas: os maiores, e o que fica fora da lista, cada parte com o nome dela. */
function caixasDasEmendas(emendas: EmendasDoParlamentar): Caixa[] {
  const f = emendas.favorecidos;
  const maiores = f.maiores.slice(0, CAIXAS_POR_LADO);
  const caixas: Caixa[] = maiores.map((m) => ({
    nome: nomeProprio(m.nome),
    detalhe: m.municipio ? `${nomeProprio(m.municipio)}${m.uf ? ` – ${m.uf}` : ''}` : m.uf,
    valor: m.recebido,
    destino: m.cnpj ? `/entidades/${m.cnpj}` : undefined,
  }));
  const fora = f.viaIntermediario + f.aPessoas + f.semIdentificacao;
  const outros = f.recebido - maiores.reduce((s, m) => s + m.recebido, 0) - fora;
  if (outros > 0.5) caixas.push({ nome: T.outrosRecebedores, detalhe: null, valor: outros, resto: true });
  if (f.viaIntermediario > 0)
    caixas.push({ nome: T.repassePorBanco, detalhe: T.destinoForaDoDado, valor: f.viaIntermediario, resto: true });
  if (f.aPessoas + f.semIdentificacao > 0)
    caixas.push({ nome: T.pessoasESemIdentificacao, detalhe: null, valor: f.aPessoas + f.semIdentificacao, resto: true });
  return caixas;
}

/** O desenho em uma frase, para o leitor de tela. */
function descreverParaLeitor(
  nome: string,
  campanha: FinanciamentoDeCampanha | null,
  entrada: Caixa[],
  emendas: EmendasDoParlamentar,
  saida: Caixa[],
): string {
  const recebeu = entrada.map((c) => T.item(c.nome, reaisCompacto(c.valor))).join('; ');
  const mandou = saida.map((c) => T.item(c.nome, reaisCompacto(c.valor))).join('; ');
  return (campanha && entrada.length ? T.leitorCampanha(campanha.anoEleicao, nome, recebeu) : '') + T.leitorEmendas(emendas.anoDaEmenda, mandou);
}

function encurtar(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}
