import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarSeguidos, obterNovidades } from '../api';
import type { Novidades } from '../api';
import { CHAVE_NOVIDADES_VISTAS } from '../constantes';
import { useSessao } from '../sessao';
import { TEXTOS_DOS_AVISOS } from '../textos/avisos';
import { AvisosNoNavegadorComponent } from './AvisosNoNavegador';
import { IconeSinoComponent } from './Icones';
import { montarItens } from './itensDoQueMudou';
import './oQueMudou.css';
import './sininho.css';

const T = TEXTOS_DOS_AVISOS.sininho;

/** Quantas novidades o painel mostra; o resto fica no "O que mudou" do início. */
const MAXIMO_NO_PAINEL = 5;

/**
 * O sininho do cabeçalho (Pendência 89): as últimas novidades de quem a pessoa segue e o
 * interruptor dos avisos neste navegador. Só aparece para quem entrou.
 *
 * DECISÃO: A contagem é das novidades que este navegador ainda não mostrou. Some com o painel
 * aberto, e o que estava na lista passa a visto ao fechar. O número vai num selo retangular de raio pequeno, na fonte de dado, como todo número
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
    const fecharMarcando = () => {
      setAberto(false);
      const chaves = itensDoSininho(novidades).map((item) => item.chave);
      setVistas(chaves);
      gravarVistas(chaves);
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
  }, [aberto, novidades]);

  if (!usuario) return null;

  const itens = itensDoSininho(novidades);
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
            <ul className="lista-novidades sininho-lista">
              {itens.slice(0, MAXIMO_NO_PAINEL).map((item) => (
                <li key={item.chave} className={vistas.includes(item.chave) ? undefined : 'novidade-nova'}>
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

  /** Abre; ao fechar, o que estava na lista passa a visto. Marcar ao abrir perdia as novidades que chegavam depois do clique. */
  function alternar() {
    if (!aberto) {
      setAberto(true);
      return;
    }
    setAberto(false);
    const chaves = itens.map((item) => item.chave);
    setVistas(chaves);
    gravarVistas(chaves);
  }
}

/** As novidades do sininho: as do "O que mudou", sem os votos da semana, que não avisam (Pendência 89). */
function itensDoSininho(novidades: Novidades | null) {
  return novidades ? montarItens(novidades).filter((item) => !item.chave.startsWith('semana-')) : [];
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
