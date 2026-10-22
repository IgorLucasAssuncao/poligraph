import { Link, useParams, useSearchParams } from 'react-router-dom';
import { obterEmendasDoMunicipio, obterGestoesDaCidade, type EleitoNaGestao, type GestaoDaCidade } from '../api';
import { EsqueletoDeTextoComponent } from '../componentes/Esqueleto';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { useCarga } from '../componentes/useCarga';
import { nomeProprio, reaisCompacto } from '../formato';
import { destinoDoPolitico, periodoDoEndereco } from '../navegacao';
import { TEXTOS_DA_CIDADE as T } from '../textos/cidade';
import { ListasDaCidadeComponent } from './Emendas';

/**
 * A página da cidade: quem foi eleito para governá-la em cada período e quanto de emenda chegou (Pendência 90, fase 4).
 *
 * DECISÃO: Versão mais simples, a pedido do autor (2026-10-21). As listas de quem mandou e de quem
 * recebeu continuam na tela de emendas, e o link leva até elas com a cidade aberta.
 *
 * RISCO: Os avisos ficam à vista, não num "saiba mais": "eleito" não é "governou", e "chegou
 * durante" não é "conseguiu". Sem eles, o bloco da gestão leria como mérito do prefeito.
 */
export function CidadeComponent() {
  const codigoIbge = useParams().codigoIbge ?? '';
  const lida = useCarga(['gestoes', codigoIbge], () => obterGestoesDaCidade(codigoIbge));
  const dados = lida.dados;

  if (lida.erro) {
    return (
      <>
        <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar />
        <p className="erro">{T.erro}</p>
      </>
    );
  }
  if (dados === undefined) return <EsqueletoDeTextoComponent rotulo={T.titulo} />;
  if (dados === null) {
    return (
      <>
        <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar />
        <p className="vazio">
          {T.naoEncontrada} <Link to="/emendas">{T.verOMapa}</Link>
        </p>
      </>
    );
  }

  const { municipio } = dados;
  const desde = dados.porAno[0]?.ano ?? null;
  const maior = Math.max(...dados.gestoes.map((g) => g.recebido), 1);
  const comPagamento = dados.gestoes.filter((g) => g.comPagamento);
  const anteriores = dados.gestoes.filter((g) => !g.comPagamento);
  const [primeiroAviso, ...outrosAvisos] = T.avisos;

  return (
    <>
      <CabecalhoDaColunaComponent titulo={`${nomeProprio(municipio.nome)} – ${municipio.uf}`} comVoltar />

      <header className="cidade-cabecalho">
        {dados.populacao && <p className="ajuda">{T.habitantes(dados.populacao)}</p>}
        <p className="painel-cidade-total">
          {dados.recebido > 0 && <span className="numero-valor">{reaisCompacto(dados.recebido)}</span>} {T.chegou(desde)}
        </p>
        {dados.recebido > 0 && (
          <ul className="painel-cidade-partes">
            <li>{T.naPrefeitura(reaisCompacto(dados.naPrefeitura))}</li>
            <li>{T.emEntidades(reaisCompacto(dados.recebido - dados.naPrefeitura))}</li>
          </ul>
        )}
        <Link className="botao-secundario" to={`/emendas?uf=${municipio.uf}&cidade=${municipio.codigoIbge}`}>
          {T.verNoMapa}
        </Link>
      </header>

      <section className="governo-secao" aria-labelledby="gestoes-titulo">
        <h2 id="gestoes-titulo" className="titulo-secao">
          {T.gestoes}
        </h2>
        <p className="ajuda">{T.gestoesAjuda}</p>
        <p className="ajuda" role="note">
          {primeiroAviso}
        </p>

        <ol className="gestoes-da-cidade">
          {comPagamento.map((g) => (
            <GestaoComponent key={g.primeiroAno} gestao={g} maior={maior} />
          ))}
        </ol>

        {anteriores.length > 0 && (
          <details className="detalhes-da-aba">
            <summary>
              {T.anteriores(anteriores.length, anteriores[anteriores.length - 1].primeiroAno, anteriores[0].ultimoAno)}
            </summary>
            <ol className="gestoes-da-cidade">
              {anteriores.map((g) => (
                <GestaoComponent key={g.primeiroAno} gestao={g} maior={maior} />
              ))}
            </ol>
          </details>
        )}

        <h3 className="cidade-como-ler">{T.comoLer}</h3>
        <ul className="avisos-da-cidade">
          {outrosAvisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      </section>

      <EmendasDaCidadeComponent codigoIbge={municipio.codigoIbge} />

      <p className="fonte-dado">{T.fonte}</p>
    </>
  );
}

/** Quem mandou e quem recebeu: as listas que saíram do painel da tela de emendas, no período que veio no endereço. */
function EmendasDaCidadeComponent({ codigoIbge }: { codigoIbge: string }) {
  const [parametros] = useSearchParams();
  const periodo = periodoDoEndereco(parametros.get('de'), parametros.get('ate'));
  const lida = useCarga(['municipio', codigoIbge, periodo?.primeiroAno, periodo?.ultimoAno], () => obterEmendasDoMunicipio(codigoIbge, periodo));
  if (!lida.dados || lida.dados.recebido === 0) return null;

  return (
    <section className="governo-secao painel-cidade" aria-labelledby="listas-da-cidade">
      <h2 id="listas-da-cidade" className="titulo-secao">
        {T.quemMandou}
      </h2>
      <p className="ajuda">{periodo ? T.quemMandouNoPeriodo(periodo.primeiroAno, periodo.ultimoAno) : T.quemMandouAjuda}</p>
      <ListasDaCidadeComponent dados={lida.dados} periodo={periodo} />
    </section>
  );
}

/** O ano em que começa a base de pagamentos de emenda (ago/2015, `emendas_favorecidos.competencia`). */
const ANO_DO_PRIMEIRO_PAGAMENTO = 2015;

/** Um mandato municipal: os anos, os eleitos e o que chegou, com a barra na escala da maior gestão. */
function GestaoComponent({ gestao, maior }: { gestao: GestaoDaCidade; maior: number }) {
  const anoAtual = new Date().getFullYear();
  const emAndamento = gestao.primeiroAno <= anoAtual && anoAtual <= gestao.ultimoAno;

  return (
    <li className="gestao-da-cidade">
      <p className="gestao-anos">
        {gestao.primeiroAno}–{gestao.ultimoAno}
        {emAndamento && <small>{T.emAndamento}</small>}
      </p>

      <dl className="gestao-eleitos">
        <dt>{gestao.prefeitos.length > 1 ? T.prefeitos : T.prefeito}</dt>
        <dd>
          <ListaDeEleitosComponent eleitos={gestao.prefeitos} />
          {gestao.prefeitos.length > 1 && <small className="gestao-nota">{T.doisEleitos}</small>}
        </dd>
        {gestao.vices.length > 0 && (
          <>
            <dt>{T.vice}</dt>
            <dd>
              <ListaDeEleitosComponent eleitos={gestao.vices} />
            </dd>
          </>
        )}
        <dt>{T.governador}</dt>
        <dd>
          {gestao.governadores.length === 0
            ? T.semGovernador
            : gestao.governadores.map((g) => (
                <span key={`${g.governador.idPessoa}-${g.deAno}`} className="gestao-governador">
                  <LinkDoEleitoComponent eleito={g.governador} />{' '}
                  {gestao.governadores.length > 1 && <small>{g.deAno}–{g.ateAno}</small>}
                </span>
              ))}
        </dd>
        {(gestao.viceGovernadores ?? []).length > 0 && (
          <>
            <dt>{T.viceGovernador}</dt>
            <dd>
              {(gestao.viceGovernadores ?? []).map((g) => (
                <span key={`${g.governador.idPessoa}-${g.deAno}`} className="gestao-governador">
                  <LinkDoEleitoComponent eleito={g.governador} />{' '}
                  {(gestao.viceGovernadores ?? []).length > 1 && <small>{g.deAno}–{g.ateAno}</small>}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>

      {gestao.comPagamento ? (
        <div className="gestao-dinheiro">
          <p>{T.chegouNaGestao(reaisCompacto(gestao.recebido))}</p>
          <span className="gestao-barra" aria-hidden="true">
            <span style={{ width: `${(100 * gestao.recebido) / maior}%` }} />
          </span>
          <small>{T.partes(reaisCompacto(gestao.naPrefeitura), reaisCompacto(gestao.recebido - gestao.naPrefeitura))}</small>
          {gestao.primeiroAno < ANO_DO_PRIMEIRO_PAGAMENTO && <small>{T.desdeAgosto}</small>}
          {gestao.contas && (
            <small className="gestao-contas">
              {T.contas(reaisCompacto(gestao.contas.receita), reaisCompacto(gestao.contas.despesaPaga))}{' '}
              {T.anosDeclarados(gestao.contas.anosDeclarados, gestao.contas.anosNaGestao)}
            </small>
          )}
        </div>
      ) : (
        <p className="ajuda">{T.semPagamento}</p>
      )}
    </li>
  );
}

function ListaDeEleitosComponent({ eleitos }: { eleitos: EleitoNaGestao[] }) {
  return (
    <>
      {eleitos.map((e, i) => (
        <span key={e.idPessoa}>
          {i > 0 && ', '}
          <LinkDoEleitoComponent eleito={e} />
        </span>
      ))}
    </>
  );
}

function LinkDoEleitoComponent({ eleito }: { eleito: EleitoNaGestao }) {
  return (
    <>
      <Link to={destinoDoPolitico(eleito)}>{nomeProprio(eleito.nome)}</Link> <small>{eleito.partido}</small>
    </>
  );
}
