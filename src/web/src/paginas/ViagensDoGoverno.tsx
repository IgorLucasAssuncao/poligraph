import { useMemo } from 'react';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { useCarga } from '../componentes/useCarga';
import { useSearchParams } from 'react-router-dom';
import { obterViagensDoGoverno, type Periodo, type ViagensDoGoverno } from '../api';
import { AbasDoDinheiroComponent } from '../componentes/AbasDoDinheiro';
import { AbasDoGovernoComponent } from '../componentes/AbasDoGoverno';
import { LinhaDeValorComponent, NumeroComponent } from '../componentes/Dados';
import { EsqueletoDePainelComponent } from '../componentes/Esqueleto';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { SeletorDePeriodoComponent } from '../componentes/SeletorDePeriodo';
import { atalhosDasGestoes } from '../componentes/atalhosDasGestoes';
import { FONTES } from '../fontes';
import { reaisCompacto } from '../formato';
import { TEXTOS_DAS_VIAGENS as T } from '../textos/viagens';

/** Quantos órgãos a lista mostra: o resto soma pouco e alongaria a página. */
const ORGAOS_EXIBIDOS = 12;

/**
 * As viagens a serviço do Executivo federal: quanto custaram, quem viajou mais e para onde.
 *
 * ATENÇÃO: hospedagem não tem valor próprio, e quem procura por ela precisa achar a resposta: a
 * página diz que a diária a paga.
 *
 * DECISÃO (2026-10-10): o órgão escolhido fica em `?orgao=`, ao lado do período, e filtra totais,
 * anos e destinos. O pagamento que o Portal publica com órgão "Sigiloso" já chega somado ao órgão
 * da viagem, e a página diz quanto veio assim. Legislativo e Judiciário não estão no arquivo.
 *
 * O texto da página fica em `textos/viagens.tsx`.
 */
export function ViagensDoGovernoComponent() {
  const [parametros, setParametros] = useSearchParams();
  const deNaUrl = parametros.get('de');
  const ateNaUrl = parametros.get('ate');
  const periodo = useMemo<Periodo | undefined>(
    () => (deNaUrl && ateNaUrl ? { primeiroAno: Number(deNaUrl), ultimoAno: Number(ateNaUrl) } : undefined),
    [deNaUrl, ateNaUrl],
  );
  const orgao = parametros.get('orgao') ?? undefined;
  const { dados, erro, atualizando, chaveDoDado } = useCarga(['viagens', deNaUrl, ateNaUrl, orgao ?? null], () =>
    obterViagensDoGoverno(periodo, orgao),
  );


  return (
    <>
      <AbasDoDinheiroComponent />
      <CabecalhoDaColunaComponent titulo={T.titulo} subtitulo={T.subtitulo} />
      <AbasDoGovernoComponent busca={parametros.toString() ? `?${parametros.toString()}` : ''} />

      {erro && <p className="erro">{T.erro}</p>}
      {!erro && dados === undefined && <EsqueletoDePainelComponent rotulo={T.carregando} alturaDoGrafico={200} />}
      {!erro && dados === null && <p className="vazio">{T.semDados}</p>}

      {dados && (
        <AtualizandoComponent atualizando={atualizando} chave={chaveDoDado}>
          <SeletorDePeriodoComponent
            anos={dados.anosDisponiveis}
            periodo={dados.periodo}
            rotulo={T.rotuloDoPeriodo}
            atalhos={atalhosDasGestoes(dados)}
            aoMudar={(novo) =>
              setParametros(
                (p) => {
                  const proximos = new URLSearchParams(p);
                  proximos.delete('de');
                  proximos.delete('ate');
                  if (novo) {
                    proximos.set('de', String(novo.primeiroAno));
                    proximos.set('ate', String(novo.ultimoAno));
                  }
                  return proximos;
                },
                { replace: true },
              )
            }
          >
            {T.escopo(textoDoPeriodo(dados.periodo))}
          </SeletorDePeriodoComponent>

          <div className="filtros">
            <select
              value={dados.orgao ?? ''}
              aria-label={T.rotuloDoOrgao}
              onChange={(e) =>
                setParametros(
                  (p) => {
                    const proximos = new URLSearchParams(p);
                    if (e.target.value) {
                      proximos.set('orgao', e.target.value);
                    } else {
                      proximos.delete('orgao');
                    }
                    return proximos;
                  },
                  { replace: true },
                )
              }
            >
              <option value="">{T.todosOsOrgaos}</option>
              {[...dados.porOrgao]
                .sort((a, b) => a.orgao.localeCompare(b.orgao, 'pt-BR'))
                .map((o) => (
                  <option key={o.orgao} value={o.orgao}>
                    {o.orgao}
                  </option>
                ))}
            </select>
          </div>
          <p className="nota-curta">{T.soOExecutivo}</p>

          <ResumoDasViagensComponent dados={dados} />
          {dados.porAno.length > 1 && <ViagensPorAnoComponent dados={dados} />}
          {!dados.orgao && <ViagensPorOrgaoComponent dados={dados} />}
          <DestinosComponent dados={dados} />

          <p className="fonte-dado">
            <LinkDeFonteComponent href={FONTES.viagens.url}>{T.fonte}</LinkDeFonteComponent> {T.portal}
          </p>
        </AtualizandoComponent>
      )}
    </>
  );
}

function textoDoPeriodo({ primeiroAno, ultimoAno }: Periodo): string {
  return primeiroAno === ultimoAno ? `em ${primeiroAno}` : `de ${primeiroAno} a ${ultimoAno}`;
}

function ResumoDasViagensComponent({ dados }: { dados: ViagensDoGoverno }) {
  const periodo = textoDoPeriodo(dados.periodo);
  const contagem = (n: number) => n.toLocaleString('pt-BR');

  return (
    <section className="governo-secao">
      <p className="frase-resposta">
        {T.resposta(periodo.charAt(0).toUpperCase() + periodo.slice(1), reaisCompacto(dados.total), contagem(dados.viagens))}
      </p>
      <div className="numeros-do-ano">
        <NumeroComponent rotulo={T.diarias} definicao={T.diariasDefinicao}>{reaisCompacto(dados.diarias)}</NumeroComponent>
        <NumeroComponent rotulo={T.passagens} definicao={T.passagensDefinicao}>{reaisCompacto(dados.passagens)}</NumeroComponent>
        <NumeroComponent rotulo={T.outros} definicao={T.outrosDefinicao}>
          {reaisCompacto(dados.seguro + dados.restituicao)}
        </NumeroComponent>
      </div>
      <p className="nota-curta">{T.hospedagem}</p>
      {dados.pagoComOrgaoSigiloso > 0 && (
        <p className="nota-curta">{T.sigilosoAtribuido(reaisCompacto(dados.pagoComOrgaoSigiloso))}</p>
      )}
      {dados.sigiloso > 0 && <p className="nota-curta">{T.sigiloso(reaisCompacto(dados.sigiloso))}</p>}
      {dados.urgentes > 0 && <p className="nota-curta">{T.urgentes(contagem(dados.urgentes), contagem(dados.viagens))}</p>}
    </section>
  );
}

function ViagensPorAnoComponent({ dados }: { dados: ViagensDoGoverno }) {
  const maior = Math.max(...dados.porAno.map((a) => a.total));
  return (
    <section className="governo-secao">
      <h2>{T.porAno}</h2>
      <p className="nota-curta">{T.porAnoNota}</p>
      <ul className="gastos-categorias">
        {dados.porAno.map((a) => (
          <LinhaDeValorComponent key={a.anoDaViagem} nome={String(a.anoDaViagem)} valor={a.total} maior={maior} formatar={reaisCompacto} />
        ))}
      </ul>
    </section>
  );
}

function ViagensPorOrgaoComponent({ dados }: { dados: ViagensDoGoverno }) {
  const maior = dados.porOrgao[0]?.total ?? 0;
  return (
    <section className="governo-secao">
      <h2>{T.porOrgao}</h2>
      <ul className="gastos-categorias">
        {dados.porOrgao.slice(0, ORGAOS_EXIBIDOS).map((o) => (
          <LinhaDeValorComponent
            key={o.orgao}
            nome={
              <>
                {o.orgao}
                <small>{T.linhaDoOrgao(o.viagens.toLocaleString('pt-BR'))}</small>
              </>
            }
            valor={o.total}
            maior={maior}
            formatar={reaisCompacto}
          />
        ))}
      </ul>
    </section>
  );
}

function DestinosComponent({ dados }: { dados: ViagensDoGoverno }) {
  const listas: [string, ViagensDoGoverno['destinos']][] = [
    [T.destinos, dados.destinos],
    [T.destinosNoExterior, dados.destinosNoExterior],
  ];
  return (
    <section className="governo-secao">
      {listas.map(([titulo, destinos]) => {
        const maior = destinos[0]?.chegadas ?? 0;
        return (
          destinos.length > 0 && (
            <div key={titulo}>
              <h2>{titulo}</h2>
              <ul className="gastos-categorias">
                {destinos.map((d) => (
                  <LinhaDeValorComponent
                    key={`${d.pais}-${d.uf}-${d.cidade}`}
                    nome={`${d.cidade}, ${d.uf ?? d.pais}`}
                    valor={d.chegadas}
                    maior={maior}
                    formatar={(n) => T.chegadas(n.toLocaleString('pt-BR'))}
                  />
                ))}
              </ul>
            </div>
          )
        );
      })}
      <p className="nota-curta">{T.notaDosDestinos}</p>
    </section>
  );
}
