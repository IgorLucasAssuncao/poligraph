import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarTudo, type Busca } from '../api';
import { useCarga } from './useCarga';
import { useAdiado } from './useAdiado';
import { nomeProprio, periodoDaLegislatura } from '../formato';
import { IconeExplorarComponent } from './Icones';
import { TEXTOS_DO_SITE as T } from '../textos/site';
import { destinoDoPolitico } from '../navegacao';
import { descricaoDoMandato } from '../textos/politicos';

/**
 * Uma caixa, quatro tipos de resposta: parlamentar, político de outro cargo (Pendência 90), cidade e entidade.
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
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const [expandida, setExpandida] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();
  const id = useId();
  const buscando = termo.trim().length >= 2;
  const adiado = useAdiado(termo.trim(), 250);
  const lida = useCarga(['busca', adiado], () => buscarTudo(adiado), { ativo: adiado.length >= 2 });
  const resposta: Busca | null = lida.erro ? null : (lida.dados ?? null);
  const [chaveDaResposta, setChaveDaResposta] = useState(lida.chaveDoDado);
  if (chaveDaResposta !== lida.chaveDoDado) {
    setChaveDaResposta(lida.chaveDoDado);
    setAtiva(0);
  }


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
    void navegar(destino);
  };

  return (
    <div className={`busca-cabecalho${expandida ? ' expandida' : ''}`} ref={caixa} data-tour="busca-global">
      <button
        type="button"
        className="busca-abrir botao-icone"
        aria-label={T.busca.abrir}
        aria-expanded={expandida}
        onClick={() => {
          setExpandida(true);
          setTimeout(() => campo.current?.focus(), 0);
        }}
      >
        <IconeExplorarComponent />
      </button>
      <label htmlFor={`${id}-campo`} className="sr-apenas">
        {T.busca.rotulo}
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
        placeholder={T.busca.placeholder}
        aria-label={T.busca.rotulo}
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
        <div className="busca-resultados" id={`${id}-lista`} role="listbox" aria-label={T.busca.resultados}>
          {opcoes.length === 0 && <p className="busca-vazia">{T.busca.nada(termo.trim())}</p>}
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
                    tabIndex={-1}
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

type Opcao = { grupo: 'parlamentar' | 'politico' | 'cidade' | 'entidade'; rotulo: string; detalhe: string; destino: string };

const GRUPOS = [
  { grupo: 'parlamentar', titulo: T.busca.grupos.parlamentar },
  { grupo: 'politico', titulo: T.busca.grupos.politico },
  { grupo: 'cidade', titulo: T.busca.grupos.cidade },
  { grupo: 'entidade', titulo: T.busca.grupos.entidade },
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
        p.casa === 'SENADO' ? T.busca.senado : p.casa === 'CAMARA' ? T.busca.camara : '',
        p.legislatura && resposta.legislaturaCorrente && p.legislatura !== resposta.legislaturaCorrente
          ? T.busca.ate(periodoDaLegislatura(p.legislatura).split('–')[1])
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      destino: `/parlamentar/${p.idPessoa}`,
    })),
    ...(resposta.politicos ?? []).map((p) => ({
      grupo: 'politico' as const,
      rotulo: nomeProprio(p.nome),
      detalhe: [descricaoDoMandato(p.mandato, nomeProprio), p.mandato.partido].join(' · '),
      destino: destinoDoPolitico(p),
    })),
    ...resposta.municipios.map((m) => ({
      grupo: 'cidade' as const,
      rotulo: `${nomeProprio(m.nome)} – ${m.uf}`,
      detalhe: T.busca.emendasDaCidade,
      destino: `/cidades/${m.codigoIbge}`,
    })),
    ...resposta.entidades.map((e) => ({
      grupo: 'entidade' as const,
      rotulo: nomeProprio(e.nome),
      detalhe: [e.naturezaJuridica, e.sede && `${nomeProprio(e.sede.nome)} – ${e.sede.uf}`].filter(Boolean).join(' · '),
      destino: `/entidades/${e.cnpj}`,
    })),
  ];
}
