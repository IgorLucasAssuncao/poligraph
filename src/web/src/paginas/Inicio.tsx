import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSeguidos, obterNoticias, type Noticia, type Parlamentar } from '../api';
import { Avatar } from '../componentes/Avatar';
import { useSessao } from '../sessao';

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
  const { usuario } = useSessao();
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

  if (carregando) return <p className="carregando">Carregando…</p>;

  return (
    <div className="inicio">
      <h1>Olá, {usuario?.nome?.split(' ')[0] ?? 'você'}</h1>

      {seguidos.length === 0 ? <SemSeguidos /> : null}

      {seguidos.length > 0 && itens.length === 0 && (
        <p className="vazio">
          Você acompanha {seguidos.length}{' '}
          {seguidos.length === 1 ? 'parlamentar' : 'parlamentares'}, mas não há notícias
          recentes. O coletor roda uma vez por dia.
        </p>
      )}

      {itens.length > 0 && (
        <section>
          <h2>Notícias de quem você acompanha</h2>

          <ul className="feed">
            {itens.map((item) => (
              <li key={item.id} className="feed-item">
                <Link to={`/parlamentar/${item.deQuem.id}`} className="feed-autor">
                  <Avatar nome={item.deQuem.nome} tamanho="pequeno" />
                  <span>{item.deQuem.nome}</span>
                </Link>

                <a
                  className="feed-titulo"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {item.titulo}
                </a>

                <span className="feed-meta">
                  {item.veiculo} · {new Date(item.publicadaEm).toLocaleDateString('pt-BR')}
                </span>

                {/* RF-46 — por que isto apareceu */}
                <span className="feed-motivo">
                  porque você segue {item.deQuem.nome}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════

/** ⭐ Estado vazio que ensina o que fazer, em vez de só dizer que está vazio. */
function SemSeguidos() {
  return (
    <section className="convite">
      <h2>Comece por aqui</h2>
      <p>
        Você ainda não acompanha ninguém. Duas formas de encontrar quem te interessa:
      </p>

      <div className="convite-acoes">
        <Link to="/questionario" className="botao-destaque">
          Responder o questionário
        </Link>
        <Link to="/explorar" className="botao-secundario">
          Explorar os deputados
        </Link>
      </div>

      <p className="convite-nota">
        O questionário compara suas respostas com o voto registrado de cada deputado.
      </p>
    </section>
  );
}
