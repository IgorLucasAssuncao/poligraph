import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listarEntidades, type GrupoDeEntidade } from '../api';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { useLista } from '../componentes/useCarga';
import { AbasDoDinheiroComponent } from '../componentes/AbasDoDinheiro';
import { BotaoMostrarMaisComponent } from '../componentes/BotaoMostrarMais';
import { CabecalhoDaColunaComponent } from '../componentes/Layout';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { FONTES } from '../fontes';
import { nomeProprio, reaisCompacto } from '../formato';
import { EsqueletoDeListaComponent } from '../componentes/Esqueleto';
import { TEXTOS_DAS_ENTIDADES } from '../textos/entidades';

const T = TEXTOS_DAS_ENTIDADES.lista;

/**
 * Quem recebeu dinheiro de emenda: prefeituras, governos estaduais, associações, empresas.
 *
 * DECISÃO: Os grupos substituem as 35 naturezas jurídicas da Receita: a pessoa reconhece
 * "associação ou fundação", não "Fundação Pública de Direito Privado Municipal". A natureza
 * exata continua na linha, para quem quiser conferir.
 *
 * O filtro e a busca ficam no endereço: o link compartilhado abre o mesmo recorte.
 */
export function EntidadesComponent() {
  const [parametros, setParametros] = useSearchParams();
  const grupo = (parametros.get('grupo') as GrupoDeEntidade | null) ?? null;
  const busca = parametros.get('busca') ?? '';

  const [digitado, setDigitado] = useState(busca);
  const lista = useLista(['entidades', busca, grupo], (numero) =>
    listarEntidades(numero > 1 ? { busca, grupo, pagina: numero } : { busca, grupo }),);
  const pagina = lista.primeira ?? null;
  const erro = lista.erro;

  useEffect(() => {
    const espera = setTimeout(() => {
      if (digitado.trim() === busca) return;
      setParametros((p) => comParametro(p, 'busca', digitado.trim() || null), { replace: true });
    }, 300);
    return () => clearTimeout(espera);
  }, [digitado, busca, setParametros]);

  const itens = lista.itens;
  const restantes = Math.max((pagina?.total ?? 0) - itens.length, 0);

  return (
    <>
      <AbasDoDinheiroComponent />
      <CabecalhoDaColunaComponent titulo={T.titulo} subtitulo={T.subtitulo} />

      <div className="filtros-entidades">
        <label htmlFor="busca-entidade" className="sr-apenas">
          {T.buscar}
        </label>
        <input
          id="busca-entidade"
          type="search"
          value={digitado}
          placeholder={T.placeholder}
          autoComplete="off"
          onChange={(e) => setDigitado(e.target.value)}
        />
        <div className="seletor-periodo-campos" role="group" aria-label={T.tipo}>
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

      {erro && <p className="erro">{T.erro}</p>}
      {!erro && !pagina && <EsqueletoDeListaComponent rotulo={T.carregando} />}

      {pagina && (
        <AtualizandoComponent atualizando={lista.atualizando} chave={lista.chaveDoDado}>
        <section className="governo-secao">
          <p className="ajuda">{T.quantas(pagina.total.toLocaleString('pt-BR'), pagina.total)}</p>

          {pagina.total === 0 ? (
            <p className="vazio">{T.nenhuma}</p>
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
        {T.fontes} <LinkDeFonteComponent href={FONTES.emendas.url}>{FONTES.emendas.nome}</LinkDeFonteComponent>;{' '}
        <LinkDeFonteComponent href={FONTES.cnpj.url}>{FONTES.cnpj.nome}</LinkDeFonteComponent>
        {T.paraASede}
      </p>
    </>
  );
}

const GRUPOS: [GrupoDeEntidade | null, string][] = [
  [null, T.grupos.todas],
  ['SEM_FINS_LUCRATIVOS', T.grupos.semFinsLucrativos],
  ['EMPRESA', T.grupos.empresas],
  ['MUNICIPIO', T.grupos.prefeituras],
  ['ESTADO', T.grupos.governosEstaduais],
  ['OUTRO', T.grupos.outras],
];

function comParametro(atual: URLSearchParams, chave: string, valor: string | null): URLSearchParams {
  const proximo = new URLSearchParams(atual);
  if (valor === null) proximo.delete(chave);
  else proximo.set(chave, valor);
  return proximo;
}
