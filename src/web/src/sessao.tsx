import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { quemSouEu, sair as sairDaApi, type Usuario } from './api';

type Sessao = {
  usuario: Usuario | null;
  carregando: boolean;
  entrou: (usuario: Usuario) => void;
  sair: () => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

/**
 * Estado de sessão do aplicativo.
 *
 * ⚠️ A verdade sobre "estou logado?" vem do SERVIDOR, sempre. O front pergunta
 * `GET /api/auth/eu` ao carregar; não há flag em `localStorage` dizendo que a pessoa
 * está logada — isso seria mentira contável, já que o cookie pode ter expirado ou a
 * sessão ter sido revogada em outro aparelho.
 */
export function ProvedorDeSessao({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    quemSouEu()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  const sair = useCallback(async () => {
    await sairDaApi();
    setUsuario(null);
  }, []);

  return (
    <Contexto.Provider value={{ usuario, carregando, entrou: setUsuario, sair }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSessao(): Sessao {
  const sessao = useContext(Contexto);
  if (!sessao) throw new Error('useSessao precisa estar dentro de ProvedorDeSessao.');

  return sessao;
}
