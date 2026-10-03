import { useEffect, useState } from 'react';
import { aplicarTema, NOME_DO_TEMA, TEMAS, temaGuardado, type Tema } from '../tema';

/**
 * O interruptor de tema — três posições, no cabeçalho.
 *
 * DECISÃO: Segmentado, não um botão que alterna. Um botão de alternar consegue expressar
 * dois valores, e "seguir o sistema" é o terceiro — o mais importante, porque é o
 * padrão e o único que continua acompanhando o SO depois.
 */
export function SeletorDeTemaComponent() {
  const [tema, setTema] = useState<Tema>(temaGuardado);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  return (
    <div className="seletor-tema" role="group" aria-label="Tema da interface">
      {TEMAS.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={tema === opcao ? 'ativo' : ''}
          aria-pressed={tema === opcao}
          title={NOME_DO_TEMA[opcao]}
          aria-label={`Tema ${NOME_DO_TEMA[opcao].toLowerCase()}`}
          onClick={() => setTema(opcao)}
        >
          <IconeComponent tema={opcao} />
        </button>
      ))}
    </div>
  );
}

/**
 * ATENÇÃO: Desenhados à mão em vez de emoji: ☀️ e 🌙 mudam de forma e de cor conforme o
 * sistema, e num interruptor de 1,7rem isso vira ruído.
 *
 * Sistema: a tela do computador — é ele quem decide.
 */
function IconeComponent({ tema }: { tema: Tema }) {
  if (tema === 'claro') {
    return (
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4M15.8 15.8l-1.4-1.4M5.6 5.6 4.2 4.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (tema === 'escuro') {
    return (
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
        <path
          d="M16.3 12.4A6.9 6.9 0 0 1 7.6 3.7a6.9 6.9 0 1 0 8.7 8.7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
      <rect
        x="2.4" y="3.6" width="15.2" height="10.4" rx="1.6"
        fill="none" stroke="currentColor" strokeWidth="1.7"
      />
      <path d="M7 17h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
