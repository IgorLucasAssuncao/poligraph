import { useState } from 'react';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * "Baixar CSV" — para quem quer levar o dado para a planilha.
 *
 * DECISÃO: `montar` busca o que for preciso na hora do clique: a lista inteira, e não só a
 * página que está na tela.
 */
export function BotaoBaixarCsvComponent({ rotulo = T.baixarCsv.rotulo, montar }: { rotulo?: string; montar: () => Promise<void> | void }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState(false);

  async function baixar() {
    setBaixando(true);
    setErro(false);
    try {
      await montar();
    } catch {
      setErro(true);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <span className="baixar-csv">
      <button type="button" className="botao-texto" onClick={baixar} disabled={baixando}>
        {baixando ? T.baixarCsv.preparando : rotulo}
      </button>
      {erro && <span className="erro">{T.baixarCsv.erro}</span>}
    </span>
  );
}
