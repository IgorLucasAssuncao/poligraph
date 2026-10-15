import { createContext, useContext } from 'react';
import type { Usuario } from './api';

export type Sessao = {
  usuario: Usuario | null;
  carregando: boolean;
  /** Se quem não entrou pode ler o site. Desligado no período eleitoral (RNF-17). */
  leituraPublica: boolean;
  entrou: (usuario: Usuario) => void;
  sair: () => Promise<void>;
};

/** O contexto da sessão; o provedor fica em `componentes/ProvedorDeSessao.tsx`. */
export const ContextoDaSessao = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const sessao = useContext(ContextoDaSessao);
  if (!sessao) throw new Error('useSessao precisa estar dentro de ProvedorDeSessao.');

  return sessao;
}
