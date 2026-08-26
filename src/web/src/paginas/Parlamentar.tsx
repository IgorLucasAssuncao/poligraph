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
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';

type Aba = 'noticias' | 'votos' | 'similares';

const ABAS: [Aba, string][] = [
  ['noticias', 'Notícias'],
  ['votos', 'Votos'],
  ['similares', 'Vota parecido'],
];

/** O perfil do parlamentar — a página mais parecida com "rede social" do site. */
export function Parlamentar() {
  const { id } = useParams();
  const pessoaId = Number(id);

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [seguindo, setSeguindo] = useState(false);
  const [aba, setAba] = useState<Aba>('noticias');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setFicha(null);
    setErro(null);
    setAba('noticias');

    Promise.all([obterFicha(pessoaId), obterNoticias(pessoaId), listarSeguidos()])
      .then(([f, n, seguidos]) => {
        setFicha(f);
        setNoticias(n);
        setSeguindo(seguidos.some((s) => s.id === pessoaId));
      })
      .catch(() => setErro('Não foi possível carregar este parlamentar.'));
  }, [pessoaId]);

  if (erro) {
    return (
      <>
        <CabecalhoDaColuna titulo="Parlamentar" comVoltar />
        <p className="erro">{erro}</p>
      </>
    );
  }

  if (!ficha) {
    return (
      <>
        <CabecalhoDaColuna titulo="Parlamentar" comVoltar />
        <p className="carregando">Carregando…</p>
      </>
    );
  }

  return (
    <>
      <CabecalhoDaColuna
        titulo={ficha.nome}
        subtitulo={`${ficha.nVotacoes} votações registradas`}
        comVoltar
      />

      {/* ⚠️ Capa em tom neutro único: cor não pode sugerir espectro político (RNF-16). */}
      <div className="capa-perfil" aria-hidden="true" />

      <header className="perfil-cabecalho">
        <div className="perfil-avatar-linha">
          <Avatar nome={ficha.nome} tamanho="grande" />

          <button
            type="button"
            className={seguindo ? 'botao-seguindo' : 'botao-seguir'}
            aria-pressed={seguindo}
            onClick={alternarSeguir}
          >
            <span>{seguindo ? 'Acompanhando' : 'Acompanhar'}</span>
          </button>
        </div>

        <div className="perfil-identidade">
          <h1>{ficha.nome}</h1>
          {ficha.nomeCivil !== ficha.nome && <p className="nome-civil">{ficha.nomeCivil}</p>}
        </div>

        <div className="perfil-chips">
          {ficha.partido && <span className="chip">{ficha.partido}</span>}
          {ficha.uf && <span className="chip">{ficha.uf}</span>}
        </div>

        <div className="perfil-numeros">
          <span>
            <strong>{ficha.nVotacoes}</strong> <span>votações registradas</span>
          </span>
        </div>
      </header>

      <nav className="abas" aria-label="Seções do perfil">
        {ABAS.map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            className={`aba ${aba === chave ? 'aba-ativa' : ''}`}
            aria-current={aba === chave}
            onClick={() => setAba(chave)}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      {aba === 'noticias' && <AbaNoticias noticias={noticias} />}
      {aba === 'votos' && <AbaVotos votos={ficha.votosRecentes} />}
      {aba === 'similares' && <AbaSimilares similares={ficha.maisSimilares} />}
    </>
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

function AbaNoticias({ noticias }: { noticias: Noticia[] }) {
  if (noticias.length === 0) {
    return (
      <p className="vazio">
        Nenhuma notícia recente. Parlamentares de menor projeção passam semanas sem aparecer
        na imprensa — isso não é erro.
      </p>
    );
  }

  return (
    <>
      {noticias.map((n) => (
        <article key={n.id} className="linha linha-simples">
          <div className="linha-corpo">
            {/* ⚠️ Link para o veículo. ⛔ Nunca reproduzimos o texto da matéria. */}
            <a className="noticia-titulo" href={n.url} target="_blank" rel="noreferrer noopener">
              {n.titulo}
            </a>
            <span className="linha-detalhe">
              {n.veiculo} · {formatarData(n.publicadaEm)}
            </span>
            {n.trecho && <p className="noticia-trecho">{n.trecho}</p>}
          </div>
        </article>
      ))}
    </>
  );
}

function AbaVotos({ votos }: { votos: Ficha['votosRecentes'] }) {
  if (votos.length === 0) return <p className="vazio">Nenhum voto registrado.</p>;

  return (
    <>
      {votos.map((v) => (
        <article key={v.votacaoId} className="linha linha-simples">
          <div className="linha-corpo">
            <span className={`selo selo-${classeDoVoto(v.valor)}`}>{rotuloDoVoto(v.valor)}</span>
            <p className="voto-descricao">{v.descricao ?? v.votacaoId}</p>
            <span className="linha-detalhe">{formatarData(v.data)}</span>
          </div>
        </article>
      ))}
    </>
  );
}

function AbaSimilares({ similares }: { similares: Ficha['maisSimilares'] }) {
  if (similares.length === 0) {
    // ⭐ RF-47: estado vazio honesto. Acontece antes de o ETL analítico rodar.
    return (
      <p className="vazio">A análise de similaridade ainda não rodou para esta legislatura.</p>
    );
  }

  return (
    <>
      {similares.map((s) => (
        <LinhaParlamentar
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
    </>
  );
}

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
