import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSeguidos, type Parlamentar } from '../api';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';

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

  return (
    <>
      <CabecalhoDaColuna
        titulo="Seguindo"
        subtitulo={lista.length > 0 ? `${lista.length} parlamentares` : undefined}
      />

      {carregando && <p className="carregando">Carregando…</p>}

      {!carregando && lista.length === 0 && (
        <p className="vazio">
          Você ainda não segue ninguém. <Link to="/explorar">Explore os deputados</Link> ou{' '}
          <Link to="/questionario">responda o questionário</Link>.
        </p>
      )}

      {lista.map((p) => (
        <LinhaParlamentar
          key={p.id}
          id={p.id}
          nome={p.nome}
          partido={p.partido}
          uf={p.uf}
          seguindo
          aoAlternarSeguir={(id) => setLista((l) => l.filter((x) => x.id !== id))}
        />
      ))}

      {!carregando && lista.length > 0 && (
        <p className="nota-privacidade">
          🔒 Esta lista indica sua posição política e é tratada como dado sensível. Ela não é
          compartilhada com ninguém. <Link to="/conta">Como apagar tudo</Link>
        </p>
      )}
    </>
  );
}
