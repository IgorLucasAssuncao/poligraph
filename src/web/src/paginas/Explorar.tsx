import { useEffect, useState } from 'react';
import {
  listarParlamentares,
  listarSeguidos,
  type Casa,
  type PaginaDeParlamentares,
  type Parlamentar,
} from '../api';
import { periodoDaLegislatura } from '../formato';
import { IconeExplorar } from '../componentes/Icones';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';
import { useSessao } from '../sessao';
import { EsqueletoDeLista } from '../componentes/Esqueleto';
import { useLegislaturaDaUrl } from '../componentes/useLegislatura';

/** Busca e navegação pelos parlamentares (RF-34). */
/**
 * ATENÇÃO: "na Câmara" / "no Senado" — a preposição muda, e concatenar `NOME_DA_CASA` daria
 * "votações registradas Senado Federal".
 *
 * Sem voto não há casa, e não há onde. A frase termina em "0 votações
 * registradas", que é exatamente o caso.
 */
const NA_CASA: Record<Parlamentar['casa'], string> = {
  CAMARA: 'na Câmara',
  SENADO: 'no Senado',
  '': '',
};

/**
 * Quantos por vez. ATENÇÃO: A lista cortava em 100 por ordem alfabética, sem avisar: dos 745
 * parlamentares da 57ª, a tela nunca mostrava os outros 645.
 */
const POR_PAGINA = 30;

/**
 * O período vem da faixa do topo — o seletor é um só, no mesmo lugar em todo o site.
 *
 * ATENÇÃO: Espera a digitação parar: sem isso, cada tecla vira uma consulta ao banco.
 *
 * DECISÃO: As opções vêm da lista inteira, que a API manda junto. Tiradas do que está na
 * tela, escolher um partido esvaziava a lista de estados.
 *
 * O período passado escolhido, para a contagem dizer de quando é a lista.
 *
 * Não "parlamentar", não "deputado": a lista traz as DUAS casas, e o
 * aria-label já dizia parlamentar — o texto visível é que discordava.
 *
 * DECISÃO: A casa antes de partido e estado: é o que muda a leitura do número de
 * votações, e quem procura "meu senador" Não precisa atravessar 513 deputados.
 *
 * RISCO: A casa entra no detalhe, não é enfeite.
 * MEDIDO: Medido em 2026-08-29: o deputado mediano tem 845 votações registradas e o
 * senador mediano, 140 — SEIS vezes menos. O senador com MAIS votações (177)
 * fica abaixo de 549 dos 643 deputados.
 * ATENÇÃO: A lista mistura as duas casas, e sem dizer qual é qual todo senador parece
 * inativo. A causa é o Senado fazer menos votação nominal — e 56,8% delas serem
 * secretas —, não o senador trabalhar menos.
 *
 * DECISÃO: Seguir só quem está em exercício (decisão do autor, 2026-10-02) — ou quem a
 * pessoa já segue, para poder deixar de seguir. A API recusa o resto (422).
 *
 * ATENÇÃO: Quem já saiu diz de quando era: "853 votações" sem o período faria um ex-deputado
 * de 2007 parecer tão ativo quanto alguém em exercício.
 *
 * ATENÇÃO: Com UM período passado escolhido, não "Ex-deputado": a lista é toda daquele período,
 * e quem foi reeleito ainda está lá. A contagem acima diz de quando é.
 */
export function Explorar() {
  const [termo, setTermo] = useState('');
  const [partido, setPartido] = useState('');
  const [uf, setUf] = useState('');
  const [casa, setCasa] = useState<Casa | ''>('');
  const [escolha] = useLegislaturaDaUrl();
  const [lista, setLista] = useState<Parlamentar[]>([]);
  const [pagina, setPagina] = useState<PaginaDeParlamentares | null>(null);
  const [seguidos, setSeguidos] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const { usuario } = useSessao();

  useEffect(() => {
    if (!usuario) return;
    listarSeguidos()
      .then((s) => setSeguidos(new Set(s.map((p) => p.id))))
      .catch(() => setSeguidos(new Set()));
  }, [usuario]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true);
      listarParlamentares({
        nome: termo, partido, uf, casa: casa || undefined,
        anteriores: escolha === 'todas' || undefined,
        legislatura: typeof escolha === 'number' ? escolha : undefined,
        tamanho: POR_PAGINA,
      })
        .then((primeira) => {
          setPagina(primeira);
          setLista(primeira.itens);
        })
        .catch(() => {
          setPagina(null);
          setLista([]);
        })
        .finally(() => setCarregando(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [termo, partido, uf, casa, escolha]);

  const partidos = pagina?.partidos ?? [];
  const ufs = pagina?.ufs ?? [];
  const total = pagina?.total ?? 0;
  const passada =
    typeof escolha === 'number' && escolha !== pagina?.legislaturaCorrente ? escolha : undefined;

  return (
    <>
      <div className="barra-busca" data-tour="busca">
        <span className="icone-busca" aria-hidden="true">
          <IconeExplorar />
        </span>
        <input
          type="search"
          placeholder="Buscar parlamentar por nome"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label="Buscar parlamentar por nome"
        />
      </div>

      <div className="filtros">
        <select value={casa} onChange={(e) => setCasa(e.target.value as Casa | '')} aria-label="Casa">
          <option value="">Câmara e Senado</option>
          <option value="CAMARA">Só a Câmara</option>
          <option value="SENADO">Só o Senado</option>
        </select>

        <select value={partido} onChange={(e) => setPartido(e.target.value)} aria-label="Partido">
          <option value="">Todos os partidos</option>
          {partidos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Estado">
          <option value="">Todos os estados</option>
          {ufs.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

      </div>

      {carregando && <EsqueletoDeLista rotulo="Buscando parlamentares" linhas={8} />}

      {!carregando && lista.length === 0 && (
        <p className="vazio">Nenhum parlamentar encontrado com esses filtros.</p>
      )}

      {!carregando && total > 0 && (
        <p className="contagem-lista" aria-live="polite">
          {lista.length === total ? `${total} parlamentares` : `${lista.length} de ${total} parlamentares`}
          {passada && ` que votaram em ${periodoDaLegislatura(passada)}`}
          {escolha === 'todas' && ' de todos os períodos, cada um com o último mandato'}
        </p>
      )}

      {lista.map((p) => (
        <LinhaParlamentar
          key={p.id}
          id={p.id}
          nome={p.nome}
          partido={p.partido}
          uf={p.uf}
          fotoUrl={p.urlFoto}
          detalhe={detalheDe(p)}
          legislatura={p.legislatura && p.legislatura !== pagina?.legislaturaCorrente ? p.legislatura : undefined}
          seguindo={seguidos.has(p.id)}
          aoAlternarSeguir={
            p.legislatura === pagina?.legislaturaCorrente || seguidos.has(p.id) ? alternar : undefined
          }
        />
      ))}

      {!carregando && lista.length < total && (
        <div className="carregar-mais">
          <button type="button" className="botao-secundario" onClick={carregarMais} disabled={carregandoMais}>
            {carregandoMais ? 'Carregando…' : `Mostrar mais ${Math.min(POR_PAGINA, total - lista.length)}`}
          </button>
        </div>
      )}
    </>
  );

  async function carregarMais() {
    if (!pagina) return;
    setCarregandoMais(true);
    try {
      const proxima = await listarParlamentares({
        ...filtro(), tamanho: POR_PAGINA, pagina: pagina.pagina + 1,
      });
      setPagina(proxima);
      setLista((atual) => [...atual, ...proxima.itens]);
    } finally {
      setCarregandoMais(false);
    }
  }

  function filtro() {
    return {
      nome: termo, partido, uf, casa: casa || undefined,
      anteriores: escolha === 'todas' || undefined,
      legislatura: typeof escolha === 'number' ? escolha : undefined,
    };
  }

  function detalheDe(p: Parlamentar) {
    const votacoes = `${p.nVotacoes} votos com posição ${NA_CASA[p.casa]}`.trim();
    const corrente = pagina?.legislaturaCorrente;
    if (typeof escolha === 'number') return votacoes;
    if (!p.legislatura || !corrente || p.legislatura === corrente) return votacoes;

    const quem = p.casa === 'SENADO' ? 'Ex-senador' : 'Ex-deputado';
    return `${quem} · ${periodoDaLegislatura(p.legislatura)} · ${votacoes}`;
  }

  function alternar(id: number, seguindoAgora: boolean) {
    setSeguidos((atual) => {
      const novo = new Set(atual);
      seguindoAgora ? novo.add(id) : novo.delete(id);
      return novo;
    });
  }
}
