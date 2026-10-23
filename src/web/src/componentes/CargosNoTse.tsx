import { Link } from 'react-router-dom';
import { obterFichaDoPolitico, type MandatoNoTse } from '../api';
import { nomeProprio } from '../formato';
import { TEXTOS_DOS_POLITICOS, descricaoDoMandato } from '../textos/politicos';
import { useCarga } from './useCarga';

const T = TEXTOS_DOS_POLITICOS.naFichaDoParlamentar;

/** Quantos cargos ficam à vista; o resto está na linha do tempo. */
const CARGOS_A_VISTA = 3;

/**
 * Os cargos fora do Congresso que o TSE registra para o parlamentar: o deputado que virou prefeito, o que foi deputado estadual antes.
 *
 * ATENÇÃO: sem isto, a ficha de Eduardo Paes dizia "Fora do mandato" e mostrava só o mandato de deputado de 2003, com ele
 * prefeito do Rio em 2025 (achado de 2026-10-23). A ficha do parlamentar é a do voto; o cargo atual vinha só na linha do tempo.
 */
export function CargosNoTseComponent({ idPessoa }: { idPessoa: number }) {
  const lida = useCarga(['politico', idPessoa], () => obterFichaDoPolitico(idPessoa));
  const fora = (lida.dados?.mandatos ?? []).filter((m) => m.cargo !== 'DEPUTADO_FEDERAL' && m.cargo !== 'SENADOR');
  if (fora.length === 0) return null;

  const aVista = fora.slice(0, CARGOS_A_VISTA);
  return (
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
  );
}

function CargoComponent({ mandato }: { mandato: MandatoNoTse }) {
  const texto = descricaoDoMandato(mandato, nomeProprio);
  return mandato.municipio ? <Link to={`/cidades/${mandato.municipio.codigoIbge}`}>{texto}</Link> : <span className="dado">{texto}</span>;
}
