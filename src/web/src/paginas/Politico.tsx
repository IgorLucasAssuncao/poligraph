import { Link, Navigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { obterFichaDoPolitico, type Cargo, type MandatoNoTse } from '../api';
import { AvatarComponent } from '../componentes/Avatar';
import { BotaoCompartilharComponent } from '../componentes/BotaoCompartilhar';
import { AbaCampanhaComponent } from '../componentes/ContasDoParlamentar';
import { useContas } from '../componentes/useContas';
import { EsqueletoDeFichaComponent } from '../componentes/Esqueleto';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { LinhaDoTempoComponent } from '../componentes/LinhaDoTempo';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { RedesDoParlamentarComponent } from '../componentes/RedesDoParlamentar';
import { useCarga } from '../componentes/useCarga';
import { FONTES } from '../fontes';
import { nomeProprio } from '../formato';
import { NOMES_DOS_CARGOS, TEXTOS_DOS_POLITICOS, descricaoDoMandato } from '../textos/politicos';
import './parlamentar.css';

const T = TEXTOS_DOS_POLITICOS.ficha;

/**
 * A ficha de quem tem mandato no TSE e nunca votou no Congresso: governador, prefeito, deputado estadual e vices (Pendência 90, fase 3).
 *
 * DECISÃO: Quem votou no Congresso vai para a ficha do parlamentar, que tem tudo isto e mais o voto.
 * Um endereço por pessoa: o link antigo e o compartilhado chegam à mesma página.
 *
 * A ficha diz por que não há voto: as assembleias e as câmaras não publicam o voto nominal. Sem a
 * frase, a falta leria como defeito do site.
 */
export function PoliticoComponent() {
  const idPessoa = Number(useParams().idPessoa);
  const lida = useCarga(['politico', idPessoa], () => obterFichaDoPolitico(idPessoa));
  const ficha = lida.dados;

  if (lida.erro) {
    return (
      <>
        <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar />
        <p className="erro">{T.erro}</p>
      </>
    );
  }
  if (ficha === undefined) return <EsqueletoDeFichaComponent />;
  if (ficha === null) {
    return (
      <>
        <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar />
        <p className="vazio">
          {T.semMandato} <Link to="/parlamentares?vista=cargos">{T.verTodos}</Link>
        </p>
      </>
    );
  }
  if (ficha.parlamentar) return <Navigate to={`/parlamentar/${idPessoa}`} replace />;

  const [atual] = ficha.mandatos;
  const noCongresso = ficha.mandatos.find((m) => m.cargo === 'DEPUTADO_FEDERAL' || m.cargo === 'SENADOR');
  const nome = nomeProprio(ficha.nome);
  const nomeCivil = ficha.nomeCivil ? nomeProprio(ficha.nomeCivil) : null;

  return (
    <>
      <CabecalhoDaColunaComponent titulo={T.titulo} comVoltar />

      <header className="perfil-cabecalho">
        <div className="perfil-avatar-linha">
          <AvatarComponent nome={ficha.nome} fotoUrl={ficha.urlFoto} tamanho="grande" />
          <div className="perfil-identidade">
            <h1>{nome}</h1>
            {nomeCivil && nomeCivil !== nome && <p className="nome-civil">{nomeCivil}</p>}
          </div>
          <div className="perfil-acoes">
            <BotaoCompartilharComponent caminho={`/p/${idPessoa}`} nome={nome} />
          </div>
        </div>

        <div className="perfil-chips">
          <span className="chip">{NOMES_DOS_CARGOS[atual.cargo]}</span>
          <span className="chip">{atual.partido}</span>
          {atual.uf && <span className="chip">{atual.uf}</span>}
        </div>

        <div className="perfil-links">
          <RedesDoParlamentarComponent redes={ficha.redesSociais} />
        </div>

        {noCongresso && (
          <p className="ajuda" role="note">
            {T.semVotoAindaNoCongresso(noCongresso.primeiroAno)}
          </p>
        )}
      </header>

      <section className="aba-dinheiro" aria-label={T.mandatos}>
        <h2 className="titulo-secao">{T.mandatos}</h2>
        <p className="ajuda">{T.quantosMandatos(ficha.mandatos.length)}</p>
        <ol className="lista-autores lista-entidades">
          {ficha.mandatos.map((m) => (
            <ItemDeMandatoComponent key={`${m.anoEleicao}-${m.cargo}`} mandato={m} />
          ))}
        </ol>
        <p className="nota-curta">
          {T.fonte} <LinkDeFonteComponent href={FONTES.candidatos.url}>{T.candidaturasNoTse}</LinkDeFonteComponent>
        </p>
      </section>

      {!noCongresso && <FaltasDaFichaComponent mandatos={ficha.mandatos} />}

      <CampanhaDoPoliticoComponent idPessoa={idPessoa} />
      <LinhaDoTempoComponent idPessoa={idPessoa} />
    </>
  );
}

/** A campanha da eleição mais recente e os bens declarados: a mesma aba da ficha do parlamentar, ligada pela candidatura eleita (Pendência 90). */
function CampanhaDoPoliticoComponent({ idPessoa }: { idPessoa: number }) {
  const { contas, erro } = useContas(idPessoa);
  return <AbaCampanhaComponent idPessoa={idPessoa} contas={contas} erro={erro} />;
}

const CARGOS_DO_LEGISLATIVO: Cargo[] = ['DEPUTADO_ESTADUAL', 'DEPUTADO_DISTRITAL'];

/**
 * O que a ficha não mostra, e por quê, pelo cargo: o deputado estadual não tem voto nem gasto de gabinete na base; o prefeito tem
 * as contas na página da cidade.
 *
 * DECISÃO (autor, 2026-10-23): a falta se explica na página. Sem a frase, a ficha curta lê como defeito do site.
 *
 * Quem teve os dois tipos de cargo (deputado estadual e depois prefeito) lê os dois blocos.
 */
function FaltasDaFichaComponent({ mandatos }: { mandatos: MandatoNoTse[] }) {
  const F = TEXTOS_DOS_POLITICOS.faltas;
  const legislativo = mandatos.some((m) => CARGOS_DO_LEGISLATIVO.includes(m.cargo));
  const executivo = mandatos.filter((m) => !CARGOS_DO_LEGISLATIVO.includes(m.cargo));
  const cidade = executivo.find((m) => m.municipio)?.municipio;
  const noEstado = executivo.some((m) => !m.municipio);

  const itens: ReactNode[] = [];
  if (legislativo) itens.push(F.legislativo.votos, F.legislativo.gastos, F.legislativo.emendas);
  if (executivo.length > 0) {
    if (!legislativo) itens.push(F.executivo.votos);
    if (cidade) {
      itens.push(
        <>
          {F.executivo.contasDaCidade} <Link to={`/cidades/${cidade.codigoIbge}`}>{F.executivo.verACidade(nomeProprio(cidade.nome))}</Link>
        </>,
      );
    }
    if (noEstado) itens.push(F.executivo.contasDoEstado);
    if (!legislativo) itens.push(F.executivo.emendas);
  }

  return (
    <section className="aba-dinheiro" aria-labelledby="faltas-titulo">
      <h2 id="faltas-titulo" className="titulo-secao">
        {F.titulo}
      </h2>
      <ul className="faltas-da-ficha">
        {itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** Um mandato: o cargo com o ente e os anos, o partido e a eleição. */
function ItemDeMandatoComponent({ mandato }: { mandato: MandatoNoTse }) {
  return (
    <li>
      <span className="autor-nome">
        {mandato.municipio ? (
          <Link to={`/cidades/${mandato.municipio.codigoIbge}`}>{descricaoDoMandato(mandato, nomeProprio)}</Link>
        ) : (
          descricaoDoMandato(mandato, nomeProprio)
        )}
      </span>
      <span className="autor-detalhe">
        {[mandato.partido, T.eleitoEm(mandato.anoEleicao)].join(' · ')} ·{' '}
        <Link to={outrosDoCargo(mandato)}>{T.outrosDoCargo}</Link>
      </span>
    </li>
  );
}

/**
 * Os outros eleitos do mesmo cargo e do mesmo lugar, na lista de todos os cargos já filtrada.
 *
 * ATENÇÃO (2026-10-23): a ficha de quem não é do Congresso tinha um link só, e era beco: dali não se chegava aos colegas da
 * mesma assembleia ou da mesma prefeitura sem voltar à lista e filtrar de novo.
 */
function outrosDoCargo(mandato: MandatoNoTse): string {
  const filtro = new URLSearchParams({ vista: 'cargos', cargo: mandato.cargo });
  if (mandato.uf) filtro.set('uf', mandato.uf);
  if (mandato.municipio) {
    filtro.set('municipio', mandato.municipio.codigoIbge);
    filtro.set('cidade', mandato.municipio.nome);
  }
  return `/parlamentares?${filtro.toString()}`;
}
