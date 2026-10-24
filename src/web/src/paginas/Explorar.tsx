import { useState } from 'react';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { useLista } from '../componentes/useCarga';
import { useAdiado } from '../componentes/useAdiado';
import {
  listarParlamentares,
  type Casa,
  type Parlamentar,
} from '../api';
import { periodoDaLegislatura } from '../formato';
import { IconeExplorarComponent } from '../componentes/Icones';
import { LinhaParlamentarComponent } from '../componentes/LinhaParlamentar';
import { marcarSeguido, useSeguidos } from '../componentes/useSeguidos';
import { EsqueletoDeListaComponent } from '../componentes/Esqueleto';
import { useLegislaturaDaUrl } from '../componentes/useLegislatura';
import { PARLAMENTARES_POR_PAGINA } from '../constantes';
import { TEXTOS_DA_LISTA as T } from '../textos/parlamentares';

/** Busca e navegação pelos parlamentares (RF-34). */
/**
 * ATENÇÃO: "na Câmara" / "no Senado" — a preposição muda, e concatenar `NOME_DA_CASA` daria
 * "votações registradas Senado Federal".
 *
 * Sem voto não há casa, e não há onde. A frase termina em "0 votações
 * registradas", que é exatamente o caso.
 */
const NA_CASA: Record<Parlamentar['casa'], string> = T.naCasa;


/**
 * O período vem da faixa do topo — o seletor é um só, no mesmo lugar em todo o site.
 *
 * ATENÇÃO: Espera a digitação parar: sem isso, cada tecla vira uma consulta ao banco.
 *
 * DECISÃO: As opções vêm da lista inteira, que a API manda junto. Tiradas do que está na
 * tela, escolher um partido esvaziava a lista de estados.
 *
 * O período passado escolhido, para a contagem dizer de quando é a lista.
 *
 * Não "parlamentar", não "deputado": a lista traz as DUAS casas, e o
 * aria-label já dizia parlamentar — o texto visível é que discordava.
 *
 * DECISÃO: A casa antes de partido e estado: é o que muda a leitura do número de
 * votações, e quem procura "meu senador" Não precisa atravessar 513 deputados.
 *
 * RISCO: A casa entra no detalhe, não é enfeite.
 * MEDIDO: Medido em 2026-08-29: o deputado mediano tem 845 votações registradas e o
 * senador mediano, 140 — SEIS vezes menos. O senador com MAIS votações (177)
 * fica abaixo de 549 dos 643 deputados.
 * ATENÇÃO: A lista mistura as duas casas, e sem dizer qual é qual todo senador parece
 * inativo. A causa é o Senado fazer menos votação nominal — e 56,8% delas serem
 * secretas —, não o senador trabalhar menos.
 *
 * DECISÃO: Seguir só quem está em exercício (decisão do autor, 2026-10-02) — ou quem a
 * pessoa já segue, para poder deixar de seguir. A API recusa o resto (422).
 *
 * ATENÇÃO: Quem já saiu diz de quando era: "853 votações" sem o período faria um ex-deputado
 * de 2007 parecer tão ativo quanto alguém em exercício.
 *
 * ATENÇÃO: Com UM período passado escolhido, não "Ex-deputado": a lista é toda daquele período,
 * e quem foi reeleito ainda está lá. A contagem acima diz de quando é.
 */
export function ExplorarComponent() {
  const [termo, setTermo] = useState('');
  const [partido, setPartido] = useState('');
  const [uf, setUf] = useState('');
  const [casa, setCasa] = useState<Casa | ''>('');
  const [ordem, setOrdem] = useState<'NOME' | 'VOTACOES'>('NOME');
  const [escolha] = useLegislaturaDaUrl();
  const seguidos = useSeguidos().ids;

  const filtroAdiado = useAdiado(JSON.stringify(filtro()), 300);
  const consulta = useLista(['parlamentares', filtroAdiado], (numero) =>
    listarParlamentares({ ...JSON.parse(filtroAdiado), tamanho: PARLAMENTARES_POR_PAGINA, ...(numero > 1 && { pagina: numero }) }),
  );
  const pagina = consulta.primeira ?? null;
  const lista = consulta.itens;
  const carregando = pagina === null && !consulta.erro;
  const atualizando = consulta.atualizando || filtroAdiado !== JSON.stringify(filtro());

  const aplicados: [string, string, () => void][] = (
    [
      ['nome', termo.trim() && T.filtroNome(termo.trim()), () => setTermo('')],
      ['casa', casa && (casa === 'CAMARA' ? T.soACamara : T.soOSenado), () => setCasa('')],
      ['partido', partido && T.filtroPartido(partido), () => setPartido('')],
      ['uf', uf && T.filtroEstado(uf), () => setUf('')],
    ] as [string, string, () => void][]
  ).filter(([, rotulo]) => rotulo);

  const partidos = pagina?.partidos ?? [];
  const ufs = pagina?.ufs ?? [];
  const total = pagina?.total ?? 0;
  const passada =
    typeof escolha === 'number' && escolha !== pagina?.legislaturaCorrente ? escolha : undefined;

  return (
    <>
      <div className="barra-busca" data-tour="busca">
        <span className="icone-busca" aria-hidden="true">
          <IconeExplorarComponent />
        </span>
        <input
          type="search"
          placeholder={T.buscar}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label={T.buscar}
        />
      </div>

      <div className="filtros">
        <select value={casa} onChange={(e) => setCasa(e.target.value as Casa | '')} aria-label={T.casa}>
          <option value="">{T.camaraESenado}</option>
          <option value="CAMARA">{T.soACamara}</option>
          <option value="SENADO">{T.soOSenado}</option>
        </select>

        <select value={partido} onChange={(e) => setPartido(e.target.value)} aria-label={T.partido}>
          <option value="">{T.todosOsPartidos}</option>
          {partidos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select value={uf} onChange={(e) => setUf(e.target.value)} aria-label={T.estado}>
          <option value="">{T.todosOsEstados}</option>
          {ufs.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <select value={ordem} onChange={(e) => setOrdem(e.target.value as 'NOME' | 'VOTACOES')} aria-label={T.ordem}>
          <option value="NOME">{T.alfabetica}</option>
          <option value="VOTACOES">{T.maisVotos}</option>
        </select>
      </div>

      {aplicados.length > 0 && (
        <div className="filtros-aplicados" aria-label={T.aplicados}>
          {aplicados.map(([chave, rotulo, limpar]) => (
            <button key={chave} type="button" className="filtro-aplicado" onClick={limpar}>
              {rotulo}
              <span aria-hidden="true"> ✕</span>
              <span className="sr-apenas">{T.remover}</span>
            </button>
          ))}
          {aplicados.length > 1 && (
            <button type="button" className="filtro-limpar" onClick={limparTudo}>
              {T.limpar}
            </button>
          )}
        </div>
      )}

      {carregando && <EsqueletoDeListaComponent rotulo={T.buscando} linhas={8} />}

      {!carregando && lista.length === 0 && (
        <p className="vazio">{T.nenhum}</p>
      )}

      {pagina && total > 0 && (
        <p className="contagem-lista" aria-live="polite">
          {T.contagem(lista.length, total)}
          {passada && T.queVotaramEm(periodoDaLegislatura(passada))}
          {escolha === 'todas' && T.todosOsPeriodos}
        </p>
      )}

      <AtualizandoComponent atualizando={atualizando} chave={consulta.chaveDoDado}>
      {lista.map((p) => (
        <LinhaParlamentarComponent
          key={p.idPessoa}
          idPessoa={p.idPessoa}
          nome={p.nome}
          partido={p.partido}
          uf={p.uf}
          fotoUrl={p.urlFoto}
          detalhe={detalheDe(p)}
          legislatura={p.legislatura && p.legislatura !== pagina?.legislaturaCorrente ? p.legislatura : undefined}
          seguindo={seguidos.has(p.idPessoa)}
          aoAlternarSeguir={
            p.emExercicio || seguidos.has(p.idPessoa) ? marcarSeguido : undefined
          }
        />
      ))}
      </AtualizandoComponent>

      {!carregando && lista.length < total && (
        <div className="carregar-mais">
          <button type="button" className="botao-secundario" onClick={consulta.carregarMais} disabled={consulta.carregandoMais}>
            {consulta.carregandoMais ? T.carregando : T.mostrarMais(Math.min(PARLAMENTARES_POR_PAGINA, total - lista.length))}
          </button>
        </div>
      )}
    </>
  );

  function filtro() {
    return {
      nome: termo, partido, uf, casa: casa || undefined, ordem,
      anteriores: escolha === 'todas' || undefined,
      legislatura: typeof escolha === 'number' ? escolha : undefined,
    };
  }

  function limparTudo() {
    setTermo('');
    setCasa('');
    setPartido('');
    setUf('');
  }

  function detalheDe(p: Parlamentar) {
    const votacoes = T.votosComPosicao(p.nVotacoes, NA_CASA[p.casa]);
    const corrente = pagina?.legislaturaCorrente;
    if (typeof escolha === 'number') return votacoes;
    if (!p.legislatura || !corrente) return votacoes;
    if (p.legislatura === corrente) return p.emExercicio === false ? T.foraDoExercicio(votacoes) : votacoes;

    const quem = p.casa === 'SENADO' ? T.exSenador : T.exDeputado;
    return T.exParlamentar(quem, periodoDaLegislatura(p.legislatura), votacoes);
  }
}
