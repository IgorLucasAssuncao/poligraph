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
import { dataCurta, minusculas, nomeProprio, periodoDaLegislatura, reais } from '../formato';
import { BotaoBaixarCsvComponent } from './BotaoBaixarCsv';
import { BotaoMostrarMaisComponent } from './BotaoMostrarMais';
import { ConveniosComponent, EmendasUmaAUmaComponent, QuandoFoiPagoComponent, QuemRecebeuComponent } from './DestinoDasEmendas';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { TermoComponent } from './Termo';
import { ComProcedenciaComponent } from './ModoAuditoria';
import { NENHUM, usePaginas } from './usePaginas';
import type { Contas } from './useContas';
import { EsqueletoDePainelComponent, EsqueletoDeTextoComponent } from './Esqueleto';
import { LinhaDeValorComponent, OpcoesComponent } from './Dados';

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
        {mandatoPassado
          ? `No mandato de ${periodoDaLegislatura(mandatoPassado)}: o ano mais recente de cada um dentro dele.`
          : 'O valor mais recente de cada um. Os anos são diferentes.'}
      </p>
      <nav className="perfil-contas contas-numeros" data-tour="ficha-contas" aria-label="Contas do mandato">
        <ValorDaContaComponent
          para={`${base}/campanha${sufixo}`}
          rotulo={fin?.anoEleicao ? `Campanha de ${fin.anoEleicao}` : 'Campanha'}
          valor={fin?.total}
          nota="arrecadado na eleição"
        />
        <ValorDaContaComponent
          para={`${base}/emendas${sufixo}`}
          rotulo={emendas?.ano ? `Emendas de ${emendas.ano}` : 'Emendas'}
          valor={emendas?.empenhado}
          nota="empenhado no ano"
        />
        <ValorDaContaComponent
          para={`${base}/cota${sufixo}`}
          rotulo={gastos?.ano ? `Cota de ${gastos.ano}` : 'Cota'}
          valor={gastos?.total}
          nota="gasto no ano"
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
      <span className="conta-rotulo">{rotulo} →</span>
      <span className={`conta-numero ${tem ? '' : 'conta-ausente'}`}>{tem ? reais(valor) : '—'}</span>
      <span className="conta-nota">{tem ? nota : 'sem registro na base'}</span>
    </Link>
  );
}

/** O que ainda não chegou, ou não existe na base, dito do mesmo jeito nas três abas. */
function CarregandoComponent({ contas, erro }: { contas: Contas | null; erro: boolean }) {
  if (erro) return <p className="erro">Não foi possível carregar as contas agora.</p>;
  if (!contas) return <EsqueletoDePainelComponent rotulo="Carregando as contas" />;
  return null;
}

/**
 * RISCO: **Empenhado e pago, sempre juntos.** Empenhar é reservar; pagar é o dinheiro sair. Só
 * o empenhado deixaria concluir que o dinheiro chegou — o que quem anuncia emenda gostaria.
 *
 * Emendas
 */
export function AbaEmendasComponent({ pessoaId, contas, erro }: { pessoaId: number; contas: Contas | null; erro: boolean }) {
  const emendas = contas?.emendas;
  if (!emendas) return <CarregandoComponent contas={contas} erro={erro} />;

  if (emendas.quantidade === 0) {
    return (
      <section className="aba-dinheiro">
        <p className="vazio">Nenhuma emenda atribuída a este parlamentar na base.</p>
      </section>
    );
  }

  const pagoTotal = emendas.pago + (emendas.pagoDepois ?? 0);
  const fracao = (valor: number) => (emendas.empenhado > 0 ? Math.min(valor / emendas.empenhado, 1) : 0);
  const maiorDestino = emendas.porDestino[0]?.empenhado ?? 1;

  return (
    <section className="aba-dinheiro" aria-label="Emendas">
      <div className="execucao">
        <p className="frase-resposta">
          <ComProcedenciaComponent
            consulta={{ contexto: 'emendas', pessoa: pessoaId, ano: emendas.ano }}
            rotulo={`Emendas de ${emendas.ano}`}
          >
            <strong>{reais(pagoTotal)}</strong>
          </ComProcedenciaComponent>{' '}
          pagos de {reais(emendas.empenhado)} empenhados em{' '}
          <strong>{emendas.quantidade}</strong> {emendas.quantidade === 1 ? 'emenda' : 'emendas'} de {emendas.ano}:{' '}
          {(fracao(pagoTotal) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% saiu de fato
        </p>
        <span className="gasto-barra execucao-barra" aria-hidden="true">
          <span style={{ width: `${fracao(emendas.pago) * 100}%` }} />
          {emendas.pagoDepois > 0 && (
            <span className="parte-depois" style={{ width: `${fracao(emendas.pagoDepois) * 100}%` }} />
          )}
        </span>
        <p className="legenda-execucao">
          <span><span className="amostra-cor" aria-hidden="true" /> pago em {emendas.ano}: {reais(emendas.pago)}</span>
          {emendas.pagoDepois > 0 && (
            <span>
              <span className="amostra-cor parte-depois" aria-hidden="true" /> pago nos anos seguintes:{' '}
              {reais(emendas.pagoDepois)}
            </span>
          )}
          <span>
            <span className="amostra-cor nao-pago" aria-hidden="true" /> ainda não pago:{' '}
            {reais(Math.max(emendas.empenhado - pagoTotal, 0))}
          </span>
        </p>
      </div>

      <div className="duas-colunas">
        <div>
          <CidadesQueReceberamComponent cidades={emendas.cidades} />
        </div>
        <div>
          <QuemRecebeuComponent pessoaId={pessoaId} favorecidos={emendas.favorecidos} ano={emendas.ano} />
        </div>
      </div>

      <details className="detalhes-da-aba">
        <summary>Ver detalhes: áreas do orçamento, local declarado, mês a mês, convênios e emenda por emenda</summary>

        {emendas.porFuncao.length > 0 && (
          <>
            <h3 className="titulo-secao">
              Em quê <TermoComponent nome="funcaoOrcamentaria">(área do orçamento)</TermoComponent>
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

        <h3 className="titulo-secao">Local declarado na emenda</h3>
        <p className="ajuda">
          O que o autor escreveu ao apresentar a emenda. Em boa parte diz “vários lugares” ou o estado inteiro, e a
          cidade de verdade está em “Cidades que receberam”.
        </p>
        <ul className="gastos-categorias">
          {emendas.porDestino.map((d) => (
            <LinhaDeValorComponent key={d.localidade} nome={<DestinoComponent localidade={d.localidade} />} valor={d.empenhado} maior={maiorDestino} />
          ))}
        </ul>

        <QuandoFoiPagoComponent meses={emendas.pagamentosPorMes} ano={emendas.ano} />
        <ConveniosComponent pessoaId={pessoaId} convenios={emendas.convenios} ano={emendas.ano} />
        <EmendasUmaAUmaComponent pessoaId={pessoaId} ano={emendas.ano} total={emendas.quantidade} />
      </details>

      <p className="ajuda ajuda-espacada">
        <TermoComponent nome="emenda">Emendas parlamentares</TermoComponent> publicadas pelo Portal da Transparência. A diferença entre{' '}
        <TermoComponent nome="empenho">empenhado e pago</TermoComponent> é o que a barra acima mostra.
      </p>
    </section>
  );
}

/** Pela sede de quem recebeu — CNPJ → IBGE —, e cada cidade leva ao mapa. */
function CidadesQueReceberamComponent({ cidades }: { cidades: CidadesDaEmenda }) {
  if (cidades.quantidade === 0) return null;

  const maior = cidades.maiores[0]?.recebido ?? 1;

  return (
    <>
      <h3 className="titulo-secao">Cidades que receberam</h3>
      <p className="ajuda ajuda-espacada">
        {cidades.quantidade} {cidades.quantidade === 1 ? 'cidade' : 'cidades'}, pela{' '}
        <TermoComponent nome="sedeDoFavorecido">sede de quem recebeu</TermoComponent>.
      </p>
      <ul className="gastos-categorias">
        {cidades.maiores.map((c) => (
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
    </>
  );
}

/**
 * O destino DECLARADO — quatro coisas diferentes na mesma coluna.
 *
 * RISCO: `MÚLTIPLO` não é um lugar: é o aviso de que a emenda se reparte, e o Portal não diz onde.
 */
function DestinoComponent({ localidade }: { localidade: string }) {
  if (localidade === 'MÚLTIPLO') {
    return (
      <>
        <TermoComponent nome="multiplo">Vários lugares</TermoComponent>
        <small> · o Portal não detalha quais</small>
      </>
    );
  }

  if (localidade === 'Nacional') {
    return (
      <>
        <TermoComponent nome="nacional">Alcance nacional</TermoComponent>
        <small> · sem destino territorial</small>
      </>
    );
  }

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
  pessoaId,
  contas,
  erro,
  legislatura,
}: {
  pessoaId: number;
  contas: Contas | null;
  erro: boolean;
  legislatura?: number | null;
}) {
  const [doAno, setDoAno] = useState<{ ano: number; gastos: GastoDeCota | null } | null>(null);
  const padrao = contas?.gastos;
  const gastos = doAno?.gastos ?? (doAno ? null : padrao);

  if (!padrao) return <CarregandoComponent contas={contas} erro={erro} />;

  const escolher = (ano: number) => {
    if (ano === padrao.ano) {
      setDoAno(null);
      return;
    }
    setDoAno({ ano, gastos: null });
    obterGastos(pessoaId, legislatura, ano)
      .then((g) => setDoAno((atual) => (atual?.ano === ano ? { ano, gastos: g } : atual)))
      .catch(() => setDoAno(null));
  };

  const seletor = legislatura ? (
    <SeletorDeAnoDaCotaComponent legislatura={legislatura} ano={doAno?.ano ?? padrao.ano} aoEscolher={escolher} />
  ) : null;

  if (!gastos) {
    return (
      <section className="aba-dinheiro" aria-label="Cota parlamentar">
        {seletor}
        <EsqueletoDeTextoComponent rotulo="Carregando a cota do ano" />
      </section>
    );
  }

  if (gastos.lancamentos === 0) {
    return (
      <section className="aba-dinheiro">
        {seletor}
        <p className="vazio">Nenhuma despesa de cota registrada {doAno ? `em ${doAno.ano}` : 'para este parlamentar na base'}.</p>
      </section>
    );
  }

  const maior = gastos.porCategoria[0]?.total ?? 1;
  const principal = gastos.porCategoria[0];

  return (
    <section className="aba-dinheiro" aria-label="Cota parlamentar">
      {seletor}
      <p className="frase-resposta">
        Gastou{' '}
        <ComProcedenciaComponent
          consulta={{ contexto: 'cota', pessoa: pessoaId, ano: gastos.ano }}
          rotulo={`Cota parlamentar de ${gastos.ano}`}
        >
          <strong>{reais(gastos.total)}</strong>
        </ComProcedenciaComponent>{' '}
        da <TermoComponent nome="cota">cota parlamentar</TermoComponent> em {gastos.ano},
        em <strong>{gastos.lancamentos}</strong> notas
        {principal && (
          <>
            . A maior parte em <strong>{minusculas(principal.categoria).replace(/\.+$/, '')}</strong>
          </>
        )}
        .
      </p>

      <div className="duas-colunas">
        <div>
          <h3 className="titulo-secao">Em quê</h3>
          <ul className="gastos-categorias">
            {gastos.porCategoria.map((c) => (
              <LinhaDeValorComponent key={c.categoria} nome={minusculas(c.categoria)} valor={c.total} maior={maior} />
            ))}
          </ul>
        </div>
        <div>
          <h3 className="titulo-secao">Quem recebeu</h3>
          <ul className="gastos-fornecedores">
            {gastos.maioresFornecedores.map((f) => (
              <li key={f.nome}>
                <span className="gasto-nome">
                  {nomeProprio(f.nome)}
                  {f.pessoaFisica && <small>pessoa física</small>}
                </span>
                <span className="gasto-valor">{reais(f.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="detalhes-da-aba">
        <summary>Ver detalhes: nota por nota, com o documento fiscal</summary>
        <LancamentosDaCotaComponent pessoaId={pessoaId} ano={gastos.ano} total={gastos.lancamentos} />
      </details>

      <p className="ajuda ajuda-espacada">
        Cota para o Exercício da Atividade Parlamentar, publicada pela Câmara dos Deputados e pelo Senado Federal.
        Valores já descontada a glosa.
      </p>
    </section>
  );
}

/** Os lançamentos, nota por nota — o caminho de volta de cada soma à fonte. */
function LancamentosDaCotaComponent({ pessoaId, ano, total }: { pessoaId: number; ano: number; total: number }) {
  const lista = usePaginas(NENHUM, total, 20, (pagina) => listarLancamentos(pessoaId, ano, pagina, 20));

  return (
    <>
      <h3 className="titulo-secao">
        Nota por nota{' '}
        <BotaoBaixarCsvComponent
          rotulo="Baixar todas (CSV)"
          montar={async () => {
            const todas = await buscarTodas((pagina) => listarLancamentos(pessoaId, ano, pagina, 100));
            baixarCsv(
              `cota-${pessoaId}-${ano}.csv`,
              ['Data', 'Mês', 'Categoria', 'Fornecedor', 'Valor', 'Documento fiscal'],
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
                {l.fornecedor ?? 'Fornecedor não informado'}
                <small>
                  {l.data ? dataCurta(l.data) : `mês ${l.mes}`} · {minusculas(l.categoria)}
                </small>
              </span>
              <span className="lancamento-fim">
                <span className="gasto-valor">{reais(l.valor)}</span>
                <LinkDeFonteComponent href={l.urlDocumento}>nota fiscal</LinkDeFonteComponent>
              </span>
            </li>
          ))}
        </ul>
      )}
      <BotaoMostrarMaisComponent
        {...lista}
        rotulo={lista.itens.length === 0 ? `Ver os ${total} lançamentos` : undefined}
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
export function AbaCampanhaComponent({ pessoaId, contas, erro }: { pessoaId: number; contas: Contas | null; erro: boolean }) {
  const fin = contas?.fin;
  if (!fin) return <CarregandoComponent contas={contas} erro={erro} />;

  return (
    <>
      <FinanciamentoComponent pessoaId={pessoaId} fin={fin} />
      <PatrimonioDeclaradoComponent pessoaId={pessoaId} />
    </>
  );
}

/**
 * RISCO: RNF-13: o documento de pessoa física é hasheado no banco.
 */
function FinanciamentoComponent({ pessoaId, fin }: { pessoaId: number; fin: FinanciamentoDeCampanha }) {
  if (fin.total === 0) {
    return (
      <section className="aba-dinheiro">
        <p className="vazio">Nenhuma receita de campanha registrada para este parlamentar na base.</p>
      </section>
    );
  }

  const publico = fin.fundoEspecial + fin.fundoPartidario;
  const maior = fin.porFonte[0]?.total ?? 1;

  return (
    <section className="aba-dinheiro" aria-label="Campanha">
      <p className="frase-resposta">
        Arrecadou{' '}
        <ComProcedenciaComponent
          consulta={{ contexto: 'campanha', pessoa: pessoaId, ano: fin.anoEleicao }}
          rotulo={`Campanha de ${fin.anoEleicao}`}
        >
          <strong>{reais(fin.total)}</strong>
        </ComProcedenciaComponent>{' '}
        na eleição de {fin.anoEleicao}. Juntos, os dois fundos somam{' '}
        <strong>{reais(publico)}</strong>,{' '}
        {((publico / fin.total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do que a campanha
        arrecadou. São fundos <strong>distintos</strong>: o Fundo Especial é eleitoral; o Partidário custeia o partido o
        ano inteiro.
      </p>

      <div className="duas-colunas">
        <div>
          <h3 className="titulo-secao">Os dois fundos</h3>
          <ul className="fundos">
            <li>
              <span className="fundo-rotulo">
                <TermoComponent nome="fundao">Fundo Especial</TermoComponent>
              </span>
              <span className="fundo-valor">{reais(fin.fundoEspecial)}</span>
            </li>
            <li>
              <span className="fundo-rotulo">Fundo Partidário</span>
              <span className="fundo-valor">{reais(fin.fundoPartidario)}</span>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="titulo-secao">Maiores doadores</h3>
          <ul className="gastos-fornecedores">
            {fin.maioresDoadores.map((d) => (
              <li key={d.nome}>
                <span className="gasto-nome">
                  {nomeProprio(d.nome)}
                  {d.pessoaFisica && <small>pessoa física</small>}
                </span>
                <span className="gasto-valor">{reais(d.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="detalhes-da-aba">
        <summary>Ver detalhes: todas as fontes de receita</summary>
        <h3 className="titulo-secao">De onde veio</h3>
        <ul className="gastos-categorias">
          {fin.porFonte.map((f) => (
            <LinhaDeValorComponent key={f.fonte} nome={minusculas(f.fonte)} valor={f.total} maior={maior} />
          ))}
        </ul>
      </details>

      <p className="ajuda ajuda-espacada">
        Prestação de contas eleitorais publicada pelo TSE.{' '}
        <LinkDeFonteComponent href={FONTES.prestacaoDeContas.url}>Conjunto de dados no TSE</LinkDeFonteComponent>
      </p>
    </section>
  );
}

/**
 * Patrimônio declarado (PP3)
 */
const TIPOS_A_VISTA = 5;

/**
 * O que o parlamentar declarou ter ao se candidatar — a última declaração, e a anterior ao lado.
 *
 * ATENÇÃO: As duas candidaturas aparecem como dois números, não como variação percentual: "cresceu
 * 300%" lê como acusação, e a declaração é do próprio candidato, pelo valor que ele deu ao
 * bem — não uma avaliação de mercado (RNF-16).
 *
 * RISCO: Só tipo e valor: a descrição de cada bem traz endereço, e não chega ao site.
 */
function PatrimonioDeclaradoComponent({ pessoaId }: { pessoaId: number }) {
  const [declaracoes, setDeclaracoes] = useState<DeclaracaoDeBens[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let atual = true;
    obterPatrimonio(pessoaId)
      .then((lidas) => atual && setDeclaracoes(lidas))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [pessoaId]);

  if (erro) return <p className="erro">Não foi possível carregar o patrimônio agora.</p>;
  if (!declaracoes) return <EsqueletoDeTextoComponent rotulo="Carregando o patrimônio" paragrafos={1} />;

  if (declaracoes.length === 0) {
    return (
      <section className="aba-dinheiro" aria-label="Patrimônio declarado">
        <h2 className="titulo-secao">Patrimônio declarado ao TSE</h2>
        <p className="vazio">Nenhuma declaração de bens deste parlamentar ao TSE na base.</p>
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
          {t.quantidade > 1 && <small>{t.quantidade} bens</small>}
        </>
      }
      valor={t.valor}
      maior={maior}
    />
  );

  return (
    <section className="aba-dinheiro" aria-label="Patrimônio declarado">
      <h2 className="titulo-secao">Patrimônio declarado ao TSE</h2>
      <p className="frase-resposta">
        Declarou{' '}
        <ComProcedenciaComponent
          consulta={{ contexto: 'patrimonio', pessoa: pessoaId, ano: ultima.anoEleicao }}
          rotulo={`Bens declarados em ${ultima.anoEleicao}`}
        >
          <strong>{reais(ultima.total)}</strong>
        </ComProcedenciaComponent>{' '}
        em {ultima.bens} {ultima.bens === 1 ? 'bem' : 'bens'} ao se
        candidatar em {ultima.anoEleicao}.
        {anterior && (
          <>
            {' '}
            Em {anterior.anoEleicao}, tinha declarado <strong>{reais(anterior.total)}</strong>.
          </>
        )}
      </p>

      <ul className="gastos-categorias">{ultima.porTipo.slice(0, TIPOS_A_VISTA).map(linha)}</ul>

      {ultima.porTipo.length > TIPOS_A_VISTA && (
        <details className="detalhes-da-aba">
          <summary>Ver os outros {ultima.porTipo.length - TIPOS_A_VISTA} tipos de bem</summary>
          <ul className="gastos-categorias">{ultima.porTipo.slice(TIPOS_A_VISTA).map(linha)}</ul>
        </details>
      )}

      <p className="nota-curta">
        O valor é o que o próprio candidato declarou ao TSE, sem avaliação de mercado.{' '}
        <LinkDeFonteComponent href={FONTES.candidatos.url}>Declarações no TSE</LinkDeFonteComponent>
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
  ano,
  aoEscolher,
}: {
  legislatura: number;
  ano: number;
  aoEscolher: (ano: number) => void;
}) {
  const posse = Number(periodoDaLegislatura(legislatura).slice(0, 4));
  const atual = new Date().getFullYear();
  const anos = [posse, posse + 1, posse + 2, posse + 3].filter((a) => a <= atual);

  return (
    <OpcoesComponent
      rotulo="Ano da cota"
      opcoes={anos.map((a) => ({
        valor: a,
        rotulo: (
          <>
            {a}
            {a === atual && <span className="em-andamento"> em andamento</span>}
          </>
        ),
      }))}
      escolhida={ano}
      aoEscolher={aoEscolher}
    />
  );
}
