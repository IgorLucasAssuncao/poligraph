import { useCarga } from '../componentes/useCarga';
import { BotaoCompartilharComponent } from '../componentes/BotaoCompartilhar';
import { Link, useParams } from 'react-router-dom';
import {
  type SancaoDaEntidade,
  listarConveniosDaEntidade,
  listarParlamentaresDaEntidade,
  obterEntidade,
  type Entidade as DadosDaEntidade,
} from '../api';
import { AbasDoDinheiroComponent } from '../componentes/AbasDoDinheiro';
import { ColetivosComponent, LinhaDoParlamentarComponent } from '../componentes/AutoresDaEmenda';
import { BotaoBaixarCsvComponent } from '../componentes/BotaoBaixarCsv';
import { BotaoMostrarMaisComponent } from '../componentes/BotaoMostrarMais';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { usePaginas } from '../componentes/usePaginas';
import { baixarCsv, buscarTodas } from '../exportar';
import { dataCurta, minusculas, nomeProprio, reais, reaisCompacto } from '../formato';
import { ComProcedenciaComponent } from '../componentes/ModoAuditoria';
import { EsqueletoDePainelComponent } from '../componentes/Esqueleto';
import { LinhaDeValorComponent, NumeroComponent } from '../componentes/Dados';
import { ITENS_POR_PAGINA_DA_ENTIDADE } from '../constantes';
import { TEXTOS_DAS_ENTIDADES } from '../textos/entidades';

const T = TEXTOS_DAS_ENTIDADES;

/**
 * Uma entidade: quanto recebeu de emenda, de quem, em que ano — e se aparece na cota.
 *
 * ## RISCO: A cota ao lado não é acusação
 *
 * Aparecer nas duas listas é, na maior parte, rotina: a cota paga despesas do escritório à
 * própria prefeitura, e a emenda vai para a mesma prefeitura; a companhia aérea vende a
 * passagem e presta serviço contratado com emenda. A seção diz isso antes dos números, e
 * Não destaca nem ordena ninguém por "coincidência" (RNF-16).
 */
export function EntidadeComponent() {
  const { cnpj = '' } = useParams();
  const { dados, erro } = useCarga(['entidade', cnpj], () => obterEntidade(cnpj), { manter: 2 });

  return (
    <>
      <AbasDoDinheiroComponent />
      {erro && <p className="erro">{T.entidade.erro}</p>}
      {!erro && dados === undefined && <EsqueletoDePainelComponent rotulo={T.entidade.carregando} />}
      {!erro && dados === null && <p className="vazio">{T.entidade.naoRecebeu}</p>}
      {dados && <PaginaDaEntidadeComponent dados={dados} />}
    </>
  );
}

function PaginaDaEntidadeComponent({ dados }: { dados: DadosDaEntidade }) {
  const maiorAno = Math.max(...dados.porAno.map((a) => a.recebido), 1);

  return (
    <>
      <CabecalhoDaColunaComponent
        titulo={nomeProprio(dados.nome)}
        subtitulo={dados.naturezaJuridica ?? undefined}
        comVoltar
        acao={<BotaoCompartilharComponent caminho={`/e/${dados.cnpj}`} nome={nomeProprio(dados.nome)} />}
      />

      {dados.emendas > 0 && (
        <>
          <section className="numeros-do-ano" aria-label={T.entidade.rotuloDosNumeros}>
            <NumeroComponent
              rotulo={T.entidade.recebeu}
              definicao={T.entidade.recebeuDefinicao(
                dados.emendas,
                dados.porAno[0]?.anoDaEmenda ?? T.entidade.semAno,
                dados.porAno[dados.porAno.length - 1]?.anoDaEmenda ?? T.entidade.semAno,
              )}
            >
              <ComProcedenciaComponent consulta={{ contexto: 'entidade', cnpj: dados.cnpj }} rotulo={T.entidade.rotuloDaProcedencia(nomeProprio(dados.nome))}>
                {reaisCompacto(dados.recebido)}
              </ComProcedenciaComponent>
            </NumeroComponent>
            <NumeroComponent
              rotulo={T.entidade.sede}
              texto
              definicao={T.entidade.sedeDefinicao}
            >
              {dados.sede ? (
                <Link to={`/cidades/${dados.sede.codigoIbge}`}>
                  {nomeProprio(dados.sede.nome)} – {dados.sede.uf}
                </Link>
              ) : (
                T.entidade.semSede
              )}
            </NumeroComponent>
          </section>

          <section className="governo-secao">
            <h2>{T.entidade.porAno}</h2>
            <ul className="gastos-categorias">
              {dados.porAno.map((a) => (
                <LinhaDeValorComponent key={a.anoDaEmenda} nome={a.anoDaEmenda} valor={a.recebido} maior={maiorAno} formatar={reaisCompacto} minimo={0} />
              ))}
            </ul>
            <p className="ajuda">{T.entidade.porAnoAjuda}</p>
          </section>

          <section className="governo-secao">
            <h2>{T.entidade.quemMandou}</h2>
            <QuemMandouComponent dados={dados} />
            <ColetivosComponent coletivos={dados.coletivos} />
          </section>
        </>
      )}

      {dados.sancoes.length > 0 && <SancoesComponent sancoes={dados.sancoes} cnpj={dados.cnpj} />}
      {dados.comOGoverno && (
        <section className="governo-secao">
          <h2>{T.comOGoverno.titulo}</h2>
          <p>
            {T.comOGoverno.resumo(
              dados.comOGoverno.contratos.toLocaleString('pt-BR'),
              reaisCompacto(dados.comOGoverno.valor),
              dados.comOGoverno.primeiroAno,
              dados.comOGoverno.ultimoAno,
            )}{' '}
            <Link to="/governo/compras">{T.comOGoverno.verTodos}</Link>
          </p>
        </section>
      )}

      <ConveniosAssinadosComponent dados={dados} />

      {dados.naCota && <NaCotaComponent dados={dados} />}

      <p className="fonte-dado">
        {T.entidade.cnpj(formatarCnpj(dados.cnpj))}{' '}
        <LinkDeFonteComponent href={dados.urlFonte}>{T.entidade.noPortal}</LinkDeFonteComponent>
      </p>
    </>
  );
}


function QuemMandouComponent({ dados }: { dados: DadosDaEntidade }) {
  const lista = usePaginas(dados.parlamentares.itens, dados.parlamentares.total, ITENS_POR_PAGINA_DA_ENTIDADE, (pagina) =>
    listarParlamentaresDaEntidade(dados.cnpj, pagina),
  );

  if (dados.parlamentares.total === 0) return null;

  return (
    <div>
      <h3>{T.parlamentares.titulo}</h3>
      <p className="ajuda">{T.parlamentares.resumo(dados.parlamentares.total, reaisCompacto(dados.deParlamentares))}</p>
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
        rotulo={T.parlamentares.baixar}
        montar={async () => {
          const todos = await buscarTodas((pagina) => listarParlamentaresDaEntidade(dados.cnpj, pagina));
          baixarCsv(
            T.parlamentares.arquivo(dados.cnpj),
            [...T.parlamentares.colunas],
            todos.map((p) => [p.nome, p.partido, p.uf, p.casa, p.emendas, p.recebido]),
          );
        }}
      />
    </div>
  );
}

/** O que parlamentares pagaram a esta mesma entidade com a cota — pelo CNPJ, e com a ressalva antes. */
/**
 * As sanções do CEIS e do CNEP. Diz quantas estão em vigor e, de cada uma, quem puniu, quando e
 * por qual lei, sem adjetivo: a categoria da sanção é a informação.
 */
function SancoesComponent({ sancoes, cnpj }: { sancoes: SancaoDaEntidade[]; cnpj: string }) {
  const S = T.sancoes;
  return (
    <section className="governo-secao">
      <h2>
        <ComProcedenciaComponent consulta={{ contexto: 'sancoes', cnpj }} rotulo={S.titulo}>
          {S.titulo}
        </ComProcedenciaComponent>
      </h2>
      <p>{S.resumo(sancoes.filter((s) => s.vigente).length, sancoes.length)}</p>
      <ul className="lista-de-sancoes">
        {sancoes.map((s, i) => (
          <li key={`${s.cadastro}-${i}`}>
            <strong>{s.categoria}</strong>
            {s.vigente && <span className="selo-vigente">{S.emVigor}</span>}
            <small>
              {[
                S.cadastros[s.cadastro] ?? s.cadastro,
                s.inicio ? S.periodo(dataCurta(s.inicio), s.fim ? dataCurta(s.fim) : null) : null,
                s.orgaoSancionador,
                s.valorDaMulta ? S.multa(reais(s.valorDaMulta)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
            {s.fundamentacaoLegal && <small>{s.fundamentacaoLegal}</small>}
          </li>
        ))}
      </ul>
      <p className="ajuda">{S.nota}</p>
    </section>
  );
}

function NaCotaComponent({ dados }: { dados: DadosDaEntidade }) {
  const cota = dados.naCota!;

  return (
    <section className="governo-secao">
      <h2>{T.naCota.titulo}</h2>
      <p className="aviso" role="note">
        {T.naCota.aviso(reaisCompacto(cota.total), cota.lancamentos)}
      </p>
      <ul className="lista-autores">
        {cota.porParlamentar.map((p) => (
          <li key={p.idPessoa}>
            <Link className="autor-nome" to={`/parlamentar/${p.idPessoa}`}>
              {nomeProprio(p.nome)}
            </Link>
            <span className="autor-detalhe">
              {[p.partido, p.casa === 'SENADO' ? T.naCota.senado : p.casa === 'CAMARA' ? T.naCota.camara : null]
                .filter(Boolean)
                .join(' · ')}{' '}
              {T.naCota.notas(p.lancamentos)}
            </span>
            <span className="valor">{reaisCompacto(p.total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * O que foi combinado com o dinheiro: o objeto de cada convênio que a entidade assinou.
 *
 * DECISÃO: Responde "comprou o quê, construiu o quê" — o que o valor sozinho não diz. Ligado pelo CNPJ
 * do convenente, não pelo nome. O liberado vem ao lado do combinado: convênio assinado não é
 * dinheiro que chegou.
 */
function ConveniosAssinadosComponent({ dados }: { dados: DadosDaEntidade }) {
  const lista = usePaginas(dados.convenios.itens, dados.convenios.total, dados.convenios.tamanho || 20, (pagina) =>
    listarConveniosDaEntidade(dados.cnpj, pagina),
  );

  if (dados.convenios.total === 0) return null;

  return (
    <section className="governo-secao">
      <h2>
        <ComProcedenciaComponent consulta={{ contexto: 'convenios', cnpj: dados.cnpj }} rotulo={T.convenios.titulo}>
          {T.convenios.titulo}
        </ComProcedenciaComponent>
      </h2>
      <p className="ajuda">{T.convenios.assinados(dados.convenios.total)}</p>
      <ul className="lista-convenios-entidade">
        {lista.itens.map((c) => (
          <li key={c.numero}>
            <p className="convenio-objeto">{c.objeto ? minusculas(c.objeto) : T.convenios.objetoNaoInformado}</p>
            <p className="convenio-detalhe">
              {[c.situacao && minusculas(c.situacao), T.convenios.assinadoEm(dataCurta(c.dataPublicacao))]
                .filter(Boolean)
                .join(' · ')}{' '}
              · <LinkDeFonteComponent href={c.urlFonte}>{T.convenios.convenio(c.numero)}</LinkDeFonteComponent>
            </p>
            <p className="convenio-valores">
              <span>{T.convenios.combinados(reais(c.valor))}</span>
              {c.valorLiberado !== null && <span>{T.convenios.liberados(reais(c.valorLiberado))}</span>}
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
    </section>
  );
}

function formatarCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
