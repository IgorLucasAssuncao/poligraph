import type { CSSProperties, ReactNode } from 'react';

/**
 * O lugar do conteúdo enquanto ele chega: blocos cinza na forma do que vem, com um
 * brilho que atravessa.
 *
 * ⭐ Forma, ⛔ "Carregando…": o texto dizia que algo vinha, mas ⛔ onde nem de que
 * tamanho. Com o bloco no lugar certo, a página ⛔ pula quando o dado chega, e o olho já
 * está no lugar da resposta.
 *
 * 🔴 ⛔ Nunca conteúdo de exemplo. Numa ferramenta que credita a procedência de cada
 * número, inventar nome, valor ou manchete para ilustrar o layout seria produzir na tela
 * o que o trabalho existe para ⛔ fazer. As barras mostram a forma sem afirmar nada.
 *
 * ♿ O leitor de tela ⛔ vê cinza: `role="status"` com o texto escondido diz o que está
 * vindo, e o resto é `aria-hidden`.
 */
export function Esqueleto({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="esqueleto-area" role="status" aria-busy="true">
      <span className="so-leitor">{rotulo}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** Uma barra de texto. `largura` em % da linha: variar as larguras é o que lê como texto. */
export function Barra({ largura = 100, alta = false }: { largura?: number; alta?: boolean }) {
  return <span className={`esqueleto-barra${alta ? ' alta' : ''}`} style={{ width: `${largura}%` }} />;
}

/** Um bloco sólido: gráfico, mapa, cartão. */
export function Bloco({ altura, estilo }: { altura: number | string; estilo?: CSSProperties }) {
  return <span className="esqueleto-bloco" style={{ height: altura, ...estilo }} />;
}

/** Larguras que se repetem sem parecer padrão. Fixas: o esqueleto ⛔ muda a cada render. */
const LARGURAS = [62, 48, 71, 55, 66, 44, 58, 69];

/** Linhas de lista: foto e duas barras, como `LinhaParlamentar`. */
export function EsqueletoDeLista({ rotulo, linhas = 6 }: { rotulo: string; linhas?: number }) {
  return (
    <Esqueleto rotulo={rotulo}>
      <div className="esqueleto-lista">
        {Array.from({ length: linhas }, (_, i) => (
          <div className="linha esqueleto" key={i}>
            <span className="esqueleto-avatar" />
            <div className="linha-corpo">
              <Barra largura={LARGURAS[i % LARGURAS.length] - 20} alta />
              <Barra largura={LARGURAS[(i + 3) % LARGURAS.length]} />
            </div>
          </div>
        ))}
      </div>
    </Esqueleto>
  );
}

/** Parágrafos: um título e algumas linhas de texto. */
export function EsqueletoDeTexto({ rotulo, paragrafos = 2 }: { rotulo: string; paragrafos?: number }) {
  return (
    <Esqueleto rotulo={rotulo}>
      <div className="esqueleto-texto">
        {Array.from({ length: paragrafos }, (_, p) => (
          <div className="esqueleto-paragrafo" key={p}>
            <Barra largura={34} alta />
            {[96, 92, 88, LARGURAS[p % LARGURAS.length]].map((largura, i) => (
              <Barra key={i} largura={largura} />
            ))}
          </div>
        ))}
      </div>
    </Esqueleto>
  );
}

/** Números em cartões, lado a lado, e um bloco de gráfico embaixo. */
export function EsqueletoDePainel({
  rotulo,
  cartoes = 3,
  alturaDoGrafico = 220,
}: {
  rotulo: string;
  cartoes?: number;
  alturaDoGrafico?: number;
}) {
  return (
    <Esqueleto rotulo={rotulo}>
      <div className="esqueleto-cartoes">
        {Array.from({ length: cartoes }, (_, i) => (
          <div className="esqueleto-cartao" key={i}>
            <Barra largura={50} />
            <Barra largura={70} alta />
          </div>
        ))}
      </div>
      {alturaDoGrafico > 0 && <Bloco altura={alturaDoGrafico} />}
    </Esqueleto>
  );
}

/** O topo do perfil (foto, nome, siglas) e o começo da lista de votos. */
export function EsqueletoDeFicha() {
  return (
    <Esqueleto rotulo="Carregando o perfil">
      <div className="esqueleto-ficha">
        <span className="esqueleto-avatar esqueleto-avatar-grande" />
        <Barra largura={45} alta />
        <Barra largura={28} />
      </div>
      <div className="esqueleto-lista">
        {[0, 1, 2, 3].map((i) => (
          <div className="linha esqueleto" key={i}>
            <div className="linha-corpo">
              <Barra largura={LARGURAS[i] - 25} />
              <Barra largura={LARGURAS[i + 2]} alta />
            </div>
          </div>
        ))}
      </div>
    </Esqueleto>
  );
}
