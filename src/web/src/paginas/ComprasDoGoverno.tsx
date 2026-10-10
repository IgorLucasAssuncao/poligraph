import { useMemo } from 'react';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { useCarga } from '../componentes/useCarga';
import { Link, useSearchParams } from 'react-router-dom';
import { obterComprasDoGoverno, type ComprasDoGoverno, type Periodo } from '../api';
import { AbasDoDinheiroComponent } from '../componentes/AbasDoDinheiro';
import { AbasDoGovernoComponent } from '../componentes/AbasDoGoverno';
import { LinhaDeValorComponent } from '../componentes/Dados';
import { EsqueletoDePainelComponent } from '../componentes/Esqueleto';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { SeletorDePeriodoComponent } from '../componentes/SeletorDePeriodo';
import { ColunasPorAnoComponent, ComposicaoComponent } from '../componentes/Graficos';
import { partesComOutros } from '../componentes/partesComOutros';
import { atalhosDasGestoes } from '../componentes/atalhosDasGestoes';
import { FONTES } from '../fontes';
import { nomeProprio, reaisCompacto } from '../formato';
import { TEXTOS_DAS_COMPRAS as T } from '../textos/compras';

/**
 * Os contratos do Executivo federal: quanto, de que modo e com quem.
 *
 * RISCO: a fonte publica valor inicial e final com erro de digitação, ora num, ora noutro. A página
 * diz quantos contratos entraram com o menor dos dois e quanto ficou fora, em vez de somar um
 * número plausível e errado.
 *
 * ATENÇÃO: a maior parte dos contratos vem sem modalidade de compra. A página diz quanto, porque
 * "sem licitação" e "sem informação" não são a mesma coisa.
 *
 * O texto da página fica em `textos/compras.tsx`.
 */
export function ComprasDoGovernoComponent() {
  const [parametros, setParametros] = useSearchParams();
  const deNaUrl = parametros.get('de');
  const ateNaUrl = parametros.get('ate');
  const periodo = useMemo<Periodo | undefined>(
    () => (deNaUrl && ateNaUrl ? { primeiroAno: Number(deNaUrl), ultimoAno: Number(ateNaUrl) } : undefined),
    [deNaUrl, ateNaUrl],
  );
  const { dados, erro, atualizando, chaveDoDado } = useCarga(['compras', deNaUrl, ateNaUrl], () => obterComprasDoGoverno(periodo));


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
              setParametros(novo ? { de: String(novo.primeiroAno), ate: String(novo.ultimoAno) } : {}, { replace: true })
            }
          >
            {T.escopo(textoDoPeriodo(dados.periodo))}
          </SeletorDePeriodoComponent>

          <ResumoDasComprasComponent dados={dados} />
          {dados.porAno.length > 1 && (
            <section className="governo-secao">
              <h2>{T.porAno}</h2>
              <p className="nota-curta">{T.porAnoNota}</p>
              <ColunasPorAnoComponent
                rotulo={T.porAno}
                series={[T.valorDosContratos]}
                anos={dados.porAno.map((a) => ({
                  ano: a.anoDaPublicacao,
                  valores: [a.valor],
                  nota: T.contratosNoAno(a.contratos.toLocaleString('pt-BR')),
                }))}
                formatar={reaisCompacto}
                anoEscolhido={dados.periodo.primeiroAno === dados.periodo.ultimoAno ? dados.periodo.primeiroAno : null}
                aoEscolher={(ano) =>
                        setParametros(
                          (p) => {
                            const proximos = new URLSearchParams(p);
                            proximos.set('de', String(ano));
                            proximos.set('ate', String(ano));
                            return proximos;
                          },
                          { replace: true },
                        )
                      }
              />
            </section>
          )}
          <ListaDeValoresComponent
            titulo={T.porModalidade}
            composicao={{ total: dados.valor }}
            linhas={dados.porModalidade.map((m) => ({ chave: m.modalidade, nome: m.modalidade, valor: m.valor, contratos: m.contratos }))}
          />
          <ListaDeValoresComponent
            titulo={T.porOrgao}
            composicao={{ total: dados.valor }}
            linhas={dados.porOrgao.map((o) => ({ chave: o.orgao, nome: o.orgao, valor: o.valor, contratos: o.contratos }))}
          />
          <ListaDeValoresComponent
            titulo={T.contratados}
            linhas={dados.contratados.map((c) => ({
              chave: c.cnpj,
              nome: <Link to={`/entidades/${c.cnpj}`}>{nomeProprio(c.nome)}</Link>,
              valor: c.valor,
              contratos: c.contratos,
            }))}
          />

          <p className="fonte-dado">
            <LinkDeFonteComponent href={FONTES.compras.url}>{T.fonte}</LinkDeFonteComponent> {T.portal}
          </p>
        </AtualizandoComponent>
      )}
    </>
  );
}

function textoDoPeriodo({ primeiroAno, ultimoAno }: Periodo): string {
  return primeiroAno === ultimoAno ? `em ${primeiroAno}` : `de ${primeiroAno} a ${ultimoAno}`;
}

function ResumoDasComprasComponent({ dados }: { dados: ComprasDoGoverno }) {
  const periodo = textoDoPeriodo(dados.periodo);
  const contagem = (n: number) => n.toLocaleString('pt-BR');

  return (
    <section className="governo-secao">
      <p className="frase-resposta">
        {T.resposta(periodo.charAt(0).toUpperCase() + periodo.slice(1), contagem(dados.contratos), reaisCompacto(dados.valor))}
      </p>
      <p className="nota-curta">{T.valorDoContrato}</p>
      {dados.semModalidade > 0 && <p className="nota-curta">{T.semModalidade(reaisCompacto(dados.semModalidade))}</p>}
      {dados.sigilosos > 0 && (
        <p className="nota-curta">{T.sigilosos(contagem(dados.sigilosos), reaisCompacto(dados.valorSigiloso))}</p>
      )}
      {dados.divergentes > 0 && (
        <p className="nota-curta">{T.divergentes(contagem(dados.divergentes), reaisCompacto(dados.valorDescartado))}</p>
      )}
    </section>
  );
}

/** Uma lista de barras com o mesmo formato: nome, quantos contratos e o valor. */
function ListaDeValoresComponent({
  titulo,
  nota,
  linhas,
  composicao,
}: {
  titulo: string;
  nota?: string;
  linhas: { chave: string; nome: React.ReactNode; texto?: string; valor: number; contratos?: number }[];
  /** Com a barra de composição: o total do período, para a lista cortada pela API. */
  composicao?: { total: number };
}) {
  const maior = Math.max(0, ...linhas.map((l) => l.valor));
  return (
    <section className="governo-secao">
      <h2>{titulo}</h2>
      {nota && <p className="nota-curta">{nota}</p>}
      {composicao && linhas.length > 1 && (
        <ComposicaoComponent
          rotulo={titulo}
          formatar={reaisCompacto}
          partes={partesComOutros(linhas, (l) => l.texto ?? l.chave, (l) => l.valor, T.outros, composicao.total)}
        />
      )}
      <ul className="gastos-categorias">
        {linhas.map((l) => (
          <LinhaDeValorComponent
            key={l.chave}
            nome={
              <>
                {l.nome}
                {l.contratos !== undefined && <small>{T.contratos(l.contratos.toLocaleString('pt-BR'))}</small>}
              </>
            }
            valor={l.valor}
            maior={maior}
            formatar={reaisCompacto}
          />
        ))}
      </ul>
    </section>
  );
}
