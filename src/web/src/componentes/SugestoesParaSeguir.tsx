import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarParlamentares, listarSeguidos, type Parlamentar } from '../api';
import { Avatar } from './Avatar';
import { BotaoSeguir } from './BotaoSeguir';
import { useSessao } from '../sessao';

/**
 * ⚠️ Eram 3, escolhidos entre os 100 primeiros em ordem alfabética — a lista da API
 * cortava ali, e o "mais ativo" era o mais ativo entre esses 100 nomes.
 */
const QUANTOS = 8;

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
  const { usuario } = useSessao();
  const [sugestoes, setSugestoes] = useState<Parlamentar[]>([]);
  const [seguidos, setSeguidos] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Sem conta não há o que seguir, e a lista de seguidos responderia 401.
    if (!usuario) return;

    // ⭐ A ordem é feita no servidor, e só vem o que a tela mostra — mais os que a
    //    pessoa já segue, que saem daqui. Antes vinha a lista inteira para usar 3.
    listarSeguidos()
      .then(async (jaSeguidos) => {
        const ids = new Set(jaSeguidos.map((p) => p.id));
        const pagina = await listarParlamentares({
          ordem: 'VOTACOES',
          tamanho: QUANTOS + ids.size,
        });
        setSeguidos(ids);
        setSugestoes(pagina.itens.filter((p) => !ids.has(p.id)).slice(0, QUANTOS));
      })
      .catch(() => setSugestoes([]));
  }, [usuario]);

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

      <Link to="/parlamentares" className="ver-mais">
        Ver todos
      </Link>
    </section>
  );
}
