import { useEffect, useState } from 'react';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/** Quanto tempo o "Link copiado" fica à vista. */
const AVISO_MS = 2500;

/**
 * "Compartilhar": o link curto que mostra a prévia (decisão do autor, 2026-10-22). `/p/{id}` na ficha, com a foto e o
 * nome; `/c/{ibge}` na cidade e `/e/{cnpj}` na entidade, com prévia de texto.
 *
 * No celular abre o compartilhamento do sistema (`navigator.share`), que oferece WhatsApp e as redes. Sem ele,
 * copia o link e diz isso. A prévia sai do servidor (`/api/compartilhar`), porque quem a monta não roda o
 * JavaScript do site; o link leva à ficha.
 */
export function BotaoCompartilharComponent({ caminho, nome }: { caminho: string; nome: string }) {
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const espera = setTimeout(() => setAviso(null), AVISO_MS);
    return () => clearTimeout(espera);
  }, [aviso]);

  const compartilhar = async () => {
    const url = `${window.location.origin}${caminho}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: nome, text: T.compartilhar.texto(nome), url });
        return;
      } catch (erro) {
        if (erro instanceof DOMException && erro.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setAviso(T.compartilhar.copiado);
    } catch {
      setAviso(T.compartilhar.semCopiar(url));
    }
  };

  return (
    <span className="compartilhar">
      <button type="button" className="botao-secundario" onClick={() => void compartilhar()}>
        {T.compartilhar.rotulo}
      </button>
      <span className="compartilhar-aviso" role="status" aria-live="polite">
        {aviso}
      </span>
    </span>
  );
}
