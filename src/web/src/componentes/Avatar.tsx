import { useState } from 'react';

/**
 * As iniciais, com a foto oficial por cima quando houver.
 *
 * ATENÇÃO: A foto não é guardada no banco nem servida por nós: a URL é da Câmara ou do Senado.
 * Rehospedar imagem de pessoa é outra discussão de licença e de LGPD que este trabalho
 * Não abriu. O que se guarda é a cópia no NAVEGADOR do visitante (`fotos-sw.js`).
 *
 * DECISÃO: As iniciais ficam POR BAIXO e aparecem na hora. A foto da Câmara tem 30–41 KB e a
 * do Senado 170–330 KB (medido em 2026-10-01), para um quadrado de ~42 px: até ela
 * chegar, o lugar já tem rosto. Se ela falhar, as iniciais continuam — antes o código
 * só escondia a imagem e o espaço ficava vazio, embora o comentário dissesse o contrário.
 *
 * DECISÃO: `loading="lazy"`: numa lista de 30, só as fotos que aparecem na tela são pedidas.
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
  const [falhou, setFalhou] = useState<string | null>(null);

  return (
    <span
      className={`avatar avatar-${tamanho} avatar-iniciais`}
      style={{ background: corDe(nome) }}
      aria-hidden="true"
    >
      {iniciais(nome)}
      {fotoUrl && falhou !== fotoUrl && (
        <img
          className="avatar-foto"
          src={fotoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFalhou(fotoUrl)}
        />
      )}
    </span>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Cor derivada do nome — estável entre recarregamentos.
 *
 * ATENÇÃO: Tons neutros de propósito: cor de avatar não pode sugerir espectro político.
 * Verde e vermelho aqui seriam lidos como juízo (RNF-16).
 */
function corDe(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);

  const matiz = Math.abs(hash) % 360;
  return `hsl(${matiz} 22% 38%)`;
}
