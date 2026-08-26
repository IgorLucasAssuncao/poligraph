import { useEffect, useState } from 'react';
import { listarParlamentares, listarSeguidos, type Parlamentar } from '../api';
import { CartaoParlamentar } from '../componentes/CartaoParlamentar';

/** Busca e navegação pelos parlamentares (RF-34). */
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
    <div className="explorar">
      <h1>Explorar</h1>

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar por nome…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label="Buscar parlamentar por nome"
        />

        <select value={partido} onChange={(e) => setPartido(e.target.value)} aria-label="Partido">
          <option value="">Todos os partidos</option>
          {partidos.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Estado">
          <option value="">Todos os estados</option>
          {ufs.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {carregando && <p className="carregando">Buscando…</p>}

      {!carregando && lista.length === 0 && (
        <p className="vazio">Nenhum parlamentar encontrado com esses filtros.</p>
      )}

      <div className="grade">
        {lista.map((p) => (
          <CartaoParlamentar
            key={p.id}
            id={p.id}
            nome={p.nome}
            partido={p.partido}
            uf={p.uf}
            detalhe={`${p.nVotacoes} votações`}
            seguindo={seguidos.has(p.id)}
            aoAlternarSeguir={alternar}
          />
        ))}
      </div>
    </div>
  );

  function alternar(id: number, seguindoAgora: boolean) {
    setSeguidos((atual) => {
      const novo = new Set(atual);
      seguindoAgora ? novo.add(id) : novo.delete(id);
      return novo;
    });
  }
}
