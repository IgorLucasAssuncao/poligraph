import { Link } from 'react-router-dom';
import { obterFichaDoPolitico, type MandatoNoTse } from '../api';
import { nomeProprio } from '../formato';
import { TEXTOS_DOS_POLITICOS, descricaoDoMandato } from '../textos/politicos';
import { ListaDeMandatosComponent } from './ListaDeMandatos';
import { useCarga } from './useCarga';

const T = TEXTOS_DOS_POLITICOS.naFichaDoParlamentar;

/** Quantos cargos ficam à vista; o resto está na linha do tempo. */
const CARGOS_A_VISTA = 3;

/**
 * Os cargos fora do Congresso que o TSE registra para o parlamentar: o deputado que virou prefeito, o que foi deputado estadual antes.
 * Embaixo, todos os mandatos eleitos, também os do Congresso, na mesma lista da página do político.
 *
 * DECISÃO (autor, 2026-10-23): o presidente que foi deputado e o governador que virou senador mostram todos os mandatos na
 * ficha, e não só os três primeiros numa linha.
 *
 * ATENÇÃO: sem isto, a ficha de Eduardo Paes dizia "Fora do mandato" e mostrava só o mandato de deputado de 2003, com ele
 * prefeito do Rio em 2025 (achado de 2026-10-23). A ficha do parlamentar é a do voto; o cargo atual vinha só na linha do tempo.
 */
export function CargosNoTseComponent({ idPessoa }: { idPessoa: number }) {
  const lida = useCarga(['politico', idPessoa], () => obterFichaDoPolitico(idPessoa));
  const todos = lida.dados?.mandatos ?? [];
  const fora = todos.filter((m) => m.cargo !== 'DEPUTADO_FEDERAL' && m.cargo !== 'SENADOR');
  if (todos.length === 0) return null;

  const aVista = fora.slice(0, CARGOS_A_VISTA);
  return (
    <>
      {fora.length > 0 && (
        <p className="mandatos-unico">
          {T.rotulo}
          {aVista.map((m, i) => (
            <span key={`${m.anoEleicao}-${m.cargo}`}>
              {i > 0 && ' · '}
              <CargoComponent mandato={m} />
            </span>
          ))}
          {fora.length > aVista.length && T.eMais(fora.length - aVista.length)}
        </p>
      )}
      <details className="detalhes-da-aba mandatos-no-tse">
        <summary>{T.verTodos(todos.length)}</summary>
        <ListaDeMandatosComponent mandatos={todos} />
      </details>
    </>
  );
}

function CargoComponent({ mandato }: { mandato: MandatoNoTse }) {
  const texto = descricaoDoMandato(mandato, nomeProprio);
  return mandato.municipio ? <Link to={`/cidades/${mandato.municipio.codigoIbge}`}>{texto}</Link> : <span className="dado">{texto}</span>;
}
