import { Link, useNavigate } from 'react-router-dom';
import { AbasDoDinheiroComponent } from '../../governo/componentes/AbasDoDinheiro';
import { CabecalhoDaColunaComponent } from '../../site/componentes/Layout';
import { nomeProprio } from '../../nucleo/formato';
import { guardarMinhaCidade, lerMinhaCidade } from '../../nucleo/minhaCidade';
import { TEXTOS_DA_CIDADE } from '../textos/cidade';
import { SuaCidadeComponent } from '../../inicio/componentes/SuaCidade';

const T = TEXTOS_DA_CIDADE.lista;

/**
 * A porta para a página de cada cidade, em "Dinheiro público" (avaliação heurística U23, 2026-10-22).
 *
 * DECISÃO: A página da cidade só se achava pela busca do cabeçalho e pelo painel da tela de emendas. Aqui a
 * pessoa escolhe a cidade pelo nome ou pela localização, a mesma busca da tela de emendas, e a escolha fica
 * guardada neste navegador, como lá.
 */
export function CidadesComponent() {
  const navegar = useNavigate();
  const guardada = lerMinhaCidade();

  return (
    <>
      <AbasDoDinheiroComponent />
      <CabecalhoDaColunaComponent titulo={T.titulo} subtitulo={T.subtitulo} />

      <section className="governo-secao">
        {guardada && (
          <p className="ajuda">
            {T.suaCidade}{' '}
            <Link to={`/cidades/${guardada.codigoIbge}`}>
              {nomeProprio(guardada.nome)} – {guardada.uf}
            </Link>
          </p>
        )}
        <SuaCidadeComponent
          aoEscolher={(m) => {
            guardarMinhaCidade(m);
            void navegar(`/cidades/${m.codigoIbge}`);
          }}
        />
        <p className="ajuda">{T.oQueTem}</p>
      </section>
    </>
  );
}
