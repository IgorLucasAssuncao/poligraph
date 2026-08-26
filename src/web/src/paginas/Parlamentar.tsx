import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  deixarDeSeguir,
  listarSeguidos,
  obterFicha,
  obterNoticias,
  seguir,
  type Ficha,
  type Noticia,
} from '../api';
import { Avatar } from '../componentes/Avatar';
import { CartaoParlamentar } from '../componentes/CartaoParlamentar';

/** O perfil do parlamentar — a página mais parecida com "rede social" do site. */
export function Parlamentar() {
  const { id } = useParams();
  const pessoaId = Number(id);

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [seguindo, setSeguindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setFicha(null);
    setErro(null);

    Promise.all([obterFicha(pessoaId), obterNoticias(pessoaId), listarSeguidos()])
      .then(([f, n, seguidos]) => {
        setFicha(f);
        setNoticias(n);
        setSeguindo(seguidos.some((s) => s.id === pessoaId));
      })
      .catch(() => setErro('Não foi possível carregar este parlamentar.'));
  }, [pessoaId]);

  if (erro) return <p className="erro">{erro}</p>;
  if (!ficha) return <p className="carregando">Carregando…</p>;

  return (
    <div className="perfil">
      <header className="perfil-cabecalho">
        <Avatar nome={ficha.nome} tamanho="grande" />

        <div className="perfil-identidade">
          <h1>{ficha.nome}</h1>
          {ficha.nomeCivil !== ficha.nome && (
            <p className="nome-civil">{ficha.nomeCivil}</p>
          )}
          <p className="perfil-filiacao">
            {ficha.partido} · {ficha.uf}
          </p>
          <p className="perfil-numeros">
            <strong>{ficha.nVotacoes}</strong> votações registradas
          </p>
        </div>

        <button
          type="button"
          className={seguindo ? 'botao-seguindo' : 'botao-seguir'}
          aria-pressed={seguindo}
          onClick={alternarSeguir}
        >
          {seguindo ? 'Seguindo' : 'Seguir'}
        </button>
      </header>

      <section className="perfil-secao">
        <h2>Vota parecido com</h2>

        {ficha.maisSimilares.length === 0 ? (
          // ⭐ RF-47: estado vazio honesto. Acontece antes de o ETL analítico rodar.
          <p className="vazio">
            A análise de similaridade ainda não rodou para esta legislatura.
          </p>
        ) : (
          <div className="grade">
            {ficha.maisSimilares.map((s) => (
              <CartaoParlamentar
                key={s.pessoaId}
                id={s.pessoaId}
                nome={s.nome}
                partido={s.partido}
                uf=""
                // ⛔ nunca percentual — a base aparece junto do número
                detalhe={
                  <>
                    votaram igual em <strong>{Math.round(s.valor * s.comuns)}</strong> de{' '}
                    <strong>{s.comuns}</strong> votações
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="perfil-secao">
        <h2>Notícias</h2>

        {noticias.length === 0 ? (
          <p className="vazio">
            Nenhuma notícia recente. Parlamentares de menor projeção passam semanas sem
            aparecer na imprensa — isso não é erro.
          </p>
        ) : (
          <ul className="lista-noticias">
            {noticias.map((n) => (
              <li key={n.id}>
                {/* ⚠️ Link para o veículo. ⛔ Nunca reproduzimos o texto da matéria. */}
                <a href={n.url} target="_blank" rel="noreferrer noopener">
                  {n.titulo}
                </a>
                <span className="noticia-meta">
                  {n.veiculo} · {formatarData(n.publicadaEm)}
                </span>
                {n.trecho && <p className="noticia-trecho">{n.trecho}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="perfil-secao">
        <h2>Votos recentes</h2>

        {ficha.votosRecentes.length === 0 ? (
          <p className="vazio">Nenhum voto registrado.</p>
        ) : (
          <ul className="lista-votos">
            {ficha.votosRecentes.map((v) => (
              <li key={v.votacaoId}>
                <span className={`selo selo-${classeDoVoto(v.valor)}`}>
                  {rotuloDoVoto(v.valor)}
                </span>
                <span className="voto-descricao">{v.descricao ?? v.votacaoId}</span>
                <span className="voto-data">{formatarData(v.data)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════

  async function alternarSeguir() {
    const proximo = !seguindo;
    setSeguindo(proximo);

    try {
      await (proximo ? seguir(pessoaId) : deixarDeSeguir(pessoaId));
    } catch {
      setSeguindo(!proximo);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════

/**
 * ⚠️ Rótulo neutro, sem cor de juízo (RNF-16). "Sim" e "Não" descrevem o registro;
 * verde e vermelho sugeririam acerto e erro.
 */
function rotuloDoVoto(valor: number | null): string {
  if (valor === 1) return 'Sim';
  if (valor === -1) return 'Não';
  if (valor === 0) return 'Abstenção';

  return 'Ausente';
}

function classeDoVoto(valor: number | null): string {
  if (valor === 1) return 'sim';
  if (valor === -1) return 'nao';
  if (valor === 0) return 'abstencao';

  return 'ausente';
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
