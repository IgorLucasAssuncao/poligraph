import { useEffect, useState } from 'react';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { useCarga } from '../componentes/useCarga';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  listarVotos,
  obterFichaDoPolitico,
  obterFicha,
  type Alinhamento,
  type Ficha,
  type PaginaDe,
  type Presenca,
  type VotoNaFicha,
} from '../api';
import { AvatarComponent } from '../componentes/Avatar';
import { TourDaTelaComponent } from '../componentes/TourDaTela';
import { nomeDePessoa, periodoDaLegislatura } from '../formato';
import { BotaoMostrarMaisComponent } from '../componentes/BotaoMostrarMais';
import { BotaoSeguirComponent } from '../componentes/BotaoSeguir';
import { BotaoCompartilharComponent } from '../componentes/BotaoCompartilhar';
import { AbaCampanhaComponent, AbaCotaComponent, AbaEmendasComponent, FaixaDeContasComponent } from '../componentes/ContasDoParlamentar';
import { useContas } from '../componentes/useContas';
import { useLegislaturas } from '../componentes/useLegislatura';
import { BotaoBaixarCsvComponent } from '../componentes/BotaoBaixarCsv';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { ComProcedenciaComponent } from '../componentes/ModoAuditoria';
import { LinhaDoTempoComponent } from '../componentes/LinhaDoTempo';
import { MandatosDoParlamentarComponent } from '../componentes/MandatosDoParlamentar';
import { PerfilDoCargoComponent } from '../componentes/PerfilDoCargo';
import { RedesDoParlamentarComponent } from '../componentes/RedesDoParlamentar';
import { baixarCsv, buscarTodas } from '../exportar';
import { usePaginas } from '../componentes/usePaginas';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { LinhaParlamentarComponent } from '../componentes/LinhaParlamentar';
import { TermoComponent } from '../componentes/Termo';
import { marcarSeguido, useSeguidos } from '../componentes/useSeguidos';
import { passosDaFicha } from '../tour';
import { EsqueletoDeFichaComponent, EsqueletoDeListaComponent } from '../componentes/Esqueleto';
import { IconeExplorarComponent } from '../componentes/Icones';
import './parlamentar.css';
import {
  BASE_PEQUENA_DO_ALINHAMENTO,
  BUSCA_MINIMA_NOS_VOTOS,
  ORIENTACAO_NAO,
  ORIENTACAO_SIM,
  SIMILARES_DE_INICIO,
  VOTOS_POR_PAGINA_DA_BUSCA,
} from '../constantes';
import { TEXTOS_DA_FICHA as T } from '../textos/parlamentar';

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
type Aba = 'votos' | 'emendas' | 'cota' | 'campanha' | 'linha-do-tempo';

const ABAS: [Aba, string][] = [
  ['votos', T.abas.votos],
  ['emendas', T.abas.emendas],
  ['cota', T.abas.cota],
  ['campanha', T.abas.campanha],
  ['linha-do-tempo', T.abas.linhaDoTempo],
];

/**
 * As abas com um cargo do TSE aberto (prefeito, presidente): só as que o cargo tem. Como vota, emendas e cota são do mandato
 * no Congresso, e somem; a linha do tempo é da pessoa, e fica (pedido do autor, 2026-10-24).
 */
const ABAS_DO_CARGO: ['campanha' | 'linha-do-tempo', string][] = [
  ['campanha', T.abas.campanha],
  ['linha-do-tempo', T.abas.linhaDoTempo],
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
export function ParlamentarComponent() {
  const { idPessoa: idPessoaNaUrl, aba: abaDoEndereco } = useParams();
  const idPessoa = Number(idPessoaNaUrl);
  const aba: Aba = ABAS.some(([chave]) => chave === abaDoEndereco) ? (abaDoEndereco as Aba) : 'votos';
  const base = `/parlamentar/${idPessoa}`;
  const { pathname } = useLocation();
  const [busca] = useSearchParams();
  const legislaturaPedida = Number(busca.get('legislatura')) || undefined;
  const eleicaoPedida = Number(busca.get('eleicao')) || undefined;
  const cargoPedido = busca.get('cargo');
  const lida = useCarga(['ficha', idPessoa, legislaturaPedida ?? null], () => obterFicha(idPessoa, legislaturaPedida), {
    manter: 2,
  });
  const ficha = lida.dados ?? null;
  const erro = lida.erro ? T.erro : null;
  const atualizando = lida.atualizando;
  const { contas, erro: erroDasContas, atualizando: contasAtualizando, chaveDasContas } = useContas(
    idPessoa,
    ficha === null ? 'aguardando' : ficha.legislatura,
  );
  const legislaturas = useLegislaturas();
  const corrente = legislaturas?.[0]?.numero;
  const emExercicio = ficha?.emExercicio ?? false;
  const doTse = useCarga(['politico', idPessoa], () => obterFichaDoPolitico(idPessoa));
  const cargoAberto = eleicaoPedida
    ? doTse.dados?.mandatos.find((m) => m.anoEleicao === eleicaoPedida && m.cargo === cargoPedido)
    : undefined;

  const seguindo = useSeguidos().ids.has(idPessoa);

  if (erro) {
    return (
      <>
        <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar />
        <p className="erro">{erro}</p>
      </>
    );
  }

  if (!ficha) {
    return (
      <>
        <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar />
        <EsqueletoDeFichaComponent />
      </>
    );
  }

  return (
    <>
      <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar acao={<TourDaTelaComponent nome="ficha" passos={PASSOS_DA_FICHA} />} />

      <header className="perfil-cabecalho">
        <div className="perfil-avatar-linha">
          <AvatarComponent nome={nomeDePessoa(ficha.nome)} fotoUrl={ficha.urlFoto} tamanho="grande" />

          <div className="perfil-identidade">
            <h1>
              <ComProcedenciaComponent consulta={{ contexto: 'parlamentar', idPessoa }} rotulo={nomeDePessoa(ficha.nome)}>
                {nomeDePessoa(ficha.nome)}
              </ComProcedenciaComponent>
            </h1>
            {ficha.nomeCivil && nomeDePessoa(ficha.nomeCivil) !== nomeDePessoa(ficha.nome) && <p className="nome-civil">{nomeDePessoa(ficha.nomeCivil)}</p>}
          </div>

          <div className="perfil-acoes">
            {(seguindo || emExercicio) && (
              <BotaoSeguirComponent idPessoa={idPessoa} seguindo={seguindo} aoAlternar={marcarSeguido} />
            )}
            <BotaoCompartilharComponent caminho={`/p/${idPessoa}`} nome={nomeDePessoa(ficha.nome)} />
          </div>
        </div>

        {!seguindo && !emExercicio && corrente !== undefined && (
          <p className="perfil-inativo" role="note">
            {T.foraDoMandato(periodoDaLegislatura(corrente))}
          </p>
        )}

        <div className="perfil-chips">
          {ficha.casa && (
            <span className="chip chip-casa">
              <TermoComponent nome={ficha.casa === 'SENADO' ? 'senado' : 'camara'}>
                {ficha.casa === 'SENADO' ? T.senador : T.deputado}
              </TermoComponent>
            </span>
          )}
          {ficha.partido && (
            <span className="chip">
              <TermoComponent nome="partido">{ficha.partido}</TermoComponent>
            </span>
          )}
          {ficha.uf && <span className="chip">{ficha.uf}</span>}
        </div>

        <MandatosDoParlamentarComponent
          mandatos={ficha.mandatos ?? []}
          doTse={doTse.dados?.mandatos ?? []}
          atual={cargoAberto ? null : ficha.legislatura}
          cargoAberto={cargoAberto}
          caminho={pathname}
        />

        <div className="perfil-links">
          <LinkDeFonteComponent href={ficha.urlFonte}>
            {ficha.casa === 'SENADO' ? T.paginaNoSenado : T.paginaNaCamara}
          </LinkDeFonteComponent>
          <RedesDoParlamentarComponent redes={ficha.redesSociais ?? []} />
        </div>

        {!cargoAberto && (
        <>
        <div className="perfil-numeros atualizavel" data-atualizando={atualizando || undefined} data-tour="ficha-votacoes">
          <span>
            <ComProcedenciaComponent
              consulta={{ contexto: 'votos', idPessoa: ficha.idPessoa, legislatura: ficha.legislatura ?? undefined }}
              rotulo={T.votosComPosicao}
            >
              <strong>{ficha.nVotacoes.toLocaleString('pt-BR')}</strong>
            </ComProcedenciaComponent>{' '}
            <span>{T.votosComPosicaoDefinicao}</span>
          </span>
        </div>

        {(ficha.alinhamento || ficha.presenca) && (
          <FaixaDeAlinhamentoComponent alinhamento={ficha.alinhamento} presenca={ficha.presenca} casa={ficha.casa} />
        )}

        <FaixaDeContasComponent
          contas={contas}
          base={base}
          sufixo={legislaturaPedida ? `?legislatura=${legislaturaPedida}` : ''}
          mandatoPassado={ficha.legislatura && corrente && ficha.legislatura !== corrente ? ficha.legislatura : null}
        />
        </>
        )}
      </header>

      {cargoAberto ? (
        <>
          <nav className="abas" aria-label={T.rotuloDasAbas}>
            {ABAS_DO_CARGO.map(([chave, rotulo]) => {
              const ativa = (aba === 'linha-do-tempo') === (chave === 'linha-do-tempo');
              return (
                <Link
                  key={chave}
                  to={`${chave === 'linha-do-tempo' ? `${base}/linha-do-tempo` : base}?eleicao=${cargoAberto.anoEleicao}&cargo=${cargoAberto.cargo}`}
                  className={`aba ${ativa ? 'aba-ativa' : ''}`}
                  aria-current={ativa ? 'page' : undefined}
                  replace
                >
                  {rotulo}
                </Link>
              );
            })}
          </nav>
          {aba === 'linha-do-tempo' ? (
            <LinhaDoTempoComponent idPessoa={idPessoa} abas={base} />
          ) : (
            <PerfilDoCargoComponent idPessoa={ficha.idPessoa} mandato={cargoAberto} />
          )}
        </>
      ) : (

      <AtualizandoComponent
        atualizando={atualizando || contasAtualizando}
        chave={lida.chaveDoDado ? `${lida.chaveDoDado}|${contas ? chaveDasContas : ''}|${aba}` : undefined}
      >

      <nav className="abas" aria-label={T.rotuloDasAbas}>
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

      {aba === 'emendas' && (
        <AbaEmendasComponent
          idPessoa={idPessoa}
          contas={contas}
          erro={erroDasContas}
          nome={ficha?.nome ?? ''}
          descricao={[T.descricaoDoGrafo(ficha?.casa), [ficha?.partido, ficha?.uf].filter(Boolean).join('-')]
            .filter(Boolean)
            .join(' · ')}
        />
      )}
      {aba === 'cota' && (
        <AbaCotaComponent idPessoa={idPessoa} contas={contas} erro={erroDasContas} legislatura={ficha?.legislatura} />
      )}
      {aba === 'linha-do-tempo' && <LinhaDoTempoComponent idPessoa={idPessoa} abas={base} />}
      {aba === 'campanha' && <AbaCampanhaComponent idPessoa={idPessoa} contas={contas} erro={erroDasContas} />}
      {aba === 'votos' && (
        <>
          <AbaSimilaresComponent similares={ficha.maisSimilares} />
          <h2 className="titulo-secao">
            <ComProcedenciaComponent
              consulta={{ contexto: 'ementas', idPessoa, legislatura: ficha.legislatura ?? undefined }}
              rotulo={T.tituloDosVotos}
            >
              {T.tituloDosVotos}
            </ComProcedenciaComponent>
          </h2>
          <AbaVotosComponent
            idPessoa={idPessoa}
            legislatura={ficha.legislatura}
            votos={ficha.votosRecentes}
            total={ficha.nRegistrosDeVoto}
            comPosicao={ficha.nVotacoes}
          />
        </>
      )}
      </AtualizandoComponent>
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
function AbaVotosComponent({
  idPessoa,
  legislatura,
  votos,
  total,
  comPosicao,
}: {
  idPessoa: number;
  legislatura: number | null;
  votos: Ficha['votosRecentes'];
  total: number;
  comPosicao: number;
}) {
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  const [semRito, setSemRito] = useState(false);
  const filtrando = Boolean(busca) || semRito;
  const achados = useCarga(
    ['votos-buscados', idPessoa, legislatura, busca, semRito],
    () => listarVotos(idPessoa, 1, VOTOS_POR_PAGINA_DA_BUSCA, legislatura, busca || undefined, semRito),
    { ativo: filtrando, manter: 3 },
  );
  const erroDaBusca = achados.erro;

  useEffect(() => {
    const timer = setTimeout(() => setBusca(termo.trim().length >= BUSCA_MINIMA_NOS_VOTOS ? termo.trim() : ''), 300);
    return () => clearTimeout(timer);
  }, [termo]);

  if (votos.length === 0) return <p className="vazio">{T.votos.nenhum}</p>;

  const resultado: PaginaDe<VotoNaFicha> | null = filtrando && !achados.atualizando ? (achados.dados ?? null) : null;

  return (
    <>
      <div className="barra-busca barra-busca-votos">
        <span className="icone-busca" aria-hidden="true">
          <IconeExplorarComponent />
        </span>
        <input
          type="search"
          placeholder={T.votos.placeholder}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label={T.votos.rotuloDaBusca}
        />
      </div>
      <label className="filtro-rito">
        <input type="checkbox" checked={semRito} onChange={(e) => setSemRito(e.target.checked)} />
        {T.votos.semRito}
      </label>

      {erroDaBusca && <p className="erro">{T.votos.erroDaBusca}</p>}
      {filtrando && !resultado && !erroDaBusca && <EsqueletoDeListaComponent rotulo={T.votos.buscando} linhas={3} />}

      {filtrando && resultado ? (
        <ListaDeVotosComponent
          key={`${busca}|${semRito}`}
          idPessoa={idPessoa}
          legislatura={legislatura}
          busca={busca || undefined}
          semRito={semRito}
          votos={resultado.itens}
          total={resultado.total}
          porPagina={VOTOS_POR_PAGINA_DA_BUSCA}
        />
      ) : (
        !filtrando && (
          <ListaDeVotosComponent
            idPessoa={idPessoa}
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


function ListaDeVotosComponent({
  idPessoa,
  legislatura,
  busca,
  semRito = false,
  votos,
  total,
  comPosicao,
  porPagina,
}: {
  idPessoa: number;
  legislatura: number | null;
  busca?: string;
  semRito?: boolean;
  votos: VotoNaFicha[];
  total: number;
  /** Só sem busca: a ficha sabe quantos têm posição na legislatura inteira. */
  comPosicao?: number;
  porPagina: number;
}) {
  const lista = usePaginas(votos, total, porPagina, (pagina) =>
    listarVotos(idPessoa, pagina, porPagina, legislatura, busca, semRito),
  );

  if (busca && total === 0) {
    return <p className="vazio">{T.votos.nenhumComBusca(busca)}</p>;
  }

  const semPosicao = comPosicao === undefined ? 0 : total - comPosicao;

  return (
    <>
      <p className="contagem-lista" aria-live="polite">
        {busca ? (
          T.votos.contagemDaBusca(
            lista.itens.length === total ? String(total) : T.votos.deTotal(lista.itens.length, total),
            total,
            busca,
          )
        ) : semRito ? (
          T.votos.contagemSemRito(lista.itens.length, total)
        ) : (
          <>
            {T.votos.contagem(lista.itens.length, total)}
            {semPosicao > 0 && T.votos.semPosicao(semPosicao)}
          </>
        )}
        {' · '}
        <BotaoBaixarCsvComponent
          rotulo={busca ? T.votos.baixarEncontrados : T.votos.baixarTodos}
          montar={async () => {
            const todos = await buscarTodas((pagina) => listarVotos(idPessoa, pagina, 100, legislatura, busca, semRito));
            baixarCsv(
              T.votos.arquivo(idPessoa),
              [...T.votos.colunas],
              todos.map((v) => [
                v.votacaoId, v.data, rotuloDoVoto(v.valor), v.orientacaoDoGoverno, v.materia,
                v.descricao, v.categoria, v.urlProposicao, v.urlRegistro, v.urlInteiroTeor ?? null,
              ]),
            );
          }}
        />
      </p>
      {agruparPorProposicao(lista.itens).map((grupo, i) =>
        grupo.length === 1 ? (
          <VotoComponent key={grupo[0].votacaoId} voto={grupo[0]} tour={i === 0} />
        ) : (
          <GrupoDeVotosComponent key={grupo[0].votacaoId} votos={grupo} tour={i === 0} />
        ),
      )}
      <BotaoMostrarMaisComponent {...lista} aoClicar={lista.carregarMais} />
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
function LinhaDoVotoComponent({ voto }: { voto: VotoNaFicha }) {
  const rito = voto.categoria === 'PROCEDIMENTAL';
  const temEmenta = Boolean(voto.ementa);

  return (
    <>
      {rito && (
        <p className="voto-rito">{T.votos.rito}</p>
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
function ContraAOrientacaoComponent({ voto }: { voto: VotoNaFicha }) {
  const orientacao = voto.orientacaoDoGoverno;

  if (orientacao !== ORIENTACAO_SIM && orientacao !== ORIENTACAO_NAO) return null;
  if (voto.valor !== 1 && voto.valor !== -1) return null;

  const acompanhou = (voto.valor === 1) === (orientacao === ORIENTACAO_SIM);

  return (
    <>
      {' · '}
      <span className="voto-orientacao">{T.votos.governoPediu(orientacao, acompanhou)}</span>
    </>
  );
}


/**
 * DECISÃO: RF-47: estado vazio honesto. Acontece antes de o ETL analítico rodar.
 *
 * nunca percentual — a base aparece junto do número
 */
function AbaSimilaresComponent({ similares }: { similares: Ficha['maisSimilares'] }) {
  const [todos, setTodos] = useState(false);

  if (similares.length === 0) {
    return <p className="vazio">{T.similares.vazio}</p>;
  }

  return (
    <section data-tour="ficha-similares">
      <h2 className="titulo-secao">{T.similares.titulo}</h2>
      {similares.slice(0, todos ? similares.length : SIMILARES_DE_INICIO).map((s) => (
        <LinhaParlamentarComponent
          key={s.idPessoa}
          idPessoa={s.idPessoa}
          nome={s.nome}
          partido={s.partido}
          uf={s.uf ?? ''}
          fotoUrl={s.urlFoto ?? null}
          detalhe={T.similares.detalhe(Math.round(s.valor * s.comuns), s.comuns)}
        />
      ))}
      {!todos && similares.length > SIMILARES_DE_INICIO && (
        <div className="carregar-mais">
          <button type="button" className="botao-secundario" onClick={() => setTodos(true)}>
            {T.similares.verTodos(similares.length)}
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
 * votações orientadas pelo partido. Abaixo de `BASE_PEQUENA_DO_ALINHAMENTO` a tela diz que é pouco.
 */
function FaixaDeAlinhamentoComponent({
  alinhamento,
  presenca,
  casa,
}: {
  alinhamento: Alinhamento | null;
  presenca: Presenca | null;
  casa: Ficha['casa'];
}) {
  const governismo = alinhamento?.governismo ?? null;
  const disciplina = alinhamento?.disciplina ?? null;

  if (governismo === null && disciplina === null && !presenca) return null;

  return (
    <dl className="alinhamento" data-tour="ficha-alinhamento">
      {presenca && presenca.votacoes > 0 && (
        <div>
          <dt>{T.alinhamento.presenca}</dt>
          <dd>
            {inteiro(presenca.presente)} de {inteiro(presenca.votacoes)}
            <small>
              {T.alinhamento.votacoes(Math.round((presenca.presente / presenca.votacoes) * 100))}
              {presenca.ausenteJustificado !== null && presenca.ausenteJustificado > 0 &&
                T.alinhamento.ausencias(presenca.ausenteJustificado)}
            </small>
            {presenca.medianaDaCasa != null && (
              <small>{T.alinhamento.medianaDaCasa(casa, Math.round(presenca.medianaDaCasa * 100))}</small>
            )}
          </dd>
        </div>
      )}

      {governismo !== null && (
        <div>
          <dt>{T.alinhamento.governo}</dt>
          <ParteDaBaseComponent proporcao={governismo} base={alinhamento!.baseGovernismo} mediana={alinhamento!.medianaGovernismo} />
        </div>
      )}

      {disciplina !== null && (
        <div>
          <dt>{T.alinhamento.partido(alinhamento!.partidoMedido)}</dt>
          <ParteDaBaseComponent proporcao={disciplina} base={alinhamento!.baseDisciplina} mediana={alinhamento!.medianaDisciplina} />
        </div>
      )}
    </dl>
  );
}


/**
 * "540 de 658 votações orientadas (82%)", com o aviso quando a base é pequena e a mediana da
 * Câmara, que dá a escala do número.
 */
function ParteDaBaseComponent({ proporcao, base, mediana }: { proporcao: number; base: number; mediana?: number | null }) {
  return (
    <dd>
      {inteiro(Math.round(proporcao * base))} de {inteiro(base)}
      <small>
        {T.alinhamento.votacoesOrientadas(Math.round(proporcao * 100))}
        {base < BASE_PEQUENA_DO_ALINHAMENTO && T.alinhamento.basePequena}
      </small>
      {mediana != null && <small>{T.alinhamento.medianaDaCamara(Math.round(mediana * 100))}</small>}
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
  if (valor === 1) return T.rotuloDoVoto.sim;
  if (valor === -1) return T.rotuloDoVoto.nao;
  if (valor === 0) return T.rotuloDoVoto.abstencao;

  return T.rotuloDoVoto.ausente;
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

/**
 * Votos seguidos sobre a mesma proposição viram um grupo (2026-10-03): a lista repetia a mesma
 * ementa em cada votação de um projeto (urgência, texto, destaques), e virava parede de texto.
 * Só junta vizinhos: a ordem continua a das datas.
 */
function agruparPorProposicao(votos: VotoNaFicha[]): VotoNaFicha[][] {
  const grupos: VotoNaFicha[][] = [];
  for (const voto of votos) {
    const ultimo = grupos.at(-1);
    if (ultimo && voto.materia && ultimo[0].materia === voto.materia) ultimo.push(voto);
    else grupos.push([voto]);
  }
  return grupos;
}

/** Um voto sozinho: o selo, o enunciado e os links. */
function VotoComponent({ voto: v, tour }: { voto: VotoNaFicha; tour: boolean }) {
  return (
    <article className="linha linha-simples" data-tour={tour ? 'ficha-votos' : undefined}>
      <div className="linha-corpo">
        <SeloDoVotoComponent voto={v} />
        <LinhaDoVotoComponent voto={v} />
        <DetalheDoVotoComponent voto={v} />
      </div>
    </article>
  );
}

/** Várias votações da mesma proposição: a matéria e a ementa uma vez, e uma linha curta por votação. */
function GrupoDeVotosComponent({ votos, tour }: { votos: VotoNaFicha[]; tour: boolean }) {
  const primeiro = votos[0];

  return (
    <article className="linha linha-simples grupo-de-votos" data-tour={tour ? 'ficha-votos' : undefined}>
      <div className="linha-corpo">
        <p className="voto-descricao">
          <strong>{primeiro.materia}</strong> {primeiro.ementa ?? ''}
        </p>
        <p className="grupo-de-votos-conta">{T.votos.votacoesNaProposicao(votos.length)}</p>
        <ul className="grupo-de-votos-lista">
          {votos.map((v) => (
            <li key={v.votacaoId}>
              <SeloDoVotoComponent voto={v} />
              <div>
                {v.categoria === 'PROCEDIMENTAL' && (
                  <span className="voto-rito">{T.votos.ritoCurto}</span>
                )}
                <span className="voto-processual">{v.descricao ?? v.votacaoId}</span>
                <DetalheDoVotoComponent voto={v} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** O selo neutro do voto (RNF-16): Sim e Não se distinguem por borda, nunca por verde e vermelho. */
function SeloDoVotoComponent({ voto: v }: { voto: VotoNaFicha }) {
  return (
    <span className={`selo selo-${classeDoVoto(v.valor)}`}>
      {v.valor === 0 ? T.votos.abstencao : rotuloDoVoto(v.valor)}
    </span>
  );
}

/** Data, orientação do Governo e os links da proposição, do texto integral e do registro. */
function DetalheDoVotoComponent({ voto: v }: { voto: VotoNaFicha }) {
  return (
    <span className="linha-detalhe">
      {formatarData(v.data)}
      <ContraAOrientacaoComponent voto={v} />
      {v.urlProposicao && (
        <>
          {' · '}
          <LinkDeFonteComponent href={v.urlProposicao}>{T.votos.proposicao}</LinkDeFonteComponent>
        </>
      )}
      {v.urlInteiroTeor && (
        <>
          {' · '}
          <LinkDeFonteComponent href={v.urlInteiroTeor}>{T.votos.inteiroTeor}</LinkDeFonteComponent>
        </>
      )}
      {v.urlRegistro && (
        <>
          {' · '}
          <LinkDeFonteComponent href={v.urlRegistro}>{T.votos.registro}</LinkDeFonteComponent>
        </>
      )}
    </span>
  );
}
