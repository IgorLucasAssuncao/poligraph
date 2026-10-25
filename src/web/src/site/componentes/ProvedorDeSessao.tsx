import { useCallback, useEffect, useState } from 'react';
import { obterAcesso, quemSouEu, sair as sairDaApi, type Usuario } from '../../nucleo/api';
import { ContextoDaSessao } from '../../nucleo/sessao';

/**
 * Estado de sessão do aplicativo.
 *
 * ATENÇÃO: A verdade sobre "estou logado?" vem do SERVIDOR, sempre. O front pergunta
 * `GET /api/auth/eu` ao carregar; não há flag em `localStorage` dizendo que a pessoa
 * está logada — isso seria mentira contável, já que o cookie pode ter expirado ou a
 * sessão ter sido revogada em outro aparelho.
 */
export function ProvedorDeSessaoComponent({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [leituraPublica, setLeituraPublica] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void Promise.all([
      quemSouEu().then(setUsuario).catch(() => setUsuario(null)),
      obterAcesso().then((a) => setLeituraPublica(a.leituraPublica)).catch(() => setLeituraPublica(false)),
    ]).finally(() => setCarregando(false));
  }, []);

  const sair = useCallback(async () => {
    await sairDaApi();
    setUsuario(null);
  }, []);

  return (
    <ContextoDaSessao.Provider value={{ usuario, carregando, leituraPublica, entrou: setUsuario, sair }}>
      {children}
    </ContextoDaSessao.Provider>
  );
}

