import { Link } from 'react-router-dom';
import type { MandatoNoTse } from '../api';
import { FONTES } from '../fontes';
import { nomeProprio } from '../formato';
import { TEXTOS_DOS_POLITICOS, descricaoDoMandato } from '../textos/politicos';
import { LinkDeFonteComponent } from './LinkDeFonte';

const T = TEXTOS_DOS_POLITICOS.ficha;

/**
 * Todos os mandatos que o TSE registra para a pessoa, do mais recente: o presidente que foi deputado, o governador que virou
 * senador. A página do político e a ficha do parlamentar usam a mesma lista (pedido do autor, 2026-10-23).
 *
 * Cada mandato leva aos outros eleitos do mesmo cargo e do mesmo lugar, e o de prefeito à página da cidade.
 */
export function ListaDeMandatosComponent({ mandatos }: { mandatos: MandatoNoTse[] }) {
  return (
    <>
      <p className="ajuda">{T.quantosMandatos(mandatos.length)}</p>
      <ol className="lista-autores lista-entidades">
        {mandatos.map((m) => (
          <ItemDeMandatoComponent key={`${m.anoEleicao}-${m.cargo}`} mandato={m} />
        ))}
      </ol>
      <p className="nota-curta">
        {T.fonte} <LinkDeFonteComponent href={FONTES.candidatos.url}>{T.candidaturasNoTse}</LinkDeFonteComponent>
      </p>
    </>
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
