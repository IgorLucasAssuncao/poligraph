import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NOME_DA_CASA,
  obterGrafo,
  type Grafo,
  type ParlamentarAfim,
  type ResultadoAfinidade,
  type ResultadoPorCasa,
} from '../api';
import { Avaliacao } from './Avaliacao';
import { Avatar } from './Avatar';
import { CabecalhoDaColuna } from './Layout';
import { GrafoAmpliado } from './GrafoAmpliado';
import { LinhaParlamentar } from './LinhaParlamentar';
import { TelaDoGrafo } from './TelaDoGrafo';

/**
 * A tela de resultado.
 *
 * 🔴 RF-29: SEMPRE "concordou em X de Y", NUNCA percentual solto.
 * "67%" esconde que a base foram 3 perguntas; "2 de 3" mostra a fragilidade do próprio
 * número — e isso é honestidade metodológica, não detalhe de interface.
 */
export function Resultado({
  resultado,
  aoRefazer,
}: {
  resultado: ResultadoAfinidade;
  aoRefazer: () => void;
}) {
  return (
    <>
      <CabecalhoDaColuna
        titulo="Seu resultado"
        subtitulo={`${resultado.totalPerguntasRespondidas} perguntas respondidas`}
      />

      <p className="ajuda ajuda-espacada">
        A comparação usa apenas as votações em que o parlamentar esteve presente e se
        posicionou. Deputados e senadores votam matérias diferentes, então cada grupo é
        comparado separadamente.
      </p>

      {resultado.porCasa.map((casa) => (
        <SecaoDaCasa key={casa.casa} casa={casa} />
      ))}

      <p className="aviso" role="note">
        Esta é uma ferramenta acadêmica de comparação de votos.{' '}
        <strong>Não é recomendação de voto</strong>, e não representa o programa completo de
        nenhum parlamentar.
      </p>

      <Avaliacao resultado={resultado} />

      {/* Refazer sempre disponível: a pessoa muda de ideia, e as perguntas mudam quando
          a curadoria acrescenta votações novas. */}
      <div className="resultado-acoes">
        <button type="button" className="botao-secundario" onClick={aoRefazer}>
          Refazer o questionário
        </button>
      </div>
    </>
  );
}

/**
 * Uma casa: destaque, grafo próprio e as duas listas.
 *
 * O cidadão nunca escolheu entre Câmara e Senado — a separação acontece só aqui, no
 * resultado, e é autoexplicativa: "Deputados mais próximos" e "Senadores mais próximos".
 *
 * O grafo é por casa porque as duas não são comparáveis entre si: nenhuma aresta liga
 * deputado a senador, e a posição do cidadão sai da execução da própria casa.
 */
function SecaoDaCasa({ casa }: { casa: ResultadoPorCasa }) {
  const [primeiro, ...demais] = casa.maisProximos;
  const grafo = useGrafo(casa.posicaoNoGrafo !== null, casa.casa);
  const [ampliado, setAmpliado] = useState(false);

  const nome = NOME_DA_CASA[casa.casa];

  if (casa.maisProximos.length === 0) return null;

  return (
    <section className="casa-resultado">
      <h2 className="titulo-casa">
        {nome.plural} mais próximos de você
        <small>
          {casa.perguntasRespondidas}{' '}
          {casa.perguntasRespondidas === 1 ? 'pergunta' : 'perguntas'} desta casa
        </small>
      </h2>

      {primeiro && <Destaque parlamentar={primeiro} />}

      {grafo && casa.posicaoNoGrafo && (
        <div className="resultado-grafo">
          <h3 className="titulo-secao">Onde você caiu</h3>

          <TelaDoGrafo
            grafo={grafo}
            cidadao={casa.posicaoNoGrafo}
            altura={320}
            aoAmpliar={() => setAmpliado(true)}
          />

          <p className="ajuda ajuda-espacada">
            O losango é você, posicionado entre os{' '}
            <strong>{casa.posicaoNoGrafo.vizinhosUsados}</strong> {nome.plural.toLowerCase()}{' '}
            com quem você mais concordou.{' '}
            {/* Sem esta frase a tela afirma uma precisão que o dado não tem. */}
            <strong>
              Sua posição vale sobre {casa.posicaoNoGrafo.baseDeVotacoes} perguntas
            </strong>{' '}
            — a de cada {nome.singular}, sobre a legislatura inteira.
          </p>

          <GrafoAmpliado
            grafo={grafo}
            cidadao={casa.posicaoNoGrafo}
            aberto={ampliado}
            aoFechar={() => setAmpliado(false)}
          />
        </div>
      )}

      {demais.length > 0 && (
        <>
          <h3 className="titulo-secao">Também próximos de você</h3>
          {demais.map((p) => (
            <LinhaAfim key={p.pessoaId} parlamentar={p} />
          ))}
        </>
      )}

      {casa.maisDistantes.length > 0 && (
        <>
          <h3 className="titulo-secao">Mais distantes</h3>
          {casa.maisDistantes.map((p) => (
            <LinhaAfim key={p.pessoaId} parlamentar={p} />
          ))}
        </>
      )}
    </section>
  );
}

/**
 * Busca o grafo da casa, e só quando há posição para desenhar.
 *
 * Sem a condição, a tela baixaria o grafo inteiro para descartá-lo — e são centenas de
 * nós e milhares de arestas por casa.
 */
function useGrafo(precisa: boolean, casa: ResultadoPorCasa['casa']): Grafo | null {
  const [grafo, setGrafo] = useState<Grafo | null>(null);

  useEffect(() => {
    if (!precisa) {
      setGrafo(null);
      return;
    }

    let vivo = true;
    obterGrafo(casa)
      .then((recebido) => {
        if (vivo) setGrafo(recebido);
      })
      // Falhar em buscar o grafo omite o desenho, nunca a tela: as listas são o
      // resultado, e o grafo é ilustração.
      .catch(() => {
        if (vivo) setGrafo(null);
      });

    return () => {
      vivo = false;
    };
  }, [precisa, casa]);

  return grafo;
}

function Destaque({ parlamentar }: { parlamentar: ParlamentarAfim }) {
  return (
    <section className="destaque-resultado">
      <p className="rotulo-destaque">Quem mais votou como você</p>

      <Link to={`/parlamentar/${parlamentar.pessoaId}`} className="destaque-link">
        <Avatar nome={parlamentar.nome} tamanho="grande" />

        <h2>{parlamentar.nome}</h2>
        <p className="perfil-filiacao">
          {parlamentar.partido}
          {parlamentar.uf && ` · ${parlamentar.uf}`}
        </p>
      </Link>

      <p className="destaque-placar">
        {/* 🔴 nunca percentual — ver o cabeçalho deste arquivo */}
        Vocês concordaram em <strong>{parlamentar.acordos}</strong> de{' '}
        <strong>{parlamentar.comparaveis}</strong> perguntas comparáveis
      </p>
    </section>
  );
}

function LinhaAfim({ parlamentar }: { parlamentar: ParlamentarAfim }) {
  return (
    <LinhaParlamentar
      id={parlamentar.pessoaId}
      nome={parlamentar.nome}
      partido={parlamentar.partido}
      uf={parlamentar.uf}
      detalhe={
        <>
          concordaram em <strong>{parlamentar.acordos}</strong> de{' '}
          <strong>{parlamentar.comparaveis}</strong> perguntas
        </>
      }
    />
  );
}
