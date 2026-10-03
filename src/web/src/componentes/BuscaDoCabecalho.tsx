import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarTudo, type Busca } from '../api';
import { nomeProprio, periodoDaLegislatura } from '../formato';
import { IconeExplorarComponent } from './Icones';

/**
 * Uma caixa, três tipos de resposta: parlamentar, cidade e entidade.
 *
 * DECISÃO: Quem chega com um nome não sabe em que página ele está — "São Paulo" é cidade, é parte
 * de nome de entidade e de parlamentar. A busca responde nos três grupos, e a pessoa escolhe.
 *
 * Combobox do WAI-ARIA: as setas andam pelas opções sem tirar o foco da caixa, Enter abre a
 * opção ativa (ou a primeira) e Esc fecha. O leitor de tela anuncia a opção pelo
 * `aria-activedescendant`.
 */
export function BuscaDoCabecalhoComponent() {
  const [termo, setTermo] = useState('');
  const [resposta, setResposta] = useState<Busca | null>(null);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const [expandida, setExpandida] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();
  const id = useId();
  const buscando = termo.trim().length >= 2;

  useEffect(() => {
    if (!buscando) return;
    let atual = true;
    const espera = setTimeout(() => {
      buscarTudo(termo.trim())
        .then((nova) => {
          if (!atual) return;
          setResposta(nova);
          setAtiva(0);
        })
        .catch(() => atual && setResposta(null));
    }, 250);
    return () => {
      atual = false;
      clearTimeout(espera);
    };
  }, [termo, buscando]);

  useEffect(() => {
    if (!aberta) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberta(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberta]);

  const opcoes = buscando && resposta ? opcoesDa(resposta) : [];
  const mostrar = aberta && buscando && resposta !== null;

  const escolher = (destino: string) => {
    setAberta(false);
    setTermo('');
    setResposta(null);
    navegar(destino);
  };

  return (
    <div className={`busca-cabecalho${expandida ? ' expandida' : ''}`} ref={caixa} data-tour="busca-global">
      <button
        type="button"
        className="busca-abrir botao-icone"
        aria-label="Abrir a busca"
        aria-expanded={expandida}
        onClick={() => {
          setExpandida(true);
          setTimeout(() => campo.current?.focus(), 0);
        }}
      >
        <IconeExplorarComponent />
      </button>
      <label htmlFor={`${id}-campo`} className="sr-apenas">
        Buscar parlamentar, cidade ou entidade
      </label>
      <input
        id={`${id}-campo`}
        ref={campo}
        type="search"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && opcoes[ativa] ? `${id}-opcao-${ativa}` : undefined}
        placeholder="Buscar nome ou cidade"
        aria-label="Buscar parlamentar, cidade ou entidade"
        autoComplete="off"
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAberta(true);
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => {
          if (!termo.trim()) setExpandida(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAtiva((a) => Math.min(a + 1, opcoes.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAtiva((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && opcoes[ativa]) {
            e.preventDefault();
            escolher(opcoes[ativa].destino);
          } else if (e.key === 'Escape') {
            setAberta(false);
            setExpandida(false);
          }
        }}
      />

      {mostrar && (
        <div className="busca-resultados" id={`${id}-lista`} role="listbox" aria-label="Resultados da busca">
          {opcoes.length === 0 && <p className="busca-vazia">Nada encontrado para “{termo.trim()}”.</p>}
          {GRUPOS.map(({ grupo, titulo }) => {
            const doGrupo = opcoes.map((o, i) => ({ ...o, i })).filter((o) => o.grupo === grupo);
            if (doGrupo.length === 0) return null;
            return (
              <div key={grupo} role="group" aria-label={titulo}>
                <p className="busca-grupo" aria-hidden="true">
                  {titulo}
                </p>
                {doGrupo.map((o) => (
                  <div
                    key={o.destino}
                    id={`${id}-opcao-${o.i}`}
                    role="option"
                    aria-selected={o.i === ativa}
                    className={`busca-opcao ${o.i === ativa ? 'ativa' : ''}`}
                    onMouseEnter={() => setAtiva(o.i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      escolher(o.destino);
                    }}
                  >
                    <span>{o.rotulo}</span>
                    <small>{o.detalhe}</small>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Opcao = { grupo: 'parlamentar' | 'cidade' | 'entidade'; rotulo: string; detalhe: string; destino: string };

const GRUPOS = [
  { grupo: 'parlamentar', titulo: 'Parlamentares' },
  { grupo: 'cidade', titulo: 'Cidades' },
  { grupo: 'entidade', titulo: 'Entidades' },
] as const;

/**
 * ATENÇÃO: O histórico entra na busca, e quem já saiu diz de quando era.
 */
function opcoesDa(resposta: Busca): Opcao[] {
  return [
    ...resposta.parlamentares.map((p) => ({
      grupo: 'parlamentar' as const,
      rotulo: nomeProprio(p.nome),
      detalhe: [
        p.partido,
        p.uf,
        p.casa === 'SENADO' ? 'Senado' : p.casa === 'CAMARA' ? 'Câmara' : '',
        p.legislatura && resposta.legislaturaCorrente && p.legislatura !== resposta.legislaturaCorrente
          ? `até ${periodoDaLegislatura(p.legislatura).split('–')[1]}`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      destino: `/parlamentar/${p.id}`,
    })),
    ...resposta.municipios.map((m) => ({
      grupo: 'cidade' as const,
      rotulo: `${nomeProprio(m.nome)} – ${m.uf}`,
      detalhe: 'emendas recebidas na cidade',
      destino: `/emendas?uf=${m.uf}&cidade=${m.codigoIbge}`,
    })),
    ...resposta.entidades.map((e) => ({
      grupo: 'entidade' as const,
      rotulo: nomeProprio(e.nome),
      detalhe: [e.naturezaJuridica, e.sede && `${nomeProprio(e.sede.nome)} – ${e.sede.uf}`].filter(Boolean).join(' · '),
      destino: `/entidades/${e.cnpj}`,
    })),
  ];
}
