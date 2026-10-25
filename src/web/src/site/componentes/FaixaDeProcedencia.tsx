import { useLocation, useSearchParams } from 'react-router-dom';
import { periodoDaLegislatura } from '../../nucleo/formato';
import { ehDinheiroPublico } from '../../nucleo/navegacao';
import { useLegislaturaDaUrl, useLegislaturas } from '../../parlamentares/componentes/useLegislatura';
import { TEXTOS_DO_SITE as T } from '../textos/site';

/**
 * De onde vem o dado, dito antes de qualquer número — e de QUE PERÍODO.
 *
 * Esta faixa já existiu e saiu porque, somada ao cabeçalho fixo, deixava 110px presos na
 * tela. Voltou sem ser fixa: rola junto com a página, e só o cabeçalho fica. Custa uma
 * linha no topo e nada durante a leitura.
 *
 * ## RISCO: A faixa não afirma um período que a tela não mostra
 *
 * Ela dizia sempre "57ª legislatura" — inclusive sobre a lista de 2015–2019, onde a
 * própria página dizia outra coisa (2026-10-02). Agora o que ela diz depende da tela:
 *
 * | Tela | A faixa |
 * |---|---|
 * | Início e Parlamentares | O período escolhido, em texto. ATENÇÃO: O seletor esteve aqui e saiu: na tira escura, em letra pequena, ficava escondido. Ele mora na `BarraDePeriodo`, junto do conteúdo |
 * | Compare seu voto | "Perguntas da 57ª legislatura": o questionário é só da corrente |
 * | Ficha | Nada: a ficha mostra os mandatos da pessoa, e qual está aberto |
 * | Dinheiro público e o resto | Nada: lá o recorte é por ano, não por legislatura |
 */
export function FaixaDeProcedenciaComponent() {
  const { pathname } = useLocation();

  return (
    <div className="faixa-procedencia" data-tour="procedencia">
      <strong>{T.faixa.dadosPublicos}</strong>
      <span className="faixa-longa">{T.faixa.longa}</span>
      <span className="faixa-curta" aria-hidden="true">{T.faixa.curta}</span>
      <PeriodoDaFaixaComponent pathname={pathname} />
    </div>
  );
}

/**
 * DECISÃO: "Todos os períodos" só na lista: Não existe grafo nem painel de todas juntas.
 */
function PeriodoDaFaixaComponent({ pathname }: { pathname: string }) {
  const [parametros] = useSearchParams();
  const [escolha] = useLegislaturaDaUrl();
  const legislaturas = useLegislaturas();

  if (!legislaturas || legislaturas.length === 0) return null;
  const corrente = legislaturas[0].numero;

  if (pathname === '/resultado') return <span>{T.faixa.perguntasDa(corrente)}</span>;

  const escolhe = pathname === '/' || pathname === '/parlamentares';
  if (!escolhe || ehDinheiroPublico(pathname)) return null;

  const naLista = pathname === '/parlamentares' && parametros.get('vista') !== 'grafo';
  const atual = escolha === 'todas' && !naLista ? corrente : (escolha ?? corrente);

  return (
    <span className="faixa-periodo">
      {atual === 'todas' ? T.faixa.todos : T.faixa.legislatura(atual, periodoDaLegislatura(atual))}
    </span>
  );
}
