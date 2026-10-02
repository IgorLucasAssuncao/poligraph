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

/** Busca e navegação pelos parlamentares (RF-34). */
/**
 * ⚠️ "na Câmara" / "no Senado" — a preposição muda, e concatenar `NOME_DA_CASA` daria
 * "votações registradas Senado Federal".
 */
const NA_CASA: Record<Parlamentar['casa'], string> = {
  CAMARA: 'na Câmara',
  SENADO: 'no Senado',
  // Sem voto não há casa, e não há onde. A frase termina em "0 votações
  // registradas", que é exatamente o caso.
  '': '',
};

/**
 * Quantos por vez. ⚠️ A lista cortava em 100 por ordem alfabética, sem avisar: dos 745
 * parlamentares da 57ª, a tela nunca mostrava os outros 645.
 */
const POR_PAGINA = 30;

export function Explorar() {
  const [termo, setTermo] = useState('');
  const [partido, setPartido] = useState('');
  const [uf, setUf] = useState('');
  const [casa, setCasa] = useState<Casa | ''>('');
  const [anteriores, setAnteriores] = useState(false);
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
    // ⚠️ Espera a digitação parar: sem isso, cada tecla vira uma consulta ao banco.
    const timer = setTimeout(() => {
      setCarregando(true);
      listarParlamentares({
        nome: termo, partido, uf, casa: casa || undefined, anteriores: anteriores || undefined,
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
  }, [termo, partido, uf, casa, anteriores]);

  // ⭐ As opções vêm da lista inteira, que a API manda junto. Tiradas do que está na
  //    tela, escolher um partido esvaziava a lista de estados.
  const partidos = pagina?.partidos ?? [];
  const ufs = pagina?.ufs ?? [];
  const total = pagina?.total ?? 0;

  return (
    <>
      <div className="barra-busca" data-tour="busca">
        <span className="icone-busca" aria-hidden="true">
          <IconeExplorar />
        </span>
        {/* ⛔ "parlamentar", ⛔ não "deputado": a lista traz as DUAS casas, e o
            aria-label já dizia parlamentar — o texto visível é que discordava. */}
        <input
          type="search"
          placeholder="Buscar parlamentar por nome"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label="Buscar parlamentar por nome"
        />
      </div>

      <div className="filtros">
        {/* ⭐ A casa antes de partido e estado: é o que muda a leitura do número de
            votações, e quem procura "meu senador" ⛔ precisa atravessar 513 deputados. */}
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

        {/* ⭐ Desligado por padrão: o histórico são milhares de nomes, e quem chega
            procura quem está lá hoje. */}
        <label className="filtro-marcador">
          <input type="checkbox" checked={anteriores} onChange={(e) => setAnteriores(e.target.checked)} />
          Incluir quem já saiu
        </label>
      </div>

      {carregando && <EsqueletoDeLista rotulo="Buscando parlamentares" linhas={8} />}

      {!carregando && lista.length === 0 && (
        <p className="vazio">Nenhum parlamentar encontrado com esses filtros.</p>
      )}

      {!carregando && total > 0 && (
        <p className="contagem-lista" aria-live="polite">
          {lista.length === total ? `${total} parlamentares` : `${lista.length} de ${total} parlamentares`}
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
          /* 🔴 A casa entra no detalhe, ⛔ não é enfeite.
             📐 Medido em 2026-08-29: o deputado mediano tem 845 votações registradas e o
             senador mediano, 140 — SEIS vezes menos. O senador com MAIS votações (177)
             fica abaixo de 549 dos 643 deputados.
             ⚠️ A lista mistura as duas casas, e sem dizer qual é qual todo senador parece
             inativo. A causa é o Senado fazer menos votação nominal — e 56,8% delas serem
             secretas —, ⛔ não o senador trabalhar menos. */
          detalhe={detalheDe(p)}
          seguindo={seguidos.has(p.id)}
          aoAlternarSeguir={usuario ? alternar : undefined}
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
    return { nome: termo, partido, uf, casa: casa || undefined, anteriores: anteriores || undefined };
  }

  /**
   * ⚠️ Quem já saiu diz de quando era: "853 votações" sem o período faria um ex-deputado
   * de 2007 parecer tão ativo quanto alguém em exercício.
   */
  function detalheDe(p: Parlamentar) {
    const votacoes = `${p.nVotacoes} votações registradas ${NA_CASA[p.casa]}`.trim();
    const corrente = pagina?.legislaturaCorrente;
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
