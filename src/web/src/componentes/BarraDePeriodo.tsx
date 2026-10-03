import { periodoDaLegislatura } from '../formato';
import { SeletorDeLegislaturaComponent } from './SeletorDeLegislatura';
import { TermoComponent } from './Termo';
import { useLegislaturaDaUrl, useLegislaturas } from './useLegislatura';
import { TEXTOS_DO_SITE as T } from '../textos/site';

/**
 * A escolha do período, no alto do conteúdo — o Início e os Parlamentares.
 *
 * ## Por que saiu da faixa do topo
 *
 * Na faixa escura, em letra pequena, ela ficou "muito escondida" (autor, 2026-10-02): é a
 * escolha que muda todos os números da tela, e estava no lugar que o olho pula. GOV.UK e
 * USWDS põem o filtro que muda a página junto do conteúdo que ele filtra.
 *
 * ## Câmara e Senado
 *
 * A legislatura é do **Congresso**, não só da Câmara: os quatro anos valem para as duas
 * casas (Constituição, art. 44). O senador tem mandato de oito anos e aparece em duas.
 * A barra diz isso, porque "57ª legislatura" ao lado do Senado parece coisa de deputado.
 *
 * ATENÇÃO: Num período passado, o aviso é forte de propósito: a tela inteira está em 2015–2019,
 * e quem chegou por um link guardado precisa saber que não está vendo o presente.
 */
export function BarraDePeriodoComponent({ comTodas = false }: { comTodas?: boolean }) {
  const [escolha, definir] = useLegislaturaDaUrl();
  const legislaturas = useLegislaturas();

  if (!legislaturas || legislaturas.length < 2) return null;

  const corrente = legislaturas[0].numero;
  const atual = escolha === 'todas' && !comTodas ? corrente : (escolha ?? corrente);
  const passada = typeof atual === 'number' && atual !== corrente;

  return (
    <section className={`barra-periodo${passada ? ' barra-periodo-passada' : ''}`} aria-label={T.periodo.rotulo}>
      <div className="barra-periodo-linha">
        <span className="barra-periodo-rotulo">
          <TermoComponent nome="legislatura">{T.periodo.legislatura}</TermoComponent>
        </span>
        <SeletorDeLegislaturaComponent
          opcoes={legislaturas.map((l) => l.numero)}
          atual={atual}
          aoTrocar={definir}
          comTodas={comTodas}
          rotulo={T.periodo.seletor}
          rotuloVisivel={false}
        />
        <span className="barra-periodo-ajuda">
          {atual === 'todas' ? T.periodo.todas : T.periodo.mesmoPeriodo(atual)}
        </span>
      </div>

      {passada && (
        <p className="barra-periodo-aviso" role="status">
          {T.periodo.anterior(periodoDaLegislatura(atual))}{' '}
          <button type="button" className="botao-link" onClick={() => definir(undefined)}>
            {T.periodo.voltarPara(periodoDaLegislatura(corrente))}
          </button>
        </p>
      )}
    </section>
  );
}
