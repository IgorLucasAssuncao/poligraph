import { useEffect, useState } from 'react';
import { TEXTO_CONSENTIMENTO, VERSAO_CONSENTIMENTO } from '../textos-legais';
import { CHAVE_CONSENTIMENTO, EVENTO_CONSENTIMENTO } from '../constantes';
import { lerConsentimento, type Escolha } from '../consentimento';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * RISCO: Banner de consentimento — bloqueante e obrigatório.
 *
 * O script de medição SÓ é carregado depois do aceite. Não basta o banner aparecer:
 * o `clarity.js` não pode ser injetado antes, senão o cookie já foi gravado.
 *
 * ATENÇÃO: O padrão de fábrica do Clarity NÃO cobre o Brasil — o Consent Mode obrigatório
 * vale para EEA, Reino Unido e Suíça. Aqui é preciso desligar "set cookies by default"
 * no painel e passar o sinal por este componente.
 *
 * ATENÇÃO: Lido aqui, não no escopo do módulo — senão o valor congela na importação
 * e o componente fica impossível de testar.
 *
 * DECISÃO: Mudou a versão do texto? O consentimento antigo não cobre o novo (art. 8º §2).
 *
 * DECISÃO: Sem ferramenta de medição configurada, não há o que consentir.
 * Mostrar o banner assim mesmo seria teatro de consentimento: pediria permissão para
 * algo que não acontece, e treinaria a pessoa a clicar em "aceitar" sem ler — que é
 * exatamente o hábito que torna o consentimento inútil quando ele passa a importar.
 *
 * ATENÇÃO: Mesmo peso visual nos dois botões (LGPD art. 9º §3): recusar não
 * pode ser mais difícil que aceitar. Sem "aceitar" em destaque.
 */
export function BannerConsentimentoComponent() {
  const clarityId = import.meta.env.VITE_CLARITY_ID;
  const [escolha, setEscolha] = useState<Escolha | null>(() => {
    const salvo = lerConsentimento();
    return salvo?.versao === VERSAO_CONSENTIMENTO ? salvo : null;
  });

  useEffect(() => {
    if (escolha?.aceito) ativarMedicao();
  }, [escolha]);

  if (!clarityId) return null;

  if (escolha) return null;

  return (
    <aside className="banner-consentimento" role="dialog" aria-labelledby="banner-titulo">
      <h2 id="banner-titulo">{TEXTO_CONSENTIMENTO.titulo}</h2>

      {TEXTO_CONSENTIMENTO.corpo.map((paragrafo) => (
        <p key={paragrafo} dangerouslySetInnerHTML={{ __html: negrito(paragrafo) }} />
      ))}

      <div className="banner-acoes">
        <button type="button" onClick={() => decidir(true)}>
          {TEXTO_CONSENTIMENTO.aceitar}
        </button>
        <button type="button" onClick={() => decidir(false)}>
          {TEXTO_CONSENTIMENTO.recusar}
        </button>
      </div>

      <p className="banner-rodape">
        {TEXTO_CONSENTIMENTO.rodape} <a href="/privacidade">{T.privacidade}</a>
      </p>
    </aside>
  );

  function decidir(aceito: boolean) {
    const nova: Escolha = {
      versao: VERSAO_CONSENTIMENTO,
      aceito,
      em: new Date().toISOString(),
    };

    guardarEscolha(nova);
    setEscolha(nova);
    window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));
  }
}

/** Sem armazenamento no navegador, a escolha vale só nesta visita. */
function guardarEscolha(escolha: Escolha): void {
  try {
    localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(escolha));
  } catch {
    return;
  }
}

/**
 * ATENÇÃO: Só aqui o script entra na página. Antes disto, nada é carregado.
 */
function ativarMedicao() {
  const id = import.meta.env.VITE_CLARITY_ID;
  if (!id || document.getElementById('clarity-js')) return;

  const script = document.createElement('script');
  script.id = 'clarity-js';
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${id}`;
  document.head.appendChild(script);

  window.clarity?.('consent', true);
}

function negrito(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

declare global {
  interface Window {
    clarity?: (comando: string, ...args: unknown[]) => void;
  }
}
