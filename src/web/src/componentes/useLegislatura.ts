import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarLegislaturas, type Legislatura } from '../api';

/** O que a URL pode pedir: uma legislatura, todas (só a lista aceita), ou nada — a corrente. */
export type EscolhaDeLegislatura = number | 'todas' | undefined;

/**
 * A legislatura escolhida, guardada em `?legislatura=`.
 *
 * ⭐ Na URL, ⛔ em estado local: a lista, o grafo e a página inicial leem o mesmo
 * parâmetro, e trocar de aba ⛔ desfaz a escolha. O endereço com o período se guarda e
 * se compartilha.
 *
 * ⚠️ `replace`, como a troca de vista: cinco trocas de período ⛔ viram cinco toques no
 * botão de voltar.
 */
export function useLegislaturaDaUrl(): [EscolhaDeLegislatura, (nova: EscolhaDeLegislatura) => void] {
  const [parametros, definirParametros] = useSearchParams();
  const bruto = parametros.get('legislatura');
  const escolha: EscolhaDeLegislatura =
    bruto === 'todas' ? 'todas' : bruto && /^\d+$/.test(bruto) ? Number(bruto) : undefined;

  function definir(nova: EscolhaDeLegislatura) {
    definirParametros(
      (atuais) => {
        const proximos = new URLSearchParams(atuais);
        if (nova === undefined) proximos.delete('legislatura');
        else proximos.set('legislatura', String(nova));
        return proximos;
      },
      { replace: true },
    );
  }

  return [escolha, definir];
}

/**
 * As legislaturas da base. Uma requisição por carga da página: a lista só muda quando o
 * ETL ingere uma legislatura nova.
 */
let pedido: Promise<Legislatura[]> | null = null;

export function useLegislaturas(): Legislatura[] | null {
  const [legislaturas, setLegislaturas] = useState<Legislatura[] | null>(null);

  useEffect(() => {
    let atual = true;
    pedido ??= listarLegislaturas().catch(() => {
      pedido = null;
      return [];
    });
    pedido.then((l) => atual && setLegislaturas(l));
    return () => {
      atual = false;
    };
  }, []);

  return legislaturas;
}
