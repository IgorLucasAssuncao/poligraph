import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSeguidos, obterNoticias, type Noticia, type Parlamentar } from '../api';
import { Avatar } from '../componentes/Avatar';
import { CabecalhoDaColuna } from '../componentes/Layout';

type ItemDoFeed = Noticia & { deQuem: Parlamentar };

/**
 * O feed.
 *
 * ⚠️ Montado NO CLIENTE, a partir de endpoints públicos por parlamentar. O servidor
 * nunca recebe "me dê o feed do usuário X" — ele responde "quais as notícias do
 * parlamentar 204528", que é informação pública.
 *
 * ⭐ É o que sobrou do desenho anônimo original, e vale manter: reduz o quanto o
 * servidor sabe sobre o comportamento de cada pessoa.
 */
export function Inicio() {
  const [seguidos, setSeguidos] = useState<Parlamentar[]>([]);
  const [itens, setItens] = useState<ItemDoFeed[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarSeguidos()
      .then(async (lista) => {
        setSeguidos(lista);

        const porParlamentar = await Promise.all(
          lista.map(async (p) => (await obterNoticias(p.id)).map((n) => ({ ...n, deQuem: p }))),
        );

        setItens(
          porParlamentar
            .flat()
            .sort((a, b) => +new Date(b.publicadaEm) - +new Date(a.publicadaEm)),
        );
      })
      .catch(() => setSeguidos([]))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <>
      <CabecalhoDaColuna
        titulo="Início"
        subtitulo={
          seguidos.length > 0
            ? `acompanhando ${seguidos.length} ${seguidos.length === 1 ? 'parlamentar' : 'parlamentares'}`
            : undefined
        }
      />

      {carregando && <p className="carregando">Carregando…</p>}

      {!carregando && seguidos.length === 0 && <SemSeguidos />}

      {!carregando && seguidos.length > 0 && itens.length === 0 && (
        <p className="vazio">Nada novo por aqui. O coletor de notícias roda uma vez por dia.</p>
      )}

      {itens.map((item) => (
        <ItemDeNoticia key={item.id} item={item} />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════

function ItemDeNoticia({ item }: { item: ItemDoFeed }) {
  return (
    <article className="linha">
      <Link to={`/parlamentar/${item.deQuem.id}`} aria-label={item.deQuem.nome}>
        <Avatar nome={item.deQuem.nome} tamanho="medio" />
      </Link>

      <div className="linha-corpo">
        <div className="linha-topo">
          <Link to={`/parlamentar/${item.deQuem.id}`} className="linha-nome">
            {item.deQuem.nome}
          </Link>
          <span className="linha-meta">
            {item.veiculo} · {new Date(item.publicadaEm).toLocaleDateString('pt-BR')}
          </span>
        </div>

        <a className="noticia-titulo" href={item.url} target="_blank" rel="noreferrer noopener">
          {item.titulo}
        </a>

        {/* RF-46 — por que isto apareceu */}
        <span className="linha-detalhe">porque você acompanha {item.deQuem.nome}</span>
      </div>
    </article>
  );
}

/** ⭐ Estado vazio que ensina o que fazer, em vez de só dizer que está vazio. */
function SemSeguidos() {
  return (
    <section className="convite">
      <h2>Comece por aqui</h2>
      <p className="ajuda">
        Você ainda não acompanha ninguém. Descubra quem vota como você — ou procure por nome.
      </p>

      <div className="convite-acoes">
        <Link to="/questionario" className="botao-destaque">
          Responder o questionário
        </Link>
        <Link to="/explorar" className="botao-secundario">
          Explorar os deputados
        </Link>
      </div>

      <p className="criterio">
        O questionário compara suas respostas com o voto registrado de cada deputado.
      </p>
    </section>
  );
}
