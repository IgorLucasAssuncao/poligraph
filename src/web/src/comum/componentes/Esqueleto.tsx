import type { CSSProperties, ReactNode } from 'react';
import { TEXTOS_DO_SITE as T } from '../../site/textos/site';

/**
 * O lugar do conteúdo enquanto ele chega: blocos cinza na forma do que vem, com um
 * brilho que atravessa.
 *
 * DECISÃO: Forma, não "Carregando…": o texto dizia que algo vinha, mas não onde nem de que
 * tamanho. Com o bloco no lugar certo, a página não pula quando o dado chega, e o olho já
 * está no lugar da resposta.
 *
 * RISCO: Nunca conteúdo de exemplo. Numa ferramenta que credita a procedência de cada
 * número, inventar nome, valor ou manchete para ilustrar o layout seria produzir na tela
 * o que o trabalho existe para não fazer. As barras mostram a forma sem afirmar nada.
 *
 * ♿ O leitor de tela não vê cinza: `role="status"` com o texto escondido diz o que está
 * vindo, e o resto é `aria-hidden`.
 */
export function EsqueletoComponent({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="esqueleto-area" role="status" aria-busy="true">
      <span className="so-leitor">{rotulo}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** Uma barra de texto. `largura` em % da linha: variar as larguras é o que lê como texto. */
export function BarraComponent({ largura = 100, alta = false }: { largura?: number; alta?: boolean }) {
  return <span className={`esqueleto-barra${alta ? ' alta' : ''}`} style={{ width: `${largura}%` }} />;
}

/** Um bloco sólido: gráfico, mapa, cartão. */
export function BlocoComponent({ altura, estilo }: { altura: number | string; estilo?: CSSProperties }) {
  return <span className="esqueleto-bloco" style={{ height: altura, ...estilo }} />;
}

/** Larguras que se repetem sem parecer padrão. Fixas: o esqueleto não muda a cada render. */
const LARGURAS = [62, 48, 71, 55, 66, 44, 58, 69];

/** Linhas de lista: foto e duas barras, como `LinhaParlamentar`. */
export function EsqueletoDeListaComponent({ rotulo, linhas = 6 }: { rotulo: string; linhas?: number }) {
  return (
    <EsqueletoComponent rotulo={rotulo}>
      <div className="esqueleto-lista">
        {Array.from({ length: linhas }, (_, i) => (
          <div className="linha esqueleto" key={i}>
            <span className="esqueleto-avatar" />
            <div className="linha-corpo">
              <BarraComponent largura={LARGURAS[i % LARGURAS.length] - 20} alta />
              <BarraComponent largura={LARGURAS[(i + 3) % LARGURAS.length]} />
            </div>
          </div>
        ))}
      </div>
    </EsqueletoComponent>
  );
}

/** Parágrafos: um título e algumas linhas de texto. */
export function EsqueletoDeTextoComponent({ rotulo, paragrafos = 2 }: { rotulo: string; paragrafos?: number }) {
  return (
    <EsqueletoComponent rotulo={rotulo}>
      <div className="esqueleto-texto">
        {Array.from({ length: paragrafos }, (_, p) => (
          <div className="esqueleto-paragrafo" key={p}>
            <BarraComponent largura={34} alta />
            {[96, 92, 88, LARGURAS[p % LARGURAS.length]].map((largura, i) => (
              <BarraComponent key={i} largura={largura} />
            ))}
          </div>
        ))}
      </div>
    </EsqueletoComponent>
  );
}

/** Números em cartões, lado a lado, e um bloco de gráfico embaixo. */
export function EsqueletoDePainelComponent({
  rotulo,
  cartoes = 3,
  alturaDoGrafico = 220,
}: {
  rotulo: string;
  cartoes?: number;
  alturaDoGrafico?: number;
}) {
  return (
    <EsqueletoComponent rotulo={rotulo}>
      <div className="esqueleto-cartoes">
        {Array.from({ length: cartoes }, (_, i) => (
          <div className="esqueleto-cartao" key={i}>
            <BarraComponent largura={50} />
            <BarraComponent largura={70} alta />
          </div>
        ))}
      </div>
      {alturaDoGrafico > 0 && <BlocoComponent altura={alturaDoGrafico} />}
    </EsqueletoComponent>
  );
}

/** O topo do perfil (foto, nome, siglas) e o começo da lista de votos. */
export function EsqueletoDeFichaComponent() {
  return (
    <EsqueletoComponent rotulo={T.carregandoOPerfil}>
      <div className="esqueleto-ficha">
        <span className="esqueleto-avatar esqueleto-avatar-grande" />
        <BarraComponent largura={45} alta />
        <BarraComponent largura={28} />
      </div>
      <div className="esqueleto-lista">
        {[0, 1, 2, 3].map((i) => (
          <div className="linha esqueleto" key={i}>
            <div className="linha-corpo">
              <BarraComponent largura={LARGURAS[i] - 25} />
              <BarraComponent largura={LARGURAS[i + 2]} alta />
            </div>
          </div>
        ))}
      </div>
    </EsqueletoComponent>
  );
}
