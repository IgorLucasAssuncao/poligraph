import { useEffect, useState } from 'react';
import { TEXTO_CONSENTIMENTO, VERSAO_CONSENTIMENTO } from '../textos-legais';

import {
  CHAVE_CONSENTIMENTO,
  EVENTO_CONSENTIMENTO,
  lerConsentimento,
  type Escolha,
} from '../consentimento';

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
export function BannerConsentimento() {
  const clarityId = import.meta.env.VITE_CLARITY_ID;
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const salvo = lerConsentimento();

    if (salvo?.versao === VERSAO_CONSENTIMENTO) {
      setEscolha(salvo);
      if (salvo.aceito) ativarMedicao();
    }

    setCarregado(true);
  }, []);

  if (!clarityId) return null;

  if (!carregado || escolha) return null;

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
        {TEXTO_CONSENTIMENTO.rodape} <a href="/privacidade">Política de privacidade</a>
      </p>
    </aside>
  );

  function decidir(aceito: boolean) {
    const nova: Escolha = {
      versao: VERSAO_CONSENTIMENTO,
      aceito,
      em: new Date().toISOString(),
    };

    localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(nova));
    setEscolha(nova);
    window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));

    if (aceito) ativarMedicao();
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
