import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  buscarMunicipios,
  listarConveniosDaCidade,
  listarFavorecidosDoMunicipio,
  listarParlamentaresDoMunicipio,
  obterEmendasDoMunicipio,
  obterMapaDoBrasil,
  obterMapaDoEstado,
  type EmendasDoMunicipio,
  type MapaDoBrasil,
  type MapaDoEstado,
  type Municipio,
  type Periodo,
} from '../api';
import { AbasDoDinheiroComponent } from '../componentes/AbasDoDinheiro';
import { ColetivosComponent, LinhaDoParlamentarComponent } from '../componentes/AutoresDaEmenda';
import { BotaoBaixarCsvComponent } from '../componentes/BotaoBaixarCsv';
import { BotaoDoTourComponent } from '../componentes/BotaoDoTour';
import { BotaoMostrarMaisComponent } from '../componentes/BotaoMostrarMais';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { MapaCoropleticoComponent } from '../componentes/MapaCoropletico';
import { SeletorDePeriodoComponent } from '../componentes/SeletorDePeriodo';
import { TermoComponent } from '../componentes/Termo';
import { usePaginas } from '../componentes/usePaginas';
import { baixarCsv, buscarTodas } from '../exportar';
import { FONTES } from '../fontes';
import { minusculas, nomeProprio, reais, reaisCompacto } from '../formato';
import { areaQueContem } from '../mapa';
import { passosDasEmendas } from '../tour';
import { BlocoComponent, EsqueletoComponent, EsqueletoDePainelComponent, EsqueletoDeTextoComponent } from '../componentes/Esqueleto';
import { UFS } from '../ufs';
import { ConfereComOPortalComponent } from '../componentes/ConfereComOPortal';
import { ComProcedenciaComponent } from '../componentes/ModoAuditoria';
import { NumeroComponent, OpcoesComponent } from '../componentes/Dados';

/**
 * Para onde foi o dinheiro de emenda, no mapa — e quem o mandou para a sua cidade.
 *
 * ## RISCO: O que a página afirma, e o que não *
 * - A cidade é a da **sede de quem recebeu**, não a da obra. Para a prefeitura e o órgão
 *   municipal as duas coincidem; para uma entidade ou empresa, não necessariamente. O
 *   painel da cidade separa as duas partes.
 * - O que não tem sede some do mapa, não da conta: o repasse pelo intermediário e o pago a
 *   pessoa ficam declarados, com valor, acima do mapa.
 * - **Bancada e comissão não são pessoas.** A emenda tem três autores possíveis (CF, art.
 *   166), e só o individual é um deputado ou senador. Os outros dois vêm em lista própria,
 *   explicados: misturados, liam como se "Bancada de Minas Gerais" fosse um político.
 * - A ordem das listas é a do valor. Sem cor de partido e sem ranking de "quem mais
 *   trouxe" como mérito (RNF-16).
 *
 * ## O período
 *
 * O padrão são TODOS os anos carregados: "quem mandou dinheiro para a minha cidade" se
 * responde pela legislatura, e ir de ano em ano obrigava a somar de cabeça. O período fica
 * no endereço, e o link compartilhado abre o mesmo recorte.
 *
 * ## Sua cidade
 *
 * O login não traz cidade, e a página não pergunta ao servidor onde a pessoa está. A cidade
 * é escolhida na busca ou achada pela localização DENTRO do navegador, contra a própria
 * malha; só o código IBGE vai ao servidor, e fica guardado neste navegador.
 *
 * A cidade guardada abre UMA vez, na chegada. Reabri-la toda vez que o endereço fica
 * sem estado e sem cidade prendia a pessoa nela: "Ver o Brasil" limpa os dois, e a
 * cidade voltava no mesmo instante.
 *
 * O painel da cidade fica ABAIXO do mapa: o mapa é por onde se escolhe, e empurrá-lo
 * para baixo a cada escolha obrigava a rolar de volta. Escolhida no mapa ou na lista, a
 * página desce até o painel; chegando com a cidade guardada, não — a pessoa ainda não fez nada.
 *
 * ATENÇÃO: Mesmo nome da aba: ela dizia "Sua cidade" e a página abria como "Emendas no
 * mapa", e quem clicava não sabia se tinha chegado aonde queria (2026-10-01).
 */
export function EmendasComponent() {
  const [parametros, setParametros] = useSearchParams();
  const de = parametros.get('de');
  const ate = parametros.get('ate');
  const periodo = useMemo(() => periodoDoEndereco(de, ate), [de, ate]);
  const chaveDoPeriodo = periodo ? `${periodo.de}-${periodo.ate}` : 'todos';
  const uf = parametros.get('uf');
  const cidade = parametros.get('cidade');

  const [brasil, setBrasil] = useState<MapaDoBrasil | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let atual = true;
    obterMapaDoBrasil(periodo)
      .then((novo) => atual && setBrasil(novo))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [periodo]);

  const chegou = useRef(false);

  useEffect(() => {
    if (chegou.current) return;
    chegou.current = true;
    if (cidade || uf) return;
    const guardada = lerMinhaCidade();
    if (guardada) {
      setParametros((p) => comParametros(p, { uf: guardada.uf, cidade: guardada.codigoIbge }), { replace: true });
    }
  }, [cidade, uf, setParametros]);

  const mudar = (novos: Record<string, string | null>) => setParametros((p) => comParametros(p, novos));

  const [escolheuAgora, setEscolheuAgora] = useState(false);
  const painel = cidade ? (
    <PainelDaCidadeComponent
      key={`${cidade}-${chaveDoPeriodo}`}
      codigoIbge={cidade}
      periodo={periodo}
      rolarAteAqui={escolheuAgora}
      aoFechar={() => mudar({ cidade: null })}
    />
  ) : null;
  const passos = useMemo(() => passosDasEmendas(), []);

  return (
    <>
      <AbasDoDinheiroComponent />
      <CabecalhoDaColunaComponent
        titulo="Emendas por cidade"
        subtitulo="Para onde foi o dinheiro de emenda parlamentar"
        acao={<BotaoDoTourComponent nome="emendas" passos={passos} />}
      />

      <SuaCidadeComponent
        aoEscolher={(m) => {
          setEscolheuAgora(true);
          guardarMinhaCidade(m);
          mudar({ uf: m.uf, cidade: m.codigoIbge });
        }}
      />

      {erro && <p className="erro">Não foi possível carregar o mapa das emendas agora.</p>}
      {!erro && !brasil && <EsqueletoDePainelComponent rotulo="Carregando o mapa das emendas" alturaDoGrafico={420} />}

      {brasil && brasil.anosDisponiveis.length === 0 && (
        <p className="vazio">
          As emendas ainda não foram carregadas. Elas aparecem depois da próxima execução do ETL.
        </p>
      )}

      {brasil && brasil.anosDisponiveis.length > 0 && (
        <>
          <SeletorDePeriodoComponent
            anos={brasil.anosDisponiveis}
            periodo={brasil.periodo}
            rotulo="Período das emendas"
            tour="emendas-periodo"
            aoMudar={(novo) =>
              mudar(novo ? { de: String(novo.de), ate: String(novo.ate) } : { de: null, ate: null })
            }
          >
            Emendas de <strong>{textoDoPeriodo(brasil.periodo)}</strong>, pagas até hoje. A cidade é a{' '}
            <TermoComponent nome="sedeDoFavorecido" />.
          </SeletorDePeriodoComponent>

          <ForaDoMapaComponent brasil={brasil} />
          <ConfereComOPortalComponent periodo={brasil.periodo} />

          {uf ? (
            <MapaDaUfComponent
              key={`${uf}-${chaveDoPeriodo}`}
              uf={uf}
              periodo={periodo}
              cidade={cidade}
              aoVoltar={() => mudar({ uf: null, cidade: null })}
              aoEscolher={(codigo) => {
                setEscolheuAgora(true);
                mudar({ cidade: codigo });
              }}
            >
              {painel}
            </MapaDaUfComponent>
          ) : (
            <>
              <MapaDoPaisComponent brasil={brasil} aoEscolher={(sigla) => mudar({ uf: sigla, cidade: null })} />
              {painel}
            </>
          )}

          <p className="fonte-dado">
            Fontes: <LinkDeFonteComponent href={FONTES.emendas.url}>{FONTES.emendas.nome}</LinkDeFonteComponent>;{' '}
            <LinkDeFonteComponent href={FONTES.cnpj.url}>{FONTES.cnpj.nome}</LinkDeFonteComponent>, para a sede;{' '}
            <LinkDeFonteComponent href={FONTES.malhas.url}>{FONTES.malhas.nome}</LinkDeFonteComponent>.
          </p>
        </>
      )}
    </>
  );
}

/**
 * O que o mapa não mostra, com valor — somem do desenho, não da conta.
 *
 * ATENÇÃO: A definição diz o que o número É em português de todo dia. "Pelo Banco do Brasil ·
 * que só repassa" exigia saber que o banco é intermediário de pagamento (2026-10-01).
 */
function ForaDoMapaComponent({ brasil }: { brasil: MapaDoBrasil }) {
  const periodo = brasil.periodo;
  const numeros: [string, number, string][] = [
    ['Pago em emendas', brasil.recebido, 'das emendas do período, pago até hoje'],
    ['No mapa', brasil.noMapa, 'sabemos em que cidade fica quem recebeu'],
    ['Repassado por banco', brasil.viaIntermediario, 'foi ao Banco do Brasil, que paga adiante; o destino final não está no dado'],
    ['Sem cidade', brasil.semSede, 'pago a pessoas ou a quem não foi identificado'],
  ];

  return (
    <section className="numeros-do-ano" aria-label="O dinheiro das emendas do período" data-tour="emendas-numeros">
      {numeros.map(([rotulo, valor, definicao]) => (
        <NumeroComponent key={rotulo} rotulo={rotulo} definicao={definicao}>
          {rotulo === 'Pago em emendas' ? (
            <ComProcedenciaComponent
              consulta={{ contexto: 'pagamentos', de: periodo.de, ate: periodo.ate }}
              rotulo={`Pago nas emendas de ${textoDoPeriodo(periodo)}`}
            >
              {reaisCompacto(valor)}
            </ComProcedenciaComponent>
          ) : (
            reaisCompacto(valor)
          )}
        </NumeroComponent>
      ))}
    </section>
  );
}

/**
 * O mapa do país em duas leituras: o total recebido, e o recebido por habitante.
 *
 * DECISÃO (2026-10-03): em reais absolutos, SP e MG ficam no topo só por serem grandes. Por
 * habitante (estimativa do IBGE, carga `populacao`) mostra onde a emenda pesa. O total continua
 * o padrão; a outra leitura só aparece com população para todos os estados.
 */
function MapaDoPaisComponent({ brasil, aoEscolher }: { brasil: MapaDoBrasil; aoEscolher: (sigla: string) => void }) {
  const [porHabitante, setPorHabitante] = useState(false);
  const temPopulacao = brasil.porUf.length > 0 && brasil.porUf.every((u) => (u.populacao ?? 0) > 0);
  const habitante = porHabitante && temPopulacao;
  const valorDe = useCallback(
    (u: MapaDoBrasil['porUf'][number]) => (habitante ? u.recebido / (u.populacao ?? 1) : u.recebido),
    [habitante],
  );
  const valores = useMemo(() => new Map(brasil.porUf.map((u) => [u.codigoUf, valorDe(u)])), [brasil, valorDe]);
  const siglaPorCodigo = useMemo(() => new Map(UFS), []);
  const ordenadas = [...brasil.porUf].sort((a, b) => valorDe(b) - valorDe(a));
  const porPessoa = (valor: number) => `R$ ${Math.round(valor).toLocaleString('pt-BR')}`;

  return (
    <section className="governo-secao">
      <h2>Por estado</h2>
      <p className="ajuda">Escolha um estado para ver as cidades.</p>
      {temPopulacao && (
        <OpcoesComponent
          rotulo="Leitura do mapa"
          opcoes={[
            { valor: false, rotulo: 'Total recebido' },
            { valor: true, rotulo: 'Por habitante' },
          ]}
          escolhida={habitante}
          aoEscolher={setPorHabitante}
        >
          {habitante && brasil.anoDaPopulacao && (
            <span className="ajuda">Reais por habitante, com a população estimada pelo IBGE para {brasil.anoDaPopulacao}.</span>
          )}
        </OpcoesComponent>
      )}

      <div data-tour="emendas-mapa">
        <MapaCoropleticoComponent
          malha="brasil"
          valores={valores}
          nomes={siglaPorCodigo}
          focavel
          formatar={habitante ? porPessoa : undefined}
          rotulo={`Mapa do Brasil: dinheiro de emenda de ${textoDoPeriodo(brasil.periodo)} por estado${habitante ? ', por habitante' : ''}`}
          aoEscolher={(codigo) => {
            const sigla = siglaPorCodigo.get(codigo);
            if (sigla) aoEscolher(sigla);
          }}
        />
      </div>

      <div className="tabela-rolavel">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">Dinheiro de emenda por estado, pela sede de quem recebeu</caption>
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Recebido</th>
              {temPopulacao && <th scope="col">Por habitante</th>}
              <th scope="col">Cidades</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((u) => (
              <tr key={u.uf}>
                <th scope="row">
                  <button type="button" className="link-botao" onClick={() => aoEscolher(u.uf)}>
                    {u.uf}
                  </button>
                </th>
                <td>{reaisCompacto(u.recebido)}</td>
                {temPopulacao && <td>{reais(u.recebido / (u.populacao ?? 1))}</td>}
                <td>{u.municipios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BotaoBaixarCsvComponent
        rotulo="Baixar por estado (CSV)"
        montar={() =>
          baixarCsv(
            `emendas-por-estado-${nomeDoArquivo(brasil.periodo)}.csv`,
            ['UF', 'Código IBGE', 'Recebido', 'População', 'Cidades'],
            ordenadas.map((u) => [u.uf, u.codigoUf, u.recebido, u.populacao ?? '', u.municipios]),
          )
        }
      />
    </section>
  );
}

const CIDADES_POR_VEZ = 15;

/**
 * O estado: o contorno das cidades aparece já, e as cores quando o dado chega — a malha e
 * o dado são pedidos juntos, não um depois do outro.
 */
function MapaDaUfComponent({
  uf,
  periodo,
  cidade,
  aoVoltar,
  aoEscolher,
  children,
}: {
  uf: string;
  periodo: Periodo | undefined;
  cidade: string | null;
  aoVoltar: () => void;
  aoEscolher: (codigo: string) => void;
  /** O painel da cidade escolhida: entre o mapa e a lista, perto de onde se clicou. */
  children?: ReactNode;
}) {
  const [estado, setEstado] = useState<MapaDoEstado | null>(null);
  const [erro, setErro] = useState(false);
  const [exibidas, setExibidas] = useState(CIDADES_POR_VEZ);
  const [porHabitante, setPorHabitante] = useState(false);

  useEffect(() => {
    let atual = true;
    obterMapaDoEstado(uf, periodo)
      .then((novo) => atual && setEstado(novo))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [uf, periodo]);

  const comDinheiro = estado?.porMunicipio.filter((m) => m.recebido > 0) ?? [];
  const temPopulacao = comDinheiro.length > 0 && comDinheiro.every((m) => (m.populacao ?? 0) > 0);
  const habitante = porHabitante && temPopulacao;
  const valorDe = useCallback(
    (m: MapaDoEstado['porMunicipio'][number]) => (habitante ? m.recebido / (m.populacao ?? 1) : m.recebido),
    [habitante],
  );
  const valores = useMemo(
    () => (estado ? new Map(estado.porMunicipio.map((m) => [m.codigoIbge, valorDe(m)])) : null),
    [estado, valorDe],
  );
  const nomes = useMemo(
    () => new Map((estado?.porMunicipio ?? []).map((m) => [m.codigoIbge, nomeProprio(m.nome)])),
    [estado],
  );
  const receberam = useMemo(
    () => (estado?.porMunicipio ?? []).filter((m) => m.recebido > 0).sort((a, b) => valorDe(b) - valorDe(a)),
    [estado, valorDe],
  );
  const codigoUf = UFS.find(([, sigla]) => sigla === uf)?.[0];

  return (
    <section className="governo-secao">
      <div className="mapa-titulo">
        <h2>{uf}</h2>
        <button type="button" className="botao-secundario" onClick={aoVoltar}>
          Ver o Brasil
        </button>
      </div>

      {erro && <p className="erro">Não foi possível carregar as cidades de {uf}.</p>}
      {estado && (
        <p className="ajuda">
          {reaisCompacto(estado.recebido)} a quem tem sede em {receberam.length} das {estado.porMunicipio.length}{' '}
          cidades de {uf}. Escolha uma cidade no mapa ou na lista.
        </p>
      )}

      {temPopulacao && (
        <OpcoesComponent
          rotulo="Leitura do mapa"
          opcoes={[
            { valor: false, rotulo: 'Total recebido' },
            { valor: true, rotulo: 'Por habitante' },
          ]}
          escolhida={habitante}
          aoEscolher={setPorHabitante}
        >
          {habitante && <span className="ajuda">Reais por habitante. Cidade pequena com uma emenda grande sobe muito.</span>}
        </OpcoesComponent>
      )}

      {codigoUf && (
        <div data-tour="emendas-mapa">
          <MapaCoropleticoComponent
            malha={codigoUf}
            valores={valores}
            nomes={nomes}
            selecionado={cidade}
            formatar={habitante ? (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}` : undefined}
            rotulo={`Mapa de ${uf}: dinheiro de emenda por cidade${habitante ? ', por habitante' : ''}`}
            aoEscolher={aoEscolher}
          />
        </div>
      )}

      {children}

      {!erro && !estado && (
        <EsqueletoComponent rotulo="Carregando as cidades">
          <BlocoComponent altura={360} />
        </EsqueletoComponent>
      )}

      {estado && (
        <>
          <ol className="lista-cidades">
            {receberam.slice(0, exibidas).map((m) => (
              <li key={m.codigoIbge}>
                <button
                  type="button"
                  className="link-botao"
                  aria-current={m.codigoIbge === cidade ? 'true' : undefined}
                  onClick={() => aoEscolher(m.codigoIbge)}
                >
                  {nomeProprio(m.nome)}
                </button>
                <span className="valor">
                  {habitante ? `${reais(valorDe(m))} por habitante` : reaisCompacto(m.recebido)}
                </span>
              </li>
            ))}
          </ol>

          <BotaoMostrarMaisComponent
            proximos={Math.min(CIDADES_POR_VEZ, receberam.length - exibidas)}
            restantes={Math.max(0, receberam.length - exibidas)}
            carregando={false}
            erro={false}
            aoClicar={() => setExibidas((n) => n + CIDADES_POR_VEZ)}
          />

          <BotaoBaixarCsvComponent
            rotulo={`Baixar as cidades de ${uf} (CSV)`}
            montar={() =>
              baixarCsv(
                `emendas-${uf}-${nomeDoArquivo(estado.periodo)}.csv`,
                ['Código IBGE', 'Cidade', 'Recebido'],
                estado.porMunicipio.map((m) => [m.codigoIbge, m.nome, m.recebido]),
              )
            }
          />
        </>
      )}
    </section>
  );
}

function PainelDaCidadeComponent({
  codigoIbge,
  periodo,
  rolarAteAqui,
  aoFechar,
}: {
  codigoIbge: string;
  periodo: Periodo | undefined;
  rolarAteAqui: boolean;
  aoFechar: () => void;
}) {
  const [dados, setDados] = useState<EmendasDoMunicipio | null>(null);
  const [erro, setErro] = useState(false);
  const secao = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!dados || !rolarAteAqui) return;
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    secao.current?.scrollIntoView?.({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' });
  }, [dados, rolarAteAqui]);

  useEffect(() => {
    let atual = true;
    obterEmendasDoMunicipio(codigoIbge, periodo)
      .then((novo) => atual && setDados(novo))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [codigoIbge, periodo]);

  if (erro) return <p className="erro">Não foi possível carregar essa cidade.</p>;
  if (!dados) return <EsqueletoDeTextoComponent rotulo="Carregando a cidade" />;

  const nome = nomeProprio(dados.municipio.nome);
  const emEntidades = dados.recebido - dados.naPropriaCidade;

  return (
    <section ref={secao} className="governo-secao painel-cidade" aria-labelledby="cidade-titulo">
      <div className="mapa-titulo">
        <h2 id="cidade-titulo">
          {nome} <span className="painel-cidade-uf">{dados.municipio.uf}</span>
        </h2>
        <button type="button" className="botao-secundario" onClick={aoFechar}>
          Fechar
        </button>
      </div>

      {dados.recebido === 0 ? (
        <p className="vazio">
          Nenhum pagamento das emendas de {textoDoPeriodo(dados.periodo)} chegou a quem tem sede em {nome}.
        </p>
      ) : (
        <>
          <p className="painel-cidade-total">
            <span className="numero-valor">{reaisCompacto(dados.recebido)}</span> das emendas de{' '}
            {textoDoPeriodo(dados.periodo)} chegaram a quem tem sede em {nome}.
          </p>
          <ul className="painel-cidade-partes">
            <li>
              <strong>{reaisCompacto(dados.naPropriaCidade)}</strong> à prefeitura ou a órgão municipal
            </li>
            <li>
              <strong>{reaisCompacto(emEntidades)}</strong> a entidades e empresas com sede aqui, que podem
              ter aplicado em outra cidade
            </li>
          </ul>

          <QuemMandouComponent dados={dados} periodo={periodo} />
          <ColetivosComponent coletivos={dados.coletivos} />
          <ConveniosDaCidadeComponent dados={dados} periodo={periodo} />
          <QuemRecebeuComponent dados={dados} periodo={periodo} />
        </>
      )}
    </section>
  );
}

/**
 * O que foi combinado com quem tem sede na cidade, e o que ainda falta liberar.
 *
 * DECISÃO: A pergunta do secretário municipal (rodada 2): "o convênio da UBS, quanto já foi
 * liberado?". "A liberar" soma só os em execução — nos outros a execução acabou.
 */
function ConveniosDaCidadeComponent({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
  const convenios = dados.convenios;
  const codigo = dados.municipio.codigoIbge;
  const lista = usePaginas(convenios.lista.itens, convenios.lista.total, convenios.lista.tamanho || POR_PAGINA, (pagina) =>
    listarConveniosDaCidade(codigo, periodo, pagina),
  );

  if (convenios.quantidade === 0) return null;

  return (
    <div>
      <h3>O que foi combinado</h3>
      <p className="nota-curta">Com quem tem sede na cidade: na capital entram órgãos do estado, e a obra pode ser em outro município.</p>
      <p className="ajuda">
        {convenios.quantidade} {convenios.quantidade === 1 ? 'convênio' : 'convênios'}: {reaisCompacto(convenios.combinado)}{' '}
        combinados, {reaisCompacto(convenios.liberado)} já liberados.
        {convenios.emExecucao > 0 && (
          <>
            {' '}
            {convenios.emExecucao} em execução, com <strong>{reaisCompacto(convenios.aLiberar)} ainda a liberar</strong>.
          </>
        )}
      </p>
      <ul className="lista-convenios-entidade">
        {lista.itens.map((c) => (
          <li key={c.numero}>
            <p className="convenio-objeto">{c.objeto ? minusculas(c.objeto) : 'Objeto não informado'}</p>
            <p className="convenio-detalhe">
              <Link to={`/entidades/${c.cnpj}`}>{nomeProprio(c.convenente)}</Link>
              {c.situacao && <> · {minusculas(c.situacao)}</>} · <LinkDeFonteComponent href={c.urlFonte}>convênio {c.numero}</LinkDeFonteComponent>
            </p>
            <p className="convenio-valores">
              <span>{reaisCompacto(c.valor)} combinados</span>
              {c.valorLiberado !== null && <span>{reaisCompacto(c.valorLiberado)} liberados</span>}
            </p>
          </li>
        ))}
      </ul>
      <BotaoMostrarMaisComponent
        proximos={lista.proximos}
        restantes={lista.restantes}
        carregando={lista.carregando}
        erro={lista.erro}
        aoClicar={lista.carregarMais}
      />
    </div>
  );
}

const POR_PAGINA = 10;

function QuemMandouComponent({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
  const codigo = dados.municipio.codigoIbge;
  const lista = usePaginas(dados.parlamentares.itens, dados.parlamentares.total, POR_PAGINA, (pagina) =>
    listarParlamentaresDoMunicipio(codigo, periodo, pagina),
  );

  if (dados.parlamentares.total === 0) return null;

  return (
    <div data-tour="emendas-parlamentares">
      <h3>Deputados e senadores que mandaram dinheiro</h3>
      <p className="ajuda">
        {dados.parlamentares.total} parlamentares, {reaisCompacto(dados.deParlamentares)} em{' '}
        <TermoComponent nome="emendaIndividual">emendas individuais</TermoComponent>. O nome leva à página de cada um.
      </p>

      <ul className="lista-autores">
        {lista.itens.map((p) => (
          <LinhaDoParlamentarComponent key={p.pessoaId ?? p.nome} parlamentar={p} />
        ))}
      </ul>

      <BotaoMostrarMaisComponent
        proximos={lista.proximos}
        restantes={lista.restantes}
        carregando={lista.carregando}
        erro={lista.erro}
        aoClicar={lista.carregarMais}
      />

      <BotaoBaixarCsvComponent
        rotulo="Baixar a lista (CSV)"
        montar={async () => {
          const todos = await buscarTodas((pagina) => listarParlamentaresDoMunicipio(codigo, periodo, pagina));
          baixarCsv(
            `emendas-${codigo}-${nomeDoArquivo(dados.periodo)}-parlamentares.csv`,
            ['Parlamentar', 'Partido', 'UF', 'Casa', 'Emendas', 'Recebido na cidade'],
            todos.map((p) => [p.nome, p.partido, p.uf, p.casa, p.emendas, p.recebido]),
          );
        }}
      />
    </div>
  );
}

function QuemRecebeuComponent({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
  const codigo = dados.municipio.codigoIbge;
  const lista = usePaginas(dados.favorecidos.itens, dados.favorecidos.total, POR_PAGINA, (pagina) =>
    listarFavorecidosDoMunicipio(codigo, periodo, pagina),
  );

  return (
    <div>
      <h3>Quem recebeu</h3>
      <ul className="lista-autores">
        {lista.itens.map((f) => (
          <li key={f.nome}>
            <span className="autor-nome">{nomeProprio(f.nome)}</span>
            {f.naturezaJuridica && <span className="autor-detalhe">{f.naturezaJuridica}</span>}
            <span className="valor">{reaisCompacto(f.recebido)}</span>
          </li>
        ))}
      </ul>

      <BotaoMostrarMaisComponent
        proximos={lista.proximos}
        restantes={lista.restantes}
        carregando={lista.carregando}
        erro={lista.erro}
        aoClicar={lista.carregarMais}
      />
    </div>
  );
}

/**
 * A busca da cidade e o atalho pela localização.
 *
 * ATENÇÃO: A localização vira código IBGE DENTRO do navegador, contra a malha do próprio site:
 * latitude e longitude não saem da página.
 */
function SuaCidadeComponent({ aoEscolher }: { aoEscolher: (m: Municipio) => void }) {
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<Municipio[]>([]);
  const [situacao, setSituacao] = useState<string | null>(null);
  const buscando = busca.trim().length >= 2;

  useEffect(() => {
    if (!buscando) return;
    let atual = true;
    const espera = setTimeout(() => {
      buscarMunicipios(busca)
        .then((novos) => atual && setAchados(novos))
        .catch(() => atual && setAchados([]));
    }, 250);
    return () => {
      atual = false;
      clearTimeout(espera);
    };
  }, [busca, buscando]);

  const escolher = (m: Municipio) => {
    setBusca('');
    setAchados([]);
    setSituacao(null);
    aoEscolher(m);
  };

  const localizar = () => {
    if (!navigator.geolocation) {
      setSituacao('Este navegador não informa a localização. Busque a cidade pelo nome.');
      return;
    }
    setSituacao('Localizando…');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const ponto: [number, number] = [coords.longitude, coords.latitude];
        const codigoUf = await areaQueContem('brasil', ponto);
        const codigo = codigoUf ? await areaQueContem(codigoUf, ponto) : null;
        const sigla = UFS.find(([c]) => c === codigoUf)?.[1];
        if (!codigo || !sigla) {
          setSituacao('A localização ficou fora do Brasil. Busque a cidade pelo nome.');
          return;
        }
        const dados = await obterEmendasDoMunicipio(codigo).catch(() => null);
        escolher(dados ? dados.municipio : { codigoIbge: codigo, nome: '', uf: sigla });
      },
      () => setSituacao('A localização não foi permitida. Busque a cidade pelo nome.'),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  };

  return (
    <div className="sua-cidade" data-tour="emendas-cidade">
      <label htmlFor="busca-cidade">Sua cidade</label>
      <div className="sua-cidade-campos">
        <input
          id="busca-cidade"
          type="search"
          value={busca}
          placeholder="Digite o nome da cidade"
          autoComplete="off"
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="botao-secundario" onClick={localizar}>
          Usar minha localização
        </button>
      </div>

      {buscando && achados.length > 0 && (
        <ul className="sua-cidade-achados" aria-label="Cidades encontradas">
          {achados.map((m) => (
            <li key={m.codigoIbge}>
              <button type="button" className="link-botao" onClick={() => escolher(m)}>
                {nomeProprio(m.nome)} – {m.uf}
              </button>
            </li>
          ))}
        </ul>
      )}

      {situacao && (
        <p className="ajuda" role="status">
          {situacao}
        </p>
      )}
      <p className="nota-curta">A cidade fica guardada só neste navegador.</p>
    </div>
  );
}

const CHAVE_MINHA_CIDADE = 'poligraph.minhaCidade';

function lerMinhaCidade(): Municipio | null {
  try {
    const bruto = localStorage.getItem(CHAVE_MINHA_CIDADE);
    const lida = bruto ? (JSON.parse(bruto) as Municipio) : null;
    return lida && /^\d{7}$/.test(lida.codigoIbge) && /^[A-Z]{2}$/.test(lida.uf) ? lida : null;
  } catch {
    return null;
  }
}

/**
 * Sem armazenamento, a escolha vale só para esta visita.
 */
function guardarMinhaCidade(m: Municipio): void {
  try {
    localStorage.setItem(CHAVE_MINHA_CIDADE, JSON.stringify(m));
  } catch {
  }
}

/** O período do endereço; sem `de` e `ate` válidos, todos os anos. */
function periodoDoEndereco(de: string | null, ate: string | null): Periodo | undefined {
  const inicio = Number(de);
  const fim = Number(ate);
  return Number.isInteger(inicio) && Number.isInteger(fim) && inicio > 0 && fim > 0
    ? { de: inicio, ate: fim }
    : undefined;
}

function textoDoPeriodo({ de, ate }: Periodo): string {
  return de === ate ? String(de) : `${de} a ${ate}`;
}

function nomeDoArquivo({ de, ate }: Periodo): string {
  return de === ate ? String(de) : `${de}-${ate}`;
}

function comParametros(atual: URLSearchParams, novos: Record<string, string | null>): URLSearchParams {
  const proximo = new URLSearchParams(atual);
  for (const [chave, valor] of Object.entries(novos)) {
    if (valor === null) proximo.delete(chave);
    else proximo.set(chave, valor);
  }
  return proximo;
}

