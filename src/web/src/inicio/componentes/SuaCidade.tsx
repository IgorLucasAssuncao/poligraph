import { useState } from 'react';
import { buscarMunicipios, obterEmendasDoMunicipio, type Municipio } from '../../nucleo/api';
import { nomeProprio } from '../../nucleo/formato';
import { TEXTOS_DAS_EMENDAS as T } from '../../emendas/textos/emendas';
import { UFS } from '../../nucleo/ufs';
import { useAdiado } from '../../comum/componentes/useAdiado';
import { useCarga } from '../../comum/componentes/useCarga';

/**
 * A busca da cidade e o atalho pela localização.
 *
 * ATENÇÃO: A localização vira código IBGE DENTRO do navegador, contra a malha do próprio site:
 * latitude e longitude não saem da página.
 *
 * A malha e o d3 só carregam no clique em "usar minha localização": a página inicial também usa esta busca, e não precisa do mapa.
 */
export function SuaCidadeComponent({ aoEscolher }: { aoEscolher: (m: Municipio) => void }) {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<string | null>(null);
  const buscando = busca.trim().length >= 2;
  const adiada = useAdiado(busca, 250);
  const lidos = useCarga(['municipios', adiada], () => buscarMunicipios(adiada), { ativo: adiada.trim().length >= 2 });
  const achados: Municipio[] = lidos.erro ? [] : (lidos.dados ?? []);

  const escolher = (m: Municipio) => {
    setBusca('');
    setSituacao(null);
    aoEscolher(m);
  };

  const localizar = () => {
    if (!navigator.geolocation) {
      setSituacao(T.suaCidade.semLocalizacao);
      return;
    }
    setSituacao(T.suaCidade.localizando);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const ponto: [number, number] = [coords.longitude, coords.latitude];
        const { areaQueContem } = await import('../../nucleo/mapa');
        const codigoUf = await areaQueContem('brasil', ponto);
        const codigoIbge = codigoUf ? await areaQueContem(codigoUf, ponto) : null;
        const sigla = UFS.find(([c]) => c === codigoUf)?.[1];
        if (!codigoIbge || !sigla) {
          setSituacao(T.suaCidade.foraDoBrasil);
          return;
        }
        const dados = await obterEmendasDoMunicipio(codigoIbge).catch(() => null);
        escolher(dados ? dados.municipio : { codigoIbge, nome: '', uf: sigla });
      },
      () => setSituacao(T.suaCidade.naoPermitida),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  };

  return (
    <div className="sua-cidade" data-tour="emendas-cidade">
      <label htmlFor="busca-cidade">{T.suaCidade.titulo}</label>
      <div className="sua-cidade-campos">
        <input
          id="busca-cidade"
          type="search"
          value={busca}
          placeholder={T.suaCidade.placeholder}
          autoComplete="off"
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="botao-secundario" onClick={localizar}>
          {T.suaCidade.usarLocalizacao}
        </button>
      </div>

      {buscando && achados.length > 0 && (
        <ul className="sua-cidade-achados" aria-label={T.suaCidade.encontradas}>
          {achados.map((m) => (
            <li key={m.codigoIbge}>
              <button type="button" className="link-botao" onClick={() => escolher(m)}>
                {nomeProprio(m.nome)} – {m.uf}
              </button>
            </li>
          ))}
        </ul>
      )}

      {situacao && (
        <p className="ajuda" role="status">
          {situacao}
        </p>
      )}
      <p className="nota-curta">{T.suaCidade.nota}</p>
    </div>
  );
}
