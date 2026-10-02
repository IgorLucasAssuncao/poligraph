import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  obterGoverno,
  type AreaDaDespesa,
  type Arrecadacao,
  type Encargo,
  type Gestao,
  type GrupoDeEncargo,
  type Governo as DadosDoGoverno,
  type Periodo,
  type PessoaDaGestao,
  type Sigilo,
} from '../api';
import { AbasDoDinheiro } from '../componentes/AbasDoDinheiro';
import { BotaoBaixarCsv } from '../componentes/BotaoBaixarCsv';
import { BotaoDoTour } from '../componentes/BotaoDoTour';
import { LinkDeFonte } from '../componentes/LinkDeFonte';
import { SeletorDePeriodo } from '../componentes/SeletorDePeriodo';
import { baixarCsv } from '../exportar';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { Termo } from '../componentes/Termo';
import { FONTES } from '../fontes';
import { dataCurta, nomeProprio, partesDeCem, reaisCompacto } from '../formato';
import { passosDoGoverno } from '../tour';
import { EsqueletoDePainel } from '../componentes/Esqueleto';

/**
 * O governo federal para quem ⛔ lê orçamento: quanto entrou, onde foi parar, o que foi
 * gasto em segredo e quem governava.
 *
 * ## Por que assim
 *
 * - **Período, ⛔ ano a ano.** O padrão são todos os anos carregados; a tabela "Ano a ano"
 *   compara os anos sem trocar o filtro. Escolher um ano por clique obrigava a somar de
 *   cabeça.
 * - **Uma frase por número, curta.** Cada linha miúda de definição era mais uma coisa a
 *   ler antes do dado; o jargão ficou nas dicas clicáveis (`Termo`) e em "Ver os detalhes".
 * - **O sigilo com a base.** "R$ 50 mi sigilosos" sozinho fazia parecer que o cartão
 *   inteiro era secreto; a barra mostra as duas partes.
 *
 * ## 🔴 O que a página ⛔ faz
 *
 * - **Qualificar o governo** (RNF-16). Sem nota, sem meta, sem cor de bom e ruim, e sem
 *   saldo: o que entrou e o que saiu ficam separados e ⛔ se subtraem.
 * - **Somar empréstimo à arrecadação**, nem **contar a rolagem como gasto**.
 *
 * ⚠️ A gestão vem depois dos números: em ano eleitoral, o presidente no topo lia como vitrine.
 */
export function Governo() {
  const [parametros, setParametros] = useSearchParams();
  const de = parametros.get('de');
  const ate = parametros.get('ate');
  const periodo = useMemo<Periodo | undefined>(
    () => (de && ate ? { de: Number(de), ate: Number(ate) } : undefined),
    [de, ate],
  );
  const [dados, setDados] = useState<DadosDoGoverno | null | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const passos = useMemo(() => passosDoGoverno(), []);

  useEffect(() => {
    let atual = true;
    obterGoverno(periodo)
      .then((novo) => atual && setDados(novo))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [periodo]);

  return (
    <>
      <AbasDoDinheiro />
      <CabecalhoDaColuna titulo="Governo federal" subtitulo="Quanto entrou, onde foi parar e o que foi gasto em segredo" />
      <div className="barra-do-tour">
        <BotaoDoTour nome="governo" passos={passos} />
      </div>

      {erro && <p className="erro">Não foi possível carregar os dados do governo agora.</p>}
      {!erro && dados === undefined && <EsqueletoDePainel rotulo="Carregando o governo" alturaDoGrafico={260} />}
      {!erro && dados === null && (
        <p className="vazio">
          Os dados do governo ainda não foram carregados. Eles aparecem depois da próxima execução do ETL.
        </p>
      )}

      {dados && (
        <>
          <SeletorDePeriodo
            anos={dados.anosDisponiveis}
            periodo={dados.periodo}
            rotulo="Período"
            tour="governo-ano"
            atalhos={atalhosDasGestoes(dados)}
            aoMudar={(novo) =>
              setParametros(novo ? { de: String(novo.de), ate: String(novo.ate) } : {}, { replace: true })
            }
          >
            O dinheiro do <strong>Poder Executivo federal</strong> em <strong>{textoDoPeriodo(dados.periodo)}</strong>.
            Congresso e Justiça não entram.
            {dados.emAndamento && (
              <>
                {' '}
                {dados.emAndamento} vai até {dataCurta(dados.geradoEm)}.
              </>
            )}
          </SeletorDePeriodo>

          <Resumo dados={dados} />
          {dados.porAno.length > 1 && <AnoAAno dados={dados} />}
          <CadaCemReais dados={dados} />
          <DeOndeVeio arrecadacao={dados.arrecadacao} />
          <GastoSigiloso sigilo={dados.sigilo} periodo={dados.periodo} emAndamento={dados.emAndamento} />
          {dados.gestoes.map((g) => (
            <PerfilDaGestao key={g.eleicao} gestao={g} />
          ))}
          <Detalhes dados={dados} />

          <p className="fonte-dado">
            Arquivos gerados até {dataCurta(dados.geradoEm)}. Fontes:{' '}
            <LinkDeFonte href={FONTES.candidatos.url}>TSE</LinkDeFonte>
            {' · '}
            <LinkDeFonte href={FONTES.orcamento.url}>orçamento</LinkDeFonte>
            {' · '}
            <LinkDeFonte href={FONTES.execucao.url}>execução mês a mês</LinkDeFonte>
            {' · '}
            <LinkDeFonte href={FONTES.receitas.url}>receitas</LinkDeFonte>
            {' · '}
            <LinkDeFonte href={FONTES.cartao.url}>cartão de pagamento</LinkDeFonte> (Portal da Transparência).
          </p>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════

function totalDoEncargo(encargos: Encargo[], grupo: GrupoDeEncargo): number {
  const encargo = encargos.find((e) => e.grupo === grupo);
  return encargo ? encargo.pago + encargo.restosAPagarPagos : 0;
}

/**
 * Uma gestão por botão, com o período dela recortado aos anos que existem.
 *
 * ⭐ Comparar as gestões medidas do mesmo jeito é o que mostra que a página ⛔ é sobre uma
 * delas — a pergunta de quem desconfia (persona do empresário, rodada 2).
 */
function atalhosDasGestoes(dados: DadosDoGoverno): { rotulo: string; periodo: Periodo }[] {
  const primeiro = dados.anosDisponiveis[0];
  const ultimo = dados.anosDisponiveis[dados.anosDisponiveis.length - 1];
  return dados.gestoesDisponiveis.map((g) => ({
    rotulo: `${nomeProprio(g.presidente.nomeDeUrna)} (${g.primeiroAno}–${g.ultimoAno})`,
    periodo: { de: Math.max(g.primeiroAno, primeiro), ate: Math.min(g.ultimoAno, ultimo) },
  }));
}

function gestaoDoAno(dados: DadosDoGoverno, ano: number): string {
  const g = dados.gestoesDisponiveis.find((x) => x.primeiroAno <= ano && x.ultimoAno >= ano);
  return g ? nomeProprio(g.presidente.nomeDeUrna) : '—';
}

function textoDoPeriodo({ de, ate }: Periodo): string {
  return de === ate ? String(de) : `${de} a ${ate}`;
}

/** Três números. ⛔ Há um quarto que os junte: o saldo pediria regras fiscais que estes dados ⛔ seguem. */
function Resumo({ dados }: { dados: DadosDoGoverno }) {
  const gastou = dados.porAno.reduce((soma, a) => soma + a.gastou, 0);
  const numeros: [string, number, string][] = [
    ['Entrou', dados.arrecadacao.arrecadado, 'impostos e contribuições'],
    ['Gastou', gastou, 'serviços, repasses e juros'],
    ['Pegou emprestado', dados.arrecadacao.emissaoDeDivida, 'em títulos da dívida'],
  ];

  return (
    <section className="numeros-do-ano" aria-label={`${textoDoPeriodo(dados.periodo)} em números`} data-tour="governo-resumo">
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

/**
 * Os três números de cada ano, lado a lado: a comparação sem trocar o filtro.
 *
 * ⚠️ Valores nominais. Sem correção pela inflação, o ano mais recente parece maior só por ser
 * mais recente — e comparar gestões assim favoreceria a última. A tabela diz isso.
 */
function AnoAAno({ dados }: { dados: DadosDoGoverno }) {
  return (
    <section className="governo-secao">
      <h2>Ano a ano</h2>
      <p className="nota-curta">Em reais de cada ano, sem correção pela inflação: anos mais recentes parecem maiores só por isso.</p>
      <div className="tabela-rolavel">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">Entrou, gastou e pegou emprestado, por ano</caption>
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col">Gestão</th>
              <th scope="col">Entrou</th>
              <th scope="col">Gastou</th>
              <th scope="col">Pegou emprestado</th>
            </tr>
          </thead>
          <tbody>
            {dados.porAno.map((a) => (
              <tr key={a.ano}>
                <th scope="row">
                  {a.ano}
                  {!a.fechado && <small className="ano-andamento"> em andamento</small>}
                </th>
                <td className="coluna-gestao">{gestaoDoAno(dados, a.ano)}</td>
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

/** Quantas áreas aparecem pelo nome; as demais viram "outras áreas". */
const AREAS_NOMEADAS = 6;

/**
 * "De cada R$ 100 gastos": a divisão que se entende sem saber o tamanho de um trilhão.
 *
 * ⚠️ As parcelas somam 100 exatos (`partesDeCem`), e cada linha traz o valor em reais.
 */
function CadaCemReais({ dados }: { dados: DadosDoGoverno }) {
  const { areas, encargos } = dados.despesa;
  const porArea = [...areas]
    .map((a) => ({ nome: a.nome, valor: a.pago + a.restosAPagarPagos }))
    .filter((a) => a.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const linhas = [
    ...porArea.slice(0, AREAS_NOMEADAS),
    { nome: 'Repasses a estados e municípios', valor: totalDoEncargo(encargos, 'TRANSFERENCIAS') },
    { nome: 'Juros e pagamento da dívida', valor: totalDoEncargo(encargos, 'SERVICO_DA_DIVIDA') },
    {
      nome: 'Outras áreas e despesas',
      valor: porArea.slice(AREAS_NOMEADAS).reduce((soma, a) => soma + a.valor, 0) + totalDoEncargo(encargos, 'OUTROS'),
    },
  ]
    .filter((l) => l.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const partes = partesDeCem(linhas.map((l) => l.valor));
  const maior = Math.max(...partes, 1);

  return (
    <section className="governo-secao" data-tour="governo-cem">
      <h2>De cada R$ 100 gastos</h2>

      <ul className="cada-cem">
        {linhas.map((l, i) => (
          <li key={l.nome}>
            <span className="cada-cem-parte">R$ {partes[i]}</span>
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

      <p className="nota-curta">
        Fora da conta: {reaisCompacto(totalDoEncargo(encargos, 'REFINANCIAMENTO'))} de{' '}
        <Termo nome="rolagem">rolagem da dívida</Termo>.
      </p>
    </section>
  );
}

/** As origens do Portal em três grupos que se reconhecem. */
function DeOndeVeio({ arrecadacao }: { arrecadacao: Arrecadacao }) {
  const de = (origem: string) => arrecadacao.porOrigem.find((o) => o.origem === origem)?.realizada ?? 0;
  const impostos = de('Impostos, Taxas e Contribuições de Melhoria');
  const contribuicoes = de('Contribuições');
  const grupos = [
    { nome: 'Impostos', valor: impostos },
    { nome: 'Contribuições (como a do INSS)', valor: contribuicoes },
    { nome: 'Outras receitas', valor: arrecadacao.arrecadado - impostos - contribuicoes },
  ];
  const maior = Math.max(...grupos.map((g) => g.valor), 1);

  return (
    <section className="governo-secao" data-tour="governo-origem">
      <h2>De onde veio o dinheiro</h2>

      <ul className="gastos-categorias">
        {grupos.map((g) => (
          <li key={g.nome}>
            <span className="gasto-nome">{g.nome}</span>
            <span className="gasto-barra">
              <span style={{ width: `${(Math.max(g.valor, 0) / maior) * 100}%` }} />
            </span>
            <span className="gasto-valor">{reaisCompacto(g.valor)}</span>
          </li>
        ))}
      </ul>

      <p className="nota-curta">
        Fora da conta: {reaisCompacto(arrecadacao.emissaoDeDivida)} pegos emprestados, que voltam com juros.
      </p>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════

/**
 * O que foi gasto sem dizer em quê.
 *
 * ⭐ A resposta a "o cartão é todo secreto?" vem primeiro, e é ⛔: a barra mostra a parte
 * aberta — que o Portal detalha compra por compra — e a sigilosa, lado a lado. Por órgão,
 * a porcentagem diz onde o sigilo pesa.
 */
function GastoSigiloso({
  sigilo,
  periodo,
  emAndamento,
}: {
  sigilo: Sigilo | null;
  periodo: Periodo;
  emAndamento: number | null;
}) {
  if (!sigilo) {
    return (
      <section className="governo-secao" data-tour="governo-sigilo">
        <h2>Gasto sigiloso</h2>
        <p className="vazio">Os gastos sigilosos deste período ainda não foram carregados.</p>
      </section>
    );
  }

  const aberto = sigilo.cartaoTotal - sigilo.cartaoSigiloso;
  const [parteSigilosa] = partesDeCem([sigilo.cartaoSigiloso, aberto]);

  return (
    <section className="governo-secao" data-tour="governo-sigilo">
      <h2>Gasto sigiloso</h2>
      <p className="frase-resposta">
        No <Termo nome="cartaoCorporativo">cartão corporativo</Termo>, {textoDoPeriodo(periodo)}:{' '}
        <strong>{reaisCompacto(sigilo.cartaoTotal)}</strong>. Desses, <strong>{parteSigilosa} de cada R$ 100</strong>{' '}
        são sigilosos.
        {emAndamento && sigilo.meses < 12 && ` ${emAndamento} até o mês ${sigilo.meses}.`}
      </p>

      <div className="barra-dividida" role="img" aria-label={`${reaisCompacto(aberto)} com detalhe; ${reaisCompacto(sigilo.cartaoSigiloso)} sigilosos`}>
        <span className="parte-aberta" style={{ flexGrow: aberto }} />
        <span className="parte-sigilosa" style={{ flexGrow: sigilo.cartaoSigiloso }} />
      </div>
      <p className="legenda-barras">
        <span className="amostra parte-aberta" /> com detalhe, compra por compra: {reaisCompacto(aberto)}
        <span className="amostra parte-sigilosa" /> sigiloso, só o valor: {reaisCompacto(sigilo.cartaoSigiloso)}
      </p>

      <div className="tabela-rolavel">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">Gasto sigiloso por órgão</caption>
          <thead>
            <tr>
              <th scope="col">Órgão</th>
              <th scope="col">Cartão sigiloso</th>
              <th scope="col">Do cartão do órgão</th>
              <th scope="col">
                <Termo nome="acaoSigilosa">Ação sigilosa</Termo>
              </th>
            </tr>
          </thead>
          <tbody>
            {sigilo.porOrgao.map((o) => (
              <tr key={o.orgao}>
                <th scope="row">{o.orgao}</th>
                <td>{o.cartao > 0 ? reaisCompacto(o.cartao) : '—'}</td>
                <td>{o.cartaoTotal > 0 ? `${partesDeCem([o.cartao, o.cartaoTotal - o.cartao])[0]}%` : '—'}</td>
                <td>{o.acao > 0 ? reaisCompacto(o.acao) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="nota-curta">
        Só o que o Portal marca como sigiloso. Gasto de inteligência em linhas de nome comum não aparece aqui.
      </p>

      <BotaoBaixarCsv
        rotulo="Baixar o gasto sigiloso (CSV)"
        montar={() =>
          baixarCsv(
            `governo-sigiloso-${periodo.de}-${periodo.ate}.csv`,
            ['Órgão', 'Cartão sigiloso', 'Cartão total', 'Ação sigilosa'],
            sigilo.porOrgao.map((o) => [o.orgao, o.cartao, o.cartaoTotal, o.acao]),
          )
        }
      />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════

/** Quem governou — depois dos números, e sem foto. */
function PerfilDaGestao({ gestao }: { gestao: Gestao }) {
  return (
    <section className="gestao" aria-labelledby={`gestao-${gestao.eleicao}`}>
      <h2 id={`gestao-${gestao.eleicao}`} className="gestao-titulo">
        Quem governou de {gestao.primeiroAno} a {gestao.ultimoAno}
      </h2>
      <div className="gestao-pessoas">
        <PessoaDaGestaoCartao papel="Presidente" pessoa={gestao.presidente} />
        <PessoaDaGestaoCartao papel="Vice-presidente" pessoa={gestao.vice} />
      </div>
      <p className="gestao-meta">
        Eleitos em {gestao.eleicao}
        {gestao.coligacao && (
          <>
            {' · '}
            <details className="gestao-coligacao">
              <summary>coligação</summary>
              {gestao.coligacao}
            </details>
          </>
        )}
      </p>
    </section>
  );
}

function PessoaDaGestaoCartao({ papel, pessoa }: { papel: string; pessoa: PessoaDaGestao }) {
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

// ═══════════════════════════════════════════════════════════════════

const NOME_DO_GRUPO: Record<GrupoDeEncargo, string> = {
  TRANSFERENCIAS: 'Transferências a estados e municípios',
  SERVICO_DA_DIVIDA: 'Juros e amortização da dívida',
  REFINANCIAMENTO: 'Rolagem da dívida',
  OUTROS: 'Outros encargos',
};

/**
 * O orçamento no vocabulário dele, recolhido. Quem quer conferir a dotação encontra;
 * quem ⛔ quer, ⛔ tropeça.
 */
function Detalhes({ dados }: { dados: DadosDoGoverno }) {
  const areas = dados.despesa.areas.filter((a) => a.pago + a.restosAPagarPagos > 0);
  const maior = Math.max(...areas.map((a) => a.pago + a.restosAPagarPagos), 1);
  const nome = `${dados.periodo.de}-${dados.periodo.ate}`;

  return (
    <details className="governo-secao governo-detalhes" data-tour="governo-detalhes">
      <summary>
        <strong>Ver os detalhes</strong> — todas as áreas, a dívida e o orçamento aprovado
      </summary>

      <h3>Todas as áreas</h3>
      <p className="legenda-barras" aria-hidden="true">
        <span className="amostra amostra-ano" /> do próprio ano
        <span className="amostra amostra-anteriores" /> <Termo nome="restosAPagar">de anos anteriores</Termo>
      </p>
      <ul className="barras-areas">
        {areas.map((a) => (
          <BarraDaArea key={a.codigo} area={a} maior={maior} />
        ))}
      </ul>

      <h3>
        Dívida e transferências <Termo nome="encargosEspeciais">(encargos especiais)</Termo>
      </h3>
      <ul className="lista-encargos">
        {(Object.keys(NOME_DO_GRUPO) as GrupoDeEncargo[]).map((grupo) => (
          <li key={grupo}>
            <span>
              <strong>{NOME_DO_GRUPO[grupo]}</strong>
            </span>
            <span className="gasto-valor">{reaisCompacto(totalDoEncargo(dados.despesa.encargos, grupo))}</span>
          </li>
        ))}
      </ul>

      <h3>Orçamento aprovado e executado</h3>
      <TabelaDasAreas areas={dados.despesa.areas} acima={dados.despesa.empenhadoAcimaDaDotacao} />

      <div className="botoes-csv">
        <BotaoBaixarCsv
          rotulo="Baixar as áreas (CSV)"
          montar={() =>
            baixarCsv(
              `governo-areas-${nome}.csv`,
              ['Código', 'Área', 'Dotação atualizada', 'Empenhado', 'Pago no ano', 'Pago de anos anteriores', 'Dotação completa'],
              dados.despesa.areas.map((a) => [
                a.codigo, a.nome, a.dotacaoAtualizada, a.empenhado, a.pago, a.restosAPagarPagos,
                a.dotacaoCompleta ? 'sim' : 'não',
              ]),
            )
          }
        />
        <BotaoBaixarCsv
          rotulo="Baixar ano a ano (CSV)"
          montar={() =>
            baixarCsv(
              `governo-ano-a-ano-${nome}.csv`,
              ['Ano', 'Entrou', 'Gastou (sem rolagem)', 'Pegou emprestado', 'Ano fechado'],
              dados.porAno.map((a) => [a.ano, a.arrecadou, a.gastou, a.pegouEmprestado, a.fechado ? 'sim' : 'não']),
            )
          }
        />
      </div>
    </details>
  );
}

function BarraDaArea({ area, maior }: { area: AreaDaDespesa; maior: number }) {
  const total = area.pago + area.restosAPagarPagos;

  return (
    <li className="barra-area">
      <span className="barra-area-nome">
        {area.nome}
        {area.restosAPagarPagos > 0 && <small>{reaisCompacto(area.restosAPagarPagos)} de anos anteriores</small>}
      </span>
      <span
        className="barra-area-trilho"
        role="img"
        aria-label={`${reaisCompacto(area.pago)} do próprio ano e ${reaisCompacto(area.restosAPagarPagos)} de anos anteriores`}
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

function TabelaDasAreas({ areas, acima }: { areas: AreaDaDespesa[]; acima: number }) {
  const incompletas = areas.filter((a) => !a.dotacaoCompleta).length;

  return (
    <>
      {incompletas > 0 && (
        <p className="aviso" role="note">
          Em {incompletas} áreas o empenhado passou da dotação publicada — {reaisCompacto(acima)} no total. Nelas a
          coluna “pago da dotação” fica em branco. <Termo nome="dotacaoIncompleta">Por quê?</Termo>
        </p>
      )}
      <div className="tabela-rolavel">
        <table className="tabela-orcamento">
          <caption className="sr-apenas">Dotação, empenho e pago por área</caption>
          <thead>
            <tr>
              <th scope="col">Área</th>
              <th scope="col">
                <Termo nome="dotacao">Dotação</Termo>
              </th>
              <th scope="col">Empenhado</th>
              <th scope="col">Pago</th>
              <th scope="col">Pago da dotação</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.codigo}>
                <th scope="row">{a.nome}</th>
                <td>{reaisCompacto(a.dotacaoAtualizada)}</td>
                <td>{reaisCompacto(a.empenhado)}</td>
                <td>{reaisCompacto(a.pago)}</td>
                <td>
                  <PagoDaDotacao area={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PagoDaDotacao({ area }: { area: AreaDaDespesa }) {
  if (!area.dotacaoCompleta) return <span className="orcamento-sem-razao">dotação incompleta</span>;
  if (area.dotacaoAtualizada <= 0) return <span className="orcamento-sem-razao">—</span>;

  return <>{Math.round((area.pago / area.dotacaoAtualizada) * 100)}%</>;
}
