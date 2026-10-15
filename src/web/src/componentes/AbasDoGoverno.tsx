import { NavLink } from 'react-router-dom';
import { ABAS_DO_GOVERNO } from '../navegacao';
import { TEXTOS_DO_SITE as T } from '../textos/site';

/**
 * As abas de Governo federal: Orçamento, Cartões e Viagens. Cada uma é um endereço próprio; o
 * período escolhido vai junto na busca, para trocar de aba sem perder o recorte.
 */
export function AbasDoGovernoComponent({ busca }: { busca: string }) {
  return (
    <nav className="abas-do-governo" aria-label={T.abasDoGoverno.rotulo} data-tour="governo-abas">
      {ABAS_DO_GOVERNO.map((aba) => (
        <NavLink key={aba.para} to={`${aba.para}${busca}`} end={aba.fim} className="aba" viewTransition>
          {aba.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
