import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarParlamentares, listarSeguidos, type Parlamentar } from '../api';
import { AvatarComponent } from './Avatar';
import { BotaoSeguirComponent } from './BotaoSeguir';
import { useSessao } from '../sessao';
import { SUGESTOES_PARA_SEGUIR } from '../constantes';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';


/**
 * "Quem seguir" — o cartão lateral.
 *
 * RISCO: A ordem NÃO é recomendação editorial. São os parlamentares com mais votações
 * registradas, ou seja, os que têm mais dado disponível — e isso está escrito na tela.
 *
 * ATENÇÃO: Ordenar por "relevância" num site sobre política seria dar destaque a alguns
 * parlamentares por critério nosso, contrariando a RNF-16.
 *
 * DECISÃO: Sem conta, as mesmas sugestões: o botão leva a entrar. A lista de seguidos
 * responderia 401, e por isso não é pedida.
 *
 * DECISÃO: A ordem é feita no servidor, e só vem o que a tela mostra — mais os que a
 * pessoa já segue, que saem daqui. Antes vinha a lista inteira para usar 3.
 *
 * DECISÃO: O critério fica à vista: ordem por dado disponível, não por juízo nosso.
 */
export function SugestoesParaSeguirComponent() {
  const { usuario } = useSessao();
  const [sugestoes, setSugestoes] = useState<Parlamentar[]>([]);
  const [seguidos, setSeguidos] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!usuario) {
      listarParlamentares({ ordem: 'VOTACOES', tamanho: SUGESTOES_PARA_SEGUIR })
        .then((pagina) => setSugestoes(pagina.itens))
        .catch(() => setSugestoes([]));
      return;
    }

    listarSeguidos()
      .then(async (jaSeguidos) => {
        const ids = new Set(jaSeguidos.map((p) => p.id));
        const pagina = await listarParlamentares({
          ordem: 'VOTACOES',
          tamanho: SUGESTOES_PARA_SEGUIR + ids.size,
        });
        setSeguidos(ids);
        setSugestoes(pagina.itens.filter((p) => !ids.has(p.id)).slice(0, SUGESTOES_PARA_SEGUIR));
      })
      .catch(() => setSugestoes([]));
  }, [usuario]);

  if (sugestoes.length === 0) return null;

  return (
    <section className="cartao-lateral">
      <h2>{T.sugestoes.titulo}</h2>

      <ul className="sugestoes">
        {sugestoes.map((p) => (
          <li key={p.id}>
            <Link to={`/parlamentar/${p.id}`} className="sugestao-link" title={T.sugestoes.dica(p.nome, p.partido, p.uf)}>
              <AvatarComponent nome={p.nome} fotoUrl={p.urlFoto} tamanho="medio" />
              <span className="sugestao-texto">
                <strong>{p.nome}</strong>
                <small>
                  {p.partido}
                  {p.uf && ` · ${p.uf}`}
                </small>
              </span>
            </Link>

            <BotaoSeguirComponent
              pessoaId={p.id}
              seguindo={seguidos.has(p.id)}
              aoAlternar={(id, agora) =>
                setSeguidos((atual) => {
                  const novo = new Set(atual);
                  if (agora) novo.add(id);
                  else novo.delete(id);
                  return novo;
                })
              }
            />
          </li>
        ))}
      </ul>

      <p className="criterio">{T.sugestoes.criterio}</p>

      <Link to="/parlamentares" className="ver-mais">
        {T.sugestoes.verTodos}
      </Link>
    </section>
  );
}
