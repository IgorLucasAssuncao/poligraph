import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NOME_DA_CASA,
  obterGrafo,
  type Casa,
  type Grafo as DadosDoGrafo,
  type NoDoGrafo,
} from '../api';
import { BotaoDoTour } from '../componentes/BotaoDoTour';
import { GrafoAmpliado } from '../componentes/GrafoAmpliado';
import { LegendaDoGrafo } from '../componentes/LegendaDoGrafo';
import { TelaDoGrafo } from '../componentes/TelaDoGrafo';
import { Termo } from '../componentes/Termo';
import { mesCurto, periodoDaLegislatura } from '../formato';
import { passosDoGrafo } from '../tour';
import { Bloco, Esqueleto } from '../componentes/Esqueleto';
import { useLegislaturaDaUrl } from '../componentes/useLegislatura';

type Grupo = { comunidade: number; quantos: number; partidos: string[] };

type Destaque = { partido?: string; uf?: string };

const CASAS: Casa[] = ['CAMARA', 'SENADO'];

/**
 * Buracos da própria fonte, ditos onde o desenho é afetado (Pendência 58).
 *
 * MEDIDO: Em 2026-10-02 (achado #37): os dados abertos do Senado não têm as votações de 2015 nem
 * as do começo de 2016, em nenhum dos três serviços. A MP 665 e o julgamento final do
 * impeachment não aparecem.
 *
 * DECISÃO (2026-10-03): dizer a lacuna. Digitar as ~230 votações do Diário do Senado seria trazer
 * fonte isolada, que a regra do autor exclui (`.claude/CLAUDE.md`, regra 5).
 */
const LACUNAS_DO_ACERVO: Record<string, string> = {
  'SENADO-55':
    'Os dados abertos do Senado não trazem as votações de 2015 nem as do começo de 2016, ' +
    'como a da MP 665 e a do julgamento do impeachment. Elas estão só no Diário do Senado, ' +
    'e este desenho fica sem elas.',
};

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
export function Grafo() {
  const navegar = useNavigate();
  const [casa, setCasa] = useState<Casa>('CAMARA');
  const [escolha, setLegislatura] = useLegislaturaDaUrl();
  const legislatura = typeof escolha === 'number' ? escolha : undefined;
  const [grafo, setGrafo] = useState<DadosDoGrafo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState(false);
  const [destaque, setDestaque] = useState<Destaque>({});

  useEffect(() => {
    let atual = true;

    setGrafo(null);
    setErro(null);
    setDestaque({});

    obterGrafo(casa, legislatura)
      .then((novo) => atual && setGrafo(novo))
      .catch(() => atual && setErro('Não foi possível carregar o grafo agora.'));

    return () => {
      atual = false;
    };
  }, [casa, legislatura]);

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
        <SeletorDeCasa casa={casa} aoTrocar={trocarDeCasa} />

        {grafo && grafo.nos.length > 0 && (
          <p className="grafo-contagem">
            {grafo.nos.length} {membro.plural} · {grafo.arestas.length} ligações
          </p>
        )}

        {passos && <BotaoDoTour nome="grafo" passos={passos} />}
      </div>

      {erro && <p className="erro">{erro}</p>}
      {!erro && !grafo && (
        <Esqueleto rotulo="Carregando o grafo">
          <Bloco altura={520} />
        </Esqueleto>
      )}

      {!erro && grafo && grafo.nos.length === 0 && (
        <p className="vazio">
          {grafo.legislaturasComGrafo.length > 0 ? (
            <>
              {NOME_DA_CASA[casa].nome} não tem grafo em {periodoDaLegislatura(grafo.legislatura)}:
              havia votações abertas de menos para comparar quem vota com quem. Há grafo em{' '}
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
            <>
              A análise ainda não rodou para {NOME_DA_CASA[casa].nome} nesta legislatura.
              O grafo aparece depois da próxima execução do ETL.
            </>
          )}
        </p>
      )}

      {!erro && grafo && grafo.nos.length > 0 && (
        <>
          <DestaqueDoGrafo grafo={grafo} destaque={destaque} aoTrocar={setDestaque} />

          <TelaDoGrafo
            grafo={grafo}
            aoSelecionar={abrirPerfil}
            aoAmpliar={() => setAmpliado(true)}
            destaque={destaque}
          />

          <GrafoAmpliado
            grafo={grafo}
            aberto={ampliado}
            aoFechar={() => setAmpliado(false)}
            aoSelecionar={abrirPerfil}
            titulo={`Quem vota com quem · ${NOME_DA_CASA[casa].nome}`}
          />

          <LegendaDoGrafo />

          <section className="grafo-explicacao">
            <h2>De onde vem</h2>
            <p>
              Só entram votações de <Termo nome="plenario" /> da{' '}
              <Termo nome="legislatura">{grafo.legislatura}ª legislatura</Termo>, de{' '}
              {periodoDaLegislatura(grafo.legislatura)}
              {grafo.abertasDesde && grafo.abertasAte && (
                <>
                  . As abertas vão de <strong>{mesCurto(grafo.abertasDesde)}</strong> a{' '}
                  <strong>{mesCurto(grafo.abertasAte)}</strong>
                </>
              )}
              . Dois
              {' '}{membro.plural} só se ligam se votaram juntos vezes suficientes:
              com poucas votações em comum, votar igual seria coincidência.
            </p>

            {LACUNAS_DO_ACERVO[`${casa}-${grafo.legislatura}`] && (
              <p className="ajuda">{LACUNAS_DO_ACERVO[`${casa}-${grafo.legislatura}`]}</p>
            )}

            {casa === 'SENADO' && grafo.secretasDePlenario > 0 && (
              <p className="ajuda">
                <strong>O Senado vota em segredo com frequência.</strong> Das{' '}
                {grafo.votacoesDePlenario} votações de plenário da legislatura,{' '}
                {grafo.secretasDePlenario} são secretas, e nelas não há voto individual
                publicado. Este desenho se apoia nas{' '}
                {grafo.votacoesDePlenario - grafo.secretasDePlenario} abertas, e é por isso
                que ele tem menos ligações e mais pontos soltos que o da Câmara.
              </p>
            )}
          </section>

          <section className="grafo-grupos" data-tour="grafo-grupos">
            <h2>Os grupos</h2>
            <p className="ajuda ajuda-espacada">
              Cada <Termo nome="comunidade" /> é formado pelo <strong>voto</strong>, não
              pelo <Termo nome="partido" />, e é por isso que um mesmo partido aparece em
              vários.
            </p>

            <ul>
              {grupos.map((g) => (
                <li key={g.comunidade}>
                  <span className="grupo-cor" data-comunidade={g.comunidade % 8} />
                  <span className="grupo-corpo">
                    <strong>
                      Grupo {g.comunidade + 1} · {g.quantos} {membro.plural}
                    </strong>
                    <small>{g.partidos.join(' · ')}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
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
    navegar(`/parlamentar/${no.id}${naLegislatura}`);
  }
}

function SeletorDeCasa({ casa, aoTrocar }: { casa: Casa; aoTrocar: (nova: Casa) => void }) {
  return (
    <div className="grafo-casas" data-tour="grafo-casas" role="group" aria-label="Casa legislativa">
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

/** ATENÇÃO: Só grupos com mais de um membro: 21 isolados virariam 21 linhas de legenda. */
const MINIMO_PARA_LISTAR = 2;

const PARTIDOS_MOSTRADOS = 5;

function resumirGrupos(nos: NoDoGrafo[]): Grupo[] {
  const porComunidade = new Map<number, NoDoGrafo[]>();

  for (const no of nos) {
    if (no.comunidade === null) continue;
    const atual = porComunidade.get(no.comunidade) ?? [];
    atual.push(no);
    porComunidade.set(no.comunidade, atual);
  }

  return [...porComunidade.entries()]
    .filter(([, membros]) => membros.length >= MINIMO_PARA_LISTAR)
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
    .slice(0, PARTIDOS_MOSTRADOS)
    .map(([partido]) => partido);
}

/**
 * U18: destacar um partido ou um estado sem esconder o resto.
 *
 * DECISÃO: Esmaecer, não filtrar: a pergunta é "onde estão os do meu estado na nuvem", e a
 * nuvem sem os outros perderia a forma que dá sentido à posição. A cor continua a da
 * comunidade: destacar um partido não pinta o partido (RNF-16).
 */
function DestaqueDoGrafo({
  grafo,
  destaque,
  aoTrocar,
}: {
  grafo: DadosDoGrafo;
  destaque: Destaque;
  aoTrocar: (novo: Destaque) => void;
}) {
  const partidos = useMemo(() => [...new Set(grafo.nos.map((n) => n.partido).filter(Boolean))].sort(), [grafo]);
  const ufs = useMemo(() => [...new Set(grafo.nos.map((n) => n.uf).filter(Boolean))].sort(), [grafo]);
  const destacados = grafo.nos.filter(
    (n) => (!destaque.partido || n.partido === destaque.partido) && (!destaque.uf || n.uf === destaque.uf),
  ).length;
  const ativo = Boolean(destaque.partido || destaque.uf);

  return (
    <div className="destaque-do-grafo">
      <span className="destaque-do-grafo-rotulo">Destacar</span>
      <select
        value={destaque.partido ?? ''}
        onChange={(e) => aoTrocar({ ...destaque, partido: e.target.value || undefined })}
        aria-label="Destacar um partido"
      >
        <option value="">todos os partidos</option>
        {partidos.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        value={destaque.uf ?? ''}
        onChange={(e) => aoTrocar({ ...destaque, uf: e.target.value || undefined })}
        aria-label="Destacar um estado"
      >
        <option value="">todos os estados</option>
        {ufs.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      {ativo && (
        <>
          <span className="destaque-do-grafo-conta" aria-live="polite">
            {destacados} de {grafo.nos.length} em destaque
          </span>
          <button type="button" className="filtro-limpar" onClick={() => aoTrocar({})}>
            Tirar o destaque
          </button>
        </>
      )}
    </div>
  );
}
