import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listarEntidades, type EntidadeNaLista, type GrupoDeEntidade, type PaginaDe } from '../api';
import { AbasDoDinheiro } from '../componentes/AbasDoDinheiro';
import { BotaoMostrarMais } from '../componentes/BotaoMostrarMais';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinkDeFonte } from '../componentes/LinkDeFonte';
import { FONTES } from '../fontes';
import { nomeProprio, reaisCompacto } from '../formato';
import { EsqueletoDeLista } from '../componentes/Esqueleto';

/**
 * Quem recebeu dinheiro de emenda: prefeituras, governos estaduais, associações, empresas.
 *
 * DECISÃO: Os grupos substituem as 35 naturezas jurídicas da Receita: a pessoa reconhece
 * "associação ou fundação", não "Fundação Pública de Direito Privado Municipal". A natureza
 * exata continua na linha, para quem quiser conferir.
 *
 * O filtro e a busca ficam no endereço: o link compartilhado abre o mesmo recorte.
 */
export function Entidades() {
  const [parametros, setParametros] = useSearchParams();
  const grupo = (parametros.get('grupo') as GrupoDeEntidade | null) ?? null;
  const busca = parametros.get('busca') ?? '';

  const [digitado, setDigitado] = useState(busca);
  const [pagina, setPagina] = useState<PaginaDe<EntidadeNaLista> | null>(null);
  const [extras, setExtras] = useState<EntidadeNaLista[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let atual = true;
    listarEntidades({ busca, grupo })
      .then((nova) => {
        if (!atual) return;
        setPagina(nova);
        setExtras([]);
      })
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [busca, grupo]);

  useEffect(() => {
    const espera = setTimeout(() => {
      if (digitado.trim() === busca) return;
      setParametros((p) => comParametro(p, 'busca', digitado.trim() || null), { replace: true });
    }, 300);
    return () => clearTimeout(espera);
  }, [digitado, busca, setParametros]);

  const itens = [...(pagina?.itens ?? []), ...extras];
  const restantes = Math.max((pagina?.total ?? 0) - itens.length, 0);

  const carregarMais = async () => {
    if (!pagina) return;
    setCarregando(true);
    try {
      const proxima = await listarEntidades({ busca, grupo, pagina: Math.floor(itens.length / pagina.tamanho) + 1 });
      setExtras((atuais) => [...atuais, ...proxima.itens]);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <AbasDoDinheiro />
      <CabecalhoDaColuna titulo="Entidades" subtitulo="Quem recebeu dinheiro de emenda parlamentar" />

      <div className="filtros-entidades">
        <label htmlFor="busca-entidade" className="sr-apenas">
          Buscar entidade
        </label>
        <input
          id="busca-entidade"
          type="search"
          value={digitado}
          placeholder="Nome ou CNPJ"
          autoComplete="off"
          onChange={(e) => setDigitado(e.target.value)}
        />
        <div className="seletor-periodo-campos" role="group" aria-label="Tipo de entidade">
          {GRUPOS.map(([valor, rotulo]) => (
            <button
              key={rotulo}
              type="button"
              className={grupo === valor ? 'ativo' : ''}
              aria-pressed={grupo === valor}
              onClick={() => setParametros((p) => comParametro(p, 'grupo', valor))}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="erro">Não foi possível carregar as entidades agora.</p>}
      {!erro && !pagina && <EsqueletoDeLista rotulo="Carregando as entidades" />}

      {pagina && (
        <section className="governo-secao">
          <p className="ajuda">
            {pagina.total.toLocaleString('pt-BR')} {pagina.total === 1 ? 'entidade' : 'entidades'}, da que
            mais recebeu à que menos recebeu, somando as emendas de todos os anos carregados.
          </p>

          {pagina.total === 0 ? (
            <p className="vazio">Nenhuma entidade com esse nome recebeu dinheiro de emenda.</p>
          ) : (
            <ol className="lista-autores lista-entidades">
              {itens.map((e) => (
                <li key={e.cnpj}>
                  <Link className="autor-nome" to={`/entidades/${e.cnpj}`}>
                    {nomeProprio(e.nome)}
                  </Link>
                  <span className="autor-detalhe">
                    {[e.naturezaJuridica, e.sede && `${nomeProprio(e.sede.nome)} – ${e.sede.uf}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="valor">{reaisCompacto(e.recebido)}</span>
                </li>
              ))}
            </ol>
          )}

          <BotaoMostrarMais
            proximos={Math.min(pagina.tamanho, restantes)}
            restantes={restantes}
            carregando={carregando}
            erro={false}
            aoClicar={carregarMais}
          />
        </section>
      )}

      <p className="fonte-dado">
        Fontes: <LinkDeFonte href={FONTES.emendas.url}>{FONTES.emendas.nome}</LinkDeFonte>;{' '}
        <LinkDeFonte href={FONTES.cnpj.url}>{FONTES.cnpj.nome}</LinkDeFonte>, para a sede.
      </p>
    </>
  );
}

const GRUPOS: [GrupoDeEntidade | null, string][] = [
  [null, 'Todas'],
  ['SEM_FINS_LUCRATIVOS', 'Associações e fundações'],
  ['EMPRESA', 'Empresas'],
  ['MUNICIPIO', 'Prefeituras'],
  ['ESTADO', 'Governos estaduais'],
  ['OUTRO', 'Outras'],
];

function comParametro(atual: URLSearchParams, chave: string, valor: string | null): URLSearchParams {
  const proximo = new URLSearchParams(atual);
  if (valor === null) proximo.delete(chave);
  else proximo.set(chave, valor);
  return proximo;
}
