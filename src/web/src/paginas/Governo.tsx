import { useMemo, type ReactNode } from 'react';
import { GraficoDeFitasComponent, type Fita, type NoDasFitas } from '../componentes/GraficoDeFitas';
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
import { TourDaTelaComponent } from '../componentes/TourDaTela';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { SeletorDePeriodoComponent } from '../componentes/SeletorDePeriodo';
import { atalhosDasGestoes } from '../componentes/atalhosDasGestoes';
import { baixarCsv } from '../exportar';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { FONTES } from '../fontes';
import { dataCurta, mesCurto, nomeProprio, partesDeCem, reaisCompacto } from '../formato';
import { passosDoGoverno } from '../tour';
import { EsqueletoDePainelComponent } from '../componentes/Esqueleto';
import { LinhaDeValorComponent, NumeroComponent } from '../componentes/Dados';
import { ColunasPorAnoComponent, ComposicaoComponent } from '../componentes/Graficos';
import { partesComOutros } from '../componentes/partesComOutros';
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
        acao={<TourDaTelaComponent nome="governo" passos={passos} />}
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
              {dados.porAno.length > 1 && (
                <AnoAAnoComponent
                  dados={dados}
                  aoEscolher={(ano) => setParametros({ de: String(ano), ate: String(ano) }, { replace: true })}
                />
              )}
              <CadaCemReaisComponent dados={dados} />
              <DeOndeVeioComponent arrecadacao={dados.arrecadacao} />
              <FitasDoGovernoComponent dados={dados} />
              {dados.gestoes.map((g) => (
                <PerfilDaGestaoComponent key={`${g.anoDaEleicao}-${g.primeiroAno}-${g.presidente.nomeDeUrna}`} gestao={g} />
              ))}
              <DetalhesComponent dados={dados} />
            </>
          ) : (
            <>
              <p className="nota-curta">{T.cartoes.abertura}</p>
              <GastoSigilosoComponent
                sigilo={dados.sigilo}
                periodo={dados.periodo}
                emAndamento={dados.emAndamento}
                aoEscolher={(ano) => setParametros({ de: String(ano), ate: String(ano) }, { replace: true })}
              />
              {dados.defesaCivil && (
                <DefesaCivilComponent
                  defesaCivil={dados.defesaCivil}
                  periodo={dados.periodo}
                  aoEscolher={(ano) => setParametros({ de: String(ano), ate: String(ano) }, { replace: true })}
                />
              )}
              {dados.comprasCentralizadas && (
                <ComprasCentralizadasComponent
                  cpcc={dados.comprasCentralizadas}
                  periodo={dados.periodo}
                  aoEscolher={(ano) => setParametros({ de: String(ano), ate: String(ano) }, { replace: true })}
                />
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
function gestaoDoAno(dados: DadosDoGoverno, anoDoOrcamento: number): string {
  const doAno = dados.gestoesDisponiveis.filter((x) => x.primeiroAno <= anoDoOrcamento && x.ultimoAno >= anoDoOrcamento);
  return doAno.length > 0 ? doAno.map((g) => nomeProprio(g.presidente.nomeDeUrna)).join(' e ') : T.semGestao;
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
function AnoAAnoComponent({ dados, aoEscolher }: { dados: DadosDoGoverno; aoEscolher: (ano: number) => void }) {
  const A = T.anoAAno;
  const tabela = (
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
  );
  return (
    <section className="governo-secao">
      <h2>{A.titulo}</h2>
      <p className="nota-curta">{A.nota}</p>
      <ColunasPorAnoComponent
        rotulo={A.titulo}
        series={[A.entrou, A.gastou, A.pegouEmprestado]}
        anos={dados.porAno.map((a) => ({
          ano: a.anoDoOrcamento,
          valores: [a.arrecadou, a.gastou, a.pegouEmprestado],
          nota: a.fechado ? gestaoDoAno(dados, a.anoDoOrcamento) : `${gestaoDoAno(dados, a.anoDoOrcamento)},${A.emAndamento}`,
        }))}
        formatar={reaisCompacto}
        anoEscolhido={dados.periodo.primeiroAno === dados.periodo.ultimoAno ? dados.periodo.primeiroAno : null}
        aoEscolher={aoEscolher}
        tabela={tabela}
      />
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
/** Quantas áreas e quantas origens ganham caixa própria; as outras se juntam numa só, que diz quantas são. */
const AREAS_NAS_FITAS = 8;
const ORIGENS_NAS_FITAS = 5;

/**
 * O caminho do dinheiro em fitas, em dois desenhos que não se ligam: para onde foi o gasto e de onde veio a arrecadação.
 *
 * DECISÃO (autor, 2026-10-23): dois desenhos, e não um. As regras da página continuam: sem saldo entre o que entrou e o que
 * saiu, empréstimo fora da arrecadação e rolagem fora do gasto. Um desenho único ligaria o imposto a um gasto, e a fonte não
 * marca destino para o imposto.
 *
 * O gasto é o mesmo da lista "de cada R$ 100": as áreas (pago e restos a pagar pagos), os repasses, os juros e os outros
 * encargos. A arrecadação é a mesma de "de onde veio": as receitas correntes, por origem. O que falta para fechar com o
 * arrecadado vira caixa própria; a origem negativa (estorno), que fita não desenha, é dita com o valor.
 *
 * Os avisos da rolagem e do empréstimo ficam nas seções de cima, uma vez só.
 */
function FitasDoGovernoComponent({ dados }: { dados: DadosDoGoverno }) {
  const F = T.fitas;
  const C = T.cadaCem;
  const { areas, encargos } = dados.despesa;

  const porArea = areas
    .map((a) => ({ nome: a.nome, valor: a.pago + a.restosAPagarPagos }))
    .filter((a) => a.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const areasAVista = porArea.length > AREAS_NAS_FITAS + 1 ? porArea.slice(0, AREAS_NAS_FITAS) : porArea;
  const restoDasAreas = porArea.slice(areasAVista.length);
  const naAreas = porArea.reduce((s, a) => s + a.valor, 0);
  const encargosNasFitas = [
    { id: 'repasses', rotulo: C.repasses, valor: totalDoEncargo(encargos, 'TRANSFERENCIAS') },
    { id: 'juros', rotulo: C.juros, valor: totalDoEncargo(encargos, 'SERVICO_DA_DIVIDA') },
    { id: 'outros', rotulo: F.outrosEncargos, valor: totalDoEncargo(encargos, 'OUTROS') },
  ].filter((e) => e.valor > 0);
  const gastou = naAreas + encargosNasFitas.reduce((s, e) => s + e.valor, 0);

  const nosDoGasto: NoDasFitas[] = [
    { id: 'gastou', rotulo: F.gastou, coluna: 0 },
    { id: 'areas', rotulo: F.areasDoGoverno, coluna: 1 },
    ...encargosNasFitas.map((e) => ({ id: e.id, rotulo: e.rotulo, coluna: 2 })),
    ...areasAVista.map((a) => ({ id: `area:${a.nome}`, rotulo: a.nome, coluna: 2 })),
    ...(restoDasAreas.length > 0 ? [{ id: 'area:resto', rotulo: F.outrasAreas(restoDasAreas.length), coluna: 2 }] : []),
  ];
  const fitasDoGasto: Fita[] = [
    { de: 'gastou', para: 'areas', valor: naAreas },
    ...encargosNasFitas.map((e) => ({ de: 'gastou', para: e.id, valor: e.valor })),
    ...areasAVista.map((a) => ({ de: 'areas', para: `area:${a.nome}`, valor: a.valor })),
    ...(restoDasAreas.length > 0 ? [{ de: 'areas', para: 'area:resto', valor: restoDasAreas.reduce((s, a) => s + a.valor, 0) }] : []),
  ].filter((f) => f.valor > 0);

  const origens = dados.arrecadacao.porOrigem.filter((o) => o.realizada > 0).sort((a, b) => b.realizada - a.realizada);
  const origensAVista = origens.length > ORIGENS_NAS_FITAS + 1 ? origens.slice(0, ORIGENS_NAS_FITAS) : origens;
  const restoDasOrigens = origens.slice(origensAVista.length);
  const nosDaArrecadacao: NoDasFitas[] = [
    ...origensAVista.map((o) => ({ id: `origem:${o.origem}`, rotulo: o.origem, coluna: 0 })),
    ...(restoDasOrigens.length > 0 ? [{ id: 'origem:resto', rotulo: F.outrasOrigens(restoDasOrigens.length), coluna: 0 }] : []),
    { id: 'arrecadou', rotulo: F.arrecadou, coluna: 1 },
  ];
  const fitasDaArrecadacao: Fita[] = [
    ...origensAVista.map((o) => ({ de: `origem:${o.origem}`, para: 'arrecadou', valor: o.realizada })),
    ...(restoDasOrigens.length > 0
      ? [{ de: 'origem:resto', para: 'arrecadou', valor: restoDasOrigens.reduce((s, o) => s + o.realizada, 0) }]
      : []),
  ];
  const diferenca = dados.arrecadacao.arrecadado - origens.reduce((s, o) => s + o.realizada, 0);
  if (diferenca > 0.5) {
    nosDaArrecadacao.splice(nosDaArrecadacao.length - 1, 0, { id: 'origem:demais', rotulo: F.demais, coluna: 0 });
    fitasDaArrecadacao.push({ de: 'origem:demais', para: 'arrecadou', valor: diferenca });
  }

  if (gastou <= 0 && origens.length === 0) return null;

  return (
    <section className="governo-secao" aria-labelledby="fitas-do-governo">
      <h2 id="fitas-do-governo">{F.titulo}</h2>
      <p className="ajuda">{F.ajuda}</p>
      {gastou > 0 && (
        <>
          <h3 className="titulo-secao">{F.paraOndeFoi}</h3>
          <GraficoDeFitasComponent
            rotulo={F.rotuloDoGasto(reaisCompacto(gastou))}
            colunas={F.colunasDoGasto}
            nos={nosDoGasto}
            fitas={fitasDoGasto}
            formatar={reaisCompacto}
            altura={440}
          />
        </>
      )}
      {origens.length > 0 && (
        <>
          <h3 className="titulo-secao">{F.deOndeVeio}</h3>
          <GraficoDeFitasComponent
            rotulo={F.rotuloDaArrecadacao(reaisCompacto(dados.arrecadacao.arrecadado))}
            colunas={F.colunasDaArrecadacao}
            nos={nosDaArrecadacao}
            fitas={fitasDaArrecadacao}
            formatar={reaisCompacto}
            altura={300}
          />
          {diferenca < -0.5 && <p className="nota-curta">{F.negativas(reaisCompacto(-diferenca))}</p>}
        </>
      )}
    </section>
  );
}

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

  return (
    <section className="governo-secao" data-tour="governo-origem">
      <h2>{D.titulo}</h2>
      <ComposicaoComponent rotulo={D.titulo} formatar={reaisCompacto} partes={grupos} />

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
  aoEscolher,
}: {
  sigilo: Sigilo | null;
  periodo: Periodo;
  emAndamento: number | null;
  aoEscolher: (ano: number) => void;
}) {
  const S = T.sigilo;
  if (!sigilo) {
    return (
      <BlocoDoCartaoComponent titulo={S.titulo} oQueE={S.oQueE} tour="governo-sigilo">
        <p className="vazio">{S.vazio}</p>
      </BlocoDoCartaoComponent>
    );
  }

  const aberto = sigilo.cartaoTotal - sigilo.cartaoSigiloso;
  const [parteSigilosa] = partesDeCem([sigilo.cartaoSigiloso, aberto]);
  const primeiro = sigilo.porOrgao[0];

  return (
    <BlocoDoCartaoComponent titulo={S.titulo} oQueE={S.oQueE} tour="governo-sigilo">
      <p className="frase-resposta">
        {S.resposta(
          maiuscula(textoDoPeriodo(periodo)),
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

      <ComposicaoComponent
        rotulo={S.titulo}
        formatar={reaisCompacto}
        partes={[
          { nome: S.comDetalheNaBarra, valor: aberto, definicao: S.comDetalheDefinicao },
          { nome: S.sigilosoNaBarra, valor: sigilo.cartaoSigiloso, definicao: S.sigilosoDefinicao },
        ]}
      />
      {sigilo.acaoSigilosa > 0 && <p className="nota-curta">{S.acaoForaDoCartao(reaisCompacto(sigilo.acaoSigilosa))}</p>}

      {sigilo.porAno.length > 1 && (
        <>
          <h3 className="titulo-secao">{T.cartoes.porAno}</h3>
          <ColunasPorAnoComponent
            rotulo={S.porAno}
            series={[S.noCartao, S.naAcao]}
            anos={sigilo.porAno.map((a) => ({ ano: a.ano, valores: [a.cartao, a.acao] }))}
            formatar={reaisCompacto}
            anoEscolhido={periodo.primeiroAno === periodo.ultimoAno ? periodo.primeiroAno : null}
            aoEscolher={aoEscolher}
          />
        </>
      )}

      <h3 className="titulo-secao">{S.porOrgao}</h3>
      {primeiro && primeiro.cartaoTotal > 0 && (
        <p className="ajuda">
          {S.explicacao(primeiro.orgao, reaisCompacto(primeiro.cartao), partesDeCem([primeiro.cartao, primeiro.cartaoTotal - primeiro.cartao])[0])}
        </p>
      )}
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
    </BlocoDoCartaoComponent>
  );
}

/**
 * Um dos três cartões da aba, num bloco próprio: o nome, o que ele é e, abaixo, sempre na mesma
 * ordem, o total, a composição, os anos e a lista.
 *
 * DECISÃO (2026-10-10): pedido do autor, que não via onde um cartão acabava e o outro começava, e
 * achava que cada um tinha um formato. Os três não se somam, e o bloco separado diz isso sem texto.
 */
function BlocoDoCartaoComponent({
  titulo,
  oQueE,
  tour,
  children,
}: {
  titulo: string;
  oQueE: ReactNode;
  tour?: string;
  children: ReactNode;
}) {
  return (
    <section className="governo-secao cartao-bloco" data-tour={tour} aria-label={titulo}>
      <header className="cartao-bloco-topo">
        <p className="cartao-bloco-rotulo">{T.cartoes.rotulo}</p>
        <h2>{titulo}</h2>
        <p className="cartao-bloco-o-que-e">{oQueE}</p>
      </header>
      {children}
    </section>
  );
}

/** A primeira letra em maiúscula: o período abre a frase. */
function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** A chapa eleita — depois dos números, e sem foto. "Eleitos", e não "quem governou": a Pendência 56 decidiu que a gestão é a da eleição (2026-10-22). */
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
 * RISCO: o Portal não publicou meses inteiros (jan/2023, nov/2025). O bloco os nomeia, senão o
 * ano com mês faltando pareceria um ano de gasto menor.
 */
function DefesaCivilComponent({
  defesaCivil,
  periodo,
  aoEscolher,
}: {
  defesaCivil: DefesaCivil;
  periodo: Periodo;
  aoEscolher: (ano: number) => void;
}) {
  const D = T.defesaCivil;
  const maiorUf = defesaCivil.porUf[0]?.valor ?? 0;
  const semArquivo = defesaCivil.mesesSemArquivo.map(mesCurto).join(', ');
  const prefeituras = defesaCivil.total - defesaCivil.estadual - defesaCivil.naoInformado;

  return (
    <BlocoDoCartaoComponent titulo={D.titulo} oQueE={D.oQueE}>
      <p className="frase-resposta">
        {D.resposta(
          maiuscula(textoDoPeriodo(periodo)),
          <ComProcedenciaComponent
            consulta={{ contexto: 'governo-defesa-civil', de: periodo.primeiroAno, ate: periodo.ultimoAno }}
            rotulo={D.rotuloDaProcedencia(textoDoPeriodo(periodo))}
          >
            {reaisCompacto(defesaCivil.total)}
          </ComProcedenciaComponent>,
          defesaCivil.executores,
        )}
      </p>
      <ComposicaoComponent
        rotulo={D.titulo}
        formatar={reaisCompacto}
        partes={[
          { nome: D.prefeituras, valor: prefeituras },
          { nome: D.estados, valor: defesaCivil.estadual },
          ...(defesaCivil.naoInformado > 0 ? [{ nome: D.semQuem, valor: defesaCivil.naoInformado }] : []),
        ]}
      />

      {defesaCivil.porAno.length > 1 && (
        <>
          <h3 className="titulo-secao">{T.cartoes.porAno}</h3>
          <ColunasPorAnoComponent
            rotulo={D.porAno}
            series={[D.valor]}
            anos={defesaCivil.porAno.map((a) => ({ ano: a.anoDoExtrato, valores: [a.valor], nota: D.meses(a.meses) || undefined }))}
            formatar={reaisCompacto}
            anoEscolhido={periodo.primeiroAno === periodo.ultimoAno ? periodo.primeiroAno : null}
            aoEscolher={aoEscolher}
          />
        </>
      )}

      <h3 className="titulo-secao">{D.porUf}</h3>
      <ul className="gastos-categorias">
        {defesaCivil.porUf.slice(0, 10).map((u) => (
          <LinhaDeValorComponent key={u.uf} nome={u.uf} valor={u.valor} maior={maiorUf} formatar={reaisCompacto} />
        ))}
      </ul>
      {semArquivo && <p className="nota-curta">{D.semArquivo(semArquivo)}</p>}
    </BlocoDoCartaoComponent>
  );
}

/**
 * O cartão de compras centralizadas: total, composição por órgão, anos e os dez maiores.
 *
 * MEDIDO (2026-10-10): de maio a agosto de 2019, R$ 96,2 mi, 99,7% em passagem aérea paga direto à
 * Gol, à Latam e à Azul (coluna TIPO AQUISIÇÃO e favorecido do arquivo). De 2020 a 2026, de R$ 6 mil
 * a R$ 21 mil por ano. A nota aparece quando o período inclui 2019 e anos depois dele, que é quando
 * a coluna de 2019 parece dado faltando nos outros anos.
 */
function ComprasCentralizadasComponent({
  cpcc,
  periodo,
  aoEscolher,
}: {
  cpcc: NonNullable<DadosDoGoverno['comprasCentralizadas']>;
  periodo: Periodo;
  aoEscolher: (ano: number) => void;
}) {
  const C = T.comprasCentralizadas;
  const maior = cpcc.porOrgao[0]?.valor ?? 0;
  return (
    <BlocoDoCartaoComponent titulo={C.titulo} oQueE={C.oQueE}>
      <p className="frase-resposta">
        {C.resposta(
          maiuscula(textoDoPeriodo(periodo)),
          <ComProcedenciaComponent
            consulta={{ contexto: 'governo-compras-centralizadas', de: periodo.primeiroAno, ate: periodo.ultimoAno }}
            rotulo={C.rotuloDaProcedencia(textoDoPeriodo(periodo))}
          >
            {reaisCompacto(cpcc.total)}
          </ComProcedenciaComponent>,
          cpcc.transacoes.toLocaleString('pt-BR'),
        )}
      </p>
      <ComposicaoComponent
        rotulo={C.titulo}
        formatar={reaisCompacto}
        partes={partesComOutros(cpcc.porOrgao, (o) => o.orgao, (o) => o.valor, C.outrosOrgaos, cpcc.total)}
      />
      {periodo.primeiroAno <= 2019 && periodo.ultimoAno > 2019 && <p className="nota-curta">{C.quaseTudoEm2019}</p>}

      {cpcc.porAno.length > 1 && (
        <>
          <h3 className="titulo-secao">{T.cartoes.porAno}</h3>
          <ColunasPorAnoComponent
            rotulo={C.titulo}
            series={[C.valor]}
            anos={cpcc.porAno.map((a) => ({ ano: a.ano, valores: [a.valor], nota: C.meses(a.meses) || undefined }))}
            formatar={reaisCompacto}
            anoEscolhido={periodo.primeiroAno === periodo.ultimoAno ? periodo.primeiroAno : null}
            aoEscolher={aoEscolher}
          />
        </>
      )}

      <h3 className="titulo-secao">{C.porOrgao}</h3>
      <ul className="gastos-categorias">
        {cpcc.porOrgao.slice(0, 10).map((o) => (
          <LinhaDeValorComponent key={o.orgao} nome={o.orgao} valor={o.valor} maior={maior} formatar={reaisCompacto} />
        ))}
      </ul>
      {cpcc.mesesSemArquivo.length > 0 && (
        <p className="nota-curta">{C.semArquivo(cpcc.mesesSemArquivo.map(mesCurto).join(', '))}</p>
      )}
    </BlocoDoCartaoComponent>
  );
}

/**
 * A chapa eleita, ou cada parte dela quando o vice assumiu no meio do mandato.
 *
 * DECISÃO (autor, 2026-10-23): o impeachment de 2016 divide a chapa de 2014 em duas gestões, com as datas e a fonte
 * (`SucessoesNaPresidencia`, na API). A frase diz que o ano da troca entra nas duas, porque o orçamento é anual.
 */
function PerfilDaGestaoComponent({ gestao }: { gestao: Gestao }) {
  const G = T.gestao;
  const id = `gestao-${gestao.anoDaEleicao}-${gestao.primeiroAno}`;
  const titulo = gestao.ate
    ? G.tituloAte(gestao.primeiroAno, dataCurta(gestao.ate))
    : gestao.desde
      ? G.tituloDesde(dataCurta(gestao.desde), gestao.ultimoAno)
      : G.titulo(gestao.primeiroAno, gestao.ultimoAno);
  const troca = gestao.sucessao;
  return (
    <section className="gestao" aria-labelledby={id}>
      <h2 id={id} className="gestao-titulo">
        <ComProcedenciaComponent consulta={{ contexto: 'gestoes', de: gestao.primeiroAno, ate: gestao.ultimoAno }} rotulo={titulo}>
          {titulo}
        </ComProcedenciaComponent>
      </h2>
      {troca && (
        <p className="nota-curta">
          {gestao.ate ? G.saiu(dataCurta(troca.afastamento), dataCurta(troca.posse)) : G.assumiu(dataCurta(troca.afastamento), dataCurta(troca.posse))}{' '}
          {G.anoDividido(Number(troca.afastamento.slice(0, 4)))}{' '}
          <LinkDeFonteComponent href={troca.urlDaFonte}>{G.fonteDaTroca}</LinkDeFonteComponent>
        </p>
      )}
      <div className="gestao-pessoas">
        <PessoaDaGestaoCartaoComponent papel={G.presidente} pessoa={gestao.presidente} />
        {gestao.vice && <PessoaDaGestaoCartaoComponent papel={G.vice} pessoa={gestao.vice} />}
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
      <p className="nota-curta">{G.aviso}</p>
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
