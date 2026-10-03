/**
 * O que a figura mostra, em três frases.
 *
 * ## ATENÇÃO: Por que é texto fixo e não dado calculado
 *
 * A versão anterior montava faixas com contagem e governismo médio, mais um
 * contraexemplo derivado dos partidos. Era correto e era demais: quem abre o desenho
 * quer saber como lê-lo, não receber um relatório. A análise vive em
 * `docs/achados`, que é onde ela é útil.
 *
 * ## RISCO: O que as três frases precisam cobrir
 *
 * 1. A posição não **não** indica orientação política — é a leitura errada que a figura
 *    convida a fazer, e a única que precisa ser bloqueada.
 * 2. O que o desenho **faz**, e que o *"é só isso"* delimita: aproximar quem vota junto,
 *    e nada além disso.
 * 3. A borda não **não** é extremismo, é ausência de dado (achado #27).
 */
export function LegendaDoGrafoComponent() {
  return (
    <p className="legenda-grafo" data-tour="grafo-legenda">
      <strong>A posição não indica orientação política</strong>: quem vota junto se
      atrai, e é só isso que o desenho mostra. Nas bordas ficam os que votaram pouco
      demais para serem comparados com alguém.
    </p>
  );
}
