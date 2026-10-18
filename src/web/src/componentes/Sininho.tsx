import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSeguidos, obterNovidades } from '../api';
import type { Novidades } from '../api';
import { CHAVE_NOVIDADES_VISTAS } from '../constantes';
import { useSessao } from '../sessao';
import { TEXTOS_DOS_AVISOS } from '../textos/avisos';
import { AvisosNoNavegadorComponent } from './AvisosNoNavegador';
import { IconeSinoComponent } from './Icones';
import { montarItens, ultimaCarga } from './itensDoQueMudou';
import './oQueMudou.css';
import './sininho.css';

const T = TEXTOS_DOS_AVISOS.sininho;

/** Quantas novidades o painel mostra; o resto fica no "O que mudou" do início. */
const MAXIMO_NO_PAINEL = 5;

/**
 * O sininho do cabeçalho (Pendência 89): as últimas novidades de quem a pessoa segue e o
 * interruptor dos avisos neste navegador. Só aparece para quem entrou.
 *
 * DECISÃO: A contagem é das novidades que este navegador ainda não mostrou, e zera ao abrir o
 * painel. O número vai num selo retangular de raio pequeno, na fonte de dado, como todo número
 * do site; bolinha vermelha seria a linguagem de rede social e leria como alarme.
 *
 * ATENÇÃO: Padrão de revelação, como o menu da conta: botão que abre um painel, Tab e Esc.
 *
 * RISCO: O dado diz quem a pessoa segue, então fica fora do cache de leituras, como o
 * "O que mudou" do início.
 */
export function SininhoComponent() {
  const { usuario } = useSessao();
  const [novidades, setNovidades] = useState<Novidades | null>(null);
  const [seguidos, setSeguidos] = useState<number | null>(null);
  const [destaque, setDestaque] = useState<string[]>([]);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [vistas, setVistas] = useState<string[]>(lerVistas);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!usuario) return;
    let atual = true;
    Promise.all([obterNovidades(), listarSeguidos()])
      .then(([n, lista]) => {
        if (!atual) return;
        setNovidades(n);
        setSeguidos(lista.length);
      })
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [usuario]);

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

  if (!usuario) return null;

  const itens = novidades ? montarItens(novidades).filter((item) => !item.chave.startsWith('semana-')) : [];
  const novas = itens.filter((item) => !vistas.includes(item.chave)).length;
  const segueAlguem = (seguidos ?? 0) > 0;
  const carga = novidades ? ultimaCarga(novidades) : null;

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
          <div className="sininho-cabeca">
            <p className="sininho-titulo">{T.titulo}</p>
            {T.base(carga) && <p className="ajuda">{T.base(carga)}</p>}
          </div>

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
            <ul className="lista-novidades sininho-lista">
              {itens.slice(0, MAXIMO_NO_PAINEL).map((item) => (
                <li key={item.chave} className={destaque.includes(item.chave) ? 'novidade-nova' : undefined}>
                  <span className="novidade-data">{item.quando}</span>
                  <p className="novidade-texto">{item.texto}</p>
                </li>
              ))}
            </ul>
          )}

          {segueAlguem && (
            <Link to="/" className="sininho-ver-tudo" onClick={() => setAberto(false)}>
              {T.verTudo}
            </Link>
          )}

          <AvisosNoNavegadorComponent />
        </div>
      )}
    </div>
  );

  function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    const todas = itens.map((item) => item.chave);
    setDestaque(todas.filter((chave) => !vistas.includes(chave)));
    setVistas(todas);
    gravarVistas(todas);
  }
}

function lerVistas(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_NOVIDADES_VISTAS);
    return bruto ? (JSON.parse(bruto) as string[]) : [];
  } catch {
    return [];
  }
}

function gravarVistas(chaves: string[]): void {
  try {
    localStorage.setItem(CHAVE_NOVIDADES_VISTAS, JSON.stringify(chaves));
  } catch {
    return;
  }
}
