import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { AbasDoDinheiro } from '../componentes/AbasDoDinheiro';
import { Coletivos, LinhaDoParlamentar } from '../componentes/AutoresDaEmenda';
import { BotaoBaixarCsv } from '../componentes/BotaoBaixarCsv';
import { BotaoDoTour } from '../componentes/BotaoDoTour';
import { BotaoMostrarMais } from '../componentes/BotaoMostrarMais';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinkDeFonte } from '../componentes/LinkDeFonte';
import { MapaCoropletico } from '../componentes/MapaCoropletico';
import { SeletorDePeriodo } from '../componentes/SeletorDePeriodo';
import { Termo } from '../componentes/Termo';
import { usePaginas } from '../componentes/usePaginas';
import { baixarCsv, buscarTodas } from '../exportar';
import { FONTES } from '../fontes';
import { minusculas, nomeProprio, reaisCompacto } from '../formato';
import { areaQueContem } from '../mapa';
import { passosDasEmendas } from '../tour';

/**
 * Para onde foi o dinheiro de emenda, no mapa — e quem o mandou para a sua cidade.
 *
 * ## 🔴 O que a página afirma, e o que ⛔
 *
 * - A cidade é a da **sede de quem recebeu**, ⛔ a da obra. Para a prefeitura e o órgão
 *   municipal as duas coincidem; para uma entidade ou empresa, ⛔ necessariamente. O
 *   painel da cidade separa as duas partes.
 * - O que ⛔ tem sede some do mapa, ⛔ da conta: o repasse pelo intermediário e o pago a
 *   pessoa ficam declarados, com valor, acima do mapa.
 * - **Bancada e comissão ⛔ são pessoas.** A emenda tem três autores possíveis (CF, art.
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
 * O login ⛔ traz cidade, e a página ⛔ pergunta ao servidor onde a pessoa está. A cidade
 * é escolhida na busca ou achada pela localização DENTRO do navegador, contra a própria
 * malha; só o código IBGE vai ao servidor, e fica guardado neste navegador.
 */
export function Emendas() {
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

  // A cidade guardada abre UMA vez, na chegada. Reabri-la toda vez que o endereço fica
  // sem estado e sem cidade prendia a pessoa nela: "Ver o Brasil" limpa os dois, e a
  // cidade voltava no mesmo instante.
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

  // O painel da cidade fica ABAIXO do mapa: o mapa é por onde se escolhe, e empurrá-lo
  // para baixo a cada escolha obrigava a rolar de volta. Escolhida no mapa ou na lista, a
  // página desce até o painel; chegando com a cidade guardada, ⛔ — a pessoa ainda ⛔ fez nada.
  const [escolheuAgora, setEscolheuAgora] = useState(false);
  const painel = cidade ? (
    <PainelDaCidade
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
      <AbasDoDinheiro />
      <CabecalhoDaColuna titulo="Emendas no mapa" subtitulo="Para onde foi o dinheiro de emenda parlamentar" />
      <div className="barra-do-tour">
        <BotaoDoTour nome="emendas" passos={passos} />
      </div>

      <SuaCidade
        aoEscolher={(m) => {
          setEscolheuAgora(true);
          guardarMinhaCidade(m);
          mudar({ uf: m.uf, cidade: m.codigoIbge });
        }}
      />

      {erro && <p className="erro">Não foi possível carregar o mapa das emendas agora.</p>}
      {!erro && !brasil && <p className="carregando">Carregando…</p>}

      {brasil && brasil.anosDisponiveis.length === 0 && (
        <p className="vazio">
          As emendas ainda não foram carregadas. Elas aparecem depois da próxima execução do ETL.
        </p>
      )}

      {brasil && brasil.anosDisponiveis.length > 0 && (
        <>
          <SeletorDePeriodo
            anos={brasil.anosDisponiveis}
            periodo={brasil.periodo}
            rotulo="Período das emendas"
            tour="emendas-periodo"
            aoMudar={(novo) =>
              mudar(novo ? { de: String(novo.de), ate: String(novo.ate) } : { de: null, ate: null })
            }
          >
            Emendas de <strong>{textoDoPeriodo(brasil.periodo)}</strong>, pagas até hoje. A cidade é a{' '}
            <Termo nome="sedeDoFavorecido" />.
          </SeletorDePeriodo>

          <ForaDoMapa brasil={brasil} />

          {uf ? (
            <MapaDaUf
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
            </MapaDaUf>
          ) : (
            <>
              <MapaDoPais brasil={brasil} aoEscolher={(sigla) => mudar({ uf: sigla, cidade: null })} />
              {painel}
            </>
          )}

          <p className="fonte-dado">
            Fontes: <LinkDeFonte href={FONTES.emendas.url}>{FONTES.emendas.nome}</LinkDeFonte>;{' '}
            <LinkDeFonte href={FONTES.cnpj.url}>{FONTES.cnpj.nome}</LinkDeFonte>, para a sede;{' '}
            <LinkDeFonte href={FONTES.malhas.url}>{FONTES.malhas.nome}</LinkDeFonte>.
          </p>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════

/** O que o mapa ⛔ mostra, com valor — somem do desenho, ⛔ da conta. */
function ForaDoMapa({ brasil }: { brasil: MapaDoBrasil }) {
  const numeros: [string, number, string][] = [
    ['Pago em emendas', brasil.recebido, 'até hoje'],
    ['No mapa', brasil.noMapa, 'com cidade conhecida'],
    ['Pelo Banco do Brasil', brasil.viaIntermediario, 'que só repassa'],
    ['Sem cidade', brasil.semSede, 'pago a pessoas'],
  ];

  return (
    <section className="numeros-do-ano" aria-label="O dinheiro das emendas do período" data-tour="emendas-numeros">
      {numeros.map(([rotulo, valor, definicao]) => (
        <div key={rotulo} className="numero-do-ano">
          <p className="numero-rotulo">{rotulo}</p>
          <p className="numero-valor">{reaisCompacto(valor)}</p>
          <p className="numero-definicao">{definicao}</p>
        </div>
      ))}
    </section>
  );
}

function MapaDoPais({ brasil, aoEscolher }: { brasil: MapaDoBrasil; aoEscolher: (sigla: string) => void }) {
  const valores = useMemo(() => new Map(brasil.porUf.map((u) => [u.codigoUf, u.recebido])), [brasil]);
  const siglaPorCodigo = useMemo(() => new Map(UFS), []);
  const ordenadas = [...brasil.porUf].sort((a, b) => b.recebido - a.recebido);

  return (
    <section className="governo-secao">
      <h2>Por estado</h2>
      <p className="ajuda">Escolha um estado para ver as cidades.</p>

      <div data-tour="emendas-mapa">
        <MapaCoropletico
          malha="brasil"
          valores={valores}
          nomes={siglaPorCodigo}
          focavel
          rotulo={`Mapa do Brasil: dinheiro de emenda de ${textoDoPeriodo(brasil.periodo)} por estado`}
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
                <td>{u.municipios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BotaoBaixarCsv
        rotulo="Baixar por estado (CSV)"
        montar={() =>
          baixarCsv(
            `emendas-por-estado-${nomeDoArquivo(brasil.periodo)}.csv`,
            ['UF', 'Código IBGE', 'Recebido', 'Cidades'],
            ordenadas.map((u) => [u.uf, u.codigoUf, u.recebido, u.municipios]),
          )
        }
      />
    </section>
  );
}

const CIDADES_POR_VEZ = 15;

/**
 * O estado: o contorno das cidades aparece já, e as cores quando o dado chega — a malha e
 * o dado são pedidos juntos, ⛔ um depois do outro.
 */
function MapaDaUf({
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

  useEffect(() => {
    let atual = true;
    obterMapaDoEstado(uf, periodo)
      .then((novo) => atual && setEstado(novo))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [uf, periodo]);

  const valores = useMemo(
    () => (estado ? new Map(estado.porMunicipio.map((m) => [m.codigoIbge, m.recebido])) : null),
    [estado],
  );
  const nomes = useMemo(
    () => new Map((estado?.porMunicipio ?? []).map((m) => [m.codigoIbge, nomeProprio(m.nome)])),
    [estado],
  );
  const receberam = useMemo(() => (estado?.porMunicipio ?? []).filter((m) => m.recebido > 0), [estado]);
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

      {codigoUf && (
        <div data-tour="emendas-mapa">
          <MapaCoropletico
            malha={codigoUf}
            valores={valores}
            nomes={nomes}
            selecionado={cidade}
            rotulo={`Mapa de ${uf}: dinheiro de emenda por cidade`}
            aoEscolher={aoEscolher}
          />
        </div>
      )}

      {children}

      {!erro && !estado && <p className="carregando">Carregando as cidades…</p>}

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
                <span className="valor">{reaisCompacto(m.recebido)}</span>
              </li>
            ))}
          </ol>

          <BotaoMostrarMais
            proximos={Math.min(CIDADES_POR_VEZ, receberam.length - exibidas)}
            restantes={Math.max(0, receberam.length - exibidas)}
            carregando={false}
            erro={false}
            aoClicar={() => setExibidas((n) => n + CIDADES_POR_VEZ)}
          />

          <BotaoBaixarCsv
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

// ═══════════════════════════════════════════════════════════════════

function PainelDaCidade({
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
  if (!dados) return <p className="carregando">Carregando a cidade…</p>;

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
              <strong>{reaisCompacto(emEntidades)}</strong> a entidades e empresas com sede aqui — podem
              ter aplicado em outra cidade
            </li>
          </ul>

          <QuemMandou dados={dados} periodo={periodo} />
          <Coletivos coletivos={dados.coletivos} />
          <ConveniosDaCidade dados={dados} periodo={periodo} />
          <QuemRecebeu dados={dados} periodo={periodo} />
        </>
      )}
    </section>
  );
}

/**
 * O que foi combinado com quem tem sede na cidade, e o que ainda falta liberar.
 *
 * ⭐ A pergunta do secretário municipal (rodada 2): "o convênio da UBS, quanto já foi
 * liberado?". "A liberar" soma só os em execução — nos outros a execução acabou.
 */
function ConveniosDaCidade({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
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
              {c.situacao && <> · {minusculas(c.situacao)}</>} · <LinkDeFonte href={c.urlFonte}>convênio {c.numero}</LinkDeFonte>
            </p>
            <p className="convenio-valores">
              <span>{reaisCompacto(c.valor)} combinados</span>
              {c.valorLiberado !== null && <span>{reaisCompacto(c.valorLiberado)} liberados</span>}
            </p>
          </li>
        ))}
      </ul>
      <BotaoMostrarMais
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

function QuemMandou({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
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
        <Termo nome="emendaIndividual">emendas individuais</Termo>. O nome leva à página de cada um.
      </p>

      <ul className="lista-autores">
        {lista.itens.map((p) => (
          <LinhaDoParlamentar key={p.pessoaId ?? p.nome} parlamentar={p} />
        ))}
      </ul>

      <BotaoMostrarMais
        proximos={lista.proximos}
        restantes={lista.restantes}
        carregando={lista.carregando}
        erro={lista.erro}
        aoClicar={lista.carregarMais}
      />

      <BotaoBaixarCsv
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

function QuemRecebeu({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
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

      <BotaoMostrarMais
        proximos={lista.proximos}
        restantes={lista.restantes}
        carregando={lista.carregando}
        erro={lista.erro}
        aoClicar={lista.carregarMais}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════

/**
 * A busca da cidade e o atalho pela localização.
 *
 * ⚠️ A localização vira código IBGE DENTRO do navegador, contra a malha do próprio site:
 * latitude e longitude ⛔ saem da página.
 */
function SuaCidade({ aoEscolher }: { aoEscolher: (m: Municipio) => void }) {
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

// ═══════════════════════════════════════════════════════════════════

/** Código IBGE e sigla das 27 UFs — o `codarea` da malha do Brasil. Fixo desde 1988. */
const UFS: [string, string][] = [
  ['11', 'RO'], ['12', 'AC'], ['13', 'AM'], ['14', 'RR'], ['15', 'PA'], ['16', 'AP'], ['17', 'TO'],
  ['21', 'MA'], ['22', 'PI'], ['23', 'CE'], ['24', 'RN'], ['25', 'PB'], ['26', 'PE'], ['27', 'AL'],
  ['28', 'SE'], ['29', 'BA'], ['31', 'MG'], ['32', 'ES'], ['33', 'RJ'], ['35', 'SP'], ['41', 'PR'],
  ['42', 'SC'], ['43', 'RS'], ['50', 'MS'], ['51', 'MT'], ['52', 'GO'], ['53', 'DF'],
];

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

function guardarMinhaCidade(m: Municipio): void {
  try {
    localStorage.setItem(CHAVE_MINHA_CIDADE, JSON.stringify(m));
  } catch {
    /* Sem armazenamento, a escolha vale só para esta visita. */
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
