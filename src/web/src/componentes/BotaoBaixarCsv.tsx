import { useState } from 'react';

/**
 * "Baixar CSV" — para quem quer levar o dado para a planilha.
 *
 * DECISÃO: `montar` busca o que for preciso na hora do clique: a lista inteira, e não só a
 * página que está na tela.
 */
export function BotaoBaixarCsv({ rotulo = 'Baixar CSV', montar }: { rotulo?: string; montar: () => Promise<void> | void }) {
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
        {baixando ? 'Preparando…' : rotulo}
      </button>
      {erro && <span className="erro">Não foi possível baixar. Tente de novo.</span>}
    </span>
  );
}
