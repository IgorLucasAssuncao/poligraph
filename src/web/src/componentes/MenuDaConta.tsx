import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessao } from '../sessao';
import { Avatar } from './Avatar';
import { useTour } from './contextoDoTour';
import { SeletorDeTema } from './SeletorDeTema';

/**
 * A conta, o tema e o tour num botão só.
 *
 * ⭐ Eram quatro controles soltos na barra — "Como funciona", o tema, o nome e "Sair" —
 * disputando atenção com a navegação. São coisas que se usam uma vez por visita, ou nenhuma:
 * cabem atrás de um clique.
 *
 * Padrão de revelação (botão que abre um painel), ⛔ `role="menu"`: o painel tem o
 * interruptor de tema, que ⛔ é item de menu, e o padrão de menu do WAI-ARIA exigiria
 * setas para andar entre os itens. Tab e Esc bastam aqui.
 *
 * ⚠️ "Entrar" fica FORA do menu para quem ⛔ entrou: é a ação principal dessa pessoa.
 */
export function MenuDaConta() {
  const { usuario, sair } = useSessao();
  const { iniciar } = useTour();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const primeiroNome = usuario?.nome?.split(' ')[0] ?? 'Conta';

  return (
    <div className="menu-conta" ref={caixa}>
      {!usuario && (
        <Link to="/resultado" className="botao-secundario">
          Entrar
        </Link>
      )}

      <button
        type="button"
        className="menu-conta-botao"
        aria-expanded={aberto}
        aria-controls={id}
        data-tour="como-funciona"
        onClick={() => setAberto((a) => !a)}
      >
        {usuario ? (
          <>
            <Avatar nome={usuario.nome ?? '?'} fotoUrl={usuario.fotoUrl} tamanho="pequeno" />
            <span className="usuario-mini-nome">{primeiroNome}</span>
          </>
        ) : (
          <span>Menu</span>
        )}
        <span aria-hidden="true" className="menu-conta-seta">
          ▾
        </span>
      </button>

      {aberto && (
        <div className="menu-conta-painel" id={id}>
          {usuario && (
            <Link to="/conta" onClick={() => setAberto(false)}>
              Minha conta
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              iniciar();
            }}
          >
            Como funciona o site
          </button>
          <div className="menu-conta-tema">
            <span>Tema</span>
            <SeletorDeTema />
          </div>
          {usuario && (
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                sair();
              }}
            >
              Sair
            </button>
          )}
        </div>
      )}
    </div>
  );
}
