import { useSearchParams } from 'react-router-dom';
import { BarraDePeriodo } from '../componentes/BarraDePeriodo';
import { Explorar } from './Explorar';
import { Grafo } from './Grafo';

type Vista = 'lista' | 'grafo';

const VISTAS: { chave: Vista; rotulo: string; ajuda: string }[] = [
  { chave: 'lista', rotulo: 'Lista', ajuda: 'Procurar por nome, partido ou estado' },
  { chave: 'grafo', rotulo: 'Grafo', ajuda: 'Quem vota com quem' },
];

/**
 * Os parlamentares, em duas vistas do MESMO conjunto.
 *
 * ⚠️ Eram dois itens do menu principal — "Explorar" e "Grafo". A pergunta que as duas
 * respondem é a mesma ("quem são, e como se agrupam"), e separá-las no menu obrigava a
 * sair de uma tela para ver a outra forma do mesmo dado.
 *
 * ⭐ A vista vive na URL, ⛔ não em estado local: `/parlamentares?vista=grafo` é um
 * endereço que se guarda e se compartilha, e o botão de voltar do navegador funciona
 * entre as duas.
 */
export function Parlamentares() {
  const [parametros, definirParametros] = useSearchParams();
  const vista: Vista = parametros.get('vista') === 'grafo' ? 'grafo' : 'lista';

  return (
    <>
      {/* ⭐ Acima das duas vistas: o período vale para a lista e para o grafo. "Todos os
          períodos" só na lista — ⛔ existe grafo de todas as legislaturas juntas. */}
      <BarraDePeriodo comTodas={vista === 'lista'} />

      <div className="abas-vista" data-tour="vistas" role="tablist" aria-label="Como ver os parlamentares">
        {VISTAS.map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            role="tab"
            aria-selected={vista === opcao.chave}
            className={vista === opcao.chave ? 'ativo' : ''}
            title={opcao.ajuda}
            onClick={() => {
              // ⚠️ `replace` para a troca de vista ⛔ não empilhar histórico: cinco
              //    alternâncias virariam cinco toques no botão de voltar.
              //    O período fica: a escolha vale para as duas vistas.
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

      {/* ⛔ Sem montar as duas e esconder uma: o grafo mede o contêiner para
          dimensionar o canvas, e num contêiner oculto ele nasceria com altura zero. */}
      {vista === 'lista' ? <Explorar /> : <Grafo />}
    </>
  );
}
