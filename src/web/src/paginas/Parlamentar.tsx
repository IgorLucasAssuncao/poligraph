import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  deixarDeSeguir,
  listarSeguidos,
  listarVotos,
  obterFicha,
  obterNoticias,
  seguir,
  type Alinhamento,
  type Ficha,
  type Noticia,
  type PaginaDe,
  type Presenca,
  type VotoNaFicha,
} from '../api';
import { Avatar } from '../componentes/Avatar';
import { BotaoDoTour } from '../componentes/BotaoDoTour';
import { BotaoMostrarMais } from '../componentes/BotaoMostrarMais';
import { AbaCampanha, AbaCota, AbaEmendas, FaixaDeContas } from '../componentes/ContasDoParlamentar';
import { useContas } from '../componentes/useContas';
import { BotaoBaixarCsv } from '../componentes/BotaoBaixarCsv';
import { LinkDeFonte } from '../componentes/LinkDeFonte';
import { MandatosDoParlamentar } from '../componentes/MandatosDoParlamentar';
import { periodoDaLegislatura } from '../formato';
import { RedesDoParlamentar } from '../componentes/RedesDoParlamentar';
import { baixarCsv, buscarTodas } from '../exportar';
import { usePaginas } from '../componentes/usePaginas';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';
import { Termo } from '../componentes/Termo';
import { useSessao } from '../sessao';
import { passosDaFicha } from '../tour';

const PASSOS_DA_FICHA = passosDaFicha();

/**
 * As abas do perfil, nomeadas pela pergunta — ⛔ pela fonte de dado — e cada uma com endereço.
 *
 * ⭐ Os três dinheiros eram um modal único, "Ver as contas", que empilhava 13 blocos numa
 * rolagem só, sem endereço para compartilhar. Agora cada um é uma aba: `/parlamentar/194/emendas`
 * abre direto nas emendas, e os três números do topo levam a elas.
 *
 * ⭐ `votos` é o padrão porque é o núcleo do trabalho e sempre tem conteúdo.
 */
type Aba = 'votos' | 'emendas' | 'cota' | 'campanha' | 'noticias';

const ABAS: [Aba, string][] = [
  ['votos', 'Como vota'],
  ['emendas', 'Emendas'],
  ['cota', 'Cota'],
  ['campanha', 'Campanha'],
  ['noticias', 'Notícias'],
];

/** O perfil do parlamentar — a página mais parecida com "rede social" do site. */
export function Parlamentar() {
  const { id, aba: abaDoEndereco } = useParams();
  const pessoaId = Number(id);
  const aba: Aba = ABAS.some(([chave]) => chave === abaDoEndereco) ? (abaDoEndereco as Aba) : 'votos';
  const base = `/parlamentar/${pessoaId}`;
  const { pathname } = useLocation();
  const [busca] = useSearchParams();
  const legislaturaPedida = Number(busca.get('legislatura')) || undefined;
  const { contas, erro: erroDasContas } = useContas(pessoaId);
  const { usuario } = useSessao();

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [noticias, setNoticias] = useState<PaginaDe<Noticia>>({ itens: [], pagina: 1, tamanho: 10, total: 0 });
  const [seguindo, setSeguindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setFicha(null);
    setErro(null);

    Promise.all([
      obterFicha(pessoaId, legislaturaPedida),
      obterNoticias(pessoaId),
      // Sem conta, ninguém é seguido — e a lista responderia 401 e derrubaria a ficha.
      usuario ? listarSeguidos() : Promise.resolve([]),
    ])
      .then(([f, n, seguidos]) => {
        setFicha(f);
        setNoticias(n);
        setSeguindo(seguidos.some((s) => s.id === pessoaId));
      })
      .catch(() => setErro('Não foi possível carregar este parlamentar.'));
  }, [pessoaId, legislaturaPedida, usuario]);

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
        subtitulo={
          ficha.legislatura
            ? `${ficha.nVotacoes} votações registradas em ${periodoDaLegislatura(ficha.legislatura)}`
            : `${ficha.nVotacoes} votações registradas`
        }
        comVoltar
      />

      {/* ⚠️ Capa em tom neutro único: cor não pode sugerir espectro político (RNF-16). */}
      <div className="capa-perfil" aria-hidden="true" />

      <header className="perfil-cabecalho">
        <div className="perfil-avatar-linha">
          <Avatar nome={ficha.nome} fotoUrl={ficha.urlFoto} tamanho="grande" />

          {usuario && (
          <button
            type="button"
            className={seguindo ? 'botao-seguindo' : 'botao-seguir'}
            aria-pressed={seguindo}
            onClick={alternarSeguir}
          >
            <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
          </button>
          )}
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

        <MandatosDoParlamentar mandatos={ficha.mandatos ?? []} atual={ficha.legislatura} caminho={pathname} />

        {/* ⭐ Tudo o que esta ficha mostra pode ser conferido na casa. */}
        <p className="perfil-fonte">
          <LinkDeFonte href={ficha.urlFonte}>
            {ficha.casa === 'SENADO' ? 'Página oficial no Senado' : 'Página oficial na Câmara'}
          </LinkDeFonte>
        </p>
        <RedesDoParlamentar redes={ficha.redesSociais ?? []} />

        <div className="perfil-numeros" data-tour="ficha-votacoes">
          <span>
            <strong>{ficha.nVotacoes}</strong> <span>votações registradas</span>
          </span>
          <BotaoDoTour nome="ficha" passos={PASSOS_DA_FICHA} />
        </div>

        {(ficha.alinhamento || ficha.presenca) && (
          <FaixaDeAlinhamento alinhamento={ficha.alinhamento} presenca={ficha.presenca} />
        )}

        {/* Os três dinheiros, cada um levando à sua aba. */}
        <FaixaDeContas contas={contas} base={base} />
      </header>

      <nav className="abas" aria-label="Seções do perfil">
        {ABAS.map(([chave, rotulo]) => (
          <Link
            key={chave}
            to={`${chave === 'votos' ? base : `${base}/${chave}`}${legislaturaPedida ? `?legislatura=${legislaturaPedida}` : ''}`}
            className={`aba ${aba === chave ? 'aba-ativa' : ''}`}
            aria-current={aba === chave ? 'page' : undefined}
            replace
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      {aba === 'emendas' && <AbaEmendas pessoaId={pessoaId} contas={contas} erro={erroDasContas} />}
      {aba === 'cota' && <AbaCota pessoaId={pessoaId} contas={contas} erro={erroDasContas} />}
      {aba === 'campanha' && <AbaCampanha pessoaId={pessoaId} contas={contas} erro={erroDasContas} />}
      {aba === 'votos' && (
        <>
          <AbaVotos
            pessoaId={pessoaId}
            legislatura={ficha.legislatura}
            votos={ficha.votosRecentes}
            total={ficha.nRegistrosDeVoto}
            comPosicao={ficha.nVotacoes}
          />
          <AbaSimilares similares={ficha.maisSimilares} />
        </>
      )}
      {aba === 'noticias' && <AbaNoticias pessoaId={pessoaId} primeira={noticias} />}
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

/**
 * Os votos da legislatura, do mais recente, com "Mostrar mais".
 *
 * ⚠️ A ficha trazia 20 dos ~845 votos do deputado mediano e parava ali, sem dizer que
 * havia mais. A contagem de baixo diz quantos são, e quantos deles ficam fora das
 * "votações registradas" do topo por ⛔ terem posição.
 */
function AbaVotos({
  pessoaId,
  legislatura,
  votos,
  total,
  comPosicao,
}: {
  pessoaId: number;
  legislatura: number | null;
  votos: Ficha['votosRecentes'];
  total: number;
  comPosicao: number;
}) {
  const lista = usePaginas(votos, total, votos.length || 20, (pagina) =>
    listarVotos(pessoaId, pagina, votos.length || 20, legislatura),
  );

  if (votos.length === 0) return <p className="vazio">Nenhum voto registrado.</p>;

  const semPosicao = total - comPosicao;

  return (
    <>
      <p className="contagem-lista" aria-live="polite">
        {lista.itens.length} de {total} registros de voto
        {semPosicao > 0 && `, ${semPosicao} deles sem posição (obstrução ou ausência registrada)`}
        {' · '}
        <BotaoBaixarCsv
          rotulo="Baixar todos (CSV)"
          montar={async () => {
            const todos = await buscarTodas((pagina) => listarVotos(pessoaId, pagina, 100, legislatura));
            baixarCsv(
              `votos-${pessoaId}.csv`,
              ['Votação', 'Data', 'Voto', 'Orientação do Governo', 'Matéria', 'Descrição', 'Categoria', 'Proposição', 'Registro'],
              todos.map((v) => [
                v.votacaoId, v.data, rotuloDoVoto(v.valor), v.orientacaoDoGoverno, v.materia,
                v.descricao, v.categoria, v.urlProposicao, v.urlRegistro,
              ]),
            );
          }}
        />
      </p>
      {lista.itens.map((v, i) => (
        <article
          key={v.votacaoId}
          className="linha linha-simples"
          data-tour={i === 0 ? 'ficha-votos' : undefined}
        >
          <div className="linha-corpo">
            <span className={`selo selo-${classeDoVoto(v.valor)}`}>
              {v.valor === 0 ? <Termo nome="abstencao">Abstenção</Termo> : rotuloDoVoto(v.valor)}
            </span>
            <LinhaDoVoto voto={v} />

            <span className="linha-detalhe">
              {formatarData(v.data)}
              <ContraAOrientacao voto={v} />
              {v.urlProposicao && (
                <>
                  {' · '}
                  <LinkDeFonte href={v.urlProposicao}>proposição</LinkDeFonte>
                </>
              )}
              {v.urlRegistro && (
                <>
                  {' · '}
                  <LinkDeFonte href={v.urlRegistro}>registro da votação</LinkDeFonte>
                </>
              )}
            </span>
          </div>
        </article>
      ))}
      <BotaoMostrarMais {...lista} aoClicar={lista.carregarMais} />
    </>
  );
}

/**
 * O enunciado de um voto — e QUAL enunciado depende do que foi votado.
 *
 * 🔴 **A ementa só pode ser a manchete quando o voto foi no MÉRITO.** 📐 Medido em
 * 2026-08-29: 43,2% das linhas desta lista são de rito. Nelas a ementa é do projeto em
 * pauta, mas o voto foi num requerimento — e *"Institui o Imposto sobre Bens e
 * Serviços"* ao lado de um "Sim" faria o leitor concluir que a pessoa votou a favor da
 * reforma tributária, quando ela votou sobre **rito**.
 *
 * ⭐ Então a ordem se inverte: no voto de rito a manchete é o que foi de fato votado
 * (*"Rejeitado o Requerimento"*), e a ementa vira contexto — *"sobre PLP 68/2024: …"*.
 *
 * ⛔ Voto de rito ⛔ não é escondido. Ele existe, é público, e some-lo seria editar o
 * histórico. ⚠️ Mas ele **pesa zero** na afinidade, e a tela diz isso.
 */
function LinhaDoVoto({ voto }: { voto: VotoNaFicha }) {
  const rito = voto.categoria === 'PROCEDIMENTAL';
  const temEmenta = Boolean(voto.ementa);

  return (
    <>
      {rito && (
        <p className="voto-rito">
          <Termo nome="procedimental">questão de rito</Termo> — não é voto no mérito
        </p>
      )}

      <p className="voto-descricao">
        {rito || !temEmenta ? (voto.descricao ?? voto.votacaoId) : voto.ementa}
      </p>

      {/* ⚠️ A outra metade continua visível: no voto de mérito ela identifica QUAL
          votação daquele projeto foi — texto principal, destaque, redação final. Sem
          isso, dois votos opostos do mesmo projeto seriam a mesma linha repetida. */}
      {temEmenta && (
        <p className="voto-processual">
          {voto.materia && <strong>{voto.materia}</strong>}{' '}
          {rito ? voto.ementa : voto.descricao}
        </p>
      )}
    </>
  );
}

/**
 * O que o Governo pediu naquela votação, ao lado do voto.
 *
 * ## 🔴 Sem juízo, ⛔ nem por palavra nem por cor
 *
 * ⛔ Nada de "seguiu ✓" e "contrariou ✗", ⛔ nada de verde e vermelho. Acompanhar ou não
 * a orientação ⛔ não é acerto nem erro — é comportamento, e quem julga é quem lê.
 * Escrito de forma neutra: *"o Governo pediu Não"* e, quando divergiu, *"votou
 * diferente"*, sem adjetivo.
 *
 * ⛔ Silenciosa quando ⛔ não há o que dizer: o Governo não orientou, orientou obstrução
 * ou liberou, ou é o Senado. ⚠️ Uma marca de "sem orientação" em quase toda linha viraria
 * ruído e esconderia as linhas que importam.
 */
function ContraAOrientacao({ voto }: { voto: VotoNaFicha }) {
  const orientacao = voto.orientacaoDoGoverno;

  // ⚠️ Só Sim e Não são comparáveis. `Obstrução` é tática de quórum e `Liberado` é
  //    ausência de orientação — nenhuma das duas é posição de mérito.
  if (orientacao !== 'Sim' && orientacao !== 'Não') return null;
  if (voto.valor !== 1 && voto.valor !== -1) return null;

  const acompanhou = (voto.valor === 1) === (orientacao === 'Sim');

  return (
    <>
      {' · '}
      <span className="voto-orientacao">
        Governo pediu <b>{orientacao}</b>
        {!acompanhou && <em> — votou diferente</em>}
      </span>
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
    <div data-tour="ficha-similares">
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
    </div>
  );
}

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
/**
 * Participação, governismo e disciplina — com que frequência votou, e como pediram a ele.
 *
 * ⭐ A participação vem primeiro: é a pergunta de quem quer saber se o representante trabalha,
 * e ela ⛔ depende de orientação nenhuma. Sempre "X de Y", com o percentual depois.
 *
 * ⚠️ A base fica DENTRO do <dd>: um <small> solto na lista de definições é a violação que o
 * axe acusava aqui.
 */
function FaixaDeAlinhamento({ alinhamento, presenca }: { alinhamento: Alinhamento | null; presenca: Presenca | null }) {
  const governismo = alinhamento?.governismo ?? null;
  const disciplina = alinhamento?.disciplina ?? null;

  if (governismo === null && disciplina === null && !presenca) return null;

  return (
    <dl className="alinhamento" data-tour="ficha-alinhamento">
      {presenca && presenca.votacoes > 0 && (
        <div>
          <dt>
            Participou
            <Termo nome="participacao" />
          </dt>
          <dd>
            {presenca.presente} de {presenca.votacoes}
            <small>
              votações em plenário ({Math.round((presenca.presente / presenca.votacoes) * 100)}%)
              {presenca.ausenteJustificado !== null && presenca.ausenteJustificado > 0 && (
                <> · {presenca.ausenteJustificado} ausências com licença ou missão</>
              )}
            </small>
          </dd>
        </div>
      )}

      {governismo !== null && (
        <div>
          <dt>
            Votou com o Governo
            <Termo nome="orientacao" />
          </dt>
          <dd>
            {Math.round(governismo * 100)}%<small>de {alinhamento!.baseGovernismo} votações orientadas</small>
          </dd>
        </div>
      )}

      {disciplina !== null && (
        <div>
          <dt>Votou com o {alinhamento!.partidoMedido}</dt>
          <dd>
            {Math.round(disciplina * 100)}%<small>de {alinhamento!.baseDisciplina} votações orientadas</small>
          </dd>
        </div>
      )}
    </dl>
  );
}

function AbaNoticias({ pessoaId, primeira }: { pessoaId: number; primeira: PaginaDe<Noticia> }) {
  const lista = usePaginas(primeira.itens, primeira.total, primeira.tamanho, (pagina) =>
    obterNoticias(pessoaId, pagina),
  );

  if (lista.itens.length === 0) {
    return (
      /* ⭐ O estado vazio diz o MOTIVO medido, ⛔ não uma desculpa genérica.
         📐 Em 2026-08-29, na primeira coleta real: 12 de 45 notícias citavam algum
         parlamentar pelo nome. As outras 33 falavam da atividade legislativa sem
         nomear ninguém — "Comissão aprova MP que destina crédito…". ⚠️ O vazio é o
         caso COMUM, e a tela precisa dizer isso ou parece quebrada. */
      <p className="vazio">
        Nenhuma notícia recente cita esta pessoa pelo nome. A maior parte da cobertura
        legislativa fala das votações sem nomear quem votou — e parlamentares de menor
        projeção passam semanas fora da imprensa. Nenhum dos dois é erro.
      </p>
    );
  }

  return (
    <>
      {lista.itens.map((n) => (
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
      <BotaoMostrarMais {...lista} aoClicar={lista.carregarMais} />
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
