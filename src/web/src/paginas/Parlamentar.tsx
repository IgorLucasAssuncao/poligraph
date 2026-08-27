import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  deixarDeSeguir,
  obterEmendas,
  obterFinanciamento,
  obterGastos,
  listarSeguidos,
  obterFicha,
  obterNoticias,
  seguir,
  type EmendasDoParlamentar,
  type Ficha,
  type FinanciamentoDeCampanha,
  type GastoDeCota,
  type Noticia,
} from '../api';
import { Avatar } from '../componentes/Avatar';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';
import { Termo } from '../componentes/Termo';

type Aba = 'noticias' | 'votos' | 'gastos' | 'emendas' | 'campanha' | 'similares';

const ABAS: [Aba, string][] = [
  ['noticias', 'Notícias'],
  ['votos', 'Votos'],
  ['gastos', 'Gastos'],
  ['emendas', 'Emendas'],
  ['campanha', 'Campanha'],
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
          <Avatar nome={ficha.nome} fotoUrl={ficha.urlFoto} tamanho="grande" />

          <button
            type="button"
            className={seguindo ? 'botao-seguindo' : 'botao-seguir'}
            aria-pressed={seguindo}
            onClick={alternarSeguir}
          >
            <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
          </button>
        </div>

        <div className="perfil-identidade">
          <h1>{ficha.nome}</h1>
          {ficha.nomeCivil !== ficha.nome && <p className="nome-civil">{ficha.nomeCivil}</p>}
        </div>

        <div className="perfil-chips">
          {/* ⚠️ RNF-31: termo institucional como contexto, nunca como controle. */}
          {ficha.partido && (
            <span className="chip">
              <Termo nome="partido">{ficha.partido}</Termo>
            </span>
          )}
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
      {aba === 'gastos' && <AbaGastos pessoaId={pessoaId} />}
      {aba === 'emendas' && <AbaEmendas pessoaId={pessoaId} />}
      {aba === 'campanha' && <AbaCampanha pessoaId={pessoaId} />}
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
            <span className={`selo selo-${classeDoVoto(v.valor)}`}>
              {v.valor === 0 ? <Termo nome="abstencao">Abstenção</Termo> : rotuloDoVoto(v.valor)}
            </span>
            <p className="voto-descricao">{v.descricao ?? v.votacaoId}</p>
            <span className="linha-detalhe">{formatarData(v.data)}</span>
          </div>
        </article>
      ))}
    </>
  );
}

/**
 * A cota parlamentar na ficha (CEAP).
 *
 * ⚠️ **Não é sobre voto** — é o outro eixo do perfil. O título do TCC fala de afinidade
 * por voto; esta aba responde outra pergunta sobre a mesma pessoa.
 *
 * 🔴 Todo valor vem com o **link do documento fiscal** a um clique na Câmara. Sem isso a
 * tela seria uma afirmação sobre gasto público sem como conferir.
 */
function AbaGastos({ pessoaId }: { pessoaId: number }) {
  const [gastos, setGastos] = useState<GastoDeCota | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setGastos(null);
    setErro(false);

    obterGastos(pessoaId).then(setGastos).catch(() => setErro(true));
  }, [pessoaId]);

  if (erro) return <p className="erro">Não foi possível carregar os gastos.</p>;
  if (!gastos) return <p className="carregando">Carregando…</p>;

  // ⭐ Estado vazio HONESTO: pode ser deputado que não usou cota, ou ano ainda não
  //    ingerido. ⛔ Nunca "R$ 0,00", que afirmaria o que não se sabe.
  if (gastos.lancamentos === 0) {
    return (
      <p className="vazio">
        Nenhuma despesa de cota registrada para este parlamentar na base.
      </p>
    );
  }

  const maior = gastos.porCategoria[0]?.total ?? 1;

  return (
    <>
      <section className="gastos-resumo">
        <p className="rotulo-destaque">Cota parlamentar em {gastos.ano}</p>
        <p className="gastos-total">{reais(gastos.total)}</p>
        <p className="ajuda">
          em <strong>{gastos.lancamentos}</strong> lançamentos
        </p>
      </section>

      <h3 className="titulo-secao">Em quê</h3>
      <ul className="gastos-categorias">
        {gastos.porCategoria.map((c) => (
          <li key={c.categoria}>
            <span className="gasto-nome">{minusculas(c.categoria)}</span>
            <span className="gasto-barra">
              {/* ⚠️ Barra proporcional à MAIOR categoria, não ao total: com 15
                  categorias, proporção do total vira fiapo ilegível. */}
              <span style={{ width: `${Math.max((c.total / maior) * 100, 2)}%` }} />
            </span>
            <span className="gasto-valor">{reais(c.total)}</span>
          </li>
        ))}
      </ul>

      <h3 className="titulo-secao">Quem recebeu</h3>
      <ul className="gastos-fornecedores">
        {gastos.maioresFornecedores.map((f) => (
          <li key={f.nome}>
            <span className="gasto-nome">
              {f.nome}
              {/* 🔴 RNF-13: o documento de pessoa física é hasheado no banco, e a tela
                  diz isso em vez de fingir que não existe fornecedor pessoa física. */}
              {f.pessoaFisica && <small> · pessoa física</small>}
            </span>
            <span className="gasto-valor">{reais(f.total)}</span>
          </li>
        ))}
      </ul>

      <p className="ajuda ajuda-espacada">
        Cota para o Exercício da Atividade Parlamentar, publicada pela Câmara dos
        Deputados. Valores já descontada a glosa.
      </p>
    </>
  );
}

/**
 * As emendas parlamentares na ficha (Portal da Transparência).
 *
 * 🔴 **Empenhado e pago são coisas diferentes, e a tela mostra os dois.** Empenhar é
 * reservar; pagar é o dinheiro sair. Um painel que exibisse só o empenhado deixaria a
 * pessoa concluir que o dinheiro chegou — que é exatamente o que quem anuncia emenda
 * gostaria que ela concluísse.
 */
function AbaEmendas({ pessoaId }: { pessoaId: number }) {
  const [emendas, setEmendas] = useState<EmendasDoParlamentar | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setEmendas(null);
    setErro(false);

    obterEmendas(pessoaId).then(setEmendas).catch(() => setErro(true));
  }, [pessoaId]);

  if (erro) return <p className="erro">Não foi possível carregar as emendas.</p>;
  if (!emendas) return <p className="carregando">Carregando…</p>;

  // ⭐ Vazio HONESTO: pode ser parlamentar sem emenda, ou autor ainda não reconciliado
  //    na base. ⛔ Nunca "R$ 0,00", que afirmaria o que não se sabe.
  if (emendas.quantidade === 0) {
    return (
      <p className="vazio">
        Nenhuma emenda atribuída a este parlamentar na base.
      </p>
    );
  }

  const maior = emendas.porDestino[0]?.empenhado ?? 1;
  const executado = emendas.empenhado > 0 ? emendas.pago / emendas.empenhado : 0;

  return (
    <>
      <section className="gastos-resumo">
        <p className="rotulo-destaque">Emendas de {emendas.ano}</p>
        <p className="gastos-total">{reais(emendas.empenhado)}</p>
        <p className="ajuda">
          empenhados em <strong>{emendas.quantidade}</strong>{' '}
          {emendas.quantidade === 1 ? 'emenda' : 'emendas'}
        </p>

        {/* 🔴 A execução é a informação, e por isso vem em destaque próprio — ⛔ não
            como um número miúdo ao lado do empenhado. */}
        <div className="execucao">
          <span className="gasto-barra execucao-barra">
            <span style={{ width: `${Math.min(executado * 100, 100)}%` }} />
          </span>
          <p className="ajuda">
            <strong>{reais(emendas.pago)}</strong> efetivamente pagos —{' '}
            {(executado * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
            do que foi empenhado
          </p>
        </div>
      </section>

      <h3 className="titulo-secao">Para onde foi</h3>
      <ul className="gastos-categorias">
        {emendas.porDestino.map((d) => (
          <li key={d.localidade}>
            <span className="gasto-nome">{d.localidade}</span>
            <span className="gasto-barra">
              {/* ⚠️ Proporcional ao MAIOR destino, não ao total — mesma razão da cota. */}
              <span style={{ width: `${Math.max((d.empenhado / maior) * 100, 2)}%` }} />
            </span>
            <span className="gasto-valor">{reais(d.empenhado)}</span>
          </li>
        ))}
      </ul>

      {emendas.porFuncao.length > 0 && (
        <>
          <h3 className="titulo-secao">Em quê</h3>
          <ul className="gastos-fornecedores">
            {emendas.porFuncao.map((f) => (
              <li key={f.funcao}>
                <span className="gasto-nome">{f.funcao}</span>
                <span className="gasto-valor">{reais(f.empenhado)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="ajuda ajuda-espacada">
        <Termo nome="emenda">Emendas parlamentares</Termo> publicadas pelo Portal da
        Transparência. A diferença entre{' '}
        <Termo nome="empenho">empenhado e pago</Termo> é o que a barra acima mostra.
      </p>
    </>
  );
}

/**
 * O financiamento da campanha que elegeu o parlamentar (TSE).
 *
 * 🔴 **O fundão e o fundo partidário aparecem SEPARADOS.** São fundos diferentes: o
 * Fundo Especial (FEFC) é eleitoral, criado em 2017; o Fundo Partidário é o
 * financiamento permanente dos partidos. Somá-los como "dinheiro público" é
 * defensável — mas é uma afirmação, e a tela ⛔ não a faz pelo leitor.
 */
function AbaCampanha({ pessoaId }: { pessoaId: number }) {
  const [fin, setFin] = useState<FinanciamentoDeCampanha | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setFin(null);
    setErro(false);

    obterFinanciamento(pessoaId).then(setFin).catch(() => setErro(true));
  }, [pessoaId]);

  if (erro) return <p className="erro">Não foi possível carregar o financiamento.</p>;
  if (!fin) return <p className="carregando">Carregando…</p>;

  if (fin.total === 0) {
    return (
      <p className="vazio">
        Nenhuma receita de campanha registrada para este parlamentar na base.
      </p>
    );
  }

  const publico = fin.fundoEspecial + fin.fundoPartidario;
  const maior = fin.porFonte[0]?.total ?? 1;

  return (
    <>
      <section className="gastos-resumo">
        <p className="rotulo-destaque">Campanha de {fin.anoEleicao}</p>
        <p className="gastos-total">{reais(fin.total)}</p>
        <p className="ajuda">arrecadados no total</p>
      </section>

      {/* 🔴 Os dois fundos, lado a lado e nomeados — ⛔ nunca somados num só número. */}
      <ul className="fundos">
        <li>
          <span className="fundo-rotulo">
            <Termo nome="fundao">Fundo Especial</Termo>
          </span>
          <span className="fundo-valor">{reais(fin.fundoEspecial)}</span>
        </li>
        <li>
          <span className="fundo-rotulo">Fundo Partidário</span>
          <span className="fundo-valor">{reais(fin.fundoPartidario)}</span>
        </li>
      </ul>

      <p className="ajuda ajuda-espacada">
        Juntos, os dois fundos somam <strong>{reais(publico)}</strong> —{' '}
        {((publico / fin.total) * 100).toLocaleString('pt-BR', {
          maximumFractionDigits: 0,
        })}
        % do que a campanha arrecadou. São fundos <strong>distintos</strong>: o Fundo
        Especial é eleitoral; o Partidário custeia o partido o ano inteiro.
      </p>

      <h3 className="titulo-secao">De onde veio</h3>
      <ul className="gastos-categorias">
        {fin.porFonte.map((f) => (
          <li key={f.fonte}>
            <span className="gasto-nome">{minusculas(f.fonte)}</span>
            <span className="gasto-barra">
              <span style={{ width: `${Math.max((f.total / maior) * 100, 2)}%` }} />
            </span>
            <span className="gasto-valor">{reais(f.total)}</span>
          </li>
        ))}
      </ul>

      <h3 className="titulo-secao">Maiores doadores</h3>
      <ul className="gastos-fornecedores">
        {fin.maioresDoadores.map((d) => (
          <li key={d.nome}>
            <span className="gasto-nome">
              {d.nome}
              {/* 🔴 RNF-13: o documento de pessoa física é hasheado no banco. */}
              {d.pessoaFisica && <small> · pessoa física</small>}
            </span>
            <span className="gasto-valor">{reais(d.total)}</span>
          </li>
        ))}
      </ul>

      <p className="ajuda ajuda-espacada">
        Prestação de contas eleitorais publicada pelo TSE, referente à eleição de{' '}
        {fin.anoEleicao}.
      </p>
    </>
  );
}

/** ⚠️ O arquivo vem em CAIXA ALTA — ilegível em bloco na tela. */
function minusculas(texto: string): string {
  const min = texto.toLocaleLowerCase('pt-BR');

  return min.charAt(0).toLocaleUpperCase('pt-BR') + min.slice(1);
}

function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
