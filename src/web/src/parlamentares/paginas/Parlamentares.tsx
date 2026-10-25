import { useSearchParams } from 'react-router-dom';
import { BarraDePeriodoComponent } from '../componentes/BarraDePeriodo';
import { ExplorarComponent } from './Explorar';
import { GrafoComponent } from '../../grafo/paginas/Grafo';
import { PoliticosComponent } from '../../politicos/paginas/Politicos';
import { TEXTOS_DOS_COMPONENTES as T } from '../../comum/textos/componentes';

type Vista = 'lista' | 'grafo' | 'cargos';

const VISTAS: { chave: Vista; rotulo: string; ajuda: string }[] = [
  { chave: 'lista', rotulo: T.vistas.lista, ajuda: T.vistas.listaAjuda },
  { chave: 'grafo', rotulo: T.vistas.grafo, ajuda: T.vistas.grafoAjuda },
  { chave: 'cargos', rotulo: T.vistas.cargos, ajuda: T.vistas.cargosAjuda },
];

/**
 * Os parlamentares, em duas vistas do MESMO conjunto.
 *
 * ATENÇÃO: Eram dois itens do menu principal — "Explorar" e "Grafo". A pergunta que as duas
 * respondem é a mesma ("quem são, e como se agrupam"), e separá-las no menu obrigava a
 * sair de uma tela para ver a outra forma do mesmo dado.
 *
 * DECISÃO: A vista vive na URL, não em estado local: `/parlamentares?vista=grafo` é um
 * endereço que se guarda e se compartilha, e o botão de voltar do navegador funciona
 * entre as duas.
 *
 * DECISÃO: Acima das duas vistas: o período vale para a lista e para o grafo. "Todos os
 * períodos" só na lista — não existe grafo de todas as legislaturas juntas.
 *
 * ATENÇÃO: `replace` para a troca de vista não empilhar histórico: cinco
 * alternâncias virariam cinco toques no botão de voltar.
 * O período fica: a escolha vale para as duas vistas.
 *
 * Pendência 90: a terceira vista, "Todos os cargos", lista governadores, prefeitos, deputados
 * estaduais e vices pelo TSE. Ela não tem legislatura, e o seletor de período some nela.
 *
 * Sem montar as duas e esconder uma: o grafo mede o contêiner para
 * dimensionar o canvas, e num contêiner oculto ele nasceria com altura zero.
 */
export function ParlamentaresComponent() {
  const [parametros, definirParametros] = useSearchParams();
  const pedida = parametros.get('vista');
  const vista: Vista = pedida === 'grafo' || pedida === 'cargos' ? pedida : 'lista';

  return (
    <>
      {vista !== 'cargos' && <BarraDePeriodoComponent comTodas={vista === 'lista'} />}

      <div className="abas-vista" data-tour="vistas" role="tablist" aria-label={T.vistas.rotulo}>
        {VISTAS.map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            role="tab"
            aria-selected={vista === opcao.chave}
            className={vista === opcao.chave ? 'ativo' : ''}
            title={opcao.ajuda}
            onClick={() => {
              definirParametros(
                (atuais) => {
                  const proximos = new URLSearchParams(atuais);
                  if (opcao.chave === 'lista') proximos.delete('vista');
                  else proximos.set('vista', opcao.chave);
                  return proximos;
                },
                { replace: true },
              );
            }}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      {vista === 'lista' && <ExplorarComponent />}
      {vista === 'grafo' && <GrafoComponent />}
      {vista === 'cargos' && <PoliticosComponent />}
    </>
  );
}
