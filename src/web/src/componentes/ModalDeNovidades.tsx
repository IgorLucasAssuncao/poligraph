import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSeguidos } from '../api';
import type { Novidades, Parlamentar } from '../api';
import { NOVIDADES_A_VISTA } from '../constantes';
import { TEXTOS_DO_QUE_MUDOU as T } from '../textos/oQueMudou';
import { AvatarComponent } from './Avatar';
import { BotaoMostrarMaisComponent } from './BotaoMostrarMais';
import { OpcoesComponent } from './Dados';
import type { Opcao } from './Dados';
import { montarItens, ultimaCarga } from './itensDoQueMudou';
import type { Item, TipoDeNovidade } from './itensDoQueMudou';
import { ModalComponent } from './Modal';

type FiltroDeTipo = TipoDeNovidade | 'todos';

/** A ordem dos tipos no filtro: o que mais pesa primeiro, os votos da semana por último. */
const TIPOS: TipoDeNovidade[] = ['contra', 'troca', 'cota', 'emenda', 'semana'];

/**
 * O feed das novidades de quem a pessoa segue (Pendência 89), num modal, como numa rede social: a
 * fila de quem ela segue no topo para filtrar por parlamentar, o filtro por tipo de fato e "Só as
 * novas", e cada fato num cartão com a foto, o nome, o partido e a data.
 *
 * DECISÃO do autor (2026-10-18): por parlamentar e fora da página; depois, com filtros, porque a
 * lista agrupada não deixava ver uma pessoa só nem um tipo de fato só.
 *
 * ATENÇÃO: O nome sai do texto de cada fato, porque já está no cabeçalho do cartão.
 *
 * `vistas`: o que este navegador já mostrou. O que não está lá leva o selo "Nova"; os votos da
 * semana nunca, porque se repetem toda semana. Quem abre o modal marca como visto ao fechar.
 *
 * RISCO: A lista de quem a pessoa segue é dado sensível, e fica fora do cache de leituras.
 */
export function ModalDeNovidadesComponent({
  aberto,
  aoFechar,
  novidades,
  vistas,
}: {
  aberto: boolean;
  aoFechar: () => void;
  novidades: Novidades;
  vistas: string[];
}) {
  const [seguidos, setSeguidos] = useState<Parlamentar[]>([]);
  const [pessoa, setPessoa] = useState<number | null>(null);
  const [tipo, setTipo] = useState<FiltroDeTipo>('todos');
  const [soNovas, setSoNovas] = useState(false);
  const [aVista, setAVista] = useState(NOVIDADES_A_VISTA);

  useEffect(() => {
    if (!aberto) return;
    let atual = true;
    listarSeguidos()
      .then((lista) => atual && setSeguidos(lista))
      .catch(() => atual && setSeguidos([]));
    return () => {
      atual = false;
    };
  }, [aberto]);

  const itens = montarItens(novidades, false);
  const nova = (item: Item) => item.tipo !== 'semana' && !vistas.includes(item.chave);
  const filtrados = itens.filter(
    (item) => (pessoa === null || item.idPessoa === pessoa) && (tipo === 'todos' || item.tipo === tipo) && (!soNovas || nova(item)),
  );
  const restantes = Math.max(filtrados.length - aVista, 0);
  const porId = new Map(seguidos.map((p) => [p.idPessoa, p]));
  const pessoas = pessoasDoFeed(itens, seguidos, nova);
  const opcoesDeTipo: Opcao<FiltroDeTipo>[] = [
    { valor: 'todos', rotulo: T.modal.tipo.todos },
    ...TIPOS.filter((t) => itens.some((item) => item.tipo === t)).map((t) => ({
      valor: t,
      rotulo: T.modal.tipo[t],
    })),
  ];

  return (
    <ModalComponent aberto={aberto} aoFechar={aoFechar} titulo={T.titulo} rotuloDeFechar={T.modal.fechar} largo>
      {itens.length === 0 ? (
        <p className="vazio">{T.nadaNovo(ultimaCarga(novidades))}</p>
      ) : (
        <>
          <div className="feed-pessoas" role="group" aria-label={T.modal.pessoas}>
            <button type="button" className="feed-pessoa" aria-pressed={pessoa === null} onClick={() => escolherPessoa(null)}>
              <span className="feed-pessoa-todos" aria-hidden="true">
                {pessoas.length}
              </span>
              <span className="feed-pessoa-nome">{T.modal.todos}</span>
            </button>
            {pessoas.map((p) => (
              <button
                key={p.idPessoa}
                type="button"
                className="feed-pessoa"
                aria-pressed={pessoa === p.idPessoa}
                onClick={() => escolherPessoa(p.idPessoa)}
              >
                <span className={p.temNova ? 'feed-pessoa-foto com-nova' : 'feed-pessoa-foto'}>
                  <AvatarComponent nome={p.nome} fotoUrl={p.urlFoto} />
                </span>
                <span className="feed-pessoa-nome">
                  {p.nome}
                  {p.temNova && <span className="so-leitor">, {T.modal.temNova}</span>}
                </span>
              </button>
            ))}
          </div>

          <div className="feed-filtros">
            <OpcoesComponent rotulo={T.modal.tipos} opcoes={opcoesDeTipo} escolhida={tipo} aoEscolher={escolherTipo} />
            <label className="feed-so-novas">
              <input type="checkbox" checked={soNovas} onChange={(e) => escolherSoNovas(e.target.checked)} />
              {T.modal.soNovas}
            </label>
          </div>

          {filtrados.length === 0 ? (
            <p className="vazio">
              {T.modal.nadaNoFiltro}{' '}
              <button type="button" className="botao-link" onClick={limparFiltros}>
                {T.modal.limpar}
              </button>
            </p>
          ) : (
            <ul className="feed">
              {filtrados.slice(0, aVista).map((item) => {
                const quem = porId.get(item.idPessoa);
                return (
                  <li key={item.chave} className={nova(item) ? 'feed-cartao com-nova' : 'feed-cartao'}>
                    <header className="feed-cartao-topo">
                      <AvatarComponent nome={item.nome} fotoUrl={quem?.urlFoto} tamanho="pequeno" />
                      <div className="feed-cartao-quem">
                        <Link to={`/parlamentar/${item.idPessoa}`} onClick={aoFechar}>
                          {item.nome}
                        </Link>
                        {quem && quem.partido && (
                          <span>
                            {quem.partido}
                            {quem.uf ? ` · ${quem.uf}` : ''}
                          </span>
                        )}
                      </div>
                      <span className="feed-cartao-data">{item.quando}</span>
                      {nova(item) && <span className="feed-selo">{T.modal.nova}</span>}
                    </header>
                    <p className="feed-cartao-texto">{item.texto}</p>
                    <p className="feed-cartao-fonte">{item.fonte}</p>
                  </li>
                );
              })}
            </ul>
          )}

          <BotaoMostrarMaisComponent
            proximos={Math.min(NOVIDADES_A_VISTA, restantes)}
            restantes={restantes}
            carregando={false}
            erro={false}
            aoClicar={() => setAVista((n) => n + NOVIDADES_A_VISTA)}
          />
        </>
      )}
    </ModalComponent>
  );

  function escolherPessoa(id: number | null) {
    setPessoa(id);
    setAVista(NOVIDADES_A_VISTA);
  }

  function escolherTipo(valor: FiltroDeTipo) {
    setTipo(valor);
    setAVista(NOVIDADES_A_VISTA);
  }

  function escolherSoNovas(valor: boolean) {
    setSoNovas(valor);
    setAVista(NOVIDADES_A_VISTA);
  }

  function limparFiltros() {
    setPessoa(null);
    setTipo('todos');
    setSoNovas(false);
    setAVista(NOVIDADES_A_VISTA);
  }
}

type PessoaDoFeed = { idPessoa: number; nome: string; urlFoto?: string | null; temNova: boolean };

/**
 * Quem aparece na fila do topo: todos os seguidos, mais quem tem fato na lista e já não é seguido.
 * Quem tem novidade vem primeiro; depois, em ordem alfabética.
 */
function pessoasDoFeed(itens: Item[], seguidos: Parlamentar[], nova: (item: Item) => boolean): PessoaDoFeed[] {
  const pessoas = new Map<number, PessoaDoFeed>();
  for (const p of seguidos) pessoas.set(p.idPessoa, { idPessoa: p.idPessoa, nome: p.nome, urlFoto: p.urlFoto, temNova: false });
  for (const item of itens) {
    const p = pessoas.get(item.idPessoa) ?? { idPessoa: item.idPessoa, nome: item.nome, temNova: false };
    p.temNova ||= nova(item);
    pessoas.set(item.idPessoa, p);
  }
  return [...pessoas.values()].sort(
    (a, b) => Number(b.temNova) - Number(a.temNova) || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}
