import { CONTATO, POLITICA_DE_PRIVACIDADE, VERSAO_CONSENTIMENTO } from '../../nucleo/textos-legais';
import { revogarConsentimento } from '../../nucleo/consentimento';
import { TEXTOS_DOS_COMPONENTES as T } from '../../comum/textos/componentes';

/**
 * A página de política de privacidade.
 *
 * RISCO: Ela é obrigatória por dois motivos independentes:
 *  1. A URL é campo OBRIGATÓRIO da tela de consentimento do Google — sem ela o app
 *     não passa de "Testing" para publicado.
 *  2. LGPD: é onde as finalidades, bases legais e direitos ficam declarados.
 *
 * ATENÇÃO: O texto é rascunho técnico, não peça jurídica revisada. Precisa passar pelo
 * orientador antes de o site ir ao ar.
 */
export function PoliticaDePrivacidadeComponent() {
  return (
    <article className="documento-legal">
      <div dangerouslySetInnerHTML={{ __html: paraHtml(POLITICA_DE_PRIVACIDADE) }} />

      <hr />

      <section className="acoes-legais">
        <h2>{T.privacidadePagina.escolhas}</h2>

        <p>{T.privacidadePagina.versao(VERSAO_CONSENTIMENTO)}</p>

        <button type="button" onClick={revogarConsentimento}>
          {T.privacidadePagina.rever}
        </button>

        <p>
          {T.privacidadePagina.contato}{' '}
          <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
        </p>
      </section>
    </article>
  );
}

/**
 * Markdown mínimo → HTML.
 *
 * ATENÇÃO: Deliberadamente sem biblioteca: a entrada é uma constante do próprio código, não
 * conteúdo de terceiro. Trazer um parser inteiro para renderizar um texto fixo seria
 * dependência sem problema que a justifique.
 *
 * `if (/^\|[\s|:-]+\|$/.test(linha)) continue;`: separador da tabela
 *
 * Linhas seguidas de texto formam um parágrafo só, como no Markdown: o negrito que começa
 * numa linha e termina na seguinte precisa ver as duas juntas, senão os asteriscos vão
 * para a tela.
 */
function paraHtml(markdown: string): string {
  const saida: string[] = [];
  let paragrafo: string[] = [];
  let emTabela = false;

  const fecharParagrafo = () => {
    if (paragrafo.length > 0) saida.push(`<p>${inline(paragrafo.join(' '))}</p>`);
    paragrafo = [];
  };

  for (const linha of markdown.split('\n')) {
    if (linha.startsWith('|')) {
      fecharParagrafo();
      if (/^\|[\s|:-]+\|$/.test(linha)) continue;

      const celulas = linha.split('|').slice(1, -1).map((c) => inline(c.trim()));
      if (!emTabela) {
        saida.push('<table><tbody>');
        emTabela = true;
      }
      saida.push(`<tr>${celulas.map((c) => `<td>${c}</td>`).join('')}</tr>`);
      continue;
    }

    if (emTabela) {
      saida.push('</tbody></table>');
      emTabela = false;
    }

    if (linha.startsWith('#') || linha.startsWith('- ') || linha.startsWith('---') || !linha.trim()) fecharParagrafo();

    if (linha.startsWith('### ')) saida.push(`<h3>${inline(linha.slice(4))}</h3>`);
    else if (linha.startsWith('## ')) saida.push(`<h2>${inline(linha.slice(3))}</h2>`);
    else if (linha.startsWith('# ')) saida.push(`<h1>${inline(linha.slice(2))}</h1>`);
    else if (linha.startsWith('- ')) saida.push(`<li>${inline(linha.slice(2))}</li>`);
    else if (linha.startsWith('---')) saida.push('<hr />');
    else if (linha.trim()) paragrafo.push(linha.trim());
  }

  fecharParagrafo();
  if (emTabela) saida.push('</tbody></table>');

  return saida.join('\n');
}

function inline(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
