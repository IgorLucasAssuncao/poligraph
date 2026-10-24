import { Link } from 'react-router-dom';
import { obterFinanciamentoDaEleicao, type MandatoNoTse } from '../api';
import { nomeProprio } from '../formato';
import { TEXTOS_DOS_POLITICOS, descricaoDoMandato } from '../textos/politicos';
import { AbaCampanhaComponent } from './ContasDoParlamentar';
import { useCarga } from './useCarga';

const T = TEXTOS_DOS_POLITICOS.perfilDoCargo;

/**
 * Um mandato fora do Congresso na ficha do parlamentar: o presidente que foi deputado, o deputado que foi prefeito.
 *
 * DECISÃO (autor, 2026-10-24): o cartão do cargo abre o perfil daquele mandato, como a página do político faz para quem nunca
 * votou no Congresso: a campanha daquela eleição, os bens declarados e o caminho para o que o cargo tem na base (o Governo
 * federal do mandato, a página da cidade). Antes, o cartão de presidente levava direto ao Governo federal.
 *
 * Sem voto nem cota: presidente, governador e prefeito não votam projetos, e a ficha diz isso.
 */
export function PerfilDoCargoComponent({ idPessoa, mandato }: { idPessoa: number; mandato: MandatoNoTse }) {
  const lida = useCarga(['financiamento-da-eleicao', idPessoa, mandato.anoEleicao], () =>
    obterFinanciamentoDaEleicao(idPessoa, mandato.anoEleicao),
  );

  return (
    <section className="aba-dinheiro perfil-do-cargo" aria-labelledby="perfil-do-cargo-titulo">
      <h2 id="perfil-do-cargo-titulo" className="titulo-secao">
        {descricaoDoMandato(mandato, nomeProprio)}
      </h2>
      <p className="ajuda">
        {T.eleito(mandato.anoEleicao, mandato.partido)} {T.semVoto}{' '}
        <Link to={destino(mandato)}>{rotuloDoDestino(mandato)}</Link>
      </p>
      <AbaCampanhaComponent
        idPessoa={idPessoa}
        contas={lida.dados ? { gastos: null, emendas: null, fin: lida.dados } : null}
        erro={lida.erro}
      />
    </section>
  );
}

function destino(m: MandatoNoTse): string {
  if (m.cargo === 'PRESIDENTE' || m.cargo === 'VICE_PRESIDENTE') return `/governo?de=${m.primeiroAno}&ate=${m.ultimoAno}`;
  if (m.municipio) return `/cidades/${m.municipio.codigoIbge}`;
  const filtro = new URLSearchParams({ vista: 'cargos', cargo: m.cargo });
  if (m.uf) filtro.set('uf', m.uf);
  return `/parlamentares?${filtro.toString()}`;
}

function rotuloDoDestino(m: MandatoNoTse): string {
  if (m.cargo === 'PRESIDENTE' || m.cargo === 'VICE_PRESIDENTE') return T.verOGoverno(m.primeiroAno, m.ultimoAno);
  if (m.municipio) return T.verACidade(nomeProprio(m.municipio.nome));
  return T.verOsOutros;
}
