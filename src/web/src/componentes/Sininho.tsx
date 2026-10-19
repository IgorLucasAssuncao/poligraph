import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessao } from '../sessao';
import { TEXTOS_DOS_AVISOS } from '../textos/avisos';
import { IconeSinoComponent } from './Icones';
import { ListaDeNovidadesComponent } from './ListaDeNovidades';
import { ModalDeNovidadesComponent } from './ModalDeNovidades';
import { novidadesQueContam, useNovidadesVistas } from './useNovidadesVistas';
import { useNovidades } from './useNovidades';
import './sininho.css';

const T = TEXTOS_DOS_AVISOS.sininho;

/** Quantas novidades o painel mostra; o resto fica no bloco de novidades do início. */
const MAXIMO_NO_PAINEL = 5;

/**
 * O sininho do cabeçalho (Pendência 89): as últimas novidades de quem a pessoa segue. Só aparece
 * para quem entrou. Os avisos no navegador são convidados ao seguir e ficam na página da conta.
 *
 * DECISÃO: A contagem é das novidades que este navegador ainda não mostrou. Some com o painel
 * aberto, e o que estava na lista passa a visto ao fechar. O número vai num selo retangular de
 * raio pequeno, na fonte de dado, como todo número do site; bolinha vermelha seria a linguagem de
 * rede social e leria como alarme.
 *
 * ATENÇÃO: Padrão de revelação, como o menu da conta: botão que abre um painel, Tab e Esc.
 *
 * RISCO: O dado diz quem a pessoa segue, então fica fora do cache de leituras, como o
 * bloco de novidades do início.
 */
export function SininhoComponent() {
  const { usuario } = useSessao();
  const { novidades, seguidos, erro } = useNovidades(usuario !== null);
  const [aberto, setAberto] = useState(false);
  const [porParlamentar, setPorParlamentar] = useState(false);
  const { vistas, marcar } = useNovidadesVistas();
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const fecharMarcando = () => {
      setAberto(false);
      marcar(novidadesQueContam(novidades).map((item) => item.chave));
    };
    const aoClicarFora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) fecharMarcando();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharMarcando();
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto, novidades, marcar]);

  if (!usuario) return null;

  const itens = novidadesQueContam(novidades);
  const novas = aberto ? 0 : itens.filter((item) => !vistas.includes(item.chave)).length;
  const segueAlguem = (seguidos ?? 0) > 0;

  return (
    <div className="sininho" ref={caixa}>
      <button
        type="button"
        className="sininho-botao"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={T.rotulo(novas)}
        title={T.titulo}
        onClick={alternar}
      >
        <IconeSinoComponent />
        {novas > 0 && (
          <span className="sininho-selo" aria-hidden="true">
            {novas > 9 ? '9+' : novas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="sininho-painel" id={id}>
          <p className="sininho-titulo">{T.titulo}</p>

          {erro && <p className="ajuda">{T.erro}</p>}

          {!erro && seguidos === 0 && (
            <p className="vazio">
              {T.ninguem}{' '}
              <Link to="/parlamentares" onClick={() => setAberto(false)}>
                {T.procurar}
              </Link>
            </p>
          )}

          {!erro && segueAlguem && novidades && itens.length === 0 && <p className="vazio">{T.nadaNovo}</p>}

          {itens.length > 0 && (
            <ListaDeNovidadesComponent
              itens={itens.slice(0, MAXIMO_NO_PAINEL)}
              nova={(chave) => !vistas.includes(chave)}
              comFonte={false}
            />
          )}

          {segueAlguem && novidades && (
            <button
              type="button"
              className="botao-link sininho-ver-tudo"
              aria-haspopup="dialog"
              onClick={() => {
                setAberto(false);
                setPorParlamentar(true);
              }}
            >
              {T.verTudo}
            </button>
          )}

        </div>
      )}

      {novidades && (
        <ModalDeNovidadesComponent
          aberto={porParlamentar}
          novidades={novidades}
          vistas={vistas}
          aoFechar={() => {
            setPorParlamentar(false);
            marcar(itens.map((item) => item.chave));
          }}
        />
      )}
    </div>
  );

  /** Abre; ao fechar, o que estava na lista passa a visto. Marcar ao abrir perdia as novidades que chegavam depois do clique. */
  function alternar() {
    if (!aberto) {
      setAberto(true);
      return;
    }
    setAberto(false);
    marcar(itens.map((item) => item.chave));
  }
}
