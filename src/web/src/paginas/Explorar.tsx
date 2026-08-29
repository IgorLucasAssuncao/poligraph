import { useEffect, useState } from 'react';
import { listarParlamentares, listarSeguidos, type Parlamentar } from '../api';
import { IconeExplorar } from '../componentes/Icones';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';

/** Busca e navegação pelos parlamentares (RF-34). */
/**
 * ⚠️ "na Câmara" / "no Senado" — a preposição muda, e concatenar `NOME_DA_CASA` daria
 * "votações registradas Senado Federal".
 */
const NA_CASA: Record<Parlamentar['casa'], string> = {
  CAMARA: 'na Câmara',
  SENADO: 'no Senado',
};

export function Explorar() {
  const [termo, setTermo] = useState('');
  const [partido, setPartido] = useState('');
  const [uf, setUf] = useState('');
  const [lista, setLista] = useState<Parlamentar[]>([]);
  const [seguidos, setSeguidos] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarSeguidos()
      .then((s) => setSeguidos(new Set(s.map((p) => p.id))))
      .catch(() => setSeguidos(new Set()));
  }, []);

  useEffect(() => {
    // ⚠️ Espera a digitação parar: sem isso, cada tecla vira uma consulta ao banco.
    const timer = setTimeout(() => {
      setCarregando(true);
      listarParlamentares({ nome: termo, partido, uf })
        .then(setLista)
        .catch(() => setLista([]))
        .finally(() => setCarregando(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [termo, partido, uf]);

  const partidos = [...new Set(lista.map((p) => p.partido))].filter(Boolean).sort();
  const ufs = [...new Set(lista.map((p) => p.uf))].filter(Boolean).sort();

  return (
    <>
      <div className="barra-busca">
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

      {carregando && <p className="carregando">Buscando…</p>}

      {!carregando && lista.length === 0 && (
        <p className="vazio">Nenhum parlamentar encontrado com esses filtros.</p>
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
          detalhe={`${p.nVotacoes} votações registradas ${NA_CASA[p.casa]}`}
          seguindo={seguidos.has(p.id)}
          aoAlternarSeguir={alternar}
        />
      ))}
    </>
  );

  function alternar(id: number, seguindoAgora: boolean) {
    setSeguidos((atual) => {
      const novo = new Set(atual);
      seguindoAgora ? novo.add(id) : novo.delete(id);
      return novo;
    });
  }
}
