/**
 * Avatar por iniciais.
 *
 * ⚠️ Não há foto de parlamentar no banco — a Câmara publica, mas coletar e
 * rehospedar imagem de pessoa é outra discussão de licença e de LGPD que este
 * trabalho não abriu. Iniciais resolvem a leitura visual sem custo nenhum.
 */
export function Avatar({
  nome,
  fotoUrl,
  tamanho = 'medio',
}: {
  nome: string;
  fotoUrl?: string | null;
  tamanho?: 'pequeno' | 'medio' | 'grande';
}) {
  if (fotoUrl) {
    return (
      <img
        className={`avatar avatar-${tamanho}`}
        src={fotoUrl}
        alt=""
        // ⚠️ A URL de foto do Google expira e passa a dar 404 — cai para as iniciais.
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    );
  }

  return (
    <span
      className={`avatar avatar-${tamanho} avatar-iniciais`}
      style={{ background: corDe(nome) }}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Cor derivada do nome — estável entre recarregamentos.
 *
 * ⚠️ Tons neutros de propósito: cor de avatar não pode sugerir espectro político.
 * Verde e vermelho aqui seriam lidos como juízo (RNF-16).
 */
function corDe(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);

  const matiz = Math.abs(hash) % 360;
  return `hsl(${matiz} 22% 45%)`;
}
