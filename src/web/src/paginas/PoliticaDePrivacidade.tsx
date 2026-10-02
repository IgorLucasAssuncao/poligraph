import { CONTATO, POLITICA_DE_PRIVACIDADE, VERSAO_CONSENTIMENTO } from '../textos-legais';
import { revogarConsentimento } from '../consentimento';

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
export function PoliticaDePrivacidade() {
  return (
    <article className="documento-legal">
      <div dangerouslySetInnerHTML={{ __html: paraHtml(POLITICA_DE_PRIVACIDADE) }} />

      <hr />

      <section className="acoes-legais">
        <h2>Suas escolhas</h2>

        <p>
          Você aceitou a versão <code>{VERSAO_CONSENTIMENTO}</code> deste texto. Se mudar
          de ideia sobre a medição de uso, pode refazer a escolha:
        </p>

        <button type="button" onClick={revogarConsentimento}>
          Rever meu consentimento
        </button>

        <p>
          Para pedir seus dados ou a exclusão da conta, escreva para{' '}
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
 */
function paraHtml(markdown: string): string {
  const linhas = markdown.split('\n');
  const saida: string[] = [];
  let emTabela = false;

  for (const linha of linhas) {
    if (linha.startsWith('|')) {
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

    if (linha.startsWith('### ')) saida.push(`<h3>${inline(linha.slice(4))}</h3>`);
    else if (linha.startsWith('## ')) saida.push(`<h2>${inline(linha.slice(3))}</h2>`);
    else if (linha.startsWith('# ')) saida.push(`<h1>${inline(linha.slice(2))}</h1>`);
    else if (linha.startsWith('- ')) saida.push(`<li>${inline(linha.slice(2))}</li>`);
    else if (linha.startsWith('---')) saida.push('<hr />');
    else if (linha.trim()) saida.push(`<p>${inline(linha)}</p>`);
  }

  if (emTabela) saida.push('</tbody></table>');

  return saida.join('\n');
}

function inline(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
