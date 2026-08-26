import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSeguidos, type Parlamentar } from '../api';
import { CartaoParlamentar } from '../componentes/CartaoParlamentar';

/**
 * 🔴 Esta tela mostra a lista de convicção política da pessoa.
 *
 * É a materialização do que a LGPD art. 5º, II chama de dado sensível — e por isso
 * traz, aqui mesmo, o caminho para apagá-la.
 */
export function Seguindo() {
  const [lista, setLista] = useState<Parlamentar[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarSeguidos()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <p className="carregando">Carregando…</p>;

  return (
    <div className="seguindo">
      <h1>Acompanhando</h1>

      {lista.length === 0 ? (
        <p className="vazio">
          Você ainda não acompanha ninguém. <Link to="/explorar">Explore os deputados</Link>{' '}
          ou <Link to="/questionario">responda o questionário</Link>.
        </p>
      ) : (
        <>
          <div className="grade">
            {lista.map((p) => (
              <CartaoParlamentar
                key={p.id}
                id={p.id}
                nome={p.nome}
                partido={p.partido}
                uf={p.uf}
                seguindo
                aoAlternarSeguir={(id) => setLista((l) => l.filter((x) => x.id !== id))}
              />
            ))}
          </div>

          <p className="nota-privacidade">
            🔒 Esta lista indica sua posição política e é tratada como dado sensível.
            Ela não é compartilhada com ninguém.{' '}
            <Link to="/privacidade">Como apagar tudo</Link>
          </p>
        </>
      )}
    </div>
  );
}
