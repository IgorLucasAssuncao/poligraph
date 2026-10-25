import { createContext, useContext } from 'react';
import type { ConsultaDeProcedencia } from '../../nucleo/api';

/** O que o modo auditoria oferece às telas: se está ligado, como alternar e como abrir o painel. */
export type EstadoDoModoAuditoria = {
  ligado: boolean;
  alternar: () => void;
  abrir: (consulta: ConsultaDeProcedencia, rotulo: string) => void;
};

/** O contexto do modo, fora do arquivo dos componentes para a recarga rápida do Vite funcionar. */
export const ContextoDoModoAuditoria = createContext<EstadoDoModoAuditoria>({
  ligado: false,
  alternar: () => {},
  abrir: () => {},
});

export function useModoAuditoria(): EstadoDoModoAuditoria {
  return useContext(ContextoDoModoAuditoria);
}
