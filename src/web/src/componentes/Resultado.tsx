import { Link } from 'react-router-dom';
import type { ParlamentarAfim, ResultadoAfinidade } from '../api';
import { Avaliacao } from './Avaliacao';
import { Avatar } from './Avatar';
import { CabecalhoDaColuna } from './Layout';
import { LinhaParlamentar } from './LinhaParlamentar';

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
  const [primeiro, ...demais] = resultado.maisProximos;

  return (
    <>
      <CabecalhoDaColuna
        titulo="Seu resultado"
        subtitulo={`${resultado.totalPerguntasRespondidas} perguntas respondidas`}
      />

      {primeiro && <Destaque parlamentar={primeiro} />}

      <p className="ajuda ajuda-espacada">
        A comparação usa apenas as votações em que o parlamentar esteve presente e se
        posicionou.
      </p>

      {demais.length > 0 && (
        <>
          <h3 className="titulo-secao">Também próximos de você</h3>
          {demais.map((p) => (
            <LinhaAfim key={p.pessoaId} parlamentar={p} />
          ))}
        </>
      )}

      <h3 className="titulo-secao">Mais distantes</h3>
      {resultado.maisDistantes.map((p) => (
        <LinhaAfim key={p.pessoaId} parlamentar={p} />
      ))}

      <p className="aviso" role="note">
        ⚠️ Esta é uma ferramenta acadêmica de comparação de votos.{' '}
        <strong>Não é recomendação de voto</strong>, e não representa o programa completo de
        nenhum parlamentar.
      </p>

      <Avaliacao resultado={resultado} />

      {/* ⭐ Refazer sempre disponível: a pessoa muda de ideia, e as perguntas mudam
          quando a curadoria acrescenta votações novas. */}
      <div className="resultado-acoes">
        <button type="button" className="botao-secundario" onClick={aoRefazer}>
          Refazer o questionário
        </button>
        <Link to="/explorar" className="botao-secundario">
          Explorar os 513
        </Link>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════

/**
 * O primeiro colocado, em tamanho grande.
 *
 * ⚠️ Destaque de tamanho, ⛔ não de cor: a paleta é única para todos os parlamentares
 * (RNF-16). E o número vem com a base junto, como em toda parte.
 */
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
