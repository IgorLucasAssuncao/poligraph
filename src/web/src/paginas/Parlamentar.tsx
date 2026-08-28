import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  deixarDeSeguir,
  listarSeguidos,
  obterEmendas,
  obterFicha,
  obterFinanciamento,
  obterGastos,
  obterNoticias,
  seguir,
  type Alinhamento,
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

/**
 * 🔴 **Três abas, nomeadas pela PERGUNTA — ⛔ não pela fonte de dado.**
 *
 * ⚠️ Eram seis, e três delas (*Gastos*, *Emendas*, *Campanha*) nomeavam **datasets**.
 * Ninguém chega a esta página querendo *"ver o dataset de emendas"*: chega querendo saber
 * **quanto dinheiro passa por esse parlamentar**. Nomear pela fonte é nomear pelo jeito
 * como o sistema foi construído.
 *
 * 🔴 **E separar as três destruía o achado que justifica ingeri-las.** O cruzamento que
 * o projeto documentou — *"este deputado paga, com verba de gabinete, empresas que
 * financiaram a campanha dele?"* — exige ver **campanha e cota ao mesmo tempo**. Em abas
 * diferentes, isso era impossível por construção.
 *
 * ⭐ **E as contas ⛔ não viraram aba.** Elas são uma **faixa fixa** logo abaixo da
 * identidade, com três números lado a lado; o detalhe abre em **modal**. Aba esconderia
 * de novo o que a fusão veio resolver — e o perfil ⛔ não pode virar quatro telas de
 * rolagem para acomodar profundidade que só parte dos leitores quer.
 *
 * ⭐ `atuacao` é o padrão porque é o núcleo do trabalho **e** porque sempre tem conteúdo.
 * ⚠️ O padrão anterior era `noticias`, e o coletor ⛔ ainda não rodou: a primeira coisa
 * que a página mostrava era estado vazio.
 */
type Aba = 'atuacao' | 'noticias';

const ABAS: [Aba, string][] = [
  ['atuacao', 'Como vota'],
  ['noticias', 'Notícias'],
];

/** O perfil do parlamentar — a página mais parecida com "rede social" do site. */
export function Parlamentar() {
  const { id } = useParams();
  const pessoaId = Number(id);

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [seguindo, setSeguindo] = useState(false);
  const [aba, setAba] = useState<Aba>('atuacao');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setFicha(null);
    setErro(null);
    setAba('atuacao');

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
          {/* A casa vem primeiro: é o que situa todo o resto. Um "PT · SP" sem ela
              deixa o leitor sem saber se está diante de deputado ou senador — e as
              duas casas votam matérias diferentes, então o número de votações e o
              grafo da pessoa significam coisas distintas. */}
          {ficha.casa && (
            <span className="chip chip-casa">
              <Termo nome={ficha.casa === 'SENADO' ? 'senado' : 'camara'}>
                {ficha.casa === 'SENADO' ? 'Senador' : 'Deputado'}
              </Termo>
            </span>
          )}
          {/* RNF-31: termo institucional como contexto, nunca como controle. */}
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

        {ficha.alinhamento && <FaixaDeAlinhamento alinhamento={ficha.alinhamento} />}

        {/* Dentro do cabeçalho, e não entre ele e as abas: as contas são parte de quem
            a pessoa é, não uma das seções entre as quais se escolhe. */}
        <PainelDeContas pessoaId={pessoaId} />
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

      {aba === 'atuacao' && (
        <>
          <AbaVotos votos={ficha.votosRecentes} />
          <AbaSimilares similares={ficha.maisSimilares} />
        </>
      )}
      {aba === 'noticias' && <AbaNoticias noticias={noticias} />}
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
 * **As contas do mandato** — faixa fixa no perfil, detalhe em modal.
 *
 * 🔴 **Eram três abas** (*Gastos*, *Emendas*, *Campanha*), e separá-las destruía o achado
 * que justifica ingerir as três. A pergunta que o projeto documentou — *"este deputado
 * paga, com verba de gabinete, empresas que financiaram a campanha dele?"* — exige **ver
 * os três ao mesmo tempo**. Em abas isso era impossível por construção, ⛔ não por falta
 * de recurso.
 *
 * 🔴 **E juntá-las numa aba única resolvia metade.** A comparação voltava, mas o detalhe
 * das três empilhado dava quatro telas de rolagem — profundidade que só parte dos
 * leitores quer, ocupando o espaço de todos.
 *
 * ⭐ **A separação que funciona é por PROFUNDIDADE, ⛔ não por fonte:** os três totais
 * ficam **sempre visíveis**, lado a lado, porque é aí que a comparação acontece; o
 * detalhe abre em `<dialog>`, que devolve o leitor exatamente onde ele estava.
 *
 * ⭐ **Uma busca, três respostas.** `Promise.allSettled` em vez de três `useEffect`
 * disparados conforme a pessoa clica — antes eram três viagens **sequenciais**, cada uma
 * com o seu *"Carregando…"*.
 *
 * ⚠️ `allSettled`, ⛔ não `all`: falha de uma fonte ⛔ não pode apagar as outras duas.
 */
/**
 * Governismo e disciplina — com que frequência votou como pediram a ele.
 *
 * ## 🔴 O que este bloco ⛔ NÃO pode fazer
 *
 * Governismo alto ⛔ não é elogio nem acusação, e a tela ⛔ não pode sugerir que seja.
 * ⛔ Sem cor semântica, ⛔ sem seta, ⛔ sem comparação com uma média — qualquer um dos
 * três transformaria medição em juízo, que é o que a RNF-16 proíbe.
 *
 * ⭐ A base anda junto do percentual, sempre. 80% sobre 15 votações e 80% sobre 900 são
 * afirmações de força muito diferente.
 */
function FaixaDeAlinhamento({ alinhamento }: { alinhamento: Alinhamento }) {
  const { governismo, baseGovernismo, disciplina, baseDisciplina, partidoMedido } =
    alinhamento;

  if (governismo === null && disciplina === null) return null;

  return (
    <dl className="alinhamento">
      {governismo !== null && (
        <div>
          <dt>
            Votou com o Governo
            <Termo nome="orientacao" />
          </dt>
          <dd>{Math.round(governismo * 100)}%</dd>
          <small>de {baseGovernismo} votações orientadas</small>
        </div>
      )}

      {disciplina !== null && (
        <div>
          <dt>Votou com o {partidoMedido}</dt>
          <dd>{Math.round(disciplina * 100)}%</dd>
          <small>de {baseDisciplina} votações orientadas</small>
        </div>
      )}
    </dl>
  );
}

function PainelDeContas({ pessoaId }: { pessoaId: number }) {
  const [dados, setDados] = useState<{
    gastos: GastoDeCota | null;
    emendas: EmendasDoParlamentar | null;
    fin: FinanciamentoDeCampanha | null;
  } | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro(false);
    setAberto(false);

    Promise.allSettled([
      obterGastos(pessoaId),
      obterEmendas(pessoaId),
      obterFinanciamento(pessoaId),
    ]).then(([g, e, f]) => {
      if (!vivo) return;

      // ⚠️ As três falhando juntas é problema de rede, ⛔ não ausência de dado — e aí a
      //    mensagem tem de ser de erro, não três traços que mentem "não há registro".
      if (g.status === 'rejected' && e.status === 'rejected' && f.status === 'rejected') {
        setErro(true);
        return;
      }

      setDados({
        gastos: g.status === 'fulfilled' ? g.value : null,
        emendas: e.status === 'fulfilled' ? e.value : null,
        fin: f.status === 'fulfilled' ? f.value : null,
      });
    });

    return () => {
      vivo = false;
    };
  }, [pessoaId]);

  // ⭐ Silêncio enquanto carrega, e silêncio no erro: a faixa é **contexto**, ⛔ não o
  //    conteúdo principal. Um "Carregando…" ou um erro vermelho aqui empurraria os votos
  //    para baixo e chamaria atenção para o que menos importa nesta página.
  if (erro || !dados) return null;

  const { gastos, emendas, fin } = dados;

  // Sem nada a mostrar, a linha inteira some: oferecer um modal com três estados vazios
  // é pior do que não oferecer.
  const temAlgo =
    (fin?.total ?? 0) > 0 || (emendas?.quantidade ?? 0) > 0 || (gastos?.lancamentos ?? 0) > 0;
  if (!temAlgo) return null;

  return (
    <>
      <section className="perfil-contas" aria-label="Contas do mandato">
        <div className="contas-numeros">
          <ValorDaConta
            rotulo="Campanha"
            valor={fin?.total}
            nota={fin?.anoEleicao ? `eleição de ${fin.anoEleicao}` : undefined}
          />
          <ValorDaConta
            rotulo="Emendas"
            valor={emendas?.empenhado}
            nota={emendas?.ano ? `empenhado em ${emendas.ano}` : undefined}
          />
          <ValorDaConta
            rotulo="Cota"
            valor={gastos?.total}
            nota={gastos?.ano ? `gasto em ${gastos.ano}` : undefined}
          />
        </div>

        <button type="button" className="botao-contas" onClick={() => setAberto(true)}>
          Ver as contas
        </button>
      </section>

      <ContasAmpliadas
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        gastos={gastos}
        emendas={emendas}
        fin={fin}
      />
    </>
  );
}

/**
 * Um número da faixa de contas.
 *
 * 🔴 **Ausente ⛔ NÃO é zero.** `R$ 0,00` afirmaria que o parlamentar ⛔ não recebeu nada;
 * o que se sabe é que **a base ⛔ não tem** — pode ser suplente, pode ser autor de emenda
 * ainda não reconciliado. O travessão diz isso sem mentir, e a nota diz por quê.
 */
function ValorDaConta({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor?: number;
  nota?: string;
}) {
  const tem = valor !== undefined && valor > 0;

  return (
    <div className="conta-valor">
      <span className="conta-rotulo">{rotulo}</span>
      <span className={`conta-numero ${tem ? '' : 'conta-ausente'}`}>
        {tem ? reais(valor) : '—'}
      </span>
      <span className="conta-nota">{tem ? nota : 'sem registro na base'}</span>
    </div>
  );
}

/**
 * O detalhe das três fontes, em `<dialog>`.
 *
 * ⭐ `<dialog>` nativo, como em `GrafoAmpliado`: Esc, captura de foco e o resto da página
 * inerte vêm de graça — três coisas que uma `div` sobreposta exigiria reimplementar, e
 * que costumam ficar pela metade.
 */
function ContasAmpliadas({
  aberto,
  aoFechar,
  gastos,
  emendas,
  fin,
}: {
  aberto: boolean;
  aoFechar: () => void;
  gastos: GastoDeCota | null;
  emendas: EmendasDoParlamentar | null;
  fin: FinanciamentoDeCampanha | null;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  // Monta na primeira abertura e ⛔ não desmonta ao fechar. Duas razões: fora do modal
  // são três subárvores grandes que ninguém está vendo, e desmontá-las no clique de
  // fechar faria a animação de saída acontecer sobre uma caixa VAZIA.
  const [jaAbriu, setJaAbriu] = useState(false);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;

    if (aberto) {
      setJaAbriu(true);
      if (!elemento.open) elemento.showModal();
    } else if (elemento.open) {
      elemento.close();
    }
  }, [aberto]);

  return (
    <dialog ref={dialogo} className="contas-ampliadas" onClose={aoFechar} onCancel={aoFechar}>
      <header>
        <div>
          <h2>Contas do mandato</h2>
          <p className="ajuda">Três dinheiros diferentes — que não se somam.</p>
        </div>

        <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
          ✕
        </button>
      </header>

      {jaAbriu && (
        <div className="contas-corpo">
          {/* 🔴 A comparação vive AQUI, com a largura do modal — é o único lugar em que
              as três ordens de grandeza cabem lado a lado sem se atropelar. */}
          <div className="contas-comparacao">
            <ValorDaConta
              rotulo="Campanha"
              valor={fin?.total}
              nota={fin?.anoEleicao ? `eleição de ${fin.anoEleicao}` : undefined}
            />
            <ValorDaConta
              rotulo="Emendas"
              valor={emendas?.empenhado}
              nota={emendas?.ano ? `empenhado em ${emendas.ano}` : undefined}
            />
            <ValorDaConta
              rotulo="Cota"
              valor={gastos?.total}
              nota={gastos?.ano ? `gasto em ${gastos.ano}` : undefined}
            />
          </div>

          <BlocoDeConta
            titulo="Campanha"
            resumo="O dinheiro que elegeu o parlamentar."
            vazio="Nenhuma receita de campanha registrada para este parlamentar na base."
          >
            {fin && fin.total > 0 ? <DetalheCampanha fin={fin} /> : null}
          </BlocoDeConta>

          <BlocoDeConta
            titulo="Emendas"
            resumo="O que ele direciona do orçamento federal."
            vazio="Nenhuma emenda atribuída a este parlamentar na base."
          >
            {emendas && emendas.quantidade > 0 ? <DetalheEmendas emendas={emendas} /> : null}
          </BlocoDeConta>

          <BlocoDeConta
            titulo="Cota parlamentar"
            resumo="O que ele gasta para manter o mandato."
            vazio="Nenhuma despesa de cota registrada para este parlamentar na base."
          >
            {gastos && gastos.lancamentos > 0 ? <DetalheGastos gastos={gastos} /> : null}
          </BlocoDeConta>
        </div>
      )}
    </dialog>
  );
}

/**
 * ⭐ O bloco existe mesmo **sem** dado, e é de propósito: num modal único, uma seção que
 * simplesmente some deixaria o leitor sem saber que aquela fonte foi consultada. Estado
 * vazio é uma informação, ⛔ não a falta de uma.
 */
function BlocoDeConta({
  titulo,
  resumo,
  vazio,
  children,
}: {
  titulo: string;
  resumo: string;
  vazio: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bloco-conta">
      <header className="cabecalho-bloco">
        <h3 className="titulo-bloco">{titulo}</h3>
        <p className="ajuda">{resumo}</p>
      </header>
      {children ?? <p className="vazio">{vazio}</p>}
    </section>
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
function DetalheCampanha({ fin }: { fin: FinanciamentoDeCampanha }) {
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
        Prestação de contas eleitorais publicada pelo TSE.
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
function DetalheEmendas({ emendas }: { emendas: EmendasDoParlamentar }) {
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
      {/* 🔴 A execução ⛔ não é um total — é a razão entre dois, e é a informação que
          distingue emenda anunciada de emenda cumprida. Por isso sobrevive ao corte que
          tirou os totais daqui: eles já estão na comparação do topo. */}
      <section className="execucao">
        <span className="gasto-barra execucao-barra">
          <span style={{ width: `${Math.min(executado * 100, 100)}%` }} />
        </span>
        <p className="ajuda">
          <strong>{reais(emendas.pago)}</strong> pagos de{' '}
          {reais(emendas.empenhado)} empenhados em{' '}
          <strong>{emendas.quantidade}</strong>{' '}
          {emendas.quantidade === 1 ? 'emenda' : 'emendas'} —{' '}
          {(executado * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% saiu
          de fato
        </p>
      </section>

      <h3 className="titulo-secao">Para onde foi</h3>
      <ul className="gastos-categorias">
        {emendas.porDestino.map((d) => (
          <li key={d.localidade}>
            <span className="gasto-nome">
              <Destino localidade={d.localidade} />
            </span>
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
          <h3 className="titulo-secao">
            Em quê <Termo nome="funcaoOrcamentaria">(área do orçamento)</Termo>
          </h3>
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
 * O destino de uma emenda — **quatro coisas diferentes na mesma coluna**.
 *
 * 🔴 `MÚLTIPLO` ⛔ **não é um lugar.** É o aviso de que a emenda se reparte entre vários
 * municípios, e o Portal ⛔ não diz quais. Listá-lo em texto puro, entre nomes de cidade,
 * faria o leitor tomá-lo por uma — e é a forma **mais comum** (4 de cada 10 emendas) e a
 * de **maior valor** (R$ 11,6 mi por emenda, oito vezes a de município).
 *
 * ⚠️ `Nacional` tem o mesmo problema em menor grau. Os dois ganham marcação própria e
 * explicação sob demanda; UF e município aparecem como o que são.
 */
function Destino({ localidade }: { localidade: string }) {
  if (localidade === 'MÚLTIPLO') {
    return (
      <>
        <Termo nome="multiplo">Vários lugares</Termo>
        <small> · o Portal não detalha quais</small>
      </>
    );
  }

  if (localidade === 'Nacional') {
    return (
      <>
        <Termo nome="nacional">Alcance nacional</Termo>
        <small> · sem destino territorial</small>
      </>
    );
  }

  // ⭐ "SÃO PAULO (UF)" → o estado inteiro, ⛔ não a capital. O sufixo é do Portal e não
  //    diz nada ao leitor; o que ele precisa saber é que abrange o estado todo.
  const uf = localidade.match(/^(.*) \(UF\)$/);
  if (uf) {
    return (
      <>
        {minusculas(uf[1])}
        <small> · estado inteiro</small>
      </>
    );
  }

  return <>{localidade}</>;
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
function DetalheGastos({ gastos }: { gastos: GastoDeCota }) {
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
      <p className="ajuda ajuda-espacada">
        <Termo nome="cota">Cota parlamentar</Termo> de {gastos.ano}, em{' '}
        <strong>{gastos.lancamentos}</strong> lançamentos.
      </p>

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

// ═══════════════════════════════════════════════════════════════════
// AUXILIARES DE FORMATAÇÃO
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

/** ⚠️ O arquivo vem em CAIXA ALTA — ilegível em bloco na tela. */
function minusculas(texto: string): string {
  const min = texto.toLocaleLowerCase('pt-BR');

  return min.charAt(0).toLocaleUpperCase('pt-BR') + min.slice(1);
}

function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
