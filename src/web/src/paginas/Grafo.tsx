import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obterGrafo, type Grafo as DadosDoGrafo, type NoDoGrafo } from '../api';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { GrafoAmpliado } from '../componentes/GrafoAmpliado';
import { TelaDoGrafo } from '../componentes/TelaDoGrafo';
import { Termo } from '../componentes/Termo';

type Grupo = { comunidade: number; quantos: number; partidos: string[] };

/**
 * O grafo de similaridade de voto (RF-33).
 *
 * ⚠️ Esta tela mostra **só a Câmara**. O Senado ainda não é ingerido, e calar isso
 * faria o leitor concluir que o Congresso inteiro está aqui. Ver PL42.
 */
export function Grafo() {
  const navegar = useNavigate();
  const [grafo, setGrafo] = useState<DadosDoGrafo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState(false);

  useEffect(() => {
    obterGrafo()
      .then(setGrafo)
      .catch(() => setErro('Não foi possível carregar o grafo agora.'));
  }, []);

  const grupos = useMemo(() => (grafo ? resumirGrupos(grafo.nos) : []), [grafo]);

  if (erro) {
    return (
      <>
        <CabecalhoDaColuna titulo="Grafo" />
        <p className="erro">{erro}</p>
      </>
    );
  }

  if (!grafo) {
    return (
      <>
        <CabecalhoDaColuna titulo="Grafo" />
        <p className="carregando">Carregando…</p>
      </>
    );
  }

  // ⭐ Estado vazio honesto: acontece antes de o ETL analítico rodar.
  if (grafo.nos.length === 0) {
    return (
      <>
        <CabecalhoDaColuna titulo="Grafo" />
        <p className="vazio">
          A análise ainda não rodou para esta legislatura. O grafo aparece depois da
          próxima execução do ETL.
        </p>
      </>
    );
  }

  return (
    <>
      <CabecalhoDaColuna
        titulo="Quem vota com quem"
        subtitulo={`${grafo.nos.length} deputados · ${grafo.arestas.length} ligações`}
      />

      <TelaDoGrafo
        grafo={grafo}
        aoSelecionar={abrirPerfil}
        aoAmpliar={() => setAmpliado(true)}
      />

      <GrafoAmpliado
        grafo={grafo}
        aberto={ampliado}
        aoFechar={() => setAmpliado(false)}
        aoSelecionar={abrirPerfil}
      />

      <section className="grafo-explicacao">
        <h2>Como ler</h2>
        <p>
          Cada ponto é um deputado. Dois pontos se ligam quando votaram parecido em pelo
          menos 20 votações — e quanto mais forte a ligação, mais perto eles ficam. Só
          entram votações de <Termo nome="plenario" /> da{' '}
          <Termo nome="legislatura">{grafo.legislatura}ª legislatura</Termo>.
        </p>
        <p className="ajuda">
          {/* 🔴 O leitor lê espectro em qualquer eixo, mesmo sem a gente afirmar. */}
          <strong>A posição não é um espectro.</strong> Não existe “esquerda” à esquerda
          nem “direita” à direita: o desenho só aproxima quem vota junto. As cores
          identificam grupos, e o número de cada grupo é apenas um rótulo.
        </p>
        {/* ⚠️ PL42 — calar isto faria o leitor concluir que o Congresso está todo aqui. */}
        <p className="ajuda">
          Por enquanto o grafo tem <strong>apenas a Câmara dos Deputados</strong>. O
          Senado ainda não entrou na base.
        </p>
      </section>

      <section className="grafo-grupos">
        <h2>Os grupos</h2>
        <p className="ajuda ajuda-espacada">
          Cada <Termo nome="comunidade" /> é formado pelo <strong>voto</strong>, não pelo{' '}
          <Termo nome="partido" /> — e é por isso que um mesmo partido aparece em vários.
        </p>

        <ul>
          {grupos.map((g) => (
            <li key={g.comunidade}>
              <span className="grupo-cor" data-comunidade={g.comunidade % 8} />
              <span className="grupo-corpo">
                <strong>
                  Grupo {g.comunidade + 1} · {g.quantos} deputados
                </strong>
                <small>{g.partidos.join(' · ')}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );

  function abrirPerfil(no: NoDoGrafo) {
    navegar(`/parlamentar/${no.id}`);
  }
}

// ═══════════════════════════════════════════════════════════════════

/** ⚠️ Só grupos com mais de um deputado: 24 isolados virariam 24 linhas de legenda. */
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
