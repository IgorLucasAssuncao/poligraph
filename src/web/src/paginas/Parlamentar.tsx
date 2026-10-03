import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  listarSeguidos,
  listarVotos,
  obterFicha,
  type Alinhamento,
  type Ficha,
  type PaginaDe,
  type Presenca,
  type VotoNaFicha,
} from '../api';
import { Avatar } from '../componentes/Avatar';
import { BotaoDoTour } from '../componentes/BotaoDoTour';
import { periodoDaLegislatura } from '../formato';
import { BotaoMostrarMais } from '../componentes/BotaoMostrarMais';
import { BotaoSeguir } from '../componentes/BotaoSeguir';
import { AbaCampanha, AbaCota, AbaEmendas, FaixaDeContas } from '../componentes/ContasDoParlamentar';
import { useContas } from '../componentes/useContas';
import { useLegislaturas } from '../componentes/useLegislatura';
import { BotaoBaixarCsv } from '../componentes/BotaoBaixarCsv';
import { LinkDeFonte } from '../componentes/LinkDeFonte';
import { ComProcedencia } from '../componentes/ModoAnalise';
import { MandatosDoParlamentar } from '../componentes/MandatosDoParlamentar';
import { RedesDoParlamentar } from '../componentes/RedesDoParlamentar';
import { baixarCsv, buscarTodas } from '../exportar';
import { usePaginas } from '../componentes/usePaginas';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';
import { Termo } from '../componentes/Termo';
import { useSessao } from '../sessao';
import { passosDaFicha } from '../tour';
import { EsqueletoDeFicha, EsqueletoDeLista } from '../componentes/Esqueleto';
import { IconeExplorar } from '../componentes/Icones';

const PASSOS_DA_FICHA = passosDaFicha();

/**
 * As abas do perfil, nomeadas pela pergunta — não pela fonte de dado — e cada uma com endereço.
 *
 * DECISÃO: Os três dinheiros eram um modal único, "Ver as contas", que empilhava 13 blocos numa
 * rolagem só, sem endereço para compartilhar. Agora cada um é uma aba: `/parlamentar/194/emendas`
 * abre direto nas emendas, e os três números do topo levam a elas.
 *
 * DECISÃO: `votos` é o padrão porque é o núcleo do trabalho e sempre tem conteúdo.
 */
type Aba = 'votos' | 'emendas' | 'cota' | 'campanha';

const ABAS: [Aba, string][] = [
  ['votos', 'Como vota'],
  ['emendas', 'Emendas'],
  ['cota', 'Cota'],
  ['campanha', 'Campanha'],
];

/**
 * O perfil do parlamentar — a página mais parecida com "rede social" do site.
 *
 * Votou na legislatura corrente — a regra de seguir, a mesma da API.
 *
 * Sem conta, ninguém é seguido — e a lista responderia 401 e derrubaria a ficha.
 *
 * DECISÃO: O nome aparece UMA vez, ao lado da foto. O cabeçalho da coluna era o nome
 * de novo, com "845 votações registradas" repetindo o número do bloco abaixo, e
 * uma capa vazia empurrava o perfil para baixo da dobra no celular (2026-10-01).
 *
 * DECISÃO: Seguir é acompanhar quem está no poder (decisão do autor, 2026-10-02): só
 * para quem votou na legislatura corrente. Quem já segue um ex-parlamentar
 * continua vendo o botão — para poder deixar de seguir.
 *
 * DECISÃO: O porquê de não haver botão, dito na ficha (autor, 2026-10-02): sem isto o perfil
 * inativo parecia só ter perdido o botão.
 *
 * A casa vem primeiro: é o que situa todo o resto. Um "PT · SP" sem ela
 * deixa o leitor sem saber se está diante de deputado ou senador — e as
 * duas casas votam matérias diferentes, então o número de votações e o
 * grafo da pessoa significam coisas distintas.
 *
 * RNF-31: termo institucional como contexto, nunca como controle.
 *
 * DECISÃO: Tudo o que esta ficha mostra pode ser conferido na casa.
 *
 * Os três dinheiros, cada um levando à sua aba.
 *
 * DECISÃO: Antes dos votos: a lista de votos tem centenas de itens, e no celular os
 * "mais parecidos" ficavam depois de ~17 mil pixels (2026-10-01).
 */
export function Parlamentar() {
  const { id, aba: abaDoEndereco } = useParams();
  const pessoaId = Number(id);
  const aba: Aba = ABAS.some(([chave]) => chave === abaDoEndereco) ? (abaDoEndereco as Aba) : 'votos';
  const base = `/parlamentar/${pessoaId}`;
  const { pathname } = useLocation();
  const [busca] = useSearchParams();
  const legislaturaPedida = Number(busca.get('legislatura')) || undefined;
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const { contas, erro: erroDasContas } = useContas(
    pessoaId,
    ficha === null ? 'aguardando' : ficha.legislatura,
  );
  const legislaturas = useLegislaturas();
  const corrente = legislaturas?.[0]?.numero;
  const emExercicio =
    corrente !== undefined && (ficha?.mandatos ?? []).some((m) => m.legislatura === corrente);
  const { usuario } = useSessao();

  const [seguindo, setSeguindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setFicha(null);
    setErro(null);

    Promise.all([
      obterFicha(pessoaId, legislaturaPedida),
      usuario ? listarSeguidos() : Promise.resolve([]),
    ])
      .then(([f, seguidos]) => {
        setFicha(f);
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
        <EsqueletoDeFicha />
      </>
    );
  }

  return (
    <>
      <CabecalhoDaColuna titulo="Parlamentar" comVoltar acao={<BotaoDoTour nome="ficha" passos={PASSOS_DA_FICHA} />} />

      <header className="perfil-cabecalho">
        <div className="perfil-avatar-linha">
          <Avatar nome={ficha.nome} fotoUrl={ficha.urlFoto} tamanho="grande" />

          <div className="perfil-identidade">
            <h1>{ficha.nome}</h1>
            {ficha.nomeCivil !== ficha.nome && <p className="nome-civil">{ficha.nomeCivil}</p>}
          </div>

          {(seguindo || emExercicio) && (
            <BotaoSeguir pessoaId={pessoaId} seguindo={seguindo} aoAlternar={(_, agora) => setSeguindo(agora)} />
          )}
        </div>

        {!seguindo && !emExercicio && corrente !== undefined && (
          <p className="perfil-inativo" role="note">
            Fora do mandato. Só é possível seguir quem está em exercício na legislatura
            atual ({periodoDaLegislatura(corrente)}).
          </p>
        )}

        <div className="perfil-chips">
          {ficha.casa && (
            <span className="chip chip-casa">
              <Termo nome={ficha.casa === 'SENADO' ? 'senado' : 'camara'}>
                {ficha.casa === 'SENADO' ? 'Senador' : 'Deputado'}
              </Termo>
            </span>
          )}
          {ficha.partido && (
            <span className="chip">
              <Termo nome="partido">{ficha.partido}</Termo>
            </span>
          )}
          {ficha.uf && <span className="chip">{ficha.uf}</span>}
        </div>

        <MandatosDoParlamentar mandatos={ficha.mandatos ?? []} atual={ficha.legislatura} caminho={pathname} />

        <p className="perfil-fonte">
          <LinkDeFonte href={ficha.urlFonte}>
            {ficha.casa === 'SENADO' ? 'Página oficial no Senado' : 'Página oficial na Câmara'}
          </LinkDeFonte>
        </p>
        <RedesDoParlamentar redes={ficha.redesSociais ?? []} />

        <div className="perfil-numeros" data-tour="ficha-votacoes">
          <span>
            <ComProcedencia
              consulta={{ contexto: 'votos', pessoa: ficha.id, legislatura: ficha.legislatura ?? undefined }}
              rotulo="Votos com posição"
            >
              <strong>{ficha.nVotacoes.toLocaleString('pt-BR')}</strong>
            </ComProcedencia>{' '}
            <span>votos com posição, em plenário e comissões</span>
          </span>
        </div>

        {(ficha.alinhamento || ficha.presenca) && (
          <FaixaDeAlinhamento alinhamento={ficha.alinhamento} presenca={ficha.presenca} />
        )}

        <FaixaDeContas
          contas={contas}
          base={base}
          sufixo={legislaturaPedida ? `?legislatura=${legislaturaPedida}` : ''}
          mandatoPassado={ficha.legislatura && corrente && ficha.legislatura !== corrente ? ficha.legislatura : null}
        />
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
      {aba === 'cota' && (
        <AbaCota pessoaId={pessoaId} contas={contas} erro={erroDasContas} legislatura={ficha?.legislatura} />
      )}
      {aba === 'campanha' && <AbaCampanha pessoaId={pessoaId} contas={contas} erro={erroDasContas} />}
      {aba === 'votos' && (
        <>
          <AbaSimilares similares={ficha.maisSimilares} />
          <h2 className="titulo-secao">Votos</h2>
          <AbaVotos
            pessoaId={pessoaId}
            legislatura={ficha.legislatura}
            votos={ficha.votosRecentes}
            total={ficha.nRegistrosDeVoto}
            comPosicao={ficha.nVotacoes}
          />
        </>
      )}
    </>
  );

}

/**
 * Os votos da legislatura, do mais recente, com "Mostrar mais".
 *
 * ATENÇÃO: A ficha trazia 20 dos ~845 votos do deputado mediano e parava ali, sem dizer que
 * havia mais. A contagem de baixo diz quantos são, e quantos deles ficam fora das
 * "votações registradas" do topo por não terem posição.
 */
/** Menos que isto não filtra — a mesma regra do servidor (`TamanhoMinimoDaBusca`). */
const BUSCA_MINIMA = 2;

/**
 * Os votos, com busca.
 *
 * DECISÃO: A busca existe porque "como fulano votou na reforma X" exigia rolar centenas de
 * votos em ordem de data (2026-10-02). Ela procura na ementa — o assunto —, na descrição
 * e na matéria ("PEC 45/2019"), sem diferença de acento: quem digita "tributaria" acha.
 *
 * Guardado com o termo que pediu: o resultado de outra busca não aparece sob o termo novo.
 *
 * ATENÇÃO: Espera a digitação parar: cada tecla seria uma consulta.
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
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<{ de: string; pagina: PaginaDe<VotoNaFicha> } | null>(null);
  const [erroDaBusca, setErroDaBusca] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBusca(termo.trim().length >= BUSCA_MINIMA ? termo.trim() : ''), 300);
    return () => clearTimeout(timer);
  }, [termo]);

  useEffect(() => {
    if (!busca) return;
    let atual = true;
    listarVotos(pessoaId, 1, POR_PAGINA_DA_BUSCA, legislatura, busca)
      .then((pagina) => {
        if (!atual) return;
        setErroDaBusca(false);
        setAchados({ de: busca, pagina });
      })
      .catch(() => atual && setErroDaBusca(true));
    return () => {
      atual = false;
    };
  }, [busca, pessoaId, legislatura]);

  if (votos.length === 0) return <p className="vazio">Nenhum voto registrado.</p>;

  const resultado = busca && achados?.de === busca ? achados.pagina : null;

  return (
    <>
      <div className="barra-busca barra-busca-votos">
        <span className="icone-busca" aria-hidden="true">
          <IconeExplorar />
        </span>
        <input
          type="search"
          placeholder="Buscar nos votos: assunto, projeto (PEC 45/2019)…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label="Buscar nos votos"
        />
      </div>

      {erroDaBusca && <p className="erro">Não foi possível buscar agora.</p>}
      {busca && !resultado && !erroDaBusca && <EsqueletoDeLista rotulo="Buscando nos votos" linhas={3} />}

      {busca && resultado ? (
        <ListaDeVotos
          key={busca}
          pessoaId={pessoaId}
          legislatura={legislatura}
          busca={busca}
          votos={resultado.itens}
          total={resultado.total}
          porPagina={POR_PAGINA_DA_BUSCA}
        />
      ) : (
        !busca && (
          <ListaDeVotos
            pessoaId={pessoaId}
            legislatura={legislatura}
            votos={votos}
            total={total}
            comPosicao={comPosicao}
            porPagina={votos.length || 20}
          />
        )
      )}
    </>
  );
}

const POR_PAGINA_DA_BUSCA = 20;

function ListaDeVotos({
  pessoaId,
  legislatura,
  busca,
  votos,
  total,
  comPosicao,
  porPagina,
}: {
  pessoaId: number;
  legislatura: number | null;
  busca?: string;
  votos: VotoNaFicha[];
  total: number;
  /** Só sem busca: a ficha sabe quantos têm posição na legislatura inteira. */
  comPosicao?: number;
  porPagina: number;
}) {
  const lista = usePaginas(votos, total, porPagina, (pagina) =>
    listarVotos(pessoaId, pagina, porPagina, legislatura, busca),
  );

  if (busca && total === 0) {
    return (
      <p className="vazio">
        Nenhum voto com “{busca}” nesta legislatura. A busca olha o assunto do projeto, a
        descrição da votação e o número da matéria.
      </p>
    );
  }

  const semPosicao = comPosicao === undefined ? 0 : total - comPosicao;

  return (
    <>
      <p className="contagem-lista" aria-live="polite">
        {busca ? (
          <>
            {lista.itens.length === total ? total : `${lista.itens.length} de ${total}`}{' '}
            {total === 1 ? 'voto' : 'votos'} com “{busca}”
          </>
        ) : (
          <>
            {lista.itens.length} de {total} registros de voto
            {semPosicao > 0 && `, ${semPosicao} deles sem posição (abstenção, obstrução ou ausência registrada)`}
          </>
        )}
        {' · '}
        <BotaoBaixarCsv
          rotulo={busca ? 'Baixar os encontrados (CSV)' : 'Baixar todos (CSV)'}
          montar={async () => {
            const todos = await buscarTodas((pagina) => listarVotos(pessoaId, pagina, 100, legislatura, busca));
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
 * RISCO: **A ementa só pode ser a manchete quando o voto foi no MÉRITO.** MEDIDO: Medido em
 * 2026-08-29: 43,2% das linhas desta lista são de rito. Nelas a ementa é do projeto em
 * pauta, mas o voto foi num requerimento — e *"Institui o Imposto sobre Bens e
 * Serviços"* ao lado de um "Sim" faria o leitor concluir que a pessoa votou a favor da
 * reforma tributária, quando ela votou sobre **rito**.
 *
 * DECISÃO: Então a ordem se inverte: no voto de rito a manchete é o que foi de fato votado
 * (*"Rejeitado o Requerimento"*), e a ementa vira contexto — *"sobre PLP 68/2024: …"*.
 *
 * Não Voto de rito não é escondido. Ele existe, é público, e some-lo seria editar o
 * histórico. ATENÇÃO: Mas ele **pesa zero** na afinidade, e a tela diz isso.
 *
 * ATENÇÃO: A outra metade continua visível: no voto de mérito ela identifica QUAL
 * votação daquele projeto foi — texto principal, destaque, redação final. Sem
 * isso, dois votos opostos do mesmo projeto seriam a mesma linha repetida.
 */
function LinhaDoVoto({ voto }: { voto: VotoNaFicha }) {
  const rito = voto.categoria === 'PROCEDIMENTAL';
  const temEmenta = Boolean(voto.ementa);

  return (
    <>
      {rito && (
        <p className="voto-rito">
          <Termo nome="procedimental">Questão de rito</Termo>: votou o andamento da proposta, como urgência ou adiamento
        </p>
      )}

      <p className="voto-descricao">
        {rito || !temEmenta ? (voto.descricao ?? voto.votacaoId) : voto.ementa}
      </p>

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
 * ## RISCO: Sem juízo, nem por palavra nem por cor
 *
 * Nada de "seguiu ✓" e "contrariou ✗", nada de verde e vermelho. Acompanhar ou não
 * a orientação não é acerto nem erro — é comportamento, e quem julga é quem lê.
 * Escrito de forma neutra: *"o Governo pediu Não"* e, quando divergiu, *"votou
 * diferente"*, sem adjetivo.
 *
 * Não Silenciosa quando não há o que dizer: o Governo não orientou, orientou obstrução
 * ou liberou, ou é o Senado. ATENÇÃO: Uma marca de "sem orientação" em quase toda linha viraria
 * ruído e esconderia as linhas que importam.
 *
 * ATENÇÃO: Só Sim e Não são comparáveis. `Obstrução` é tática de quórum e `Liberado` é
 * ausência de orientação — nenhuma das duas é posição de mérito.
 */
function ContraAOrientacao({ voto }: { voto: VotoNaFicha }) {
  const orientacao = voto.orientacaoDoGoverno;

  if (orientacao !== 'Sim' && orientacao !== 'Não') return null;
  if (voto.valor !== 1 && voto.valor !== -1) return null;

  const acompanhou = (voto.valor === 1) === (orientacao === 'Sim');

  return (
    <>
      {' · '}
      <span className="voto-orientacao">
        Governo pediu <b>{orientacao}</b>
        {!acompanhou && <em> (votou diferente)</em>}
      </span>
    </>
  );
}

/** Quantos "parecidos" aparecem antes do botão: o bastante para ler o grupo, sem empurrar os votos. */
const SIMILARES_DE_INICIO = 5;

/**
 * DECISÃO: RF-47: estado vazio honesto. Acontece antes de o ETL analítico rodar.
 *
 * nunca percentual — a base aparece junto do número
 */
function AbaSimilares({ similares }: { similares: Ficha['maisSimilares'] }) {
  const [todos, setTodos] = useState(false);

  if (similares.length === 0) {
    return (
      <p className="vazio">A análise de similaridade ainda não rodou para esta legislatura.</p>
    );
  }

  return (
    <section data-tour="ficha-similares">
      <h2 className="titulo-secao">Quem vota parecido</h2>
      {similares.slice(0, todos ? similares.length : SIMILARES_DE_INICIO).map((s) => (
        <LinhaParlamentar
          key={s.pessoaId}
          id={s.pessoaId}
          nome={s.nome}
          partido={s.partido}
          uf=""
          detalhe={
            <>
              votaram igual em <strong>{Math.round(s.valor * s.comuns)}</strong> de{' '}
              <strong>{s.comuns}</strong> votações
            </>
          }
        />
      ))}
      {!todos && similares.length > SIMILARES_DE_INICIO && (
        <div className="carregar-mais">
          <button type="button" className="botao-secundario" onClick={() => setTodos(true)}>
            Ver os {similares.length}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Governismo e disciplina — com que frequência votou como pediram a ele.
 *
 * ## RISCO: O que este bloco NÃO pode fazer
 *
 * Governismo alto não é elogio nem acusação, e a tela não pode sugerir que seja.
 * Sem cor semântica, sem seta, sem comparação com uma média — qualquer um dos
 * três transformaria medição em juízo, que é o que a RNF-16 proíbe.
 *
 * DECISÃO: A base anda junto do percentual, sempre. 80% sobre 15 votações e 80% sobre 900 são
 * afirmações de força muito diferente.
 */
/**
 * Participação, governismo e disciplina — com que frequência votou, e como pediram a ele.
 *
 * DECISÃO: A participação vem primeiro: é a pergunta de quem quer saber se o representante trabalha,
 * e ela não depende de orientação nenhuma. Sempre "X de Y", com o percentual depois.
 *
 * ATENÇÃO: A base fica DENTRO do <dd>: um <small> solto na lista de definições é a violação que o
 * axe acusava aqui.
 *
 * DECISÃO (2026-10-03): Os três números com a mesma forma, "X de Y". O governismo e a disciplina
 * vinham como percentual com a base embaixo, e a ficha mostrava "100%" para quem tinha duas
 * votações orientadas pelo partido. Abaixo de `BASE_PEQUENA` a tela diz que é pouco.
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
            <Termo nome="participacao">Presença</Termo> no plenário
          </dt>
          <dd>
            {inteiro(presenca.presente)} de {inteiro(presenca.votacoes)}
            <small>
              votações ({Math.round((presenca.presente / presenca.votacoes) * 100)}%)
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
            Seguiu a <Termo nome="orientacao">orientação</Termo> do Governo
          </dt>
          <ParteDaBase proporcao={governismo} base={alinhamento!.baseGovernismo} />
        </div>
      )}

      {disciplina !== null && (
        <div>
          <dt>Seguiu a orientação do {alinhamento!.partidoMedido}</dt>
          <ParteDaBase proporcao={disciplina} base={alinhamento!.baseDisciplina} />
        </div>
      )}
    </dl>
  );
}

/**
 * Abaixo disto, a proporção diz pouco: a mesma régua da similaridade, que só compara quem
 * votou junto em 20 votações ou mais (`ck_sim_minimo`).
 */
const BASE_PEQUENA = 20;

/** "540 de 658 votações orientadas (82%)", com o aviso quando a base é pequena. */
function ParteDaBase({ proporcao, base }: { proporcao: number; base: number }) {
  return (
    <dd>
      {inteiro(Math.round(proporcao * base))} de {inteiro(base)}
      <small>
        votações orientadas ({Math.round(proporcao * 100)}%)
        {base < BASE_PEQUENA && <> · poucas para tirar conclusão</>}
      </small>
    </dd>
  );
}

/** Inteiro com separador de milhar. */
function inteiro(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

/**
 * ATENÇÃO: Rótulo neutro, sem cor de juízo (RNF-16). "Sim" e "Não" descrevem o registro;
 * verde e vermelho sugeririam acerto e erro.
 *
 * AUXILIARES DE FORMATAÇÃO
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
