import { useMemo, useState } from 'react';
import { AtualizandoComponent } from '../componentes/Atualizando';
import { useCarga } from '../componentes/useCarga';
import { useNavigate } from 'react-router-dom';
import {
  NOME_DA_CASA,
  obterGrafo,
  type Casa,
  type Grafo as DadosDoGrafo,
  type NoDoGrafo,
} from '../api';
import { BotaoDoTourComponent } from '../componentes/BotaoDoTour';
import { GrafoAmpliadoComponent } from '../componentes/GrafoAmpliado';
import { LegendaDoGrafoComponent } from '../componentes/LegendaDoGrafo';
import { TelaDoGrafoComponent } from '../componentes/TelaDoGrafo';
import { mesCurto, periodoDaLegislatura } from '../formato';
import { passosDoGrafo } from '../tour';
import { BlocoComponent, EsqueletoComponent } from '../componentes/Esqueleto';
import { useLegislaturaDaUrl } from '../componentes/useLegislatura';
import './grafo.css';
import { MINIMO_PARA_LISTAR_PARTIDO, PARTIDOS_MOSTRADOS_NO_GRAFO } from '../constantes';
import { TEXTOS_DO_GRAFO } from '../textos/grafo';

const T = TEXTOS_DO_GRAFO.pagina;

type Grupo = { comunidade: number; quantos: number; partidos: string[] };

type Destaque = { partido?: string; uf?: string };

const CASAS: Casa[] = ['CAMARA', 'SENADO'];

/**
 * O grafo de similaridade de voto (RF-33).
 *
 * ## RISCO: Um grafo por casa, nunca um só
 *
 * Deputado e senador não votam as mesmas matérias: o par não teria base comum, e o
 * banco impede a aresta entre casas por restrição. Juntar os dois desenhos produziria
 * duas nuvens sem ligação nenhuma entre elas, o que sugere oposição onde só há ausência
 * de dado.
 *
 * ATENÇÃO: O seletor é permitido aqui e proibido no questionário (RNF-28): a proibição vale
 * onde o *usuário* declararia afinidade por uma casa. Aqui ele só escolhe qual figura
 * olhar.
 *
 * `undefined` é "a corrente": a API escolhe, e a tela não adivinha qual é. "Todas" é da
 * lista — não existe grafo de todas as legislaturas juntas — e aqui vale a corrente.
 *
 * ATENÇÃO: Zera antes de buscar: sem isto a tela mostra o grafo da Câmara sob o título do
 * Senado enquanto a requisição não volta.
 *
 * O alinhamento só existe onde a orientação do Governo foi registrada.
 *
 * DECISÃO: Estado vazio honesto: acontece antes de o ETL analítico rodar para a casa.
 *
 * RISCO: O sigilo do Senado muda o que a figura pode afirmar, e calar isso
 * faria o leitor comparar as duas casas como se fossem equivalentes.
 *
 * O período fica: as duas casas têm as mesmas legislaturas. Se a outra não tem grafo
 * nele, a tela diz isso e oferece os que tem.
 *
 * DECISÃO: A ficha abre no mandato do grafo: no de 2019, o deputado de 2019.
 */
export function GrafoComponent() {
  const navegar = useNavigate();
  const [casa, setCasa] = useState<Casa>('CAMARA');
  const [escolha, setLegislatura] = useLegislaturaDaUrl();
  const legislatura = typeof escolha === 'number' ? escolha : undefined;
  const chave = `${casa}:${legislatura ?? ''}`;
  const lido = useCarga(['grafo', casa, legislatura ?? null], () => obterGrafo(casa, legislatura));
  const grafo = lido.dados ?? null;
  const atualizando = lido.atualizando;
  const erro = lido.erro ? T.erro : null;
  const [ampliado, setAmpliado] = useState(false);
  const [destaque, setDestaque] = useState<Destaque>({});
  const [chaveDoDestaque, setChaveDoDestaque] = useState(chave);
  if (chaveDoDestaque !== chave) {
    setChaveDoDestaque(chave);
    setDestaque({});
  }


  const grupos = useMemo(() => (grafo ? resumirGrupos(grafo.nos) : []), [grafo]);
  const membro = NOME_DA_CASA[casa];

  const passos = useMemo(
    () =>
      grafo && grafo.nos.length > 0
        ? passosDoGrafo({
            singular: NOME_DA_CASA[casa].singular,
            plural: NOME_DA_CASA[casa].plural,
            vizinhosPorNo: grafo.vizinhosPorNo,
            temAlinhamento: grafo.nos.some((n) => n.governismo !== null),
          })
        : null,
    [grafo, casa],
  );

  return (
    <>
      <div className="grafo-barra">
        <SeletorDeCasaComponent casa={casa} aoTrocar={trocarDeCasa} />

        {grafo && grafo.nos.length > 0 && (
          <p className="grafo-contagem">{T.contagem(grafo.nos.length, membro.plural, grafo.arestas.length)}</p>
        )}

        {passos && <BotaoDoTourComponent nome="grafo" passos={passos} />}
      </div>

      {erro && <p className="erro">{erro}</p>}
      {!erro && !grafo && (
        <EsqueletoComponent rotulo={T.carregando}>
          <BlocoComponent altura={520} />
        </EsqueletoComponent>
      )}

      {!erro && grafo && grafo.nos.length === 0 && (
        <p className="vazio">
          {grafo.legislaturasComGrafo.length > 0 ? (
            <>
              {T.semGrafoNoPeriodo(NOME_DA_CASA[casa].nome, periodoDaLegislatura(grafo.legislatura))}
              {grafo.legislaturasComGrafo.map((l, i) => (
                <span key={l}>
                  {i > 0 && ', '}
                  <button type="button" className="botao-link" onClick={() => setLegislatura(l)}>
                    {periodoDaLegislatura(l)}
                  </button>
                </span>
              ))}
              .
            </>
          ) : (
            T.analiseNaoRodou(NOME_DA_CASA[casa].nome)
          )}
        </p>
      )}

      {!erro && grafo && grafo.nos.length > 0 && (
        <AtualizandoComponent atualizando={atualizando} chave={lido.chaveDoDado}>
          <DestaqueDoGrafoComponent grafo={grafo} destaque={destaque} aoTrocar={setDestaque} />

          <TelaDoGrafoComponent
            grafo={grafo}
            aoSelecionar={abrirPerfil}
            aoAmpliar={() => setAmpliado(true)}
            destaque={destaque}
          />

          <GrafoAmpliadoComponent
            grafo={grafo}
            aberto={ampliado}
            aoFechar={() => setAmpliado(false)}
            aoSelecionar={abrirPerfil}
            titulo={T.tituloDoAmpliado(NOME_DA_CASA[casa].nome)}
          />

          <LegendaDoGrafoComponent />

          <section className="grafo-explicacao">
            <h2>{T.deOndeVem}</h2>
            <p>
              {T.origem(
                grafo.legislatura,
                periodoDaLegislatura(grafo.legislatura),
                grafo.abertasDesde && grafo.abertasAte
                  ? { desde: mesCurto(grafo.abertasDesde), ate: mesCurto(grafo.abertasAte) }
                  : null,
                membro.plural,
              )}
            </p>

            {TEXTOS_DO_GRAFO.lacunasDoAcervo[`${casa}-${grafo.legislatura}`] && (
              <p className="ajuda">{TEXTOS_DO_GRAFO.lacunasDoAcervo[`${casa}-${grafo.legislatura}`]}</p>
            )}

            {casa === 'SENADO' && grafo.secretasDePlenario > 0 && (
              <p className="ajuda">{T.sigiloDoSenado(grafo.votacoesDePlenario, grafo.secretasDePlenario)}</p>
            )}
          </section>

          <section className="grafo-grupos" data-tour="grafo-grupos">
            <h2>{T.osGrupos}</h2>
            <p className="ajuda ajuda-espacada">{T.gruposAjuda}</p>

            <ul>
              {grupos.map((g) => (
                <li key={g.comunidade}>
                  <span className="grupo-cor" data-comunidade={g.comunidade % 8} />
                  <span className="grupo-corpo">
                    <strong>{T.grupo(g.comunidade + 1, g.quantos, membro.plural)}</strong>
                    <small>{g.partidos.join(' · ')}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </AtualizandoComponent>
      )}
    </>
  );

  function trocarDeCasa(nova: Casa) {
    setCasa(nova);
  }

  function abrirPerfil(no: NoDoGrafo) {
    const naLegislatura = grafo && grafo.legislaturasComGrafo[0] !== grafo.legislatura
      ? `?legislatura=${grafo.legislatura}`
      : '';
    void navegar(`/parlamentar/${no.idPessoa}${naLegislatura}`);
  }
}

function SeletorDeCasaComponent({ casa, aoTrocar }: { casa: Casa; aoTrocar: (nova: Casa) => void }) {
  return (
    <div className="grafo-casas" data-tour="grafo-casas" role="group" aria-label={T.casaLegislativa}>
      {CASAS.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={casa === opcao ? 'ativo' : ''}
          aria-pressed={casa === opcao}
          onClick={() => aoTrocar(opcao)}
        >
          {NOME_DA_CASA[opcao].nome}
        </button>
      ))}
    </div>
  );
}



function resumirGrupos(nos: NoDoGrafo[]): Grupo[] {
  const porComunidade = new Map<number, NoDoGrafo[]>();

  for (const no of nos) {
    if (no.comunidade === null) continue;
    const atual = porComunidade.get(no.comunidade) ?? [];
    atual.push(no);
    porComunidade.set(no.comunidade, atual);
  }

  return [...porComunidade.entries()]
    .filter(([, membros]) => membros.length >= MINIMO_PARA_LISTAR_PARTIDO)
    .map(([comunidade, membros]) => ({
      comunidade,
      quantos: membros.length,
      partidos: partidosMaisComuns(membros),
    }))
    .sort((a, b) => b.quantos - a.quantos);
}

function partidosMaisComuns(membros: NoDoGrafo[]): string[] {
  const contagem = new Map<string, number>();

  for (const m of membros) {
    if (!m.partido) continue;
    contagem.set(m.partido, (contagem.get(m.partido) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PARTIDOS_MOSTRADOS_NO_GRAFO)
    .map(([partido]) => partido);
}

/**
 * U18: destacar um partido ou um estado sem esconder o resto.
 *
 * DECISÃO: Esmaecer, não filtrar: a pergunta é "onde estão os do meu estado na nuvem", e a
 * nuvem sem os outros perderia a forma que dá sentido à posição. A cor continua a da
 * comunidade: destacar um partido não pinta o partido (RNF-16).
 */
function DestaqueDoGrafoComponent({
  grafo,
  destaque,
  aoTrocar,
}: {
  grafo: DadosDoGrafo;
  destaque: Destaque;
  aoTrocar: (novo: Destaque) => void;
}) {
  const partidos = useMemo(() => [...new Set(grafo.nos.map((n) => n.partido).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [grafo]);
  const ufs = useMemo(() => [...new Set(grafo.nos.map((n) => n.uf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [grafo]);
  const destacados = grafo.nos.filter(
    (n) => (!destaque.partido || n.partido === destaque.partido) && (!destaque.uf || n.uf === destaque.uf),
  ).length;
  const ativo = Boolean(destaque.partido || destaque.uf);

  return (
    <div className="destaque-do-grafo">
      <span className="destaque-do-grafo-rotulo">{T.destacar}</span>
      <select
        value={destaque.partido ?? ''}
        onChange={(e) => aoTrocar({ ...destaque, partido: e.target.value || undefined })}
        aria-label={T.destacarPartido}
      >
        <option value="">{T.todosOsPartidos}</option>
        {partidos.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        value={destaque.uf ?? ''}
        onChange={(e) => aoTrocar({ ...destaque, uf: e.target.value || undefined })}
        aria-label={T.destacarEstado}
      >
        <option value="">{T.todosOsEstados}</option>
        {ufs.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      {ativo && (
        <>
          <span className="destaque-do-grafo-conta" aria-live="polite">
            {T.emDestaque(destacados, grafo.nos.length)}
          </span>
          <button type="button" className="filtro-limpar" onClick={() => aoTrocar({})}>
            {T.tirarDestaque}
          </button>
        </>
      )}
    </div>
  );
}
