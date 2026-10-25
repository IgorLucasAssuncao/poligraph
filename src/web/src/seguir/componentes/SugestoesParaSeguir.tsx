import { useState } from 'react';
import { nomeDePessoa } from '../../nucleo/formato';
import { Link } from 'react-router-dom';
import { listarParlamentares } from '../../nucleo/api';
import { AvatarComponent } from '../../comum/componentes/Avatar';
import { BotaoSeguirComponent } from './BotaoSeguir';
import { useSessao } from '../../nucleo/sessao';
import { useCarga } from '../../comum/componentes/useCarga';
import { marcarSeguido, useSeguidos } from './useSeguidos';
import { SUGESTOES_PARA_SEGUIR } from '../../nucleo/constantes';
import { TEXTOS_DOS_COMPONENTES as T } from '../../comum/textos/componentes';

const SEM_NINGUEM: ReadonlySet<number> = new Set();

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
 *
 * ATENÇÃO: Sai quem a pessoa já seguia quando o cartão abriu. Quem ela segue por aqui fica, com "Seguindo": sumir no
 * clique levaria junto o convite de avisos que o botão abre.
 */
export function SugestoesParaSeguirComponent() {
  const { usuario } = useSessao();
  const seguidos = useSeguidos();
  const [jaSeguia, setJaSeguia] = useState<ReadonlySet<number> | null>(null);
  if (usuario && seguidos.lista && jaSeguia === null) setJaSeguia(seguidos.ids);
  const fora = usuario ? jaSeguia : SEM_NINGUEM;

  const lida = useCarga(
    ['sugestoes-para-seguir', fora?.size ?? null],
    () => listarParlamentares({ ordem: 'VOTACOES', tamanho: SUGESTOES_PARA_SEGUIR + (fora?.size ?? 0) }),
    { ativo: fora !== null },
  );
  const sugestoes = (lida.dados?.itens ?? [])
    .filter((p) => !usuario || (p.emExercicio !== false && !fora?.has(p.idPessoa)))
    .slice(0, SUGESTOES_PARA_SEGUIR);

  if (sugestoes.length === 0) return null;

  return (
    <section className="cartao-lateral">
      <h2>{T.sugestoes.titulo}</h2>

      <ul className="sugestoes">
        {sugestoes.map((p) => (
          <li key={p.idPessoa}>
            <Link to={`/parlamentar/${p.idPessoa}`} className="sugestao-link" title={T.sugestoes.dica(p.nome, p.partido, p.uf)}>
              <AvatarComponent nome={nomeDePessoa(p.nome)} fotoUrl={p.urlFoto} tamanho="medio" />
              <span className="sugestao-texto">
                <strong>{nomeDePessoa(p.nome)}</strong>
                <small>
                  {p.partido}
                  {p.uf && ` · ${p.uf}`}
                </small>
              </span>
            </Link>

            <BotaoSeguirComponent
              idPessoa={p.idPessoa}
              seguindo={seguidos.ids.has(p.idPessoa)}
              aoAlternar={marcarSeguido}
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
