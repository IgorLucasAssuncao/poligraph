/**
 * Ícones em SVG inline.
 *
 * ⚠️ Sem biblioteca de propósito: são seis ícones. Trazer um pacote inteiro para isso
 * somaria centenas de KB ao bundle e uma dependência a justificar na banca.
 */

type Props = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconeExplorar({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Colunas sobre uma linha de base: o orçamento por área. */
export function IconeOrcamento({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 20h18" />
      <path d="M6 20v-7M11 20V5M16 20v-10" />
    </svg>
  );
}

export function IconeSeguindo({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
      <circle cx="9.5" cy="7.5" r="3.5" />
      <path d="m16.5 11.5 2 2 4-4" />
    </svg>
  );
}

export function IconeQuestionario({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h5M8 12h8M8 16h6" />
    </svg>
  );
}

export function IconeConta({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

export function IconeVoltar({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/** ⚠️ Marca do projeto — um grafo de três nós, que é o que o site faz. */
export function Marca({ className, tamanho = 28 }: Props & { tamanho?: number }) {
  return (
    <svg
      className={className}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="6" cy="17" r="2.6" />
      <circle cx="18" cy="17" r="2.6" />
      <circle cx="12" cy="6" r="2.6" />
      <path d="M8.4 15.4 10.4 8m3.2 0 2 7.4M8.6 17h6.8" />
    </svg>
  );
}

/** ⚠️ Três nós ligados — o mesmo desenho da marca, sem o preenchimento. */
export function IconeGrafo({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="16" r="2.2" />
      <circle cx="13" cy="5" r="2.2" />
      <path d="m6.6 16.3 5-9.4m1.9.5 4.6 8.4M7.2 18.4l9.6-1.3" />
    </svg>
  );
}
