import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarParlamentares, listarSeguidos, type Parlamentar } from '../api';
import { Avatar } from './Avatar';
import { BotaoSeguir } from './BotaoSeguir';

const QUANTOS = 3;

/**
 * "Quem seguir" — o cartão lateral.
 *
 * 🔴 A ordem NÃO é recomendação editorial. São os parlamentares com mais votações
 * registradas, ou seja, os que têm mais dado disponível — e isso está escrito na tela.
 *
 * ⚠️ Ordenar por "relevância" num site sobre política seria dar destaque a alguns
 * parlamentares por critério nosso, contrariando a RNF-16.
 */
export function SugestoesParaSeguir() {
  const [sugestoes, setSugestoes] = useState<Parlamentar[]>([]);
  const [seguidos, setSeguidos] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([listarParlamentares(), listarSeguidos()])
      .then(([todos, jaSeguidos]) => {
        const ids = new Set(jaSeguidos.map((p) => p.id));
        setSeguidos(ids);
        setSugestoes(
          todos
            .filter((p) => !ids.has(p.id))
            .sort((a, b) => b.nVotacoes - a.nVotacoes)
            .slice(0, QUANTOS),
        );
      })
      .catch(() => setSugestoes([]));
  }, []);

  if (sugestoes.length === 0) return null;

  return (
    <section className="cartao-lateral">
      <h2>Quem seguir</h2>

      <ul className="sugestoes">
        {sugestoes.map((p) => (
          <li key={p.id}>
            <Link to={`/parlamentar/${p.id}`} className="sugestao-link">
              <Avatar nome={p.nome} fotoUrl={p.urlFoto} tamanho="medio" />
              <span className="sugestao-texto">
                <strong>{p.nome}</strong>
                <small>
                  {p.partido}
                  {p.uf && ` · ${p.uf}`}
                </small>
              </span>
            </Link>

            <BotaoSeguir
              pessoaId={p.id}
              seguindo={seguidos.has(p.id)}
              aoAlternar={(id, agora) =>
                setSeguidos((atual) => {
                  const novo = new Set(atual);
                  agora ? novo.add(id) : novo.delete(id);
                  return novo;
                })
              }
            />
          </li>
        ))}
      </ul>

      {/* ⭐ O critério fica à vista: ordem por dado disponível, não por juízo nosso. */}
      <p className="criterio">Ordenado por número de votações registradas.</p>

      <Link to="/explorar" className="ver-mais">
        Ver todos
      </Link>
    </section>
  );
}
