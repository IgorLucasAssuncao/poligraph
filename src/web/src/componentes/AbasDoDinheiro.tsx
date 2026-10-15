import { NavLink } from 'react-router-dom';
import { ABAS_DO_DINHEIRO } from '../navegacao';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * As três portas para "para onde vai o dinheiro": a cidade, quem recebeu e o governo.
 *
 * DECISÃO: Abas, e não três itens na barra do site: é uma pergunta só, e a barra fica com as três
 * intenções de quem usa — parlamentares, comparar o voto, dinheiro público. Cada aba é um
 * endereço próprio, então o link compartilhado e o "voltar" do navegador continuam valendo.
 */
export function AbasDoDinheiroComponent() {
  return (
    <nav className="abas-do-dinheiro" aria-label={T.abasDoDinheiro}>
      {ABAS_DO_DINHEIRO.map((aba) => (
        <NavLink key={aba.para} to={aba.para} className="aba" viewTransition>
          {aba.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
