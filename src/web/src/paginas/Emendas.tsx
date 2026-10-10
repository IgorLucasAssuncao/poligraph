import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AtualizandoComponent, useCarga } from '../componentes/Atualizando';
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
import { AbasComponent, NumeroComponent, OpcoesComponent, type Aba } from '../componentes/Dados';
import { CHAVE_MINHA_CIDADE, CIDADES_POR_VEZ, ESTADOS_A_VISTA, ITENS_POR_PAGINA_DA_CIDADE } from '../constantes';
import { TEXTOS_DAS_EMENDAS as T } from '../textos/emendas';

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
  const chaveDoPeriodo = periodo ? `${periodo.primeiroAno}-${periodo.ultimoAno}` : 'todos';
  const uf = parametros.get('uf');
  const cidade = parametros.get('cidade');

  const carga = useCarga(`${de}-${ate}`, () => obterMapaDoBrasil(periodo));
  const brasil = carga.dados ?? null;
  const erro = carga.erro;

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
        titulo={T.titulo}
        subtitulo={T.subtitulo}
        acao={<BotaoDoTourComponent nome="emendas" passos={passos} />}
      />


      {erro && <p className="erro">{T.erro}</p>}
      {!erro && !brasil && <EsqueletoDePainelComponent rotulo={T.carregando} alturaDoGrafico={420} />}

      {brasil && brasil.anosDisponiveis.length === 0 && <p className="vazio">{T.semDados}</p>}

      {brasil && brasil.anosDisponiveis.length > 0 && (
        <AtualizandoComponent atualizando={carga.atualizando} chave={carga.chaveDoDado}>
          <div className="emendas-filtros">
            <SuaCidadeComponent
              aoEscolher={(m) => {
                setEscolheuAgora(true);
                guardarMinhaCidade(m);
                mudar({ uf: m.uf, cidade: m.codigoIbge });
              }}
            />
            <div className="filtro-periodo">
              <p className="filtro-titulo">{T.periodo}</p>
              <SeletorDePeriodoComponent
                anos={brasil.anosDisponiveis}
                periodo={brasil.periodo}
                rotulo={T.periodoDasEmendas}
                tour="emendas-periodo"
                aoMudar={(novo) =>
                  mudar(novo ? { de: String(novo.primeiroAno), ate: String(novo.ultimoAno) } : { de: null, ate: null })
                }
              />
            </div>
          </div>
          <p className="emendas-escopo">{T.escopo(textoDoPeriodo(brasil.periodo))}</p>

          <ForaDoMapaComponent brasil={brasil} />
          <ConfereComOPortalComponent periodo={brasil.periodo} />

          {uf ? (
            <MapaDaUfComponent
              key={`${uf}-${chaveDoPeriodo}`}
              uf={uf}
              periodo={periodo}
              cidade={cidade}
              aoVoltar={() => mudar({ uf: null, cidade: null })}
              aoEscolher={(codigoIbge) => {
                setEscolheuAgora(true);
                mudar({ cidade: codigoIbge });
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
            {T.fontes} <LinkDeFonteComponent href={FONTES.emendas.url}>{FONTES.emendas.nome}</LinkDeFonteComponent>;{' '}
            <LinkDeFonteComponent href={FONTES.cnpj.url}>{FONTES.cnpj.nome}</LinkDeFonteComponent>
            {T.paraASede}{' '}
            <LinkDeFonteComponent href={FONTES.malhas.url}>{FONTES.malhas.nome}</LinkDeFonteComponent>.
          </p>
        </AtualizandoComponent>
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
  const N = T.numeros;
  const numeros: [string, number, string][] = [
    [N.pago, brasil.recebido, N.pagoDefinicao],
    [N.noMapa, brasil.noMapa, N.noMapaDefinicao],
    [N.porBanco, brasil.viaIntermediario, N.porBancoDefinicao],
    [N.semCidade, brasil.semSede, N.semCidadeDefinicao],
  ];

  return (
    <section className="numeros-do-ano" aria-label={N.rotulo} data-tour="emendas-numeros">
      {numeros.map(([rotulo, valor, definicao]) => (
        <NumeroComponent key={rotulo} rotulo={rotulo} definicao={definicao}>
          {rotulo === N.pago ? (
            <ComProcedenciaComponent
              consulta={{ contexto: 'pagamentos', de: periodo.primeiroAno, ate: periodo.ultimoAno }}
              rotulo={N.rotuloDaProcedencia(textoDoPeriodo(periodo))}
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
  const porPessoa = (valor: number) => T.leitura.porPessoa(Math.round(valor).toLocaleString('pt-BR'));
  const [todosOsEstados, setTodosOsEstados] = useState(false);
  const periodo = brasil.periodo;

  return (
    <section className="governo-secao">
      <h2>{T.pais.titulo}</h2>
      <p className="ajuda">{T.pais.ajuda}</p>
      {temPopulacao && (
        <OpcoesComponent
          rotulo={T.leitura.rotulo}
          opcoes={[
            { valor: false, rotulo: T.leitura.total },
            { valor: true, rotulo: T.leitura.porHabitante },
          ]}
          escolhida={habitante}
          aoEscolher={setPorHabitante}
        >
          {habitante && brasil.anoDaPopulacao && <span className="ajuda">{T.pais.populacao(brasil.anoDaPopulacao)}</span>}
        </OpcoesComponent>
      )}

      <div className={`mapa-e-lista${todosOsEstados ? ' todos-os-estados' : ''}`}>
      <div data-tour="emendas-mapa">
        <MapaCoropleticoComponent
          malha="brasil"
          valores={valores}
          nomes={siglaPorCodigo}
          focavel
          formatar={habitante ? porPessoa : undefined}
          rotulo={T.pais.rotuloDoMapa(textoDoPeriodo(brasil.periodo), habitante)}
          aoEscolher={(codigoIbge) => {
            const sigla = siglaPorCodigo.get(codigoIbge);
            if (sigla) aoEscolher(sigla);
          }}
        />
      </div>

      <div className="tabela-rolavel lista-ao-lado">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">{T.pais.legenda}</caption>
          <thead>
            <tr>
              <th scope="col">{T.pais.estado}</th>
              <th scope="col">{T.pais.recebido}</th>
              {temPopulacao && <th scope="col">{T.pais.porHabitante}</th>}
              <th scope="col">{T.pais.cidades}</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((u, i) => (
              <tr key={u.uf} className={i >= ESTADOS_A_VISTA ? 'estado-alem-dos-dez' : undefined}>
                <th scope="row">
                  <button type="button" className="link-botao" onClick={() => aoEscolher(u.uf)}>
                    {u.uf}
                  </button>
                </th>
                <td>
                  <ComProcedenciaComponent
                    consulta={{ contexto: 'pagamentos', de: periodo.primeiroAno, ate: periodo.ultimoAno, uf: u.uf }}
                    rotulo={T.pais.rotuloDaProcedencia(textoDoPeriodo(periodo), u.uf)}
                  >
                    {reaisCompacto(u.recebido)}
                  </ComProcedenciaComponent>
                </td>
                {temPopulacao && <td>{reais(u.recebido / (u.populacao ?? 1))}</td>}
                <td>{u.municipios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordenadas.length > ESTADOS_A_VISTA && !todosOsEstados && (
        <button type="button" className="botao-secundario ver-todos-os-estados" onClick={() => setTodosOsEstados(true)}>
          {T.pais.verTodos(ordenadas.length)}
        </button>
      )}
      </div>

      <BotaoBaixarCsvComponent
        rotulo={T.pais.baixar}
        montar={() =>
          baixarCsv(
            T.pais.arquivo(nomeDoArquivo(brasil.periodo)),
            [...T.pais.colunas],
            ordenadas.map((u) => [u.uf, u.codigoUf, u.recebido, u.populacao ?? '', u.municipios]),
          )
        }
      />
    </section>
  );
}


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
  aoEscolher: (codigoIbge: string) => void;
  /** O painel da cidade escolhida: entre o mapa e a lista, perto de onde se clicou. */
  children?: ReactNode;
}) {
  const carga = useCarga(`${uf}:${periodo?.primeiroAno}-${periodo?.ultimoAno}`, () => obterMapaDoEstado(uf, periodo));
  const estado = carga.dados ?? null;
  const erro = carga.erro;
  const [exibidas, setExibidas] = useState(CIDADES_POR_VEZ);
  const [porHabitante, setPorHabitante] = useState(false);


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
          {T.estado.verOBrasil}
        </button>
      </div>

      {erro && <p className="erro">{T.estado.erro(uf)}</p>}
      {estado && (
        <p className="ajuda">{T.estado.ajuda(reaisCompacto(estado.recebido), receberam.length, estado.porMunicipio.length, uf)}</p>
      )}

      {temPopulacao && (
        <OpcoesComponent
          rotulo={T.leitura.rotulo}
          opcoes={[
            { valor: false, rotulo: T.leitura.total },
            { valor: true, rotulo: T.leitura.porHabitante },
          ]}
          escolhida={habitante}
          aoEscolher={setPorHabitante}
        >
          {habitante && <span className="ajuda">{T.estado.porHabitante}</span>}
        </OpcoesComponent>
      )}

      {codigoUf && (
        <div data-tour="emendas-mapa">
          <MapaCoropleticoComponent
            malha={codigoUf}
            valores={valores}
            nomes={nomes}
            selecionado={cidade}
            formatar={habitante ? (v) => T.leitura.porPessoa(Math.round(v).toLocaleString('pt-BR')) : undefined}
            rotulo={T.estado.rotuloDoMapa(uf, habitante)}
            aoEscolher={aoEscolher}
          />
        </div>
      )}

      {children}

      {!erro && !estado && (
        <EsqueletoComponent rotulo={T.estado.carregando}>
          <BlocoComponent altura={360} />
        </EsqueletoComponent>
      )}

      {estado && (
        <AtualizandoComponent atualizando={carga.atualizando} chave={carga.chaveDoDado}>
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
                  {habitante ? T.estado.porHabitanteNaLista(reais(valorDe(m))) : reaisCompacto(m.recebido)}
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
            rotulo={T.estado.baixar(uf)}
            montar={() =>
              baixarCsv(
                T.estado.arquivo(uf, nomeDoArquivo(estado.periodo)),
                [...T.estado.colunas],
                estado.porMunicipio.map((m) => [m.codigoIbge, m.nome, m.recebido]),
              )
            }
          />
        </AtualizandoComponent>
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
  const carga = useCarga(`${codigoIbge}:${periodo?.primeiroAno}-${periodo?.ultimoAno}`, () =>
    obterEmendasDoMunicipio(codigoIbge, periodo),
  );
  const dados = carga.dados ?? null;
  const erro = carga.erro;
  const [aba, setAba] = useState<AbaDaCidade | null>(null);
  const secao = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!dados || !rolarAteAqui) return;
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    secao.current?.scrollIntoView?.({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' });
  }, [dados, rolarAteAqui]);


  if (erro) return <p className="erro">{T.cidade.erro}</p>;
  if (!dados) return <EsqueletoDeTextoComponent rotulo={T.cidade.carregando} />;

  const nome = nomeProprio(dados.municipio.nome);
  const emEntidades = dados.recebido - dados.naPropriaCidade;
  const abas = abasDaCidade(dados);
  const escolhida = abas.find((a) => a.chave === aba)?.chave ?? abas[0]?.chave;

  return (
    <section ref={secao} className="governo-secao painel-cidade" aria-labelledby="cidade-titulo">
      <div className="mapa-titulo">
        <h2 id="cidade-titulo">
          {nome} <span className="painel-cidade-uf">{dados.municipio.uf}</span>
        </h2>
        <button type="button" className="botao-secundario" onClick={aoFechar}>
          {T.cidade.fechar}
        </button>
      </div>

      {dados.recebido === 0 ? (
        <p className="vazio">{T.cidade.vazio(textoDoPeriodo(dados.periodo), nome)}</p>
      ) : (
        <>
          <p className="painel-cidade-total">
            {T.cidade.total(
              <ComProcedenciaComponent
                consulta={{ contexto: 'pagamentos', de: dados.periodo.primeiroAno, ate: dados.periodo.ultimoAno, municipio: dados.municipio.codigoIbge }}
                rotulo={T.cidade.rotuloDaProcedencia(textoDoPeriodo(dados.periodo), nome)}
              >
                <span className="numero-valor">{reaisCompacto(dados.recebido)}</span>
              </ComProcedenciaComponent>,
              textoDoPeriodo(dados.periodo),
              nome,
            )}
          </p>
          <ul className="painel-cidade-partes">
            <li>
              <strong>{reaisCompacto(dados.naPropriaCidade)}</strong>
              {T.cidade.naPrefeitura}
            </li>
            <li>
              <strong>{reaisCompacto(emEntidades)}</strong>
              {T.cidade.emEntidades}
            </li>
          </ul>

          {escolhida && (
            <>
              <AbasComponent rotulo={T.cidade.rotuloDasAbas(nome)} abas={abas} escolhida={escolhida} aoEscolher={setAba} />
              <div className="painel-cidade-aba" role="tabpanel" id={`painel-${escolhida}`} aria-labelledby={`aba-${escolhida}`}>
                {escolhida === 'parlamentares' && <QuemMandouComponent dados={dados} periodo={periodo} />}
                {escolhida === 'coletivos' && <ColetivosComponent coletivos={dados.coletivos} />}
                {escolhida === 'convenios' && <ConveniosDaCidadeComponent dados={dados} periodo={periodo} />}
                {escolhida === 'recebedores' && <QuemRecebeuComponent dados={dados} periodo={periodo} />}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** As listas do painel da cidade, uma por aba. */
type AbaDaCidade = 'parlamentares' | 'coletivos' | 'convenios' | 'recebedores';

/** Só as abas com algo dentro, na ordem da pergunta: quem mandou, o que foi combinado, quem recebeu. */
function abasDaCidade(dados: EmendasDoMunicipio): Aba<AbaDaCidade>[] {
  const abas: Aba<AbaDaCidade>[] = [];
  if (dados.parlamentares.total > 0)
    abas.push({ chave: 'parlamentares', rotulo: T.cidade.abaParlamentares, contagem: dados.parlamentares.total });
  if (dados.coletivos.length > 0)
    abas.push({ chave: 'coletivos', rotulo: T.cidade.abaColetivos, contagem: dados.coletivos.length, tour: 'emendas-coletivos' });
  if (dados.convenios.quantidade > 0)
    abas.push({ chave: 'convenios', rotulo: T.cidade.abaConvenios, contagem: dados.convenios.quantidade });
  if (dados.favorecidos.total > 0)
    abas.push({ chave: 'recebedores', rotulo: T.cidade.abaRecebedores, contagem: dados.favorecidos.total });
  return abas;
}

/**
 * O que foi combinado com quem tem sede na cidade, e o que ainda falta liberar.
 *
 * DECISÃO: A pergunta do secretário municipal (rodada 2): "o convênio da UBS, quanto já foi
 * liberado?". "A liberar" soma só os em execução — nos outros a execução acabou.
 */
function ConveniosDaCidadeComponent({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
  const convenios = dados.convenios;
  const codigoIbge = dados.municipio.codigoIbge;
  const lista = usePaginas(convenios.lista.itens, convenios.lista.total, convenios.lista.tamanho || ITENS_POR_PAGINA_DA_CIDADE, (pagina) =>
    listarConveniosDaCidade(codigoIbge, periodo, pagina),
  );

  if (convenios.quantidade === 0) return null;

  return (
    <div>
      <p className="ajuda">
        {T.convenios.resumo(
          convenios.quantidade,
          reaisCompacto(convenios.combinado),
          reaisCompacto(convenios.liberado),
          convenios.emExecucao,
          reaisCompacto(convenios.aLiberar),
        )}
      </p>
      <ul className="lista-convenios-entidade">
        {lista.itens.map((c) => (
          <li key={c.numero}>
            <p className="convenio-objeto">{c.objeto ? minusculas(c.objeto) : T.convenios.objetoNaoInformado}</p>
            <p className="convenio-detalhe">
              <Link to={`/entidades/${c.cnpj}`}>{nomeProprio(c.convenente)}</Link>
              {c.situacao && <> · {minusculas(c.situacao)}</>} · <LinkDeFonteComponent href={c.urlFonte}>{T.convenios.convenio(c.numero)}</LinkDeFonteComponent>
            </p>
            <p className="convenio-valores">
              <span>{T.convenios.combinados(reaisCompacto(c.valor))}</span>
              {c.valorLiberado !== null && <span>{T.convenios.liberados(reaisCompacto(c.valorLiberado))}</span>}
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


function QuemMandouComponent({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
  const codigoIbge = dados.municipio.codigoIbge;
  const lista = usePaginas(dados.parlamentares.itens, dados.parlamentares.total, ITENS_POR_PAGINA_DA_CIDADE, (pagina) =>
    listarParlamentaresDoMunicipio(codigoIbge, periodo, pagina),
  );

  if (dados.parlamentares.total === 0) return null;

  return (
    <div data-tour="emendas-parlamentares">
      <p className="ajuda">{T.quemMandou.resumo(dados.parlamentares.total, reaisCompacto(dados.deParlamentares))}</p>

      <ul className="lista-autores">
        {lista.itens.map((p) => (
          <LinhaDoParlamentarComponent key={p.idPessoa ?? p.nome} parlamentar={p} />
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
        rotulo={T.quemMandou.baixar}
        montar={async () => {
          const todos = await buscarTodas((pagina) => listarParlamentaresDoMunicipio(codigoIbge, periodo, pagina));
          baixarCsv(
            T.quemMandou.arquivo(codigoIbge, nomeDoArquivo(dados.periodo)),
            [...T.quemMandou.colunas],
            todos.map((p) => [p.nome, p.partido, p.uf, p.casa, p.emendas, p.recebido]),
          );
        }}
      />
    </div>
  );
}

function QuemRecebeuComponent({ dados, periodo }: { dados: EmendasDoMunicipio; periodo: Periodo | undefined }) {
  const codigoIbge = dados.municipio.codigoIbge;
  const lista = usePaginas(dados.favorecidos.itens, dados.favorecidos.total, ITENS_POR_PAGINA_DA_CIDADE, (pagina) =>
    listarFavorecidosDoMunicipio(codigoIbge, periodo, pagina),
  );

  return (
    <div>
      <p className="ajuda">{T.quemRecebeu.ajuda(nomeProprio(dados.municipio.nome))}</p>
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
      setSituacao(T.suaCidade.semLocalizacao);
      return;
    }
    setSituacao(T.suaCidade.localizando);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const ponto: [number, number] = [coords.longitude, coords.latitude];
        const codigoUf = await areaQueContem('brasil', ponto);
        const codigoIbge = codigoUf ? await areaQueContem(codigoUf, ponto) : null;
        const sigla = UFS.find(([c]) => c === codigoUf)?.[1];
        if (!codigoIbge || !sigla) {
          setSituacao(T.suaCidade.foraDoBrasil);
          return;
        }
        const dados = await obterEmendasDoMunicipio(codigoIbge).catch(() => null);
        escolher(dados ? dados.municipio : { codigoIbge, nome: '', uf: sigla });
      },
      () => setSituacao(T.suaCidade.naoPermitida),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  };

  return (
    <div className="sua-cidade" data-tour="emendas-cidade">
      <label htmlFor="busca-cidade">{T.suaCidade.titulo}</label>
      <div className="sua-cidade-campos">
        <input
          id="busca-cidade"
          type="search"
          value={busca}
          placeholder={T.suaCidade.placeholder}
          autoComplete="off"
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="botao-secundario" onClick={localizar}>
          {T.suaCidade.usarLocalizacao}
        </button>
      </div>

      {buscando && achados.length > 0 && (
        <ul className="sua-cidade-achados" aria-label={T.suaCidade.encontradas}>
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
      <p className="nota-curta">{T.suaCidade.nota}</p>
    </div>
  );
}


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
    return;
  }
}

/** O período do endereço; sem `de` e `ate` válidos, todos os anos. */
function periodoDoEndereco(deNaUrl: string | null, ateNaUrl: string | null): Periodo | undefined {
  const inicio = Number(deNaUrl);
  const fim = Number(ateNaUrl);
  return Number.isInteger(inicio) && Number.isInteger(fim) && inicio > 0 && fim > 0
    ? { primeiroAno: inicio, ultimoAno: fim }
    : undefined;
}

function textoDoPeriodo({ primeiroAno, ultimoAno }: Periodo): string {
  return primeiroAno === ultimoAno ? String(primeiroAno) : `${primeiroAno} a ${ultimoAno}`;
}

function nomeDoArquivo({ primeiroAno, ultimoAno }: Periodo): string {
  return primeiroAno === ultimoAno ? String(primeiroAno) : `${primeiroAno}-${ultimoAno}`;
}

function comParametros(atual: URLSearchParams, novos: Record<string, string | null>): URLSearchParams {
  const proximo = new URLSearchParams(atual);
  for (const [chave, valor] of Object.entries(novos)) {
    if (valor === null) proximo.delete(chave);
    else proximo.set(chave, valor);
  }
  return proximo;
}

