import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { obterAcesso, quemSouEu, sair as sairDaApi, type Usuario } from './api';

type Sessao = {
  usuario: Usuario | null;
  carregando: boolean;
  /** Se quem não entrou pode ler o site. Desligado no período eleitoral (RNF-17). */
  leituraPublica: boolean;
  entrou: (usuario: Usuario) => void;
  sair: () => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

/**
 * Estado de sessão do aplicativo.
 *
 * ATENÇÃO: A verdade sobre "estou logado?" vem do SERVIDOR, sempre. O front pergunta
 * `GET /api/auth/eu` ao carregar; não há flag em `localStorage` dizendo que a pessoa
 * está logada — isso seria mentira contável, já que o cookie pode ter expirado ou a
 * sessão ter sido revogada em outro aparelho.
 */
export function ProvedorDeSessao({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [leituraPublica, setLeituraPublica] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([
      quemSouEu().then(setUsuario).catch(() => setUsuario(null)),
      obterAcesso().then((a) => setLeituraPublica(a.leituraPublica)),
    ]).finally(() => setCarregando(false));
  }, []);

  const sair = useCallback(async () => {
    await sairDaApi();
    setUsuario(null);
  }, []);

  return (
    <Contexto.Provider value={{ usuario, carregando, leituraPublica, entrou: setUsuario, sair }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSessao(): Sessao {
  const sessao = useContext(Contexto);
  if (!sessao) throw new Error('useSessao precisa estar dentro de ProvedorDeSessao.');

  return sessao;
}
