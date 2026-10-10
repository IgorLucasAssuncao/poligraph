import { useMemo } from 'react';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { useCarga } from '../componentes/useCarga';
import { useSearchParams } from 'react-router-dom';
import {
  obterGoverno,
  type AreaDaDespesa,
  type Arrecadacao,
  type DefesaCivil,
  type Encargo,
  type Gestao,
  type GrupoDeEncargo,
  type Governo as DadosDoGoverno,
  type Periodo,
  type PessoaDaGestao,
  type Sigilo,
} from '../api';
import { AbasDoDinheiroComponent } from '../componentes/AbasDoDinheiro';
import { AbasDoGovernoComponent } from '../componentes/AbasDoGoverno';
import { BotaoBaixarCsvComponent } from '../componentes/BotaoBaixarCsv';
import { BotaoDoTourComponent } from '../componentes/BotaoDoTour';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { SeletorDePeriodoComponent } from '../componentes/SeletorDePeriodo';
import { baixarCsv } from '../exportar';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { FONTES } from '../fontes';
import { dataCurta, mesCurto, nomeProprio, partesDeCem, reaisCompacto } from '../formato';
import { passosDoGoverno } from '../tour';
import { EsqueletoDePainelComponent } from '../componentes/Esqueleto';
import { LinhaDeValorComponent, NumeroComponent } from '../componentes/Dados';
import { ComProcedenciaComponent } from '../componentes/ModoAuditoria';
import { AREAS_DO_ORCAMENTO_NOMEADAS } from '../constantes';
import { TEXTOS_DO_GOVERNO as T } from '../textos/governo';

/**
 * O governo federal para quem não lê orçamento: quanto entrou, onde foi parar, o que foi
 * gasto em segredo e quem governava.
 *
 * ## Por que assim
 *
 * - **Período, não ano a ano.** O padrão são todos os anos carregados; a tabela "Ano a ano"
 *   compara os anos sem trocar o filtro. Escolher um ano por clique obrigava a somar de
 *   cabeça.
 * - **Uma frase por número, curta.** Cada linha miúda de definição era mais uma coisa a
 *   ler antes do dado; o jargão ficou nas dicas clicáveis (`TermoComponent`) e em "Ver os detalhes".
 * - **O sigilo com a base.** "R$ 50 mi sigilosos" sozinho fazia parecer que o cartão
 *   inteiro era secreto; a barra mostra as duas partes.
 *
 * ## RISCO: O que a página não faz
 *
 * - **Qualificar o governo** (RNF-16). Sem nota, sem meta, sem cor de bom e ruim, e sem
 *   saldo: o que entrou e o que saiu ficam separados e não se subtraem.
 * - **Somar empréstimo à arrecadação**, nem **contar a rolagem como gasto**.
 *
 * ATENÇÃO: A gestão vem depois dos números: em ano eleitoral, o presidente no topo lia como vitrine.
 *
 * O texto da página fica em `textos/governo.tsx`.
 */
export function GovernoComponent({ secao = 'orcamento' }: { secao?: 'orcamento' | 'cartoes' }) {
  const [parametros, setParametros] = useSearchParams();
  const deNaUrl = parametros.get('de');
  const ateNaUrl = parametros.get('ate');
  const periodo = useMemo<Periodo | undefined>(
    () => (deNaUrl && ateNaUrl ? { primeiroAno: Number(deNaUrl), ultimoAno: Number(ateNaUrl) } : undefined),
    [deNaUrl, ateNaUrl],
  );
  const { dados, erro, atualizando, chaveDoDado } = useCarga(['governo', deNaUrl, ateNaUrl], () => obterGoverno(periodo));
  const passos = useMemo(() => passosDoGoverno(), []);


  return (
    <>
      <AbasDoDinheiroComponent />
      <CabecalhoDaColunaComponent
        titulo={T.titulo}
        subtitulo={T.subtitulo}
        acao={<BotaoDoTourComponent nome="governo" passos={passos} />}
      />
      <AbasDoGovernoComponent busca={parametros.toString() ? `?${parametros.toString()}` : ''} />

      {erro && <p className="erro">{T.erro}</p>}
      {!erro && dados === undefined && <EsqueletoDePainelComponent rotulo={T.carregando} alturaDoGrafico={260} />}
      {!erro && dados === null && <p className="vazio">{T.semDados}</p>}

      {dados && (
        <AtualizandoComponent atualizando={atualizando} chave={chaveDoDado}>
          <SeletorDePeriodoComponent
            anos={dados.anosDisponiveis}
            periodo={dados.periodo}
            rotulo={T.rotuloDoPeriodo}
            tour="governo-ano"
            atalhos={atalhosDasGestoes(dados)}
            aoMudar={(novo) =>
              setParametros(novo ? { de: String(novo.primeiroAno), ate: String(novo.ultimoAno) } : {}, { replace: true })
            }
          >
            {T.escopo(textoDoPeriodo(dados.periodo), dados.emAndamento, dataCurta(dados.geradoEm))}
          </SeletorDePeriodoComponent>

          {secao === 'orcamento' ? (
            <>
              <ResumoComponent dados={dados} />
              {dados.porAno.length > 1 && <AnoAAnoComponent dados={dados} />}
              <CadaCemReaisComponent dados={dados} />
              <DeOndeVeioComponent arrecadacao={dados.arrecadacao} />
              {dados.gestoes.map((g) => (
                <PerfilDaGestaoComponent key={g.anoDaEleicao} gestao={g} />
              ))}
              <DetalhesComponent dados={dados} />
            </>
          ) : (
            <>
              <GastoSigilosoComponent sigilo={dados.sigilo} periodo={dados.periodo} emAndamento={dados.emAndamento} />
              {dados.defesaCivil && <DefesaCivilComponent defesaCivil={dados.defesaCivil} periodo={dados.periodo} />}
              {dados.comprasCentralizadas && (
                <ComprasCentralizadasComponent cpcc={dados.comprasCentralizadas} periodo={dados.periodo} />
              )}
            </>
          )}

          <p className="fonte-dado">
            {T.arquivosGeradosAte(dataCurta(dados.geradoEm))}{' '}
            <LinkDeFonteComponent href={FONTES.candidatos.url}>{T.fonteTse}</LinkDeFonteComponent>
            {' · '}
            <LinkDeFonteComponent href={FONTES.orcamento.url}>{T.fonteOrcamento}</LinkDeFonteComponent>
            {' · '}
            <LinkDeFonteComponent href={FONTES.execucao.url}>{T.fonteExecucao}</LinkDeFonteComponent>
            {' · '}
            <LinkDeFonteComponent href={FONTES.receitas.url}>{T.fonteReceitas}</LinkDeFonteComponent>
            {' · '}
            <LinkDeFonteComponent href={FONTES.cartao.url}>{T.fonteCartao}</LinkDeFonteComponent> {T.portalDaTransparencia}
          </p>
        </AtualizandoComponent>
      )}
    </>
  );
}

function totalDoEncargo(encargos: Encargo[], grupo: GrupoDeEncargo): number {
  const encargo = encargos.find((e) => e.grupo === grupo);
  return encargo ? encargo.pago + encargo.restosAPagarPagos : 0;
}

/**
 * Uma gestão por botão, com o período dela recortado aos anos que existem.
 *
 * DECISÃO: Comparar as gestões medidas do mesmo jeito é o que mostra que a página não é sobre uma
 * delas — a pergunta de quem desconfia (persona do empresário, rodada 2).
 */
function atalhosDasGestoes(dados: DadosDoGoverno): { rotulo: string; periodo: Periodo }[] {
  const primeiro = dados.anosDisponiveis[0];
  const ultimo = dados.anosDisponiveis[dados.anosDisponiveis.length - 1];
  return dados.gestoesDisponiveis.map((g) => ({
    rotulo: `${nomeProprio(g.presidente.nomeDeUrna)} (${g.primeiroAno}–${g.ultimoAno})`,
    periodo: { primeiroAno: Math.max(g.primeiroAno, primeiro), ultimoAno: Math.min(g.ultimoAno, ultimo) },
  }));
}

function gestaoDoAno(dados: DadosDoGoverno, anoDoOrcamento: number): string {
  const g = dados.gestoesDisponiveis.find((x) => x.primeiroAno <= anoDoOrcamento && x.ultimoAno >= anoDoOrcamento);
  return g ? nomeProprio(g.presidente.nomeDeUrna) : T.semGestao;
}

function textoDoPeriodo({ primeiroAno, ultimoAno }: Periodo): string {
  return primeiroAno === ultimoAno ? String(primeiroAno) : `${primeiroAno} a ${ultimoAno}`;
}

/** Três números. Não Há um quarto que os junte: o saldo pediria regras fiscais que estes dados não seguem. */
function ResumoComponent({ dados }: { dados: DadosDoGoverno }) {
  const gastou = dados.porAno.reduce((soma, a) => soma + a.gastou, 0);
  const { primeiroAno, ultimoAno } = dados.periodo;
  const R = T.resumo;
  const numeros: [string, number, string, 'governo-receitas' | 'governo-gastos'][] = [
    [R.entrou, dados.arrecadacao.arrecadado, R.entrouDefinicao, 'governo-receitas'],
    [R.gastou, gastou, R.gastouDefinicao, 'governo-gastos'],
    [R.pegouEmprestado, dados.arrecadacao.emissaoDeDivida, R.pegouEmprestadoDefinicao, 'governo-receitas'],
  ];

  return (
    <section className="numeros-do-ano" aria-label={R.rotuloDaSecao(textoDoPeriodo(dados.periodo))} data-tour="governo-resumo">
      {numeros.map(([rotulo, valor, definicao, contexto]) => (
        <NumeroComponent key={rotulo} rotulo={rotulo} definicao={definicao}>
          <ComProcedenciaComponent consulta={{ contexto, de: primeiroAno, ate: ultimoAno }} rotulo={R.rotuloDaProcedencia(rotulo, textoDoPeriodo(dados.periodo))}>
            {reaisCompacto(valor)}
          </ComProcedenciaComponent>
        </NumeroComponent>
      ))}
    </section>
  );
}

/**
 * Os três números de cada ano, lado a lado: a comparação sem trocar o filtro.
 *
 * ATENÇÃO: Valores nominais. Sem correção pela inflação, o ano mais recente parece maior só por ser
 * mais recente — e comparar gestões assim favoreceria a última. A tabela diz isso.
 */
function AnoAAnoComponent({ dados }: { dados: DadosDoGoverno }) {
  const A = T.anoAAno;
  return (
    <section className="governo-secao">
      <h2>{A.titulo}</h2>
      <p className="nota-curta">{A.nota}</p>
      <div className="tabela-rolavel">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">{A.legenda}</caption>
          <thead>
            <tr>
              <th scope="col">{A.ano}</th>
              <th scope="col">{A.gestao}</th>
              <th scope="col">{A.entrou}</th>
              <th scope="col">{A.gastou}</th>
              <th scope="col">{A.pegouEmprestado}</th>
            </tr>
          </thead>
          <tbody>
            {dados.porAno.map((a) => (
              <tr key={a.anoDoOrcamento}>
                <th scope="row">
                  {a.anoDoOrcamento}
                  {!a.fechado && <small className="ano-andamento">{A.emAndamento}</small>}
                </th>
                <td className="coluna-gestao">{gestaoDoAno(dados, a.anoDoOrcamento)}</td>
                <td>{reaisCompacto(a.arrecadou)}</td>
                <td>{reaisCompacto(a.gastou)}</td>
                <td>{reaisCompacto(a.pegouEmprestado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * "De cada R$ 100 gastos": a divisão que se entende sem saber o tamanho de um trilhão.
 *
 * ATENÇÃO: As parcelas somam 100 exatos (`partesDeCem`), e cada linha traz o valor em reais.
 */
function CadaCemReaisComponent({ dados }: { dados: DadosDoGoverno }) {
  const { areas, encargos } = dados.despesa;
  const C = T.cadaCem;
  const porArea = [...areas]
    .map((a) => ({ nome: a.nome, valor: a.pago + a.restosAPagarPagos }))
    .filter((a) => a.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const linhas = [
    ...porArea.slice(0, AREAS_DO_ORCAMENTO_NOMEADAS),
    { nome: C.repasses, valor: totalDoEncargo(encargos, 'TRANSFERENCIAS') },
    { nome: C.juros, valor: totalDoEncargo(encargos, 'SERVICO_DA_DIVIDA') },
    {
      nome: C.outras,
      valor: porArea.slice(AREAS_DO_ORCAMENTO_NOMEADAS).reduce((soma, a) => soma + a.valor, 0) + totalDoEncargo(encargos, 'OUTROS'),
    },
  ]
    .filter((l) => l.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const partes = partesDeCem(linhas.map((l) => l.valor));
  const maior = Math.max(...partes, 1);

  return (
    <section className="governo-secao" data-tour="governo-cem">
      <h2>{C.titulo}</h2>

      <ul className="cada-cem">
        {linhas.map((l, i) => (
          <li key={l.nome}>
            <span className="cada-cem-parte">{C.parte(partes[i])}</span>
            <span className="cada-cem-nome">
              {l.nome}
              <small>{reaisCompacto(l.valor)}</small>
            </span>
            <span className="cada-cem-trilho" aria-hidden="true">
              <span style={{ width: `${(partes[i] / maior) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>

      <p className="nota-curta">{C.foraDaConta(reaisCompacto(totalDoEncargo(encargos, 'REFINANCIAMENTO')))}</p>
    </section>
  );
}

/** As origens do Portal em três grupos que se reconhecem. */
function DeOndeVeioComponent({ arrecadacao }: { arrecadacao: Arrecadacao }) {
  const D = T.deOndeVeio;
  const realizadaNaOrigem = (origem: string) => arrecadacao.porOrigem.find((o) => o.origem === origem)?.realizada ?? 0;
  const impostos = realizadaNaOrigem(D.origemDosImpostos);
  const contribuicoes = realizadaNaOrigem(D.origemDasContribuicoes);
  const grupos = [
    { nome: D.impostos, valor: impostos },
    { nome: D.contribuicoes, valor: contribuicoes },
    { nome: D.outras, valor: arrecadacao.arrecadado - impostos - contribuicoes },
  ];
  const maior = Math.max(...grupos.map((g) => g.valor), 1);

  return (
    <section className="governo-secao" data-tour="governo-origem">
      <h2>{D.titulo}</h2>

      <ul className="gastos-categorias">
        {grupos.map((g) => (
          <LinhaDeValorComponent key={g.nome} nome={g.nome} valor={g.valor} maior={maior} formatar={reaisCompacto} minimo={0} />
        ))}
      </ul>

      <p className="nota-curta">{D.foraDaConta(reaisCompacto(arrecadacao.emissaoDeDivida))}</p>
    </section>
  );
}

/**
 * O que foi gasto sem dizer em quê.
 *
 * DECISÃO: A resposta a "o cartão é todo secreto?" vem primeiro, e é não : a barra mostra a parte
 * aberta — que o Portal detalha compra por compra — e a sigilosa, lado a lado. Por órgão,
 * a porcentagem diz onde o sigilo pesa.
 */
function GastoSigilosoComponent({
  sigilo,
  periodo,
  emAndamento,
}: {
  sigilo: Sigilo | null;
  periodo: Periodo;
  emAndamento: number | null;
}) {
  const S = T.sigilo;
  if (!sigilo) {
    return (
      <section className="governo-secao" data-tour="governo-sigilo">
        <h2>{S.titulo}</h2>
        <p className="vazio">{S.vazio}</p>
      </section>
    );
  }

  const aberto = sigilo.cartaoTotal - sigilo.cartaoSigiloso;
  const [parteSigilosa] = partesDeCem([sigilo.cartaoSigiloso, aberto]);
  const primeiro = sigilo.porOrgao[0];

  return (
    <section className="governo-secao" data-tour="governo-sigilo">
      <h2>{S.titulo}</h2>
      <p className="frase-resposta">
        {S.resposta(
          textoDoPeriodo(periodo),
          <ComProcedenciaComponent
            consulta={{ contexto: 'governo-sigiloso', de: periodo.primeiroAno, ate: periodo.ultimoAno }}
            rotulo={S.rotuloDaProcedencia(textoDoPeriodo(periodo))}
          >
            <strong>{reaisCompacto(sigilo.cartaoTotal)}</strong>
          </ComProcedenciaComponent>,
          parteSigilosa,
          emAndamento && sigilo.meses < 12 ? S.ateOMes(emAndamento, sigilo.meses) : null,
        )}
      </p>

      <div className="barra-dividida" role="img" aria-label={S.rotuloDaBarra(reaisCompacto(aberto), reaisCompacto(sigilo.cartaoSigiloso))}>
        <span className="parte-aberta" style={{ flexGrow: aberto }} />
        <span className="parte-sigilosa" style={{ flexGrow: sigilo.cartaoSigiloso }} />
      </div>
      <p className="legenda-barras">
        <span className="amostra parte-aberta" />
        {S.comDetalhe(reaisCompacto(aberto))}
        <span className="amostra parte-sigilosa" />
        {S.sigiloso(reaisCompacto(sigilo.cartaoSigiloso))}
      </p>

      <h3 className="titulo-secao">{S.porOrgao}</h3>
      <p className="ajuda">
        {S.explicacao}
        {primeiro && primeiro.cartaoTotal > 0 &&
          S.exemplo(primeiro.orgao, reaisCompacto(primeiro.cartao), partesDeCem([primeiro.cartao, primeiro.cartaoTotal - primeiro.cartao])[0])}
      </p>
      <div className="tabela-rolavel">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">{S.legenda}</caption>
          <thead>
            <tr>
              <th scope="col">{S.orgao}</th>
              <th scope="col">{S.comprasSigilosas}</th>
              <th scope="col">{S.parteSigilosa}</th>
              <th scope="col">{S.pagoEmAcaoSigilosa}</th>
            </tr>
          </thead>
          <tbody>
            {sigilo.porOrgao.map((o) => (
              <tr key={o.orgao}>
                <th scope="row">{o.orgao}</th>
                <td>{o.cartao > 0 ? reaisCompacto(o.cartao) : S.vazioNaCelula}</td>
                <td>{parteSigilosaDoCartao(o.cartao, o.cartaoTotal)}</td>
                <td>{o.acao > 0 ? reaisCompacto(o.acao) : S.vazioNaCelula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="nota-curta">{S.nota}</p>

      <BotaoBaixarCsvComponent
        rotulo={S.baixar}
        montar={() =>
          baixarCsv(
            S.arquivo(periodo.primeiroAno, periodo.ultimoAno),
            [...S.colunas],
            sigilo.porOrgao.map((o) => [o.orgao, o.cartao, o.cartaoTotal, o.acao]),
          )
        }
      />
    </section>
  );
}

/** Quem governou — depois dos números, e sem foto. */
/**
 * A parte sigilosa do cartão do órgão, em porcento.
 *
 * ATENÇÃO: compra sigilosa pequena num cartão grande arredondava para "0%" ao lado de um valor
 * sigiloso na mesma linha (Defesa: R$ 55 mil, 2019 a 2026). Abaixo de meio por cento a célula diz
 * "menos de 1%".
 */
function parteSigilosaDoCartao(sigiloso: number, total: number): string {
  if (total <= 0) return T.sigilo.vazioNaCelula;
  const [parte] = partesDeCem([sigiloso, total - sigiloso]);
  return sigiloso > 0 && parte === 0 ? T.sigilo.menosDeUmPorcento : `${parte}%`;
}

/**
 * O cartão da Defesa Civil, ao lado do corporativo e sem somar com ele: quem compra é o ente local.
 *
 * RISCO: o Portal não publicou meses inteiros (jan/2023, nov/2025). A seção os nomeia, senão o
 * ano com mês faltando pareceria um ano de gasto menor.
 */
function DefesaCivilComponent({ defesaCivil, periodo }: { defesaCivil: DefesaCivil; periodo: Periodo }) {
  const D = T.defesaCivil;
  const maiorAno = Math.max(...defesaCivil.porAno.map((a) => a.valor));
  const maiorUf = defesaCivil.porUf[0]?.valor ?? 0;
  const semArquivo = defesaCivil.mesesSemArquivo.map(mesCurto).join(', ');

  return (
    <section className="governo-secao">
      <h2>{D.titulo}</h2>
      <p className="frase-resposta">{D.resposta(textoDoPeriodo(periodo), reaisCompacto(defesaCivil.total), defesaCivil.executores)}</p>
      <p className="nota-curta">{D.diferente}</p>
      <p className="nota-curta">{D.estadual(reaisCompacto(defesaCivil.estadual))}</p>
      {defesaCivil.naoInformado !== 0 && <p className="nota-curta">{D.naoInformado(reaisCompacto(defesaCivil.naoInformado))}</p>}
      {semArquivo && <p className="nota-curta">{D.semArquivo(semArquivo)}</p>}

      {defesaCivil.porAno.length > 1 && (
        <>
          <h3>{D.porAno}</h3>
          <ul className="gastos-categorias">
            {defesaCivil.porAno.map((a) => (
              <LinhaDeValorComponent
                key={a.anoDoExtrato}
                nome={`${a.anoDoExtrato}${D.meses(a.meses)}`}
                valor={a.valor}
                maior={maiorAno}
                formatar={reaisCompacto}
              />
            ))}
          </ul>
        </>
      )}

      <h3>{D.porUf}</h3>
      <ul className="gastos-categorias">
        {defesaCivil.porUf.slice(0, 10).map((u) => (
          <LinhaDeValorComponent key={u.uf} nome={u.uf} valor={u.valor} maior={maiorUf} formatar={reaisCompacto} />
        ))}
      </ul>
    </section>
  );
}

/** O cartão de compras centralizadas, por órgão: os dez maiores. */
function ComprasCentralizadasComponent({
  cpcc,
  periodo,
}: {
  cpcc: NonNullable<DadosDoGoverno['comprasCentralizadas']>;
  periodo: Periodo;
}) {
  const C = T.comprasCentralizadas;
  const maior = cpcc.porOrgao[0]?.valor ?? 0;
  return (
    <section className="governo-secao">
      <h2>{C.titulo}</h2>
      <p className="frase-resposta">
        {C.resposta(textoDoPeriodo(periodo), reaisCompacto(cpcc.total), cpcc.transacoes.toLocaleString('pt-BR'))}
      </p>
      <p className="nota-curta">{C.nota}</p>
      <h3>{C.porOrgao}</h3>
      <ul className="gastos-categorias">
        {cpcc.porOrgao.slice(0, 10).map((o) => (
          <LinhaDeValorComponent key={o.orgao} nome={o.orgao} valor={o.valor} maior={maior} formatar={reaisCompacto} />
        ))}
      </ul>
    </section>
  );
}

function PerfilDaGestaoComponent({ gestao }: { gestao: Gestao }) {
  const G = T.gestao;
  return (
    <section className="gestao" aria-labelledby={`gestao-${gestao.anoDaEleicao}`}>
      <h2 id={`gestao-${gestao.anoDaEleicao}`} className="gestao-titulo">
        {G.titulo(gestao.primeiroAno, gestao.ultimoAno)}
      </h2>
      <div className="gestao-pessoas">
        <PessoaDaGestaoCartaoComponent papel={G.presidente} pessoa={gestao.presidente} />
        <PessoaDaGestaoCartaoComponent papel={G.vice} pessoa={gestao.vice} />
      </div>
      <div className="gestao-meta">
        {G.eleitosEm(gestao.anoDaEleicao)}
        {gestao.coligacao && (
          <>
            {' · '}
            <details className="gestao-coligacao">
              <summary>{G.coligacao}</summary>
              {gestao.coligacao}
            </details>
          </>
        )}
      </div>
    </section>
  );
}

function PessoaDaGestaoCartaoComponent({ papel, pessoa }: { papel: string; pessoa: PessoaDaGestao }) {
  return (
    <div className="gestao-pessoa">
      <div>
        <p className="gestao-papel">{papel}</p>
        <p className="gestao-nome">{nomeProprio(pessoa.nomeDeUrna)}</p>
        <p className="gestao-civil">
          {nomeProprio(pessoa.nome)} · {pessoa.partido}
        </p>
      </div>
    </div>
  );
}

/**
 * O orçamento no vocabulário dele, recolhido. Quem quer conferir a dotação encontra;
 * quem não quer, não tropeça.
 */
function DetalhesComponent({ dados }: { dados: DadosDoGoverno }) {
  const D = T.detalhes;
  const areas = dados.despesa.areas.filter((a) => a.pago + a.restosAPagarPagos > 0);
  const maior = Math.max(...areas.map((a) => a.pago + a.restosAPagarPagos), 1);
  const nome = `${dados.periodo.primeiroAno}-${dados.periodo.ultimoAno}`;

  return (
    <details className="governo-secao governo-detalhes" data-tour="governo-detalhes">
      <summary>{D.resumo}</summary>

      <h3>{D.todasAsAreas}</h3>
      <p className="legenda-barras" aria-hidden="true">
        <span className="amostra amostra-ano" />
        {D.doProprioAno}
        <span className="amostra amostra-anteriores" /> {D.deAnosAnteriores}
      </p>
      <ul className="barras-areas">
        {areas.map((a) => (
          <BarraDaAreaComponent key={a.codigoDaFuncao} area={a} maior={maior} />
        ))}
      </ul>

      <h3>{D.divida}</h3>
      <ul className="lista-encargos">
        {(Object.keys(T.nomeDoGrupo) as GrupoDeEncargo[]).map((grupo) => (
          <li key={grupo}>
            <span>
              <strong>{T.nomeDoGrupo[grupo]}</strong>
            </span>
            <span className="gasto-valor">{reaisCompacto(totalDoEncargo(dados.despesa.encargos, grupo))}</span>
          </li>
        ))}
      </ul>

      <h3>{D.orcamento}</h3>
      <TabelaDasAreasComponent areas={dados.despesa.areas} acima={dados.despesa.empenhadoAcimaDaDotacao} />

      <div className="botoes-csv">
        <BotaoBaixarCsvComponent
          rotulo={D.baixarAreas}
          montar={() =>
            baixarCsv(
              D.arquivoDasAreas(nome),
              [...D.colunasDasAreas],
              dados.despesa.areas.map((a) => [
                a.codigoDaFuncao, a.nome, a.dotacaoAtualizada, a.empenhado, a.pago, a.restosAPagarPagos,
                a.dotacaoCompleta ? D.sim : D.nao,
              ]),
            )
          }
        />
        <BotaoBaixarCsvComponent
          rotulo={D.baixarAnoAAno}
          montar={() =>
            baixarCsv(
              D.arquivoDoAnoAAno(nome),
              [...D.colunasDoAnoAAno],
              dados.porAno.map((a) => [a.anoDoOrcamento, a.arrecadou, a.gastou, a.pegouEmprestado, a.fechado ? D.sim : D.nao]),
            )
          }
        />
      </div>
    </details>
  );
}

function BarraDaAreaComponent({ area, maior }: { area: AreaDaDespesa; maior: number }) {
  const total = area.pago + area.restosAPagarPagos;

  return (
    <li className="barra-area">
      <span className="barra-area-nome">
        {area.nome}
        {area.restosAPagarPagos > 0 && <small>{T.area.deAnosAnteriores(reaisCompacto(area.restosAPagarPagos))}</small>}
      </span>
      <span
        className="barra-area-trilho"
        role="img"
        aria-label={T.area.rotuloDaBarra(reaisCompacto(area.pago), reaisCompacto(area.restosAPagarPagos))}
      >
        <span className="barra-ano" style={{ width: `${(Math.max(area.pago, 0) / maior) * 100}%` }} />
        {area.restosAPagarPagos > 0 && (
          <span className="barra-anteriores" style={{ width: `${(area.restosAPagarPagos / maior) * 100}%` }} />
        )}
      </span>
      <span className="gasto-valor">{reaisCompacto(total)}</span>
    </li>
  );
}

function TabelaDasAreasComponent({ areas, acima }: { areas: AreaDaDespesa[]; acima: number }) {
  const A = T.tabelaDasAreas;
  const incompletas = areas.filter((a) => !a.dotacaoCompleta).length;

  return (
    <>
      {incompletas > 0 && (
        <p className="aviso" role="note">
          {A.aviso(incompletas, reaisCompacto(acima))}
        </p>
      )}
      <div className="tabela-rolavel">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">{A.legenda}</caption>
          <thead>
            <tr>
              <th scope="col">{A.area}</th>
              <th scope="col">{A.dotacao}</th>
              <th scope="col">{A.empenhado}</th>
              <th scope="col">{A.pago}</th>
              <th scope="col">{A.pagoDaDotacao}</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.codigoDaFuncao}>
                <th scope="row">{a.nome}</th>
                <td>{reaisCompacto(a.dotacaoAtualizada)}</td>
                <td>{reaisCompacto(a.empenhado)}</td>
                <td>{reaisCompacto(a.pago)}</td>
                <td>
                  <PagoDaDotacaoComponent area={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PagoDaDotacaoComponent({ area }: { area: AreaDaDespesa }) {
  if (!area.dotacaoCompleta) return <span className="orcamento-sem-razao">{T.tabelaDasAreas.dotacaoIncompleta}</span>;
  if (area.dotacaoAtualizada <= 0) return <span className="orcamento-sem-razao">{T.tabelaDasAreas.semDotacao}</span>;

  return <>{Math.round((area.pago / area.dotacaoAtualizada) * 100)}%</>;
}
