import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarLancamentos,
  obterGastos,
  obterPatrimonio,
  type GastoDeCota,
  type CidadesDaEmenda,
  type DeclaracaoDeBens,
  type FinanciamentoDeCampanha,
} from '../api';
import { baixarCsv, buscarTodas } from '../exportar';
import { FONTES } from '../fontes';
import { dataCurta, minusculas, nomeProprio, periodoDaLegislatura, reais, semPontosNoFim } from '../formato';
import { BotaoBaixarCsvComponent } from './BotaoBaixarCsv';
import { BotaoMostrarMaisComponent } from './BotaoMostrarMais';
import { ConveniosComponent, EmendasUmaAUmaComponent, QuandoFoiPagoComponent, QuemRecebeuComponent } from './DestinoDasEmendas';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { ComProcedenciaComponent } from './ModoAuditoria';
import { NENHUM, useAVista, usePaginas } from './usePaginas';
import type { Contas } from './useContas';
import { EsqueletoDePainelComponent, EsqueletoDeTextoComponent } from './Esqueleto';
import { LinhaDeValorComponent, OpcoesComponent } from './Dados';
import { GrafoDoDinheiroComponent } from './GrafoDoDinheiro';
import { LOCALIDADE_MULTIPLA, LOCALIDADE_NACIONAL, SUFIXO_DE_ESTADO, TIPOS_DE_BEM_A_VISTA } from '../constantes';
import { TEXTOS_DAS_CONTAS as T } from '../textos/contasDoParlamentar';

/**
 * O dinheiro do parlamentar, em três abas — campanha, emendas e cota.
 *
 * ## Por que abas, e não o modal
 *
 * O modal "Ver as contas" empilhava as três fontes numa rolagem só: 13 blocos com o mesmo
 * peso, sem endereço para compartilhar, e no telefone uma rolagem dentro de outra. Cada
 * aba agora responde UMA pergunta, na ordem de Shneiderman — visão geral primeiro, detalhe
 * sob demanda:
 *
 * 1. uma frase-resposta, com o número que importa;
 * 2. dois blocos, os que respondem "para onde" e "para quem";
 * 3. o resto em "Ver detalhes", fechado.
 *
 * ATENÇÃO: O argumento antigo para o modal — ver campanha e cota juntas, para cruzar doador e
 * fornecedor — agora é feito pelo DADO, pelo CNPJ, na página da entidade. Medido em
 * 2026-09-25: 3 CNPJs em comum entre cota e campanha; o olho não achava isso numa rolagem.
 */

/**
 * Os três números do topo, cada um levando à sua aba.
 *
 * DECISÃO: Silêncio enquanto carrega e no erro: a faixa é contexto, não o conteúdo principal.
 *
 * ATENÇÃO: Os três vêm de anos diferentes — a eleição, e o ano mais recente de emenda e
 * de cota. Lado a lado, sem o ano no rótulo, liam como comparáveis (2026-10-01).
 */
export function FaixaDeContasComponent({
  contas,
  base,
  sufixo = '',
  mandatoPassado = null,
}: {
  contas: Contas | null;
  base: string;
  /** O `?legislatura=` da ficha: o número leva à aba no MESMO mandato. */
  sufixo?: string;
  /** A legislatura do mandato aberto, quando não é a corrente — a frase diz de qual. */
  mandatoPassado?: number | null;
}) {
  if (!contas) return null;

  const { gastos, emendas, fin } = contas;
  const temAlgo = (fin?.total ?? 0) > 0 || (emendas?.quantidade ?? 0) > 0 || (gastos?.lancamentos ?? 0) > 0;
  if (!temAlgo) return null;

  return (
    <>
      <p className="contas-aviso">
        {mandatoPassado ? T.faixa.noMandato(periodoDaLegislatura(mandatoPassado)) : T.faixa.maisRecente}
      </p>
      <nav className="perfil-contas contas-numeros" data-tour="ficha-contas" aria-label={T.faixa.rotulo}>
        <ValorDaContaComponent
          para={`${base}/campanha${sufixo}`}
          rotulo={T.faixa.campanha(fin?.anoEleicao)}
          valor={fin?.total}
          nota={T.faixa.campanhaNota}
        />
        <ValorDaContaComponent
          para={`${base}/emendas${sufixo}`}
          rotulo={T.faixa.emendas(emendas?.anoDaEmenda)}
          valor={emendas?.empenhado}
          nota={T.faixa.emendasNota}
        />
        <ValorDaContaComponent
          para={`${base}/cota${sufixo}`}
          rotulo={T.faixa.cota(gastos?.anoDaDespesa)}
          valor={gastos?.total}
          nota={T.faixa.cotaNota}
        />
      </nav>
    </>
  );
}

/**
 * RISCO: **Ausente não é zero.** `R$ 0,00` afirmaria que o parlamentar não recebeu nada; o que se
 * sabe é que a base não tem. O travessão diz isso sem mentir.
 */
function ValorDaContaComponent({ para, rotulo, valor, nota }: { para: string; rotulo: string; valor?: number; nota?: string }) {
  const tem = valor !== undefined && valor > 0;

  return (
    <Link className="conta-valor" to={para}>
      <span className="conta-rotulo">
        {rotulo}
        {T.faixa.seta}
      </span>
      <span className={`conta-numero ${tem ? '' : 'conta-ausente'}`}>{tem ? reais(valor) : T.faixa.ausente}</span>
      <span className="conta-nota">{tem ? nota : T.faixa.semRegistro}</span>
    </Link>
  );
}

/** O que ainda não chegou, ou não existe na base, dito do mesmo jeito nas três abas. */
function CarregandoComponent({ contas, erro }: { contas: Contas | null; erro: boolean }) {
  if (erro) return <p className="erro">{T.carregando.erro}</p>;
  if (!contas) return <EsqueletoDePainelComponent rotulo={T.carregando.rotulo} />;
  return null;
}

/**
 * RISCO: **Empenhado e pago, sempre juntos.** Empenhar é reservar; pagar é o dinheiro sair. Só
 * o empenhado deixaria concluir que o dinheiro chegou — o que quem anuncia emenda gostaria.
 *
 * Emendas
 */
export function AbaEmendasComponent({
  idPessoa,
  contas,
  erro,
  nome,
  descricao,
}: {
  idPessoa: number;
  contas: Contas | null;
  erro: boolean;
  /** Para o centro do grafo do dinheiro. */
  nome: string;
  descricao: string;
}) {
  const [grafoAberto, setGrafoAberto] = useState(false);
  const emendas = contas?.emendas;
  if (!emendas) return <CarregandoComponent contas={contas} erro={erro} />;

  if (emendas.quantidade === 0) {
    return (
      <section className="aba-dinheiro">
        <p className="vazio">{T.emendas.vazio}</p>
      </section>
    );
  }

  const pagoTotal = emendas.pago + (emendas.pagoDepois ?? 0);
  const fracao = (valor: number) => (emendas.empenhado > 0 ? Math.min(valor / emendas.empenhado, 1) : 0);
  const maiorDestino = emendas.porDestino[0]?.empenhado ?? 1;

  return (
    <section className="aba-dinheiro" aria-label={T.emendas.rotulo}>
      <GrafoDoDinheiroComponent
        aberto={grafoAberto}
        aoFechar={() => setGrafoAberto(false)}
        nome={nome}
        descricao={descricao}
        campanha={contas?.fin ?? null}
        emendas={emendas}
      />
      <div className="execucao">
        <div className="execucao-cabeca">
          <p className="frase-resposta">
            {T.emendas.resposta(
              <ComProcedenciaComponent
                consulta={{ contexto: 'emendas', idPessoa: idPessoa, anoDaEmenda: emendas.anoDaEmenda }}
                rotulo={T.emendas.rotuloDaProcedencia(emendas.anoDaEmenda)}
              >
                <strong>{reais(pagoTotal)}</strong>
              </ComProcedenciaComponent>,
              reais(emendas.empenhado),
              emendas.quantidade,
              emendas.anoDaEmenda,
              (fracao(pagoTotal) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
            )}
          </p>
          <button type="button" className="botao-secundario" onClick={() => setGrafoAberto(true)}>
            {T.emendas.verOGrafo}
          </button>
        </div>
        <span className="gasto-barra execucao-barra" aria-hidden="true">
          <span style={{ width: `${fracao(emendas.pago) * 100}%` }} />
          {emendas.pagoDepois > 0 && (
            <span className="parte-depois" style={{ width: `${fracao(emendas.pagoDepois) * 100}%` }} />
          )}
        </span>
        <p className="legenda-execucao">
          <span>
            <span className="amostra-cor" aria-hidden="true" />
            {T.emendas.pagoNoAno(emendas.anoDaEmenda, reais(emendas.pago))}
          </span>
          {emendas.pagoDepois > 0 && (
            <span>
              <span className="amostra-cor parte-depois" aria-hidden="true" />
              {T.emendas.pagoDepois(reais(emendas.pagoDepois))}
            </span>
          )}
          <span>
            <span className="amostra-cor nao-pago" aria-hidden="true" />
            {T.emendas.naoPago(reais(Math.max(emendas.empenhado - pagoTotal, 0)))}
          </span>
        </p>
      </div>

      <div className="duas-colunas">
        <div>
          <CidadesQueReceberamComponent cidades={emendas.cidades} />
        </div>
        <div>
          <QuemRecebeuComponent idPessoa={idPessoa} favorecidos={emendas.favorecidos} anoDaEmenda={emendas.anoDaEmenda} />
        </div>
      </div>

      <details className="detalhes-da-aba">
        <summary>{T.emendas.verDetalhes}</summary>

        {emendas.porFuncao.length > 0 && (
          <>
            <h3 className="titulo-secao">{T.emendas.emQue}</h3>
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

        <h3 className="titulo-secao">{T.emendas.localDeclarado}</h3>
        <p className="ajuda">{T.emendas.localDeclaradoAjuda}</p>
        <ul className="gastos-categorias">
          {emendas.porDestino.map((d) => (
            <LinhaDeValorComponent key={d.localidade} nome={<DestinoComponent localidade={d.localidade} />} valor={d.empenhado} maior={maiorDestino} />
          ))}
        </ul>

        <QuandoFoiPagoComponent meses={emendas.pagamentosPorMes} anoDaEmenda={emendas.anoDaEmenda} />
        <ConveniosComponent idPessoa={idPessoa} convenios={emendas.convenios} anoDaEmenda={emendas.anoDaEmenda} />
        <EmendasUmaAUmaComponent idPessoa={idPessoa} anoDaEmenda={emendas.anoDaEmenda} total={emendas.quantidade} />
      </details>

      <p className="ajuda ajuda-espacada">{T.emendas.fonte}</p>
    </section>
  );
}

/**
 * Pela sede de quem recebeu — CNPJ → IBGE —, e cada cidade leva ao mapa.
 *
 * ATENÇÃO: A API manda só as maiores. O botão diz quantas abre, e não "faltam N": o total de
 * cidades é maior que a lista.
 */
function CidadesQueReceberamComponent({ cidades }: { cidades: CidadesDaEmenda }) {
  const lista = useAVista({
    itens: cidades.maiores,
    restantes: 0,
    proximos: 0,
    carregando: false,
    erro: false,
    carregarMais: () => {},
  });
  if (cidades.quantidade === 0) return null;

  const maior = cidades.maiores[0]?.recebido ?? 1;

  return (
    <>
      <h3 className="titulo-secao">{T.cidades.titulo}</h3>
      <p className="ajuda ajuda-espacada">{T.cidades.quantas(cidades.quantidade, cidades.maiores.length)}</p>
      <ul className="gastos-categorias">
        {lista.itens.map((c) => (
          <LinhaDeValorComponent
            key={c.municipio.codigoIbge}
            nome={
              <Link to={`/emendas?uf=${c.municipio.uf}&cidade=${c.municipio.codigoIbge}`}>
                {nomeProprio(c.municipio.nome)} – {c.municipio.uf}
              </Link>
            }
            valor={c.recebido}
            maior={maior}
          />
        ))}
      </ul>
      <BotaoMostrarMaisComponent {...lista} aoClicar={lista.carregarMais} rotulo={T.cidades.verAsMaiores(cidades.maiores.length)} />
    </>
  );
}

/**
 * O destino DECLARADO — quatro coisas diferentes na mesma coluna.
 *
 * RISCO: `MÚLTIPLO` não é um lugar: é o aviso de que a emenda se reparte, e o Portal não diz onde.
 */
function DestinoComponent({ localidade }: { localidade: string }) {
  if (localidade === LOCALIDADE_MULTIPLA) {
    return (
      <>
        {T.destino.multiplo}
        <small>{T.destino.multiploNota}</small>
      </>
    );
  }

  if (localidade === LOCALIDADE_NACIONAL) {
    return (
      <>
        {T.destino.nacional}
        <small>{T.destino.nacionalNota}</small>
      </>
    );
  }

  if (SUFIXO_DE_ESTADO.test(localidade)) {
    return (
      <>
        {minusculas(localidade.replace(SUFIXO_DE_ESTADO, ''))}
        <small>{T.destino.estadoInteiro}</small>
      </>
    );
  }

  return <>{localidade}</>;
}

/**
 * A cota parlamentar (CEAP e CEAPS).
 *
 * RISCO: Todo valor tem o documento fiscal a um clique, na Câmara — sem isso a tela seria uma
 * afirmação sobre gasto público sem como conferir. Fica em "Ver detalhes": são centenas.
 *
 * Cota
 *
 * RISCO: RNF-13: o documento de pessoa física é hasheado; a tela diz que é pessoa.
 */
export function AbaCotaComponent({
  idPessoa,
  contas,
  erro,
  legislatura,
}: {
  idPessoa: number;
  contas: Contas | null;
  erro: boolean;
  legislatura?: number | null;
}) {
  const [doAno, setDoAno] = useState<{ anoDaDespesa: number; gastos: GastoDeCota | null } | null>(null);
  const padrao = contas?.gastos;
  const gastos = doAno?.gastos ?? (doAno ? null : padrao);

  if (!padrao) return <CarregandoComponent contas={contas} erro={erro} />;

  const escolher = (anoDaDespesa: number) => {
    if (anoDaDespesa === padrao.anoDaDespesa) {
      setDoAno(null);
      return;
    }
    setDoAno({ anoDaDespesa, gastos: null });
    obterGastos(idPessoa, legislatura, anoDaDespesa)
      .then((g) => setDoAno((atual) => (atual?.anoDaDespesa === anoDaDespesa ? { anoDaDespesa, gastos: g } : atual)))
      .catch(() => setDoAno(null));
  };

  const seletor = legislatura ? (
    <SeletorDeAnoDaCotaComponent legislatura={legislatura} anoDaDespesa={doAno?.anoDaDespesa ?? padrao.anoDaDespesa} aoEscolher={escolher} />
  ) : null;

  if (!gastos) {
    return (
      <section className="aba-dinheiro" aria-label={T.cota.rotulo}>
        {seletor}
        <EsqueletoDeTextoComponent rotulo={T.cota.carregandoOAno} />
      </section>
    );
  }

  if (gastos.lancamentos === 0) {
    return (
      <section className="aba-dinheiro">
        {seletor}
        <p className="vazio">{T.cota.vazio(doAno ? doAno.anoDaDespesa : null)}</p>
      </section>
    );
  }

  const maior = gastos.porCategoria[0]?.total ?? 1;
  const principal = gastos.porCategoria[0];

  return (
    <section className="aba-dinheiro" aria-label={T.cota.rotulo}>
      {seletor}
      <p className="frase-resposta">
        {T.cota.resposta(
          <ComProcedenciaComponent
            consulta={{ contexto: 'cota', idPessoa: idPessoa, anoDaDespesa: gastos.anoDaDespesa }}
            rotulo={T.cota.rotuloDaProcedencia(gastos.anoDaDespesa)}
          >
            <strong>{reais(gastos.total)}</strong>
          </ComProcedenciaComponent>,
          gastos.anoDaDespesa,
          gastos.lancamentos,
          principal ? semPontosNoFim(minusculas(principal.categoria)) : null,
        )}
      </p>

      <div className="duas-colunas">
        <div>
          <h3 className="titulo-secao">{T.cota.emQue}</h3>
          <ul className="gastos-categorias">
            {gastos.porCategoria.map((c) => (
              <LinhaDeValorComponent
                key={c.categoria}
                nome={minusculas(c.categoria)}
                valor={c.total}
                maior={maior}
                procedencia={{
                  consulta: { contexto: 'cota', idPessoa: idPessoa, anoDaDespesa: gastos.anoDaDespesa, categoria: c.categoria },
                  rotulo: T.cota.rotuloDaCategoria(gastos.anoDaDespesa, minusculas(c.categoria)),
                }}
              />
            ))}
          </ul>
        </div>
        <div>
          <h3 className="titulo-secao">{T.cota.quemRecebeu}</h3>
          <ul className="gastos-fornecedores">
            {gastos.maioresFornecedores.map((f) => (
              <li key={f.nome}>
                <span className="gasto-nome">
                  {nomeProprio(f.nome)}
                  {f.pessoaFisica && <small>{T.cota.pessoaFisica}</small>}
                </span>
                <span className="gasto-valor">{reais(f.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="detalhes-da-aba">
        <summary>{T.cota.verDetalhes}</summary>
        <LancamentosDaCotaComponent idPessoa={idPessoa} anoDaDespesa={gastos.anoDaDespesa} total={gastos.lancamentos} />
      </details>

      <p className="ajuda ajuda-espacada">{T.cota.fonte}</p>
    </section>
  );
}

/** Os lançamentos, nota por nota — o caminho de volta de cada soma à fonte. */
function LancamentosDaCotaComponent({ idPessoa, anoDaDespesa, total }: { idPessoa: number; anoDaDespesa: number; total: number }) {
  const lista = usePaginas(NENHUM, total, 20, (pagina) => listarLancamentos(idPessoa, anoDaDespesa, pagina, 20));

  return (
    <>
      <h3 className="titulo-secao">
        {T.lancamentos.titulo}{' '}
        <BotaoBaixarCsvComponent
          rotulo={T.lancamentos.baixar}
          montar={async () => {
            const todas = await buscarTodas((pagina) => listarLancamentos(idPessoa, anoDaDespesa, pagina, 100));
            baixarCsv(
              T.lancamentos.arquivo(idPessoa, anoDaDespesa),
              [...T.lancamentos.colunas],
              todas.map((l) => [l.data, l.mes, l.categoria, l.fornecedor, l.valor, l.urlDocumento]),
            );
          }}
        />
      </h3>
      {lista.itens.length > 0 && (
        <ul className="lista-lancamentos">
          {lista.itens.map((l, i) => (
            <li key={i}>
              <span className="gasto-nome">
                {l.fornecedor ?? T.lancamentos.fornecedorNaoInformado}
                <small>
                  {l.data ? dataCurta(l.data) : T.lancamentos.mes(l.mes)} · {minusculas(l.categoria)}
                </small>
              </span>
              <span className="lancamento-fim">
                <span className="gasto-valor">{reais(l.valor)}</span>
                <LinkDeFonteComponent href={l.urlDocumento}>{T.lancamentos.notaFiscal}</LinkDeFonteComponent>
              </span>
            </li>
          ))}
        </ul>
      )}
      <BotaoMostrarMaisComponent
        {...lista}
        rotulo={lista.itens.length === 0 ? T.lancamentos.verTodos(total) : undefined}
        aoClicar={lista.carregarMais}
      />
    </>
  );
}

/**
 * O financiamento da campanha que elegeu o parlamentar (TSE).
 *
 * RISCO: O Fundo Especial e o Fundo Partidário aparecem SEPARADOS. A soma dos dois é dita como
 * soma, e não substitui os dois: somá-los como "dinheiro público" é uma afirmação.
 *
 * Campanha
 */
export function AbaCampanhaComponent({ idPessoa, contas, erro }: { idPessoa: number; contas: Contas | null; erro: boolean }) {
  const fin = contas?.fin;
  if (!fin) return <CarregandoComponent contas={contas} erro={erro} />;

  return (
    <>
      <FinanciamentoComponent idPessoa={idPessoa} fin={fin} />
      <PatrimonioDeclaradoComponent idPessoa={idPessoa} />
    </>
  );
}

/**
 * RISCO: RNF-13: o documento de pessoa física é hasheado no banco.
 */
function FinanciamentoComponent({ idPessoa, fin }: { idPessoa: number; fin: FinanciamentoDeCampanha }) {
  if (fin.total === 0) {
    return (
      <section className="aba-dinheiro">
        <p className="vazio">{T.campanha.vazio}</p>
      </section>
    );
  }

  const publico = fin.fundoEspecial + fin.fundoPartidario;
  const maior = fin.porFonte[0]?.total ?? 1;

  return (
    <section className="aba-dinheiro" aria-label={T.campanha.rotulo}>
      <p className="frase-resposta">
        {T.campanha.resposta(
          <ComProcedenciaComponent
            consulta={{ contexto: 'campanha', idPessoa: idPessoa, anoDaEleicao: fin.anoEleicao }}
            rotulo={T.campanha.rotuloDaProcedencia(fin.anoEleicao)}
          >
            <strong>{reais(fin.total)}</strong>
          </ComProcedenciaComponent>,
          fin.anoEleicao,
          reais(publico),
          ((publico / fin.total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
        )}
      </p>

      <div className="duas-colunas">
        <div>
          <h3 className="titulo-secao">{T.campanha.osDoisFundos}</h3>
          <ul className="fundos">
            <li>
              <span className="fundo-rotulo">{T.campanha.fundoEspecial}</span>
              <span className="fundo-valor">{reais(fin.fundoEspecial)}</span>
            </li>
            <li>
              <span className="fundo-rotulo">{T.campanha.fundoPartidario}</span>
              <span className="fundo-valor">{reais(fin.fundoPartidario)}</span>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="titulo-secao">{T.campanha.maioresDoadores}</h3>
          <ul className="gastos-fornecedores">
            {fin.maioresDoadores.map((d) => (
              <li key={d.nome}>
                <span className="gasto-nome">
                  {nomeProprio(d.nome)}
                  {d.pessoaFisica && <small>{T.campanha.pessoaFisica}</small>}
                </span>
                <span className="gasto-valor">{reais(d.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="detalhes-da-aba">
        <summary>{T.campanha.verDetalhes}</summary>
        <h3 className="titulo-secao">{T.campanha.deOndeVeio}</h3>
        <ul className="gastos-categorias">
          {fin.porFonte.map((f) => (
            <LinhaDeValorComponent key={f.fonte} nome={minusculas(f.fonte)} valor={f.total} maior={maior} />
          ))}
        </ul>
      </details>

      <p className="ajuda ajuda-espacada">
        {T.campanha.fonte}{' '}
        <LinkDeFonteComponent href={FONTES.prestacaoDeContas.url}>{T.campanha.conjuntoNoTse}</LinkDeFonteComponent>
      </p>
    </section>
  );
}


/**
 * O que o parlamentar declarou ter ao se candidatar — a última declaração, e a anterior ao lado.
 *
 * ATENÇÃO: As duas candidaturas aparecem como dois números, não como variação percentual: "cresceu
 * 300%" lê como acusação, e a declaração é do próprio candidato, pelo valor que ele deu ao
 * bem — não uma avaliação de mercado (RNF-16).
 *
 * RISCO: Só tipo e valor: a descrição de cada bem traz endereço, e não chega ao site.
 */
function PatrimonioDeclaradoComponent({ idPessoa }: { idPessoa: number }) {
  const [declaracoes, setDeclaracoes] = useState<DeclaracaoDeBens[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let atual = true;
    obterPatrimonio(idPessoa)
      .then((lidas) => atual && setDeclaracoes(lidas))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [idPessoa]);

  if (erro) return <p className="erro">{T.patrimonio.erro}</p>;
  if (!declaracoes) return <EsqueletoDeTextoComponent rotulo={T.patrimonio.carregando} paragrafos={1} />;

  if (declaracoes.length === 0) {
    return (
      <section className="aba-dinheiro" aria-label={T.patrimonio.rotulo}>
        <h2 className="titulo-secao">{T.patrimonio.titulo}</h2>
        <p className="vazio">{T.patrimonio.vazio}</p>
      </section>
    );
  }

  const [ultima, anterior] = declaracoes;
  const maior = ultima.porTipo[0]?.valor || 1;
  const linha = (t: DeclaracaoDeBens['porTipo'][number]) => (
    <LinhaDeValorComponent
      key={t.tipo}
      nome={
        <>
          {t.tipo}
          {t.quantidade > 1 && <small>{T.patrimonio.bens(t.quantidade)}</small>}
        </>
      }
      valor={t.valor}
      maior={maior}
    />
  );

  return (
    <section className="aba-dinheiro" aria-label={T.patrimonio.rotulo}>
      <h2 className="titulo-secao">{T.patrimonio.titulo}</h2>
      <p className="frase-resposta">
        {T.patrimonio.resposta(
          <ComProcedenciaComponent
            consulta={{ contexto: 'patrimonio', idPessoa: idPessoa, anoDaEleicao: ultima.anoEleicao }}
            rotulo={T.patrimonio.rotuloDaProcedencia(ultima.anoEleicao)}
          >
            <strong>{reais(ultima.total)}</strong>
          </ComProcedenciaComponent>,
          ultima.bens,
          ultima.anoEleicao,
          anterior ? { anoDaEleicao: anterior.anoEleicao, total: reais(anterior.total) } : null,
        )}
      </p>

      <ul className="gastos-categorias">{ultima.porTipo.slice(0, TIPOS_DE_BEM_A_VISTA).map(linha)}</ul>

      {ultima.porTipo.length > TIPOS_DE_BEM_A_VISTA && (
        <details className="detalhes-da-aba">
          <summary>{T.patrimonio.verOsOutros(ultima.porTipo.length - TIPOS_DE_BEM_A_VISTA)}</summary>
          <ul className="gastos-categorias">{ultima.porTipo.slice(TIPOS_DE_BEM_A_VISTA).map(linha)}</ul>
        </details>
      )}

      <p className="nota-curta">
        {T.patrimonio.nota}{' '}
        <LinkDeFonteComponent href={FONTES.candidatos.url}>{T.patrimonio.declaracoesNoTse}</LinkDeFonteComponent>
      </p>
    </section>
  );
}


/**
 * Os quatro anos de cota do mandato, como botões. O ano corrente diz que está em andamento:
 * comparar o total dele com o de um ano fechado leria como queda.
 */
function SeletorDeAnoDaCotaComponent({
  legislatura,
  anoDaDespesa,
  aoEscolher,
}: {
  legislatura: number;
  anoDaDespesa: number;
  aoEscolher: (anoDaDespesa: number) => void;
}) {
  const posse = Number(periodoDaLegislatura(legislatura).slice(0, 4));
  const atual = new Date().getFullYear();
  const anos = [posse, posse + 1, posse + 2, posse + 3].filter((a) => a <= atual);

  return (
    <OpcoesComponent
      rotulo={T.cota.anoDaCota}
      opcoes={anos.map((a) => ({
        valor: a,
        rotulo: (
          <>
            {a}
            {a === atual && <span className="em-andamento">{T.cota.emAndamento}</span>}
          </>
        ),
      }))}
      escolhida={anoDaDespesa}
      aoEscolher={aoEscolher}
    />
  );
}
