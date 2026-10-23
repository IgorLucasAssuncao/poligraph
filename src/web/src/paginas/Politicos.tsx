import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buscarMunicipios, listarPoliticos, type Cargo, type Nivel, type PoliticoNaLista } from '../api';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { BotaoMostrarMaisComponent } from '../componentes/BotaoMostrarMais';
import { EsqueletoDeListaComponent } from '../componentes/Esqueleto';
import { useAdiado } from '../componentes/useAdiado';
import { useCarga, useLista } from '../componentes/useCarga';
import { nomeProprio } from '../formato';
import { destinoDoPolitico } from '../navegacao';
import { SIGLAS_DAS_UFS } from '../ufs';
import { CARGOS_DO_NIVEL, NOMES_DOS_CARGOS, TEXTOS_DOS_POLITICOS, descricaoDoMandato } from '../textos/politicos';

const T = TEXTOS_DOS_POLITICOS.lista;
const NIVEIS: (Nivel | null)[] = [null, 'FEDERAL', 'ESTADUAL', 'MUNICIPAL'];

/**
 * Todo político eleito que o TSE publica, de 1998 a 2026: presidente, governadores, prefeitos, deputados e vices (Pendência 90).
 *
 * DECISÃO: Os filtros descem do nível ao município. O cargo só oferece os do nível escolhido, e a
 * cidade só aparece com o estado escolhido: são 5.570 municípios, e a lista sem estado não caberia.
 *
 * O filtro fica no endereço, como na lista de entidades: o link compartilhado abre o mesmo recorte.
 */
export function PoliticosComponent() {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  const nivel = (parametros.get('nivel') as Nivel | null) ?? null;
  const cargo = (parametros.get('cargo') as Cargo | null) ?? null;
  const uf = parametros.get('uf');
  const municipio = parametros.get('municipio');
  const nomeDaCidade = parametros.get('cidade');

  const [digitado, setDigitado] = useState(busca);
  const lista = useLista(['politicos', busca, nivel, cargo, uf, municipio], (numero) =>
    listarPoliticos({ busca, nivel, cargo, uf, municipio, ...(numero > 1 ? { pagina: numero } : {}) }),
  );
  const pagina = lista.primeira ?? null;

  useEffect(() => {
    const espera = setTimeout(() => {
      if (digitado.trim() === busca) return;
      setParametros((p) => comParametros(p, { busca: digitado.trim() || null }), { replace: true });
    }, 300);
    return () => clearTimeout(espera);
  }, [digitado, busca, setParametros]);

  const cargos = nivel ? CARGOS_DO_NIVEL[nivel] : (Object.keys(NOMES_DOS_CARGOS) as Cargo[]);
  const restantes = Math.max((pagina?.total ?? 0) - lista.itens.length, 0);

  return (
    <>
      <div className="filtros-entidades filtros-politicos">
        <label htmlFor="busca-politico" className="sr-apenas">
          {T.buscar}
        </label>
        <input
          id="busca-politico"
          type="search"
          value={digitado}
          placeholder={T.placeholder}
          autoComplete="off"
          onChange={(e) => setDigitado(e.target.value)}
        />

        <div className="seletor-periodo-campos" role="group" aria-label={T.nivel}>
          {NIVEIS.map((valor) => (
            <button
              key={valor ?? 'todos'}
              type="button"
              className={nivel === valor ? 'ativo' : ''}
              aria-pressed={nivel === valor}
              onClick={() =>
                setParametros((p) =>
                  comParametros(p, {
                    nivel: valor,
                    cargo: valor && cargo && !CARGOS_DO_NIVEL[valor].includes(cargo) ? null : cargo,
                    municipio: valor && valor !== 'MUNICIPAL' ? null : municipio,
                    cidade: valor && valor !== 'MUNICIPAL' ? null : nomeDaCidade,
                  }),
                )
              }
            >
              {T.niveis[valor ?? 'todos']}
            </button>
          ))}
        </div>

        <label className="filtro-politico">
          <span>{T.cargo}</span>
          <select
            value={cargo ?? ''}
            onChange={(e) => setParametros((p) => comParametros(p, { cargo: e.target.value || null }))}
          >
            <option value="">{T.todosOsCargos}</option>
            {cargos.map((c) => (
              <option key={c} value={c}>
                {NOMES_DOS_CARGOS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="filtro-politico">
          <span>{T.uf}</span>
          <select
            value={uf ?? ''}
            onChange={(e) =>
              setParametros((p) => comParametros(p, { uf: e.target.value || null, municipio: null, cidade: null }))
            }
          >
            <option value="">{T.todasAsUfs}</option>
            {SIGLAS_DAS_UFS.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla}
              </option>
            ))}
          </select>
        </label>

        {nivel !== 'FEDERAL' && nivel !== 'ESTADUAL' && (
          <FiltroDeCidadeComponent
            uf={uf}
            escolhida={municipio && nomeDaCidade ? nomeDaCidade : null}
            aoEscolher={(codigo, nome) => setParametros((p) => comParametros(p, { municipio: codigo, cidade: nome }))}
          />
        )}
      </div>

      {lista.erro && <p className="erro">{T.erro}</p>}
      {!lista.erro && !pagina && <EsqueletoDeListaComponent rotulo={T.carregando} />}

      {pagina && (
        <AtualizandoComponent atualizando={lista.atualizando} chave={lista.chaveDoDado}>
          <section className="governo-secao">
            <p className="ajuda">{T.quantos(pagina.total)}</p>
            {pagina.total === 0 ? (
              <p className="vazio">{T.nenhum}</p>
            ) : (
              <ol className="lista-autores lista-entidades">
                {lista.itens.map((p) => (
                  <ItemDePoliticoComponent key={p.idPessoa} politico={p} />
                ))}
              </ol>
            )}
            <BotaoMostrarMaisComponent
              proximos={Math.min(pagina.tamanho, restantes)}
              restantes={restantes}
              carregando={lista.carregandoMais}
              erro={false}
              aoClicar={lista.carregarMais}
            />
          </section>
        </AtualizandoComponent>
      )}

      <p className="fonte-dado">
        {T.fonte} {T.viceAntes}
      </p>
    </>
  );
}

/** Uma linha da lista: o nome leva à página da pessoa, a do parlamentar quando ela votou no Congresso. */
function ItemDePoliticoComponent({ politico }: { politico: PoliticoNaLista }) {
  return (
    <li>
      <Link className="autor-nome" to={destinoDoPolitico(politico)}>
        {nomeProprio(politico.nome)}
      </Link>
      <span className="autor-detalhe">
        {[descricaoDoMandato(politico.mandato, nomeProprio), politico.mandato.partido, T.outrosMandatos(politico.mandatos)]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </li>
  );
}

/** A cidade só se escolhe com o estado: a busca de municípios responde por nome, e o estado tira os homônimos. */
function FiltroDeCidadeComponent({
  uf,
  escolhida,
  aoEscolher,
}: {
  uf: string | null;
  escolhida: string | null;
  aoEscolher: (codigo: string | null, nome: string | null) => void;
}) {
  const [termo, setTermo] = useState('');
  const adiado = useAdiado(termo.trim(), 250);
  const cidades = useCarga(['municipios', adiado], () => buscarMunicipios(adiado), { ativo: !!uf && adiado.length >= 2 });

  if (!uf) {
    return <p className="ajuda filtro-politico">{T.municipioPrecisaDeUf}</p>;
  }
  if (escolhida) {
    return (
      <button type="button" className="filtro-escolhido" onClick={() => aoEscolher(null, null)} aria-label={T.tirarMunicipio(escolhida)}>
        {nomeProprio(escolhida)} ×
      </button>
    );
  }

  const daUf = (cidades.dados ?? []).filter((c) => c.uf === uf).slice(0, 8);
  return (
    <div className="filtro-politico filtro-cidade">
      <label htmlFor="filtro-cidade">{T.municipio}</label>
      <input
        id="filtro-cidade"
        type="search"
        value={termo}
        placeholder={T.municipioPlaceholder}
        autoComplete="off"
        onChange={(e) => setTermo(e.target.value)}
      />
      {termo.trim().length >= 2 && daUf.length > 0 && (
        <ul className="opcoes-cidade">
          {daUf.map((c) => (
            <li key={c.codigoIbge}>
              <button type="button" onClick={() => aoEscolher(c.codigoIbge, c.nome)}>
                {nomeProprio(c.nome)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function comParametros(atual: URLSearchParams, mudancas: Record<string, string | null>): URLSearchParams {
  const proximo = new URLSearchParams(atual);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null) proximo.delete(chave);
    else proximo.set(chave, valor);
  }
  return proximo;
}
